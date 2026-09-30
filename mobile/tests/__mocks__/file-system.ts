// Test double for expo-file-system (aliased in vitest.config.ts).
export const documentDirectory = "/mock-documents/";
export const EncodingType = { Base64: "base64", UTF8: "utf8" };
const files = new Map<string, string>();
export async function getInfoAsync(uri: string): Promise<{ exists: boolean; size: number; uri: string }> {
  const c = files.get(uri);
  return { exists: c !== undefined, size: c?.length ?? 0, uri };
}
export async function makeDirectoryAsync(): Promise<void> {}
export async function copyAsync({ from, to }: { from: string; to: string }): Promise<void> {
  files.set(to, files.get(from) ?? "");
}
export async function readAsStringAsync(): Promise<string> {
  return "";
}
export async function writeAsStringAsync(uri: string, contents: string): Promise<void> {
  files.set(uri, contents);
}
export function __getFiles(): Map<string, string> {
  return files;
}
