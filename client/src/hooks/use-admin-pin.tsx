import { createContext, useContext, useRef, useState, useCallback, useEffect, ReactNode } from "react";
import { AdminPinDialog } from "@/components/AdminPinDialog";
import { registerPinHandler } from "@/lib/pinGate";

// Short-lived PIN cache — allows concurrent requests within the same mutation
// (e.g. PATCH profile + PATCH role fired in parallel) to share one dialog.
interface PinCache { pin: string; expiresAt: number; }
const PIN_CACHE_TTL_MS = 8_000; // 8 seconds

// ── Admin PIN Context ──────────────────────────────────────────────────────
// Provides a promise-based requestPin() function. apiRequest() in queryClient.ts
// calls invokeRequestPin() from pinGate, which delegates to this provider.
// The dialog appears automatically for any /api/admin/* PIN challenge.
// No individual admin page needs to be modified.
// ──────────────────────────────────────────────────────────────────────────

interface PinState {
  open: boolean;
  error: string | null;
  locked: boolean;
  retryAfterMs?: number;
  attemptsLeft?: number;
}

interface AdminPinContextValue {
  requestPin: () => Promise<string>;
  reportPinError: (msg: string, opts?: { locked?: boolean; retryAfterMs?: number; attemptsLeft?: number }) => void;
  reportPinSuccess: () => void;
}

const AdminPinContext = createContext<AdminPinContextValue | null>(null);

export function AdminPinProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PinState>({
    open: false,
    error: null,
    locked: false,
  });

  const resolveRef = useRef<((pin: string) => void) | null>(null);
  const rejectRef = useRef<((reason?: unknown) => void) | null>(null);
  // Extra waiters queued when dialog is already open (parallel requests in one mutation)
  const waitersRef = useRef<Array<(pin: string) => void>>([]);
  const waiterRejectsRef = useRef<Array<(reason?: unknown) => void>>([]);
  // Short-lived PIN cache so back-to-back requests reuse the PIN without reopening dialog
  const pinCacheRef = useRef<PinCache | null>(null);

  const requestPin = useCallback((): Promise<string> => {
    // Return cached PIN if still fresh (handles concurrent requests in the same mutation)
    if (pinCacheRef.current && Date.now() < pinCacheRef.current.expiresAt) {
      return Promise.resolve(pinCacheRef.current.pin);
    }
    // Dialog already open — queue onto the existing promise instead of overwriting resolveRef
    if (resolveRef.current !== null) {
      return new Promise((resolve, reject) => {
        waitersRef.current.push(resolve);
        waiterRejectsRef.current.push(reject);
      });
    }
    return new Promise((resolve, reject) => {
      resolveRef.current = resolve;
      rejectRef.current = reject;
      setState({ open: true, error: null, locked: false });
    });
  }, []);

  const reportPinError = useCallback((
    msg: string,
    opts?: { locked?: boolean; retryAfterMs?: number; attemptsLeft?: number }
  ) => {
    // Invalidate cache on wrong PIN so the user must re-enter
    pinCacheRef.current = null;
    setState(s => ({
      ...s,
      open: true,
      error: msg,
      locked: opts?.locked ?? false,
      retryAfterMs: opts?.retryAfterMs,
      attemptsLeft: opts?.attemptsLeft,
    }));
  }, []);

  const reportPinSuccess = useCallback(() => {
    setState({ open: false, error: null, locked: false });
    resolveRef.current = null;
    rejectRef.current = null;
  }, []);

  // Register this provider as the global PIN handler for apiRequest
  useEffect(() => {
    const unregister = registerPinHandler(requestPin, reportPinError, reportPinSuccess);
    return unregister;
  }, [requestPin, reportPinError, reportPinSuccess]);

  const handleSubmit = (pin: string) => {
    // Cache PIN briefly so concurrent requests in the same mutation don't reopen the dialog
    pinCacheRef.current = { pin, expiresAt: Date.now() + PIN_CACHE_TTL_MS };
    resolveRef.current?.(pin);
    // Resolve all queued waiters with the same PIN
    for (const resolve of waitersRef.current) resolve(pin);
    waitersRef.current = [];
    waiterRejectsRef.current = [];
  };

  const handleCancel = () => {
    setState({ open: false, error: null, locked: false });
    rejectRef.current?.(new Error("PIN_CANCELLED"));
    for (const reject of waiterRejectsRef.current) reject(new Error("PIN_CANCELLED"));
    waitersRef.current = [];
    waiterRejectsRef.current = [];
    resolveRef.current = null;
    rejectRef.current = null;
  };

  return (
    <AdminPinContext.Provider value={{ requestPin, reportPinError, reportPinSuccess }}>
      {children}
      <AdminPinDialog
        open={state.open}
        error={state.error}
        locked={state.locked}
        retryAfterMs={state.retryAfterMs}
        attemptsLeft={state.attemptsLeft}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
    </AdminPinContext.Provider>
  );
}

export function useAdminPin(): AdminPinContextValue {
  const ctx = useContext(AdminPinContext);
  if (!ctx) throw new Error("useAdminPin must be used inside AdminPinProvider");
  return ctx;
}
