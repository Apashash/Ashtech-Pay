// ── Admin-aware API request with PIN support ────────────────────────────────
// This module provides apiRequestWithPin() which wraps the standard apiRequest
// and automatically handles PIN challenges from the server:
//
//   428 { pinRequired }  → calls requestPin() to get the PIN, retries with header
//   403 { pinInvalid }   → reports the error back to the dialog so user can retry
//   423 { pinLocked }    → shows the lockout screen in the dialog
//
// Usage in admin pages:
//   const { apiRequestWithPin } = useAdminApiRequest();
//   const res = await apiRequestWithPin("PATCH", "/api/admin/...", body);
//
// No changes needed to individual pages — just swap apiRequest → apiRequestWithPin
// for any mutation that goes to /api/admin/*.
// ──────────────────────────────────────────────────────────────────────────────

import { getAuthHeaders } from "./queryClient";

export type PinRequestFn = () => Promise<string>;
export type PinErrorFn = (msg: string, opts?: { locked?: boolean; retryAfterMs?: number; attemptsLeft?: number }) => void;
export type PinSuccessFn = () => void;

async function throwIfResNotOk(res: Response): Promise<void> {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    try {
      const json = JSON.parse(text);
      throw Object.assign(new Error(json.message || text), json);
    } catch (e) {
      if (e instanceof SyntaxError) throw new Error(text);
      throw e;
    }
  }
}

export async function adminApiRequest(
  method: string,
  url: string,
  data: unknown | undefined,
  pin: string | null,
): Promise<Response> {
  const headers: Record<string, string> = {
    ...getAuthHeaders() as Record<string, string>,
    "X-Requested-With": "XMLHttpRequest",
    ...(data ? { "Content-Type": "application/json" } : {}),
    ...(pin ? { "X-Admin-Pin": pin } : {}),
  };

  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  return res;
}

// Main function that orchestrates PIN dialog + retry
export async function apiRequestWithPin(
  method: string,
  url: string,
  data: unknown | undefined,
  requestPin: PinRequestFn,
  reportPinError: PinErrorFn,
  reportPinSuccess: PinSuccessFn,
): Promise<Response> {
  // First attempt: no PIN
  let res = await adminApiRequest(method, url, data, null);

  // If PIN is not required (feature disabled or route exempt), just return
  if (res.status !== 428 && res.status !== 403 && res.status !== 423) {
    await throwIfResNotOk(res);
    return res;
  }

  const body = await res.clone().json().catch(() => ({}));

  if (!body.pinRequired && !body.pinInvalid && !body.pinLocked) {
    // Normal 403 error (not PIN related)
    await throwIfResNotOk(res);
    return res;
  }

  // Handle locked state upfront
  if (body.pinLocked) {
    let pin: string;
    try {
      pin = await requestPin();
    } catch {
      throw new Error("PIN_CANCELLED");
    }
    reportPinError(body.message || "Trop de tentatives. Réessayez plus tard.", {
      locked: true,
      retryAfterMs: body.retryAfterMs,
    });
    throw new Error("PIN_CANCELLED");
  }

  // PIN required — enter retry loop
  while (true) {
    let pin: string;
    try {
      pin = await requestPin();
    } catch {
      throw new Error("PIN_CANCELLED");
    }

    res = await adminApiRequest(method, url, data, pin);

    if (res.ok) {
      reportPinSuccess();
      return res;
    }

    const errBody = await res.clone().json().catch(() => ({}));

    if (res.status === 403 && errBody.pinInvalid) {
      reportPinError(errBody.message || "Code PIN incorrect.", {
        attemptsLeft: errBody.attemptsLeft,
      });
      // Loop continues — dialog stays open with error
      continue;
    }

    if (res.status === 423 && errBody.pinLocked) {
      reportPinError(errBody.message || "Trop de tentatives. Compte bloqué 20 min.", {
        locked: true,
        retryAfterMs: errBody.retryAfterMs,
      });
      throw new Error("PIN_LOCKED");
    }

    // Some other error — surface it normally
    reportPinSuccess(); // close dialog
    await throwIfResNotOk(res);
    return res;
  }
}
