// ── Global PIN Gate ────────────────────────────────────────────────────────
// Module-level PIN handler registry.
// AdminPinProvider registers a handler on mount; apiRequest calls it
// transparently whenever the server returns a PIN challenge.
// This allows zero changes to individual admin pages.
// ──────────────────────────────────────────────────────────────────────────

export interface PinResponse {
  pin: string;
}

export type PinRequestHandler = () => Promise<string>;
export type PinErrorReporter = (msg: string, opts?: { locked?: boolean; retryAfterMs?: number; attemptsLeft?: number }) => void;
export type PinSuccessReporter = () => void;

let _requestPin: PinRequestHandler | null = null;
let _reportPinError: PinErrorReporter | null = null;
let _reportPinSuccess: PinSuccessReporter | null = null;

export function registerPinHandler(
  requestPin: PinRequestHandler,
  reportError: PinErrorReporter,
  reportSuccess: PinSuccessReporter,
): () => void {
  _requestPin = requestPin;
  _reportPinError = reportError;
  _reportPinSuccess = reportSuccess;
  return () => {
    _requestPin = null;
    _reportPinError = null;
    _reportPinSuccess = null;
  };
}

export function hasPinHandler(): boolean {
  return _requestPin !== null;
}

export async function invokeRequestPin(): Promise<string> {
  if (!_requestPin) throw new Error("No PIN handler registered");
  return _requestPin();
}

export function invokePinError(msg: string, opts?: { locked?: boolean; retryAfterMs?: number; attemptsLeft?: number }): void {
  _reportPinError?.(msg, opts);
}

export function invokePinSuccess(): void {
  _reportPinSuccess?.();
}
