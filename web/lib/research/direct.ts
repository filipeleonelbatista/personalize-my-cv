import { fetchWithTimeout, type ReadDoc } from "./providers";

export type CnpjData = {
  razaoSocial: string | null; nomeFantasia: string | null; openedAt: string | null;
  cnae: string | null; porte: string | null; capitalSocial: string | null;
  partners: { name: string; role: string; since: string | null }[];
};

export async function fetchCnpj(cnpj: string): Promise<CnpjData | null> {
  const digits = cnpj.replace(/\D/g, "");
  if (digits.length !== 14) return null;
  const res = await fetchWithTimeout(`https://brasilapi.com.br/api/cnpj/v1/${digits}`, {}, 20_000);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`brasilapi ${res.status}`);
  const j = (await res.json()) as Record<string, unknown>;
  const qsa = (j.qsa as { nome_socio?: string; qualificacao_socio?: string; data_entrada_sociedade?: string }[] | undefined) ?? [];
  return {
    razaoSocial: (j.razao_social as string) ?? null,
    nomeFantasia: (j.nome_fantasia as string) ?? null,
    openedAt: (j.data_inicio_atividade as string) ?? null,
    cnae: [j.cnae_fiscal, j.cnae_fiscal_descricao].filter(Boolean).join(" — ") || null,
    porte: (j.porte as string) ?? null,
    capitalSocial: j.capital_social != null ? String(j.capital_social) : null,
    partners: qsa.map((s) => ({ name: s.nome_socio ?? "", role: s.qualificacao_socio ?? "", since: s.data_entrada_sociedade ?? null })).filter((p) => p.name),
  };
}

export async function fetchGithubEvents(org: string, token?: string): Promise<ReadDoc | null> {
  const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetchWithTimeout(`https://api.github.com/orgs/${encodeURIComponent(org)}/events/public?per_page=30`, { headers }, 20_000);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`github ${res.status}`);
  const events = (await res.json()) as { type?: string; created_at?: string; repo?: { name?: string }; payload?: Record<string, unknown> }[];
  const lines: string[] = [];
  for (const e of events) {
    if (e.type === "PushEvent") {
      const commits = (e.payload?.commits as { sha?: string; message?: string }[] | undefined) ?? [];
      const c = commits[0];
      if (c) lines.push(`${e.created_at ?? ""} | ${c.message ?? ""} | https://github.com/${e.repo?.name ?? ""}/commit/${c.sha ?? ""}`);
    } else if (e.type === "ReleaseEvent") {
      const rel = e.payload?.release as { name?: string; html_url?: string } | undefined;
      if (rel?.html_url) lines.push(`${e.created_at ?? ""} | ${rel.name ?? "release"} | ${rel.html_url}`);
    }
  }
  if (!lines.length) return null;
  return { url: `https://github.com/${org}`, title: `GitHub ${org}`, publishedAt: null, content: lines.join("\n"), provider: "direct" };
}

export async function fetchYoutubePosts(channelId: string, key: string): Promise<ReadDoc | null> {
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${encodeURIComponent(channelId)}&order=date&type=video&maxResults=5&key=${encodeURIComponent(key)}`;
  const res = await fetchWithTimeout(url, {}, 20_000);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`youtube ${res.status}`);
  const j = (await res.json()) as { items?: { snippet?: { publishedAt?: string; title?: string; description?: string }; id?: { videoId?: string } }[] };
  const lines = (j.items ?? []).filter((it) => it.id?.videoId).map((it) => `${it.snippet?.publishedAt ?? ""} | ${it.snippet?.title ?? ""} | https://www.youtube.com/watch?v=${it.id?.videoId ?? ""}`);
  if (!lines.length) return null;
  return { url: `https://www.youtube.com/channel/${channelId}`, title: `YouTube ${channelId}`, publishedAt: null, content: lines.join("\n"), provider: "direct" };
}
