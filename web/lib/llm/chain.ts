import { chatJsonGemini, geminiModels } from "./gemini";

export type Provider = string; // "gemini:<model>"

export async function generateJson(system: string, user: string): Promise<{ data: unknown; provider: Provider }> {
  const errs: string[] = [];
  for (const model of geminiModels()) {
    try {
      return { data: await chatJsonGemini(system, user, model), provider: `gemini:${model}` };
    } catch (e) {
      errs.push(`${model}: ${(e as Error).message}`);
    }
  }
  throw new Error(errs.join(" | "));
}
