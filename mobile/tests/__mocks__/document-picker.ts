// Test doubles for native modules (aliased in vitest.config.ts).
export async function getDocumentAsync(): Promise<{ canceled: true; assets: null }> {
  return { canceled: true, assets: null };
}
