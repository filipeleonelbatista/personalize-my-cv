export const DOSSIER_ENV_KEYS = [
  "NEXT_PUBLIC_TAVILY_API_KEY",
  "NEXT_PUBLIC_BRAVE_API_KEY",
  "NEXT_PUBLIC_JINA_API_KEY",
  "NEXT_PUBLIC_YOUTUBE_API_KEY",
  "NEXT_PUBLIC_GITHUB_TOKEN",
] as const;

export type DossierResearchConfig = {
  enabled: boolean;
  tavilyKey: string;
  braveKey: string;
  jinaKey: string;
  youtubeKey: string;
  githubToken: string;
  missingKeys: string[];
};

export function getDossierResearchConfig(): DossierResearchConfig {
  const enabledFlag = process.env.NEXT_PUBLIC_IS_DOSSIE_ENABLED === "true";
  const credentials: Record<(typeof DOSSIER_ENV_KEYS)[number], string> = {
    NEXT_PUBLIC_TAVILY_API_KEY: process.env.NEXT_PUBLIC_TAVILY_API_KEY?.trim() ?? "",
    NEXT_PUBLIC_BRAVE_API_KEY: process.env.NEXT_PUBLIC_BRAVE_API_KEY?.trim() ?? "",
    NEXT_PUBLIC_JINA_API_KEY: process.env.NEXT_PUBLIC_JINA_API_KEY?.trim() ?? "",
    NEXT_PUBLIC_YOUTUBE_API_KEY: process.env.NEXT_PUBLIC_YOUTUBE_API_KEY?.trim() ?? "",
    NEXT_PUBLIC_GITHUB_TOKEN: process.env.NEXT_PUBLIC_GITHUB_TOKEN?.trim() ?? "",
  };
  const missingKeys = DOSSIER_ENV_KEYS.filter((name) => !credentials[name]);

  return {
    enabled: enabledFlag && missingKeys.length === 0,
    tavilyKey: credentials.NEXT_PUBLIC_TAVILY_API_KEY,
    braveKey: credentials.NEXT_PUBLIC_BRAVE_API_KEY,
    jinaKey: credentials.NEXT_PUBLIC_JINA_API_KEY,
    youtubeKey: credentials.NEXT_PUBLIC_YOUTUBE_API_KEY,
    githubToken: credentials.NEXT_PUBLIC_GITHUB_TOKEN,
    missingKeys: [...(enabledFlag ? [] : ["NEXT_PUBLIC_IS_DOSSIE_ENABLED"]), ...missingKeys],
  };
}

export function isDossierEnabled(): boolean {
  return getDossierResearchConfig().enabled;
}
