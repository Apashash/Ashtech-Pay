import rateLimit from "express-rate-limit";
import type { Request, Response } from "express";

// ─── Helper: extract real client IP (handles proxies / Apache / Nginx / IPv6) ─
function getIp(req: Request): string {
  const fwd = req.headers["x-forwarded-for"];
  if (fwd) {
    const raw = Array.isArray(fwd) ? fwd[0] : fwd;
    return raw.split(",")[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || "unknown";
}

function reject(res: Response, msg: string, retryAfterSec = 60) {
  res.setHeader("Retry-After", String(retryAfterSec));
  res.status(429).json({ message: msg });
}

// validate: keyGeneratorIpFallback désactivé car on gère déjà l'IPv6 via X-Forwarded-For
const sharedValidate = { keyGeneratorIpFallback: false };

// ─── 1. Global : 50 requêtes / minute / IP ───────────────────────────────────
export const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getIp,
  validate: sharedValidate,
  skip: (req) => {
    if (!req.path.startsWith("/api")) return true;
    if (req.path === "/api/auth/ping") return true;
    if (req.path === "/api/sse") return true;
    return false;
  },
  handler: (_req, res) =>
    reject(res, "Trop de requêtes. Réessayez dans une minute.", 60),
});

// ─── 2. Register : 5 créations de compte / minute / IP ──────────────────────
export const registerLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getIp,
  validate: sharedValidate,
  handler: (_req, res) =>
    reject(
      res,
      "Trop de tentatives d'inscription. Réessayez dans une minute.",
      60
    ),
});

// ─── 3. Retraits : 10 requêtes / minute / IP ────────────────────────────────
export const withdrawalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getIp,
  validate: sharedValidate,
  handler: (_req, res) =>
    reject(
      res,
      "Trop de demandes de retrait. Réessayez dans une minute.",
      60
    ),
});

// ─── 4. Dépôts / liens de paiement : 20 / minute / IP ───────────────────────
export const depositLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getIp,
  validate: sharedValidate,
  handler: (_req, res) =>
    reject(res, "Trop de demandes de dépôt. Réessayez dans une minute.", 60),
});

// ─── 5. Transferts : 15 / minute / IP ───────────────────────────────────────
export const transferLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getIp,
  validate: sharedValidate,
  handler: (_req, res) =>
    reject(
      res,
      "Trop de demandes de transfert. Réessayez dans une minute.",
      60
    ),
});

// ─── 6. Mot de passe oublié : 5 / 15 minutes / IP ───────────────────────────
export const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getIp,
  validate: sharedValidate,
  handler: (_req, res) =>
    reject(
      res,
      "Trop de demandes de réinitialisation. Réessayez dans 15 minutes.",
      900
    ),
});

// ─── 7. API publique (liens de paiement, checkout) : 30 / minute / IP ────────
export const publicPayLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getIp,
  validate: sharedValidate,
  handler: (_req, res) =>
    reject(res, "Trop de requêtes. Réessayez dans une minute.", 60),
});

// ─── 8. Login : 10 tentatives / 15 min / IP (couche express-rate-limit) ──────
// Complète le rate limiter custom in-memory déjà présent dans routes.ts.
// Double couche : l'un protège au niveau middleware, l'autre suit par identifiant.
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getIp,
  validate: sharedValidate,
  handler: (_req, res) =>
    reject(
      res,
      "Trop de tentatives de connexion. Réessayez dans 15 minutes.",
      900
    ),
});

// ─── 9. Confirmation OTP (AfribaPay) : 5 tentatives / 10 min / IP ────────────
// Empêche le brute-force du code OTP à 6 chiffres (1 000 000 combinaisons).
export const otpConfirmLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getIp,
  validate: sharedValidate,
  handler: (_req, res) =>
    reject(
      res,
      "Trop de tentatives OTP. Réessayez dans 10 minutes.",
      600
    ),
});

// ─── 10. Actions admin financières : 30 / minute / IP (couche supplémentaire) ─
// Les endpoints admin sont déjà protégés par requireAdmin + OTP, mais cette
// couche empêche le flooding automatisé même avec un token admin compromis.
export const adminActionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getIp,
  validate: sharedValidate,
  handler: (_req, res) =>
    reject(res, "Trop d'actions admin. Réessayez dans une minute.", 60),
});
