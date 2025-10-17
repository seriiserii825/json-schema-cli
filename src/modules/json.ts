export function parseJsonSafe<T = unknown>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    try {
      const cleaned = text.replace(/^\uFEFF/, "").trim();
      return JSON.parse(cleaned) as T;
    } catch {
      return null;
    }
  }
}
