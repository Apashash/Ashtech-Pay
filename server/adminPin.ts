import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

// ── Admin PIN Protection ─────────────────────────────────────────────────────
//
// RÈGLE DE SÉCURITÉ :
//   • ADMIN_PIN_CODE défini et valide (4 chiffres) → PIN requis pour toute
//     action admin (POST/PATCH/PUT/DELETE sur /api/admin/*).
//   • ADMIN_PIN_CODE absent ou invalide → toutes les actions admin sont
//     BLOQUÉES avec 503 lorsque la protection est activée.
//
// Cela garantit que supprimer ou oublier la variable d'env rend le panneau
// admin PLUS restrictif, jamais moins. Aucun moyen de contourner.
//
// Anti-bypass supplémentaires :
//   • userId lu depuis req.userId (injecté par le middleware auth serveur,
//     jamais fourni par le client).
//   • Comparaison à temps constant (crypto.timingSafeEqual) — anti timing attack.
//   • Verrouillage par userId (pas par IP) → changer d'IP ne déverrouille pas.
//   • Nettoyage automatique des verrous expirés (évite les fuites mémoire).
//   • Le PIN n'est jamais envoyé au client, jamais loggué en clair.
//
// Réponses HTTP :
//   503 { pinNotConfigured }   — ADMIN_PIN_CODE absent/invalide côté serveur
//   428 { pinRequired }        — header X-Admin-Pin manquant
//   403 { pinInvalid, attemptsLeft } — mauvais PIN
//   423 { pinLocked, retryAfterMs } — verrouillé 20 min
// ────────────────────────────────────────────────────────────────────────────

const MAX_ATTEMPTS = 4;
const LOCKOUT_MS = 20 * 60 * 1000; // 20 minutes
const ADMIN_PIN_PROTECTION_ENABLED = false;

interface AttemptRecord {
  count: number;
  lockedUntil: number | null;
}

// Keyed par userId — non forgeable par le client
const attempts = new Map<string, AttemptRecord>();

// Nettoyage automatique des verrous expirés toutes les 30 minutes
setInterval(() => {
  const now = Date.now();
  for (const [uid, rec] of attempts.entries()) {
    if (rec.lockedUntil !== null && now >= rec.lockedUntil) {
      attempts.delete(uid);
    }
  }
}, 30 * 60 * 1000).unref();

function getRecord(userId: string): AttemptRecord {
  if (!attempts.has(userId)) {
    attempts.set(userId, { count: 0, lockedUntil: null });
  }
  return attempts.get(userId)!;
}

function resetRecord(userId: string): void {
  attempts.delete(userId);
}

// Comparaison à temps constant — empêche les timing attacks
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
}

// Routes exemptées du PIN (flux d'authentification eux-mêmes)
const PIN_EXEMPT_EXACT = new Set([
  "/api/admin/impersonate/exit",
]);

// ── Lecture et validation du PIN au démarrage du module ──────────────────────
// Fait UNE SEULE FOIS au boot — le résultat est immuable pendant toute la
// durée de vie du processus. Aucune relecture à chaque requête.
const _rawPin = (process.env.ADMIN_PIN_CODE ?? "").trim();
const _pinValid = /^\d{4}$/.test(_rawPin);
const configuredPin: string | null = _pinValid ? _rawPin : null;

if (!ADMIN_PIN_PROTECTION_ENABLED) {
  console.log("[AdminPin] Protection PIN désactivée — les mutations admin ne demandent pas de PIN.");
} else if (configuredPin) {
  console.log("[AdminPin] ✅ Protection PIN ACTIVE — toutes les mutations admin exigent le code à 4 chiffres.");
} else if (_rawPin.length > 0) {
  // Clé présente mais format invalide — bloque quand même
  console.error("[AdminPin] ❌ ADMIN_PIN_CODE présent mais invalide (doit être exactement 4 chiffres). Mutations admin BLOQUÉES.");
} else {
  // Clé absente — comportement fail-secure : blocage total
  console.error("[AdminPin] ❌ ADMIN_PIN_CODE absent. Mutations admin BLOQUÉES (fail-secure). Configurez la variable d'environnement.");
}

// ── Middleware principal ──────────────────────────────────────────────────────
export type AdminPinCheck =
  | { ok: true }
  | { ok: false; status: 403 | 428 | 423 | 503; body: Record<string, unknown> };

export function isAdminPinProtectionEnabled(): boolean {
  return ADMIN_PIN_PROTECTION_ENABLED;
}

export function verifyAdminPinCode(userId: string, submittedPin: string): AdminPinCheck {
  if (!ADMIN_PIN_PROTECTION_ENABLED) {
    return { ok: true };
  }

  // ── FAIL-SECURE : PIN non configuré → BLOCAGE total ──────────────────────
  // Cette branche est atteinte si ADMIN_PIN_CODE est absent ou invalide.
  // Elle ne laisse JAMAIS passer — enlever la variable env rend le système
  // plus restrictif, jamais moins.
  if (!configuredPin) {
    return {
      ok: false,
      status: 503,
      body: {
        pinNotConfigured: true,
        message: "Le panneau d'administration est désactivé : ADMIN_PIN_CODE non configuré sur le serveur. Contactez l'administrateur système.",
      },
    };
  }

  const record = getRecord(userId);

  // ── Vérification du verrouillage ──────────────────────────────────────────
  if (record.lockedUntil !== null) {
    const now = Date.now();
    if (now < record.lockedUntil) {
      const retryAfterMs = record.lockedUntil - now;
      const minutes = Math.ceil(retryAfterMs / 60000);
      return {
        ok: false,
        status: 423,
        body: {
          pinLocked: true,
          message: `Trop de tentatives incorrectes. Réessayez dans ${minutes} minute${minutes > 1 ? "s" : ""}.`,
          retryAfterMs,
        },
      };
    }
    // Verrou expiré → réinitialisation
    resetRecord(userId);
  }

  // ── Présence du PIN ───────────────────────────────────────────────────────
  if (!submittedPin) {
    return {
      ok: false,
      status: 428,
      body: {
        pinRequired: true,
        message: "Code PIN requis pour effectuer cette action.",
      },
    };
  }

  // ── Format du PIN soumis (4 chiffres) ────────────────────────────────────
  if (!/^\d{4}$/.test(submittedPin)) {
    return {
      ok: false,
      status: 403,
      body: {
        pinInvalid: true,
        message: "Format invalide — le code PIN doit être exactement 4 chiffres.",
        attemptsLeft: MAX_ATTEMPTS - getRecord(userId).count,
      },
    };
  }

  // ── Comparaison à temps constant ─────────────────────────────────────────
  if (!safeEqual(submittedPin, configuredPin)) {
    const rec = getRecord(userId);
    rec.count += 1;

    if (rec.count >= MAX_ATTEMPTS) {
      rec.lockedUntil = Date.now() + LOCKOUT_MS;
      console.warn(`[AdminPin] LOCKOUT — userId=${userId} — ${MAX_ATTEMPTS} tentatives échouées. Bloqué 20 min.`);
      return {
        ok: false,
        status: 423,
        body: {
          pinLocked: true,
          message: "Trop de tentatives incorrectes. Panneau admin bloqué pendant 20 minutes.",
          retryAfterMs: LOCKOUT_MS,
        },
      };
    }

    const attemptsLeft = MAX_ATTEMPTS - rec.count;
    console.warn(`[AdminPin] Mauvais PIN — userId=${userId} (${rec.count}/${MAX_ATTEMPTS})`);
    return {
      ok: false,
      status: 403,
      body: {
        pinInvalid: true,
        message: `Code PIN incorrect. ${attemptsLeft} tentative${attemptsLeft > 1 ? "s" : ""} restante${attemptsLeft > 1 ? "s" : ""} avant blocage de 20 min.`,
        attemptsLeft,
      },
    };
  }

  resetRecord(userId);
  return { ok: true };
}

export function requireAdminPin(req: Request, res: Response, next: NextFunction): void {
  if (!ADMIN_PIN_PROTECTION_ENABLED) {
    return next();
  }

  // GET/HEAD/OPTIONS = lecture seule → pas de PIN requis
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
    return next();
  }

  const path = req.originalUrl.split("?")[0];

  // Routes exemptées (authentification OTP/TOTP)
  if (PIN_EXEMPT_EXACT.has(path)) {
    return next();
  }

  // ── userId injecté par le middleware auth global (non forgeable) ──────────
  const userId = (req as any).userId as string | undefined;
  if (!userId) {
    res.status(428).json({
      pinRequired: true,
      message: "Authentification et code PIN requis.",
    });
    return;
  }

  const result = verifyAdminPinCode(userId, ((req.headers["x-admin-pin"] as string | undefined) ?? "").trim());
  if (!result.ok) {
    console.error(`[AdminPin] BLOCKED — status=${result.status} Method=${req.method} Path=${path}`);
    res.status(result.status).json(result.body);
    return;
  }

  console.log(`[AdminPin] ✅ PIN vérifié — userId=${userId} ${req.method} ${path}`);
  next();
}
