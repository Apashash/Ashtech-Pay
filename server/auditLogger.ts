/**
 * auditLogger.ts — Système de logs d'audit centralisé
 *
 * Enregistre les actions sensibles (connexion, retrait, rôle, KYC…) de façon
 * asynchrone (fire-and-forget). Ne bloque jamais la requête en cours.
 *
 * Usage:
 *   import { audit, AUDIT } from "./auditLogger";
 *   audit(req, AUDIT.LOGIN_SUCCESS, { userId: user.id });
 */

import { db } from "./db";
import { auditLogs } from "@shared/schema";
import type { Request } from "express";

// ── Actions auditées ─────────────────────────────────────────────────────────
export const AUDIT = {
  // Authentification
  LOGIN_SUCCESS:    "login_success",
  LOGIN_FAILED:     "login_failed",
  LOGOUT:           "logout",
  REGISTER:         "register",
  PASSWORD_CHANGED: "password_changed",
  PASSWORD_RESET:   "password_reset",
  // Financier
  WITHDRAWAL_CREATED: "withdrawal_created",
  WITHDRAWAL_FAILED:  "withdrawal_failed",
  TRANSFER_SENT:      "transfer_sent",
  TRANSFER_FAILED:    "transfer_failed",
  DEPOSIT_INITIATED:  "deposit_initiated",
  PAYMENT_LINK_PAID:  "payment_link_paid",
  // Administration
  ROLE_CHANGED:        "role_changed",
  USER_BANNED:         "user_banned",
  USER_UNBANNED:       "user_unbanned",
  KYC_APPROVED:        "kyc_approved",
  KYC_REJECTED:        "kyc_rejected",
  SESSION_REVOKED:     "session_revoked",
  SETTINGS_UPDATED:    "settings_updated",
} as const;

export type AuditAction = (typeof AUDIT)[keyof typeof AUDIT];

export interface AuditOptions {
  userId?: string | null;
  actorType?: "user" | "admin" | "system";
  targetType?: string;
  targetId?: string;
  details?: Record<string, unknown>;
  success?: boolean;
}

/**
 * Enregistre un événement d'audit de façon asynchrone (fire-and-forget).
 * Ne lance jamais d'exception — les erreurs sont uniquement loggées en console.
 */
export function audit(req: Request, action: AuditAction, opts: AuditOptions = {}): void {
  const ip = req.ip ?? null;
  const userAgent = ((req.headers["user-agent"] as string) || "").substring(0, 512);
  const userId = opts.userId !== undefined ? opts.userId : (req.userId ?? null);
  const actorType = opts.actorType ?? "user";

  db.insert(auditLogs)
    .values({
      userId,
      actorType,
      action,
      targetType: opts.targetType ?? null,
      targetId: opts.targetId ?? null,
      details: opts.details ? JSON.stringify(opts.details) : null,
      ipAddress: ip,
      userAgent: userAgent || null,
      success: opts.success ?? true,
    })
    .catch((err: unknown) => {
      console.error("[AuditLog] Échec d'insertion:", (err as Error)?.message ?? err);
    });
}
