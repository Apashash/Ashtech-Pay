export const CHUNK_RELOAD_ATTEMPT_KEY = "ashtech_chunk_reload_attempt";

export function clearChunkReloadAttempt(): void {
  try {
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(CHUNK_RELOAD_ATTEMPT_KEY);
    }
  } catch {
    // Storage can be unavailable in private browsing.
  }
}