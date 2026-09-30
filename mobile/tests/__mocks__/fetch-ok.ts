// Test double: fetch resolving a minimal Gemini JSON response.
export default async function fetchOk(): Promise<unknown> {
  return {
    ok: true,
    json: async () => ({ candidates: [{ content: { parts: [{ text: '{"ok":1}' }] } }] }),
  };
}
