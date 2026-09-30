// mobile/lib/ai-log.ts — persistent log of AI generation/extraction
// requests (AsyncStorage pmcv:ai-log, capped at 100, newest last).
import AsyncStorage from "@react-native-async-storage/async-storage";
import { z } from "zod";

export const AiLogEntrySchema = z.object({
  id: z.string().min(1),
  at: z.string(),
  label: z.string().min(1),
  provider: z.string().default(""),
  ms: z.number().int().min(0),
  ok: z.boolean(),
  error: z.string().default(""),
});
export type AiLogEntry = z.infer<typeof AiLogEntrySchema>;

const KEY = "pmcv:ai-log";
const CAP = 100;
let seq = 0;

export async function loadAiLog(): Promise<AiLogEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const arr: unknown = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    const out: AiLogEntry[] = [];
    for (const item of arr) {
      try {
        out.push(AiLogEntrySchema.parse(item));
      } catch {
        /* descarta entrada inválida */
      }
    }
    return out.reverse();
  } catch {
    return [];
  }
}

export async function appendAiLog(e: Omit<AiLogEntry, "id" | "at" | "error"> & { at?: string; error?: string }): Promise<AiLogEntry> {
  seq += 1;
  const entry: AiLogEntry = AiLogEntrySchema.parse({
    error: "",
    ...e,
    id: `${Date.now().toString(36)}-${seq.toString(36)}`,
    at: e.at ?? new Date().toISOString(),
  });
  // Mirror to the Expo terminal in dev (Metro forwards console to the CLI).
  try {
    const g = globalThis as unknown as { __DEV__?: boolean };
    if (g.__DEV__) {
      console.log(
        `[ai] ${entry.label} ${entry.provider || "—"} ${entry.ms}ms ${entry.ok ? "ok" : "FAIL"}${entry.error ? ` :: ${entry.error}` : ""}`,
      );
    }
  } catch {
    /* logging must never break the flow */
  }
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const arr: unknown = raw ? JSON.parse(raw) : [];
    const list = Array.isArray(arr) ? arr : [];
    list.push(entry);
    await AsyncStorage.setItem(KEY, JSON.stringify(list.slice(-CAP)));
  } catch {
    /* log é auxiliar: nunca quebra o fluxo principal */
  }
  return entry;
}

export async function clearAiLog(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
