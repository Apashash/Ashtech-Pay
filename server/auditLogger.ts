/**
 * auditLogger.ts — Système de logs d'audit centralisé
 *
 * Enregistre les actions sensibles (connexion, retrait, rôle, KYC…) de façon
 * asynchrone (fire-and-forget). Ne bloque jamais la requête en cours.
 * Envoie également une alerte Telegram pour chaque événement.
 *
 * Usage:
 *   import { audit, AUDIT } from "./auditLogger";
 *   audit(req, AUDIT.LOGIN_SUCCESS, { userId: user.id, userName: user.fullName, userEmail: user.email });
 */

import { db } from "./db";
import { auditLogs } from "@shared/schema";
import { notifyAuditEvent } from "./telegram";
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
  userName?: string | null;
  userEmail?: string | null;
  actorType?: "user" | "admin" | "system";
  targetType?: string;
  targetId?: string;
  details?: Record<string, unknown>;
  success?: boolean;
}

/**
 * Enregistre un événement d'audit en base ET envoie une alerte Telegram.
 * Fire-and-forget — ne lance jamais d'exception.
 */
export function audit(req: Request, action: AuditAction, opts: AuditOptions = {}): void {
  const ip = req.ip ?? null;
  const userAgent = ((req.headers["user-agent"] as string) || "").substring(0, 512);
  const userId = opts.userId !== undefined ? opts.userId : (req.userId ?? null);
  const actorType = opts.actorType ?? "user";
  const success = opts.success ?? true;

  // ── 1. Persistance en base (fire-and-forget) ──────────────────────────────
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
      success,
    })
    .catch((err: unknown) => {
      console.error("[AuditLog] Échec d'insertion:", (err as Error)?.message ?? err);
    });

  // ── 2. Alerte Telegram (fire-and-forget) ─────────────────────────────────
  notifyAuditEvent({
    action,
    actorType,
    userId,
    userName:  opts.userName  ?? null,
    userEmail: opts.userEmail ?? null,
    ipAddress: ip,
    userAgent,
    success,
    details: opts.details ?? null,
  }).catch((err: unknown) => {
    console.error("[AuditLog] Échec Telegram:", (err as Error)?.message ?? err);
  });
}
