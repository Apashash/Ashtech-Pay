import { createContext, useContext, useRef, useState, useCallback, useEffect, ReactNode } from "react";
import { AdminPinDialog } from "@/components/AdminPinDialog";
import { registerPinHandler } from "@/lib/pinGate";

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

  const requestPin = useCallback((): Promise<string> => {
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
    resolveRef.current?.(pin);
  };

  const handleCancel = () => {
    setState({ open: false, error: null, locked: false });
    rejectRef.current?.(new Error("PIN_CANCELLED"));
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
