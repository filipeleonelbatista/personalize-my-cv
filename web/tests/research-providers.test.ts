import { afterEach, describe, expect, it, vi } from "vitest";
import { tavilySearch } from "@/lib/research/tavily";
import { jinaRead, parseReaderMeta } from "@/lib/research/jina";
import { fetchCnpj, fetchGithubEvents, fetchYoutubePosts } from "@/lib/research/direct";
import { BRAVE_ENABLED, braveSearch } from "@/lib/research/brave";

afterEach(() => vi.restoreAllMocks());

describe("tavily", () => {
  it("chama POST /search com o header de autorização e mapeia os hits", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      results: [{ url: "https://a.com/x", title: "A", content: "trecho", published_date: "2026-09-01" }],
    }), { status: 200, headers: { "content-type": "application/json" } }));
    const hits = await tavilySearch("acme", "tvly-1");
    const [url, init] = spy.mock.calls[0];
    expect(String(url)).toBe("https://api.tavily.com/search");
    expect(init?.method).toBe("POST");
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer tvly-1");
    expect(JSON.parse(String(init?.body))).toMatchObject({
      query: "acme",
      search_depth: "basic",
      include_published_date: true,
      include_raw_content: false,
      topic: "general",
      max_results: 8,
    });
    expect(hits[0]).toMatchObject({ url: "https://a.com/x", title: "A", snippet: "trecho" });
  });

  it("propaga 401 como erro", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("nope", { status: 401 }));
    await expect(tavilySearch("acme", "bad")).rejects.toThrow(/401/);
  });
});

describe("jina", () => {
  it("extrai Title e Published Time do cabeçalho", () => {
    const text = "Title: Acme\n\nURL Source: https://a.com\n\nPublished Time: Tue, 01 Sep 2026 10:00:00 GMT\n\nMarkdown aqui";
    expect(parseReaderMeta(text)).toEqual({ title: "Acme", publishedAt: "2026-09-01" });
  });

  it("lê a página e devolve ReadDoc", async () => {
    // A página precisa de ≥200 caracteres úteis: menos que isso é leitura falha (regra do task).
    const pagina = "conteúdo " + "Texto real sobre a empresa, párrafos com substância o bastante. ".repeat(4);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(`Title: Acme\n\nURL Source: https://a.com\n\nPublished Time: Tue, 01 Sep 2026 10:00:00 GMT\n\n${pagina}`, { status: 200 }));
    const doc = await jinaRead("https://a.com");
    expect(doc.provider).toBe("jina");
    expect(doc.publishedAt).toBe("2026-09-01");
    expect(doc.content).toContain("conteúdo");
  });

  it("não fabrica dia a partir de data parcial", () => {
    expect(parseReaderMeta("Title: X\n\nPublished Time: 2026-09").publishedAt).toBeNull();
    expect(parseReaderMeta("Title: X\n\nPublished Time: 2026").publishedAt).toBeNull();
  });

  it("mantém o dia declarado no timestamp com fuso (sem normalizar para UTC)", () => {
    expect(parseReaderMeta("Title: X\n\nPublished Time: 2026-09-01T23:30:00-03:00").publishedAt).toBe("2026-09-01");
  });

  it("mede os 200 caracteres úteis sem marcadores do reader", async () => {
    const textoReal = "x".repeat(190);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(`Title: T\n\nURL Source: https://a.com\n\nMarkdown Content:\n\n${textoReal}`, { status: 200 }));
    await expect(jinaRead("https://a.com")).rejects.toThrow();
  });

  it("trata 200 com corpo de erro como leitura FALHA (página bloqueada)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("Warning: target URL returned error 403", { status: 200 }));
    await expect(jinaRead("https://glassdoor.com/x")).rejects.toThrow(/blocked|error|warning/i);
  });

  it("trata corpo muito curto como leitura FALHA", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("ok", { status: 200 }));
    await expect(jinaRead("https://a.com")).rejects.toThrow();
  });
});

describe("direct: CNPJ", () => {
  it("monta a URL do BrasilAPI e mapeia os campos", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      razao_social: "ACME LTDA", nome_fantasia: "Acme", data_inicio_atividade: "2010-05-04",
      cnae_fiscal: 6201, cnae_fiscal_descricao: "Desenvolvimento de programas", porte: "DEMAIS",
      capital_social: 1000, qsa: [{ nome_socio: "JOÃO", qualificacao_socio: "Presidente", data_entrada_sociedade: "2010-05-04" }],
    }), { status: 200, headers: { "content-type": "application/json" } }));
    const data = await fetchCnpj("11.222.333/0001-81");
    expect(String(spy.mock.calls[0][0])).toBe("https://brasilapi.com.br/api/cnpj/v1/11222333000181");
    expect(data?.razaoSocial).toBe("ACME LTDA");
    expect(data?.partners[0]).toEqual({ name: "JOÃO", role: "Presidente", since: "2010-05-04" });
  });

  it("devolve null em 404", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 404 }));
    expect(await fetchCnpj("00000000000191")).toBeNull();
  });
});

describe("direct: GitHub", () => {
  it("monta linhas só de PushEvent e ReleaseEvent, ignorando WatchEvent", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify([
      { type: "PushEvent", created_at: "2026-09-01T10:00:00Z", repo: { name: "acme/web" }, payload: { commits: [{ sha: "abc123", message: "feat: x" }] } },
      { type: "ReleaseEvent", created_at: "2026-09-02T10:00:00Z", repo: { name: "acme/web" }, payload: { release: { name: "v1.0.0", html_url: "https://github.com/acme/web/releases/tag/v1.0.0" } } },
      { type: "WatchEvent", created_at: "2026-09-03T10:00:00Z", repo: { name: "acme/web" }, payload: {} },
    ]), { status: 200, headers: { "content-type": "application/json" } }));
    const doc = await fetchGithubEvents("acme");
    expect(doc).not.toBeNull();
    expect(doc!.provider).toBe("direct");
    expect(doc!.url).toBe("https://github.com/acme");
    const lines = doc!.content.split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe("2026-09-01T10:00:00Z | feat: x | https://github.com/acme/web/commit/abc123");
    expect(lines[1]).toBe("2026-09-02T10:00:00Z | v1.0.0 | https://github.com/acme/web/releases/tag/v1.0.0");
    expect(doc!.content).not.toContain("WatchEvent");
  });

  it("devolve null quando não há PushEvent/ReleaseEvent", async () => {
    const spy = vi.spyOn(globalThis, "fetch");
    spy.mockResolvedValueOnce(new Response(JSON.stringify([{ type: "WatchEvent", created_at: "2026-09-03T10:00:00Z", repo: { name: "acme/web" }, payload: {} }]), { status: 200, headers: { "content-type": "application/json" } }));
    expect(await fetchGithubEvents("acme")).toBeNull();
    spy.mockResolvedValueOnce(new Response(JSON.stringify({ items: [] }), { status: 200, headers: { "content-type": "application/json" } }));
    expect(await fetchYoutubePosts("UC1", "yt-key")).toBeNull();
  });
});

describe("direct: YouTube", () => {
  it("pede type=video, filtra itens sem videoId e monta URLs watch válidas", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      items: [
        { snippet: { publishedAt: "2026-09-01T00:00:00Z", title: "Vídeo 1" }, id: { videoId: "vid1" } },
        { snippet: { publishedAt: "2026-09-02T00:00:00Z", title: "Playlist" }, id: { playlistId: "PLx" } },
        { snippet: { publishedAt: "2026-09-03T00:00:00Z", title: "Vídeo 2" }, id: { videoId: "vid2" } },
      ],
    }), { status: 200, headers: { "content-type": "application/json" } }));
    const doc = await fetchYoutubePosts("UC123", "yt-key");
    expect(String(spy.mock.calls[0][0])).toContain("type=video");
    expect(doc).not.toBeNull();
    const lines = doc!.content.split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe("2026-09-01T00:00:00Z | Vídeo 1 | https://www.youtube.com/watch?v=vid1");
    expect(lines[1]).toBe("2026-09-03T00:00:00Z | Vídeo 2 | https://www.youtube.com/watch?v=vid2");
    expect(doc!.content).not.toContain("watch?v=|");
  });

  it("devolve null quando nenhum item tem videoId", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      items: [{ snippet: { publishedAt: "2026-09-02T00:00:00Z", title: "Playlist" }, id: { playlistId: "PLx" } }],
    }), { status: 200, headers: { "content-type": "application/json" } }));
    expect(await fetchYoutubePosts("UC123", "yt-key")).toBeNull();
  });
});

describe("brave", () => {
  it("está desligado por padrão (sem CORS liberado)", async () => {
    expect(BRAVE_ENABLED).toBe(false);
    await expect(braveSearch("acme", "key")).rejects.toThrow(/brave-cors-not-supported/);
  });
});
