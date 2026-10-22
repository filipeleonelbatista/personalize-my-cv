import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DOSSIER_ENV_KEYS, getDossierResearchConfig, isDossierEnabled } from "@/lib/research/config";

const configuredKeys = {
  NEXT_PUBLIC_TAVILY_API_KEY: "tavily",
  NEXT_PUBLIC_BRAVE_API_KEY: "brave",
  NEXT_PUBLIC_JINA_API_KEY: "jina",
  NEXT_PUBLIC_YOUTUBE_API_KEY: "youtube",
  NEXT_PUBLIC_GITHUB_TOKEN: "github",
} as const;

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_IS_DOSSIE_ENABLED", "true");
  for (const [name, value] of Object.entries(configuredKeys)) vi.stubEnv(name, value);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("dossier environment configuration", () => {
  it("enables the dossier only with the true flag and every configured credential", () => {
    expect(getDossierResearchConfig()).toMatchObject({
      enabled: true,
      tavilyKey: "tavily",
      braveKey: "brave",
      jinaKey: "jina",
      youtubeKey: "youtube",
      githubToken: "github",
      missingKeys: [],
    });
    expect(isDossierEnabled()).toBe(true);
  });

  it("requires each research credential, including whitespace-only values", () => {
    for (const name of DOSSIER_ENV_KEYS) {
      vi.stubEnv(name, "   ");
      const config = getDossierResearchConfig();
      expect(config.enabled, name).toBe(false);
      expect(config.missingKeys, name).toContain(name);
      vi.stubEnv(name, configuredKeys[name]);
    }
  });

  it("requires the flag to be the literal string true", () => {
    for (const value of ["", "false", "TRUE", "1"]) {
      vi.stubEnv("NEXT_PUBLIC_IS_DOSSIE_ENABLED", value);
      expect(isDossierEnabled(), value).toBe(false);
    }
  });
});
