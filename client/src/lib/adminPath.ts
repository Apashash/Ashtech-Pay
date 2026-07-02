declare global {
  interface Window {
    __ADMIN_PATH__?: string;
  }
}

const ADMIN_PATH_LS_KEY = "ashtech_ap";

/** Call on logout to prevent stale admin-path exposure on shared devices. */
export function clearAdminPathCache(): void {
  try { localStorage.removeItem(ADMIN_PATH_LS_KEY); } catch {}
}

/**
 * Returns the custom admin path.
 *
 * Priority:
 *  1. window.__ADMIN_PATH__ injected by the server at request time (freshest)
 *  2. localStorage cache set the last time the server injection was available
 *  3. Hard-coded "/admin" fallback
 *
 * Using localStorage as a fallback means that when the browser serves a cached
 * index.html (bypassing Node.js injection), the correct secret admin path is
 * still used instead of reverting to "/admin".
 */
export function getAdminPath(): string {
  const injected = window.__ADMIN_PATH__;

  if (injected && injected !== "/admin") {
    // Cache the injected value so future loads from browser cache can use it
    try { localStorage.setItem(ADMIN_PATH_LS_KEY, injected); } catch {}
    return injected;
  }

  // Fall back to the last known good value stored in localStorage.
  // Validate the cached value before using it: must be an absolute path that
  // starts with "/" and contains no protocol separators (defends against a
  // poisoned localStorage containing a javascript: or https:// URL).
  try {
    const cached = localStorage.getItem(ADMIN_PATH_LS_KEY);
    if (cached && cached !== "/admin" && cached.startsWith("/") && !cached.includes("://")) {
      return cached;
    }
  } catch {}

  return injected || "/admin";
}
