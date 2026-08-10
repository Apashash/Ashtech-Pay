import rateLimit from "express-rate-limit";
import type { Request, Response } from "express";
import crypto from "crypto";

// ─── Helper: extract real client IP ──────────────────────────────────────────
// FIX-6: maintenant que app.set("trust proxy", 1) est configuré dans index.ts,
// Express résout lui-même req.ip depuis X-Forwarded-For de façon sécurisée.
// On ne parse plus manuellement X-Forwarded-For : un client ne peut pas forger req.ip.
function getIp(req: Request): string {
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

// External merchant API: rate-limit by API key when present, with IP as a
// secondary partition. The raw key is never retained by the limiter.
export const apiV1Limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const auth = String(req.headers.authorization || "");
    const key = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    const identity = key
      ? `key:${crypto.createHash("sha256").update(key).digest("hex").slice(0, 24)}`
      : `ip:${getIp(req)}`;
    return identity;
  },
  validate: sharedValidate,
  handler: (_req, res) =>
    reject(res, "Trop de requêtes API. Réessayez dans une minute.", 60),
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

// ─── 11. Webhooks prestataires : 120 / minute / IP ───────────────────────────
// Bloque le flooding de faux callbacks de paiement.
export const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getIp,
  validate: sharedValidate,
  handler: (_req, res) =>
    reject(res, "Trop de requêtes webhook. Réessayez dans une minute.", 60),
});

// ─── 12. Statut de transaction public : 30 / minute / IP ────────────────────
// Empêche l'énumération de références de transactions.
export const transactionStatusLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getIp,
  validate: sharedValidate,
  handler: (_req, res) =>
    reject(res, "Trop de requêtes. Réessayez dans une minute.", 60),
});

// ─── 13. API marchands hébergés : 20 / minute / IP ──────────────────────────
// Limite la création de sessions de paiement hébergées.
export const hostedPaymentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getIp,
  validate: sharedValidate,
  handler: (_req, res) =>
    reject(res, "Trop de demandes de paiement hébergé. Réessayez dans une minute.", 60),
});

// ─── 14. Admin OTP request : 3 / 15 minutes / IP ────────────────────────────
// VULN-A2: prevents email/Telegram flooding and code invalidation loop.
export const adminOtpRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getIp,
  validate: sharedValidate,
  handler: (_req, res) =>
    reject(res, "Trop de demandes de code OTP. Réessayez dans 15 minutes.", 900),
});

// ─── 15. Bot banner images : 10 / minute / IP ───────────────────────────────
// VULN-A4: prevents CPU DoS via repeated sharp image generation.
export const bannerLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getIp,
  validate: sharedValidate,
  handler: (_req, res) =>
    reject(res, "Trop de requêtes. Réessayez dans une minute.", 60),
});

// ─── 16. Endpoints publics d'information : 20 / minute / IP ─────────────────
// Couvre les routes publiques sans auth (/api/public/*, /api/contact-info, etc.)
// qui ne sont pas couvertes par un limiter dédié plus strict.
// Le global limiter (50/min) reste actif en plus — cette couche est plus serrée.
export const publicInfoLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getIp,
  validate: sharedValidate,
  handler: (_req, res) =>
    reject(res, "Trop de requêtes. Réessayez dans une minute.", 60),
});

// ─── 17. Proxy image / geo-lookup : 15 / minute / IP ────────────────────────
// Protège les endpoints qui font des appels HTTP vers des services externes
// (ip-api.com, Supabase storage) — évite le flooding de ressources externes.
export const externalProxyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getIp,
  validate: sharedValidate,
  handler: (_req, res) =>
    reject(res, "Trop de requêtes. Réessayez dans une minute.", 60),
});
