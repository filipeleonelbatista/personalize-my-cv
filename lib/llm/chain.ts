import { chatJsonZen } from "./zen";
import { chatJsonGemini } from "./gemini";
import { chatJsonOpenrouter } from "./openrouter";

export type Provider = "zen" | "gemini" | "openrouter";

export async function generateJson(system: string, user: string): Promise<{ data: unknown; provider: Provider }> {
  const errs: string[] = [];
  try {
    return { data: await chatJsonZen(system, user), provider: "zen" };
  } catch (e) {
    errs.push(`zen: ${(e as Error).message}`);
  }
  try {
    return { data: await chatJsonGemini(system, user), provider: "gemini" };
  } catch (e) {
    errs.push(`gemini: ${(e as Error).message}`);
  }
  try {
    return { data: await chatJsonOpenrouter(system, user), provider: "openrouter" };
  } catch (e) {
    errs.push(`openrouter: ${(e as Error).message}`);
  }
  throw new Error(errs.join(" | "));
}
