import { Request, Response, NextFunction } from "express";

// ── Admin PIN Protection ─────────────────────────────────────────────────────
// Every state-changing request to /api/admin/* MUST include the correct 4-digit
// PIN in the X-Admin-Pin header. The PIN is read from ADMIN_PIN_CODE env var.
//
// Anti-bypass hardening:
//  • Uses req.userId (set by the global auth middleware) — not a client-supplied value.
//  • If PIN is configured and req.userId is missing (unauthenticated) → 428.
//    requireAdmin will also reject, but we add this layer so the error is consistent.
//  • Empty or whitespace PIN values are rejected as wrong.
//  • Validates ADMIN_PIN_CODE is exactly 4 digits at startup.
//  • Constant-time comparison to prevent timing attacks.
//  • Lockout: 4 wrong attempts → 20 min per user ID.
//
// Responses:
//   428 { pinRequired: true }                      — header missing
//   403 { pinInvalid: true, attemptsLeft: N }      — wrong PIN
//   423 { pinLocked: true, retryAfterMs: N }       — locked out
// ────────────────────────────────────────────────────────────────────────────

import crypto from "crypto";

const MAX_ATTEMPTS = 4;
const LOCKOUT_MS = 20 * 60 * 1000; // 20 minutes

interface AttemptRecord {
  count: number;
  lockedUntil: number | null;
}

// Keyed by admin user ID — server-side, not forgeable by client
const attempts = new Map<string, AttemptRecord>();

// Auto-clean expired lockouts every 30 minutes
setInterval(() => {
  const now = Date.now();
  for (const [uid, rec] of attempts.entries()) {
    if (rec.lockedUntil !== null && now >= rec.lockedUntil) {
      attempts.delete(uid);
    }
  }
}, 30 * 60 * 1000);

function getRecord(userId: string): AttemptRecord {
  if (!attempts.has(userId)) {
    attempts.set(userId, { count: 0, lockedUntil: null });
  }
  return attempts.get(userId)!;
}

function resetRecord(userId: string): void {
  attempts.delete(userId);
}

// Constant-time string comparison — prevents timing attacks on PIN
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
}

// Routes exempt from PIN (already protected by OTP/TOTP or are auth flows)
const PIN_EXEMPT_EXACT = new Set([
  "/api/admin/request-otp",
  "/api/admin/verify-otp",
  "/api/admin/totp/setup",
  "/api/admin/totp/confirm",
  "/api/admin/totp/verify",
  "/api/admin/totp/disable",
  "/api/admin/impersonate/exit",
]);

// Validate ADMIN_PIN_CODE at module load
const configuredPin = (process.env.ADMIN_PIN_CODE || "").trim();
if (configuredPin && !/^\d{4}$/.test(configuredPin)) {
  console.error("[AdminPin] FATAL: ADMIN_PIN_CODE must be exactly 4 digits (0-9). Current value is invalid. PIN protection is DISABLED until fixed.");
}

const PIN_ACTIVE = configuredPin && /^\d{4}$/.test(configuredPin);

if (PIN_ACTIVE) {
  console.log("[AdminPin] 4-digit PIN protection ACTIVE for all admin mutations.");
} else {
  console.warn("[AdminPin] ADMIN_PIN_CODE not set or invalid — PIN protection DISABLED.");
}

export function requireAdminPin(req: Request, res: Response, next: NextFunction): void {
  // Only protect state-changing methods
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
    return next();
  }

  // PIN feature not configured — pass through (no-op)
  if (!PIN_ACTIVE) {
    return next();
  }

  const path = req.originalUrl.split("?")[0];

  // Exempt paths (OTP/TOTP auth flows)
  if (PIN_EXEMPT_EXACT.has(path)) {
    return next();
  }

  // req.userId is populated by the global auth middleware that runs before this
  // (app.use at line ~1574 in routes.ts). If it's absent, the user is not
  // authenticated — we still block with pinRequired so requireAdmin's 403 is consistent.
  const userId = (req as any).userId as string | undefined;

  if (!userId) {
    // Unauthenticated — return pinRequired; requireAdmin will also reject with 403
    res.status(428).json({
      pinRequired: true,
      message: "Authentification et code PIN requis.",
    });
    return;
  }

  const record = getRecord(userId);

  // ── Check lockout ─────────────────────────────────────────────────────────
  if (record.lockedUntil !== null) {
    const now = Date.now();
    if (now < record.lockedUntil) {
      const retryAfterMs = record.lockedUntil - now;
      res.status(423).json({
        pinLocked: true,
        message: `Trop de tentatives. Réessayez dans ${Math.ceil(retryAfterMs / 60000)} minute(s).`,
        retryAfterMs,
      });
      return;
    }
    // Lockout expired — reset
    resetRecord(userId);
  }

  // ── Check PIN presence ────────────────────────────────────────────────────
  const submittedPin = (req.headers["x-admin-pin"] as string | undefined || "").trim();

  if (!submittedPin) {
    res.status(428).json({
      pinRequired: true,
      message: "Code PIN requis pour effectuer cette action.",
    });
    return;
  }

  // ── Validate PIN format (must be 4 digits) ────────────────────────────────
  if (!/^\d{4}$/.test(submittedPin)) {
    res.status(403).json({
      pinInvalid: true,
      message: "Format de code PIN invalide (4 chiffres requis).",
      attemptsLeft: MAX_ATTEMPTS - getRecord(userId).count,
    });
    return;
  }

  // ── Compare PIN (constant-time) ───────────────────────────────────────────
  if (!safeEqual(submittedPin, configuredPin)) {
    const rec = getRecord(userId);
    rec.count += 1;

    if (rec.count >= MAX_ATTEMPTS) {
      rec.lockedUntil = Date.now() + LOCKOUT_MS;
      console.warn(`[AdminPin] LOCKOUT — userId=${userId} — ${MAX_ATTEMPTS} failed PIN attempts. Locked for 20 min.`);
      res.status(423).json({
        pinLocked: true,
        message: "Trop de tentatives incorrectes. Panneau admin bloqué pendant 20 minutes.",
        retryAfterMs: LOCKOUT_MS,
      });
      return;
    }

    const attemptsLeft = MAX_ATTEMPTS - rec.count;
    console.warn(`[AdminPin] Wrong PIN — userId=${userId} (${rec.count}/${MAX_ATTEMPTS} attempts)`);
    res.status(403).json({
      pinInvalid: true,
      message: `Code PIN incorrect. ${attemptsLeft} tentative${attemptsLeft > 1 ? "s" : ""} restante${attemptsLeft > 1 ? "s" : ""} avant blocage.`,
      attemptsLeft,
    });
    return;
  }

  // ── PIN correct ───────────────────────────────────────────────────────────
  resetRecord(userId);
  console.log(`[AdminPin] PIN verified — userId=${userId} path=${path}`);
  next();
}
