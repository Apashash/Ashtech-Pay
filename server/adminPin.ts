import { Request, Response, NextFunction } from "express";

// ── Admin PIN Protection ────────────────────────────────────────────────────
// Requires a 4-digit PIN (stored in ADMIN_PIN_CODE env var) for all sensitive
// admin mutations. Lockout: 4 failed attempts → 20 minutes.
//
// PIN is sent via X-Admin-Pin header (works for all HTTP methods).
// Server responds:
//   428 { pinRequired: true }   — header missing
//   403 { pinInvalid: true, attemptsLeft: N } — wrong PIN
//   423 { pinLocked: true, retryAfterMs: N }  — locked out
// ────────────────────────────────────────────────────────────────────────────

const MAX_ATTEMPTS = 4;
const LOCKOUT_MS = 20 * 60 * 1000; // 20 minutes

interface AttemptRecord {
  count: number;
  lockedUntil: number | null;
}

// Keyed by admin user ID
const attempts = new Map<string, AttemptRecord>();

function getRecord(userId: string): AttemptRecord {
  if (!attempts.has(userId)) {
    attempts.set(userId, { count: 0, lockedUntil: null });
  }
  return attempts.get(userId)!;
}

function resetRecord(userId: string): void {
  attempts.set(userId, { count: 0, lockedUntil: null });
}

// Routes that must NOT require the PIN (auth flows, TOTP, impersonate exit)
const PIN_EXEMPT_SUFFIXES = [
  "/api/admin/request-otp",
  "/api/admin/verify-otp",
  "/api/admin/totp/setup",
  "/api/admin/totp/confirm",
  "/api/admin/totp/verify",
  "/api/admin/totp/disable",
  "/api/admin/impersonate/exit",
  "/api/auth/admin-login-otp",
  "/api/auth/admin-panel-verify",
];

export function requireAdminPin(req: Request, res: Response, next: NextFunction): void {
  // Only apply to state-changing methods
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
    return next();
  }

  const path = req.originalUrl.split("?")[0];
  if (PIN_EXEMPT_SUFFIXES.some(s => path === s || path.startsWith(s + "/"))) {
    return next();
  }

  const configuredPin = process.env.ADMIN_PIN_CODE;
  if (!configuredPin) {
    // PIN not configured — allow through (feature disabled)
    return next();
  }

  const userId = (req as any).user?.id as string | undefined;
  if (!userId) {
    // Not authenticated — other middleware will handle it
    return next();
  }

  const record = getRecord(userId);

  // Check lockout
  if (record.lockedUntil !== null) {
    const now = Date.now();
    if (now < record.lockedUntil) {
      const retryAfterMs = record.lockedUntil - now;
      res.status(423).json({
        pinLocked: true,
        message: "Trop de tentatives incorrectes. Réessayez dans 20 minutes.",
        retryAfterMs,
      });
      return;
    } else {
      // Lockout expired — reset
      resetRecord(userId);
    }
  }

  const submittedPin = req.headers["x-admin-pin"] as string | undefined;

  if (!submittedPin) {
    res.status(428).json({
      pinRequired: true,
      message: "Code PIN requis pour effectuer cette action.",
    });
    return;
  }

  if (submittedPin !== configuredPin) {
    const rec = getRecord(userId);
    rec.count += 1;

    if (rec.count >= MAX_ATTEMPTS) {
      rec.lockedUntil = Date.now() + LOCKOUT_MS;
      console.warn(`[AdminPin] User ${userId} locked out for 20 minutes after ${MAX_ATTEMPTS} failed PIN attempts.`);
      res.status(423).json({
        pinLocked: true,
        message: `Trop de tentatives incorrectes. Compte bloqué pendant 20 minutes.`,
        retryAfterMs: LOCKOUT_MS,
      });
      return;
    }

    const attemptsLeft = MAX_ATTEMPTS - rec.count;
    console.warn(`[AdminPin] Wrong PIN for user ${userId} — ${rec.count}/${MAX_ATTEMPTS} attempts`);
    res.status(403).json({
      pinInvalid: true,
      message: `Code PIN incorrect. ${attemptsLeft} tentative${attemptsLeft > 1 ? "s" : ""} restante${attemptsLeft > 1 ? "s" : ""}.`,
      attemptsLeft,
    });
    return;
  }

  // PIN correct — reset attempts and continue
  resetRecord(userId);
  next();
}
