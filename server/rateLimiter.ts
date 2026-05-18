import rateLimit from "express-rate-limit";
import type { Request, Response } from "express";

// ─── Helper: extract real client IP (handles proxies) ────────────────────────
function getIp(req: Request): string {
  const fwd = req.headers["x-forwarded-for"];
  if (fwd) {
    const raw = Array.isArray(fwd) ? fwd[0] : fwd;
    return raw.split(",")[0].trim();
  }
  return req.ip || "unknown";
}

function reject(res: Response, msg: string, retryAfterSec = 60) {
  res.setHeader("Retry-After", String(retryAfterSec));
  res.status(429).json({ message: msg });
}

// ─── 1. Global : 50 requêtes / minute / IP ───────────────────────────────────
export const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => !req.path.startsWith("/api"),
  handler: (_req, res) =>
    reject(res, "Trop de requêtes. Réessayez dans une minute.", 60),
});

// ─── 2. Login : 5 tentatives / minute / IP ───────────────────────────────────
export const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) =>
    reject(
      res,
      "Trop de tentatives de connexion. Réessayez dans une minute.",
      60
    ),
});

// ─── 3. Register : 5 créations de compte / minute / IP ──────────────────────
export const registerLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) =>
    reject(
      res,
      "Trop de tentatives d'inscription. Réessayez dans une minute.",
      60
    ),
});

// ─── 4. Retraits : 10 requêtes / minute / IP ────────────────────────────────
export const withdrawalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) =>
    reject(
      res,
      "Trop de demandes de retrait. Réessayez dans une minute.",
      60
    ),
});

// ─── 5. Dépôts / liens de paiement : 20 / minute / IP ───────────────────────
export const depositLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) =>
    reject(res, "Trop de demandes de dépôt. Réessayez dans une minute.", 60),
});

// ─── 6. Transferts : 15 / minute / IP ───────────────────────────────────────
export const transferLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) =>
    reject(
      res,
      "Trop de demandes de transfert. Réessayez dans une minute.",
      60
    ),
});

// ─── 7. Mot de passe oublié : 5 / 15 minutes / IP ───────────────────────────
export const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) =>
    reject(
      res,
      "Trop de demandes de réinitialisation. Réessayez dans 15 minutes.",
      900
    ),
});

// ─── 8. API publique (liens de paiement, checkout) : 30 / minute / IP ────────
export const publicPayLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) =>
    reject(res, "Trop de requêtes. Réessayez dans une minute.", 60),
});
