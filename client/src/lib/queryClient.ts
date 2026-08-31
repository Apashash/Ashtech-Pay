import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { hasPinHandler, invokeRequestPin, invokePinError, invokePinSuccess } from "./pinGate";

// Token storage for authentication (workaround for blocked cookies in iframes)
const AUTH_TOKEN_KEY = 'ashtech_auth_token';

export function getAuthToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAuthToken(token: string): void {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function removeAuthToken(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

const ADMIN_OTP_TOKEN_KEY = 'ashtech_admin_otp_token';

export function setAdminOtpToken(token: string): void {
  localStorage.setItem(ADMIN_OTP_TOKEN_KEY, token);
}

export function getAdminOtpToken(): string | null {
  return localStorage.getItem(ADMIN_OTP_TOKEN_KEY);
}

export function removeAdminOtpToken(): void {
  localStorage.removeItem(ADMIN_OTP_TOKEN_KEY);
}

export function getAuthHeaders(): HeadersInit {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'X-Requested-With': 'XMLHttpRequest',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    try {
      const json = JSON.parse(text);
      if (json.vpnDetected && res.status === 403) {
        removeAuthToken();
        window.dispatchEvent(new CustomEvent("vpn-disconnect", { detail: { message: json.message } }));
      }
      if (json.sessionRevoked && res.status === 401) {
        removeAuthToken();
        window.dispatchEvent(new CustomEvent("force-logout", { detail: { retryAfter: json.retryAfter } }));
      }
      if (json.forceLogout && res.status === 403) {
        // Server destroyed the session — clear local token and redirect to login
        removeAuthToken();
        window.location.href = "/login?kicked=unauthorized";
        return;
      }
      if (json.ipBlocked && res.status === 403) {
        removeAuthToken();
        window.dispatchEvent(new CustomEvent("admin-ip-blocked", { detail: { message: json.message } }));
        window.location.href = "/login?kicked=ip";
      }
      if (json.totpRequired && res.status === 403) {
        // Admin TOTP session expired — save current path so we can return after verification
        sessionStorage.setItem("admin_verify_return", window.location.pathname + window.location.search);
        window.location.href = "/admin-panel-verify";
        return;
      }
      throw Object.assign(new Error(json.message || text), json);
    } catch (e) {
      if (e instanceof SyntaxError) {
        throw new Error(text);
      }
      throw e;
    }
  }
}

// ── Raw fetch helper (no PIN logic) ──────────────────────────────────────────
async function rawFetch(
  method: string,
  url: string,
  data: unknown | undefined,
  pin: string | null,
  signal?: AbortSignal,
): Promise<Response> {
  const headers: Record<string, string> = {
    ...getAuthHeaders() as Record<string, string>,
    "X-Requested-With": "XMLHttpRequest",
    ...(data ? { "Content-Type": "application/json" } : {}),
    ...(pin ? { "X-Admin-Pin": pin } : {}),
  };
  return fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
    signal,
  });
}

// ── Admin PIN challenge detection ────────────────────────────────────────────
function isPinChallenge(status: number, body: Record<string, unknown>): boolean {
  return (
    (status === 428 && !!body.pinRequired) ||
    (status === 403 && !!body.pinInvalid) ||
    (status === 423 && !!body.pinLocked)
  );
}

function isPinNotConfigured(status: number, body: Record<string, unknown>): boolean {
  return status === 503 && !!body.pinNotConfigured;
}

// ── apiRequest ────────────────────────────────────────────────────────────────
// For /api/admin/* mutations, transparently handles PIN challenges:
//   428 pinRequired → open dialog → retry with PIN header
//   403 pinInvalid  → show error in dialog → loop
//   423 pinLocked   → show lockout screen
export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
  options?: { signal?: AbortSignal },
): Promise<Response> {
  const isAdminRoute = url.startsWith("/api/admin/") || url.startsWith("/api/admin");
  const isStateChanging = method !== "GET" && method !== "HEAD" && method !== "OPTIONS";

  // First request — no PIN
  let res = await rawFetch(method, url, data, null, options?.signal);

  // Only intercept PIN challenges for admin routes with a registered handler
  if (!isAdminRoute || !isStateChanging || !hasPinHandler()) {
    await throwIfResNotOk(res);
    return res;
  }

  // Check if this is a PIN challenge
  const bodyText = await res.clone().text();
  let body: Record<string, unknown> = {};
  try { body = JSON.parse(bodyText); } catch { /* ignore */ }

  // 503 pinNotConfigured — admin PIN not set on the server
  if (isPinNotConfigured(res.status, body)) {
    throw new Error(
      String(body.message || "Le code PIN admin n'est pas configuré sur le serveur. Ajoutez ADMIN_PIN_CODE dans les variables d'environnement.")
    );
  }

  if (!isPinChallenge(res.status, body)) {
    await throwIfResNotOk(res);
    return res;
  }

  // Handle locked state
  if (res.status === 423 && body.pinLocked) {
    let pin: string;
    try { pin = await invokeRequestPin(); } catch { throw new Error("PIN_CANCELLED"); }
    invokePinError(String(body.message || "Trop de tentatives."), {
      locked: true,
      retryAfterMs: body.retryAfterMs as number | undefined,
    });
    throw new Error("PIN_LOCKED");
  }

  // PIN required or invalid — enter retry loop
  while (true) {
    let pin: string;
    try {
      pin = await invokeRequestPin();
    } catch {
      throw new Error("PIN_CANCELLED");
    }

    res = await rawFetch(method, url, data, pin, options?.signal);

    if (res.ok) {
      invokePinSuccess();
      return res;
    }

    const errText = await res.clone().text();
    let errBody: Record<string, unknown> = {};
    try { errBody = JSON.parse(errText); } catch { /* ignore */ }

    if (res.status === 403 && errBody.pinInvalid) {
      invokePinError(String(errBody.message || "Code PIN incorrect."), {
        attemptsLeft: errBody.attemptsLeft as number | undefined,
      });
      continue; // loop — dialog stays open with error shown
    }

    if (res.status === 423 && errBody.pinLocked) {
      invokePinError(String(errBody.message || "Compte bloqué 20 minutes."), {
        locked: true,
        retryAfterMs: errBody.retryAfterMs as number | undefined,
      });
      throw new Error("PIN_LOCKED");
    }

    // Other error — close dialog, surface normally
    invokePinSuccess();
    await throwIfResNotOk(res);
    return res;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
      headers: getAuthHeaders(),
    });

    if (res.status === 401) {
      try {
        const body = await res.clone().json();
        if (body.sessionRevoked) {
          removeAuthToken();
          window.dispatchEvent(new CustomEvent("force-logout", { detail: { retryAfter: body.retryAfter } }));
        }
      } catch {}
      if (unauthorizedBehavior === "returnNull") return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
