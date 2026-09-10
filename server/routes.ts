import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage, normalizePhone } from "./storage";
import { appPath } from "./appPaths";
import { audit, AUDIT } from "./auditLogger";
import { setFailedCooldown, getFailedCooldown } from "./failedCooldown";
import {
  checkAuthRateLimit,
  checkIdentifierRateLimit,
  recordAuthFailure,
  clearAuthAttempts,
  getBlockedIps,
  unblockByIdentifier,
  blockIpManually,
} from "./ipBlocker";
import {
  registerLimiter,
  withdrawalLimiter,
  depositLimiter,
  transferLimiter,
  passwordResetLimiter,
  publicPayLimiter,
  loginLimiter,
  otpConfirmLimiter,
  adminActionLimiter,
  webhookLimiter,
  transactionStatusLimiter,
  hostedPaymentLimiter,
  bannerLimiter,
  publicInfoLimiter,
  externalProxyLimiter,
  apiV1Limiter,
} from "./rateLimiter";
import { 
  loginSchema, 
  registerSchema, 
  transferSchema, 
  depositSchema, 
  withdrawSchema, 
  createPaymentLinkSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  COUNTRY_CURRENCIES,
  SUPPORTED_CURRENCIES,
  CURRENCY_ZONE,
  CURRENCY_SYMBOLS,
  EXCHANGE_RATES,
  ALL_FX_CURRENCIES,
  type SupportedCurrency,
  type Transaction,
  insertAutoConversionRuleSchema,
} from "@shared/schema-runtime";
import { seedPawaPayCountries, syncPawaPayCatalog } from "./pawapayCatalog";
import crypto from "crypto";
import { z } from "zod";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { MySqlSessionStore } from "./mysqlSessionStore";
import { pool, db, sessionPool, poolStats } from "./db";
import { transactions as transactionsTable, users as usersTable, wallets as walletsTable } from "@shared/schema-runtime";
import { and, desc, eq, sql, sql as drizzleSql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import multer from "multer";
import path from "path";
import fs from "fs";
import { uploadToSupabase, getSignedImageUrl, downloadFromSupabase, STORAGE_BUCKET } from "./supabase";
import { decryptField, encryptField, isFieldEncryptionConfigured } from "./fieldEncryption";
import { requireAdminPin, verifyAdminPinCode } from "./adminPin";
import { createPaymentIntent, createDirectCharge, validateWebhook, getIziPayWebhookSecret, toIziPayCurrency, isIziPayConfigured } from "./izichange";
import { fetchCryptoAssets, filterCryptoAssets, parseDisabledCryptoAssets, getStaticCryptoAssets } from "./cryptoAssets";
import {
  buildDirectCryptoCustomer,
  computeDirectCryptoFeeBreakdown,
  MIN_DIRECT_CRYPTO_USDT,
  parseDirectCryptoRequest,
  type DirectCryptoRequest,
} from "./directCrypto";
import { initiateAfribaPayin, initiateAfribaPayOtp, initiateAfribaPayout, checkAfribaPayStatus, computeAfribaPayFees, fetchAfribaPayCountries, parseAfribaPayWebhook, AFRIBAPAY_DEFAULT_MARGIN, isAfribaPayOtpRequired, getAfribaPayOtpInfo, confirmAfribaPayOtp, isAfribaPayOtpRequiredMessage } from "./afribapay";
import { initiatePixPayUssd, initiatePixPayOtp, initiatePixPayWave, initiatePixPayPayout, checkPixPayStatus, computePixPayFees, parsePixPayWebhook, PIXPAY_CURRENCY_MAP, PIXPAY_SUPPORTED_COUNTRIES, detectPixPayFlowType, getPixPayServiceId, PIXPAY_OTP_USSD_CODES } from "./pixpay";
import { assertPawaPayProviderActive, classifyPawaPayControlledTransaction, createPawaPayDeposit, createPawaPayId, createPawaPayPayout, createPawaPayPaymentPage, getPawaPayActiveConfiguration, getPawaPayDeposit, getPawaPayPayout, resolvePawaPayOperationConfiguration, PAWAPAY_CUSTOMER_MESSAGE } from "./pawapay";
import { addPendingPayment, removePendingPayment, expireCryptoPaymentIfNeeded } from "./paymentPoller";
import { processPawaPayDepositCallback } from "./paymentPoller";
import { loadFxRates, convertFromXAF, convertToXAF, convertCurrency, creditUserWallet, sameCfaFamily, getConversionPairKey, maybeAutoConvert } from "./walletHelper";
import { addPendingPayout, removePendingPayout } from "./payoutPoller";
import { processPawaPayPayoutCallback } from "./payoutPoller";
import { isPawaPayUuidV4, parsePawaPayCallback, verifyPawaPayCallbackSignature } from "./pawapay";
import {
  getPawaPaySettingsView,
  getPawaPayWebhookSecret,
  replacePawaPayCredentials,
} from "./pawapayConfig";
import { enqueueMerchantWebhook } from "./merchantWebhook";
import { buildProviderErrorPayload } from "./providerErrors";
import { buildPublicPaymentStatus } from "./publicPaymentState";
import { buildPawaPayFeeUpdates } from "./feeUpdates";
import { toLocalMobileMoneyPhone, validateMobileMoneyPhone } from "@shared/mobile-money-phone";
import { getVapidPublicKey, sendPushNotificationToAll } from "./push";
import { buildTransactionBalanceSnapshots } from "./transactionBalances";
import { formatDebugError, shouldExposeDebugErrors } from "./errorDiagnostics";

const PAWAPAY_PUBLIC_INITIATION_TIMEOUT_MS = 20_000;

import { addSSEClient, removeSSEClient, setActiveTicket, isUserOnline, getOnlineUserIds, getAdminViewingTicket, getUserViewingTicket, notifyUser, notifyAdmins, broadcastOnlineStatus, notifyUserForceLogout, notifyOtherSessionsForceLogout, notifyAllUsersForceLogout, notifySpecificSessionForceLogout } from "./sse";
import { sendClean404 } from "./botGuard";
import {
  notifyNewDeposit,
  notifyWithdrawalPendingManual,
  notifyWithdrawalManuallyValidated,
  notifyWithdrawalAutoValidated,
  notifyWithdrawalFailed,
  notifyLoginFailed,
  notifyIpBlocked,
  notifyAdminLogin,
  notifyAdminLoginSuccess,
  notifyAdminLoginFailed,
  notifyNewUser,
  notifyConversion,
  notifyConversionStarted,
  notifyConversionCompleted,
  notifyAutoConversionRuleCreated,
  notifyAutoConversionRulesBulkCreated,
  notifyTransferSent,
  notifyKycSubmitted,
  notifyKycApproved,
  notifyKycRejected,
  notifyKycSubmittedFull,
  notifyPaymentLinkCreated,
  notifyDepositFailed,
  notifyDepositConfirmed,
  handleTelegramUpdate,
  registerTelegramWebhook,
  getTelegramWebhookSecret,
  getWebhookInfo,
  notifyWithdrawalNumberChangeRequest,
  notifyNewTicket,
  notifySupportMessage,
  notifyAdminPanelAccess,
} from "./telegram";
import {
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendCampaignEmail,
  sendPayerConfirmationEmail,
  sendKycApprovedEmail,
  sendWithdrawalApprovedEmail,
  sendWithdrawalNumberApprovedEmail,
  sendAccountDeletedEmail,
  sendPasswordChangeOtpEmail,
} from "./email";

// ─── Helper: URL de callback webhook avec token d'authentification ────────────
// Appelle les fournisseurs de paiement avec le token dans l'URL pour que leurs
// callbacks soient authentifiés automatiquement (WEBHOOK_SECRET requis).
function buildWebhookUrl(path: string): string {
  const base = (process.env.APP_URL || "").replace(/\/$/, "");
  const token = process.env.WEBHOOK_SECRET;
  return token
    ? `${base}${path}?token=${encodeURIComponent(token)}`
    : `${base}${path}`;
}

// ─── AfribaPay: country → ISO currency (authoritative, from AfribaPay API) ───
// Used to always send the correct ISO currency code regardless of DB value.
const AFRIBAPAY_ISO_CURRENCY: Record<string, string> = {
  BF: "XOF", BJ: "XOF", CD: "CDF", CF: "XAF", CG: "XAF",
  CI: "XOF", CM: "XAF", GA: "XAF",
  GQ: "XAF", GW: "XOF", ML: "XOF", NE: "XOF", RW: "RWF",
  SN: "XOF", TD: "XAF", TG: "XOF",
  UG: "UGX",
};

// Countries currently returned by AfribaPay's live /v1/countries endpoint.
// Keep this list aligned with the live catalogue; this is only a warning guard,
// while the operator/provider configuration remains controlled in the database.
const AFRIBAPAY_CONFIRMED_COUNTRIES = new Set([
  "BF", "BJ", "CD", "CF", "CG", "CI", "CM", "GA", "GW", "ML", "NE", "SN", "TD", "TG",
]);
function warnIfAfribaPayUnsupportedCountry(countryCode: string, context: string) {
  if (!AFRIBAPAY_CONFIRMED_COUNTRIES.has(countryCode.toUpperCase())) {
    console.warn(`[AfribaPay] ${context}: country "${countryCode}" is NOT in AfribaPay's confirmed country list. Request will likely fail. Consider routing via PixPay.`);
  }
}

// ─── AfribaPay: operator name → AfribaPay operator code ──────────────────────
// Fallback if afribapayOperatorCode is not set in DB.
const AFRIBAPAY_OPERATOR_CODE_MAP: Record<string, string> = {
  orange: "orange", mtn: "mtn", moov: "moov", wave: "wave",
  airtel: "airtel", free: "free", expresso: "expresso",
  emoney: "emoney", ligdicash: "wligdicash",
  walletligdicash: "wligdicash", tmoney: "tmoney", celtiis: "celtiis",
  coris: "coris", corismoney: "coris",
  mpesa: "mpesa", vodacom: "vodacom",
  afrimoney: "afrimoney", djamo: "djamo", amanata: "amanata",
  nita: "nita", zamani: "zamani",
};

/** Resolve the AfribaPay operator code from the DB record or operator name. */
function resolveAfribaPayOperatorCode(operatorRecord: any, operatorName: string): string {
  if (operatorRecord?.afribapayOperatorCode) return operatorRecord.afribapayOperatorCode;
  const raw = operatorName.toLowerCase()
    .replace(/\s+money\b.*/i, "")
    .replace(/\s+/g, "")
    .trim();
  return AFRIBAPAY_OPERATOR_CODE_MAP[raw] || raw;
}

const PAWAPAY_ALPHA3_COUNTRIES: Record<string, string> = {
  BJ: "BEN", BF: "BFA", CD: "COD", CI: "CIV", CM: "CMR", CG: "COG", GA: "GAB",
  GH: "GHA", KE: "KEN", ML: "MLI", MW: "MWI", MZ: "MOZ", NG: "NGA", RW: "RWA",
  SN: "SEN", TZ: "TZA", UG: "UGA", ZM: "ZMB", ET: "ETH", LS: "LSO", SL: "SLE",
};
function toPawaPayCurrency(currency: string): string {
  return /^XAF|^XOF/.test(currency.toUpperCase()) ? currency.slice(0, 3).toUpperCase() : currency.toUpperCase();
}
function pawaPayCountry(countryCode: string): string {
  return PAWAPAY_ALPHA3_COUNTRIES[countryCode.toUpperCase()] || countryCode.toUpperCase();
}
function countryWalletCurrency(country: { code?: string | null; currency?: string | null }): string {
  return CURRENCY_ZONE[String(country.code || "").toUpperCase()] || country.currency || "XAF";
}
/** DB configuration wins; conservative documented-code fallback covers seeded operators. */
function resolvePawaPayProviderCode(operator: any, name: string, countryCode: string): string {
  if (operator?.pawapayProviderCode?.trim()) return operator.pawapayProviderCode.trim();
  if (process.env.NODE_ENV === "production") {
    throw new Error("PawaPay provider code is not configured for this operator");
  }
  const brand = name.toLowerCase();
  const country = pawaPayCountry(countryCode);
  if (brand.includes("mtn")) return `MTN_MOMO_${country}`;
  if (brand.includes("orange")) return `ORANGE_${country}`;
  if (brand.includes("airtel")) return `AIRTEL_${country}`;
  if (brand.includes("moov") || brand.includes("flooz")) return `MOOV_${country}`;
  if (brand.includes("wave")) return `WAVE_${country}`;
  throw new Error("PawaPay provider code is not configured for this operator");
}

function normalizePawaPayInstructionLabel(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase();
}

function dedupePawaPayInstructions(instructions: any): any {
  if (!instructions || !Array.isArray(instructions.channels)) return instructions ?? null;
  const seen = new Set<string>();
  const channels = instructions.channels.map((channel: any) => {
    const nextChannel = { ...channel };
    const nextInstructions = { ...(channel.instructions || {}) };

    for (const locale of ["fr", "en"]) {
      if (!Array.isArray(channel.instructions?.[locale])) continue;
      nextInstructions[locale] = channel.instructions[locale].filter((instruction: any) => {
        const key = normalizePawaPayInstructionLabel(instruction?.text || instruction?.template);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    nextChannel.instructions = nextInstructions;
    return nextChannel;
  });

  return { ...instructions, channels };
}

function pawaPayAuthPayload(auth: any): Record<string, any> | null {
  if (!auth?.authType) return null;
  return {
    authType: auth.authType,
    pinPrompt: auth.pinPrompt ?? null,
    pinPromptRevivable: auth.pinPromptRevivable ?? false,
    pinPromptInstructions: dedupePawaPayInstructions(auth.pinPromptInstructions),
    authTokenInstructions: dedupePawaPayInstructions(auth.authTokenInstructions),
  };
}

async function reconcilePawaPayPayoutAttempt(transaction: any): Promise<"completed" | "failed" | "unresolved"> {
  const payoutId = transaction.externalReference;
  if (!payoutId || !isPawaPayUuidV4(payoutId)) return "unresolved";
  try {
    const result = await getPawaPayPayout(payoutId);
    if (result.status === "completed") {
      await processPawaPayPayoutCallback(transaction, "success");
      return "completed";
    }
    if (result.status === "failed") {
      await processPawaPayPayoutCallback(transaction, "failed");
      return "failed";
    }
  } catch {
    // Unknown transport/provider outcome must remain recoverable.
  }
  const claimed = await storage.claimTransactionStatus(transaction.id, "processing", ["pending", "pending_manual"]);
  const current = claimed || await storage.getTransactionById(transaction.id);
  if (!current) return "unresolved";
  if (current.status === "completed") return "completed";
  if (current.status === "failed" || current.status === "cancelled") return "failed";
  if (current.status !== "processing" || current.externalReference !== payoutId) return "unresolved";
  addPendingPayout({
    transactionId: transaction.id,
    reference: payoutId,
    externalReference: payoutId,
    userId: transaction.userId,
    amount: transaction.amount,
    totalDebited: transaction.totalAmount || transaction.amount,
    provider: "pawapay",
    countryCode: (transaction.recipientCountry || "CM").toUpperCase(),
    txType: transaction.type,
    txCurrency: transaction.currency || "XAF",
  });
  return "unresolved";
}

async function reconcilePawaPayIncomingAttempt(transaction: any): Promise<"completed" | "failed" | "unresolved"> {
  const depositId = transaction.externalReference;
  if (!depositId || !isPawaPayUuidV4(depositId)) return "unresolved";
  try {
    const result = await getPawaPayDeposit(depositId);
    if (result.status === "completed") {
      await processPawaPayDepositCallback(transaction, "completed");
      return "completed";
    }
    if (result.status === "failed") {
      await processPawaPayDepositCallback(transaction, "failed");
      return "failed";
    }
  } catch {
    // Pending, not-found and transport ambiguity remain provider-controlled.
  }
  const current = await storage.getTransactionById(transaction.id);
  if (!current) return "unresolved";
  if (current.status === "completed") return "completed";
  if (current.status === "failed" || current.status === "cancelled") return "failed";
  if (current.externalReference === depositId && current.status === "pending") {
    addPendingPayment({
      transactionId: current.id,
      reference: current.reference || current.id,
      externalReference: depositId,
      userId: current.userId,
      type: current.type,
      amount: current.amount,
      provider: "pawapay",
      countryCode: (current.recipientCountry || "CM").toUpperCase(),
    });
  }
  return "unresolved";
}

// UPLOADS_DIR env var allows a persistent path outside the deployment folder (e.g. on Plesk).
// Default: <cwd>/uploads — but this is wiped on each deployment!
// On production (Plesk), set UPLOADS_DIR to a stable absolute path like:
//   /var/www/vhosts/ashtechpay.top/upload_data
const uploadsDir = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : appPath("uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
console.log(`[Uploads] Storage directory: ${uploadsDir}`);

const fileStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

// ─── FIX-10: Validation des fichiers par magic bytes ─────────────────────────
// Le Content-Type déclaré par le client peut être falsifié. On vérifie les
// vrais octets du fichier (magic bytes) pour détecter le vrai format.
function validateFileMagicBytes(buffer: Buffer): { valid: boolean; detected: string } {
  if (buffer.length < 4) return { valid: false, detected: "too_short" };
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { valid: true, detected: "image/jpeg" };
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return { valid: true, detected: "image/png" };
  // GIF: GIF87a ou GIF89a
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) return { valid: true, detected: "image/gif" };
  // WebP: RIFF....WEBP
  if (buffer.length >= 12 && buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) return { valid: true, detected: "image/webp" };
  // PDF: %PDF
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) return { valid: true, detected: "application/pdf" };
  return { valid: false, detected: "unknown" };
}

const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"];
    if (allowedTypes.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Type de fichier non autorisé"));
  },
});

const upload = multer({
  storage: fileStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Type de fichier non autorisé"));
    }
  },
});

const SessionStore = connectPgSimple(session);
const isMysqlDialect = process.env.DB_DIALECT?.toLowerCase() === "mysql";

declare module "express-session" {
  interface SessionData {
    userId: string;
    role?: string;          // stored at login — used for inactivity timeout (24h admin / 24h user)
    lastActivity?: number;  // ms timestamp — updated on every authenticated request
    _avs?: number;
    _avsIp?: string;      // IP at TOTP verification time — used for admin session IP pinning
    _otpCode?: string;    // deprecated: plaintext OTP kept for backward compat only
    _otpCodeH?: string;   // VULN-A1 fix: HMAC-SHA256 hash of OTP stored in DB session
    _otpExpiry?: number;
    _totpPendingSecret?: string; // encrypted secret awaiting confirmation
    clientIp?: string;
    userAgent?: string;
    loginAt?: string;
    tokenIssuedAt?: number;
    _pav?: number;
    _ppv?: number;       // panel PIN verification expiry
    _ppvIp?: string;     // IP at panel PIN verification time
    impersonatedBy?: string;
  }
}

// ─── FIX-1: Secret de développement unique par démarrage de processus ─────────
// En production, SESSION_SECRET est obligatoire (index.ts quitte si absent).
// En dev, ce secret aléatoire garantit que sessions ET tokens Bearer utilisent
// la même clé — cohérence entre les deux mécanismes d'authentification.
const _DEV_TOKEN_SECRET = crypto.randomBytes(32).toString("hex");

// ─── VULN-A1: HMAC helper — OTP is stored as hash in DB session, never plaintext ─
function hashOtp(code: string): string {
  const secret = process.env.SESSION_SECRET || _DEV_TOKEN_SECRET;
  return crypto.createHmac("sha256", secret).update(code).digest("hex");
}

// ─── OTP email toggle (admin-configurable) ────────────────────────────────────
// When disabled, withdrawals & transfers skip the mandatory email OTP step.
async function isOtpEmailEnabled(): Promise<boolean> {
  const setting = await storage.getSetting("otp_email_enabled");
  if (!setting) return true; // default: enabled (secure by default)
  return setting.value !== "false";
}

// ─── Transaction OTP store (withdrawal / transfer) ────────────────────────────
const TX_OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const txOtpStore = new Map<string, {
  userId: string;
  otpHash: string;
  type: "withdrawal" | "transfer_external" | "transfer_internal";
  expiresAt: number;
}>();
setInterval(() => {
  const now = Date.now();
  for (const [ref, entry] of txOtpStore) {
    if (entry.expiresAt <= now) txOtpStore.delete(ref);
  }
}, 10 * 60 * 1000);

// ─── DB-backed OTP operation lock (15 min per user, survives restarts) ───────
const OTP_OP_LOCK_MS = 15 * 60 * 1000;

async function getOtpOpLockRemaining(userId: string): Promise<number> {
  try {
    const result = await db.execute(sql`SELECT otp_locked_until FROM users WHERE id = ${userId}`);
    const row = (result as any).rows?.[0];
    if (!row) return 0;
    const lockedUntil = Number(row.otp_locked_until ?? 0);
    const remaining = lockedUntil - Date.now();
    return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
  } catch { return 0; }
}

async function setOtpOpLock(userId: string): Promise<void> {
  try {
    await db.execute(sql`UPDATE users SET otp_locked_until = ${Date.now() + OTP_OP_LOCK_MS} WHERE id = ${userId}`);
  } catch (e) { console.error("[OtpLock] setOtpOpLock error:", e); }
}

async function clearOtpOpLock(userId: string): Promise<void> {
  try {
    await db.execute(sql`UPDATE users SET otp_locked_until = 0 WHERE id = ${userId}`);
  } catch (e) { console.error("[OtpLock] clearOtpOpLock error:", e); }
}

// Shared database lock for payout/transfer submission. This reuses the same
// short-lived user lock column so it works across workers and survives a
// process restart. The compare-and-set prevents two requests from both
// passing the balance check and submitting two provider payouts.
async function acquirePayoutOperationLock(userId: string): Promise<number | null> {
  const lockUntil = Date.now() + OTP_OP_LOCK_MS;
  try {
    if (isMysqlDialect) {
      const updated = await pool.query(
        `UPDATE users
         SET otp_locked_until = ?
         WHERE id = ? AND COALESCE(otp_locked_until, 0) < ?`,
        [lockUntil, userId, Date.now()],
      );
      return updated.rowCount > 0 ? lockUntil : null;
    }
    const result = await db.execute(sql`
      UPDATE users
      SET otp_locked_until = ${lockUntil}
      WHERE id = ${userId}
        AND COALESCE(otp_locked_until, 0) < ${Date.now()}
      RETURNING id
    `);
    const rows = (result as any).rows || [];
    return rows.length > 0 ? lockUntil : null;
  } catch (e) {
    console.error("[PayoutLock] acquire error:", e);
    throw new Error("Impossible de sécuriser cette opération. Veuillez réessayer.");
  }
}

async function releasePayoutOperationLock(userId: string, lockUntil: number | null): Promise<void> {
  if (!lockUntil) return;
  try {
    // Do not clear a newer lock if this request exceeded its TTL and another
    // operation acquired the slot meanwhile.
    await db.execute(sql`
      UPDATE users
      SET otp_locked_until = 0
      WHERE id = ${userId} AND otp_locked_until = ${lockUntil}
    `);
  } catch (e) {
    console.error("[PayoutLock] release error:", e);
  }
}

async function findRecentActivePayoutDuplicate(params: {
  userId: string;
  type: "withdrawal" | "transfer_out";
  recipientPhone: string;
  operatorId: string;
  totalAmount: number;
}): Promise<{ id: string; reference: string | null; status: string } | null> {
  if (isMysqlDialect) {
    const result = await pool.query(
      `SELECT id, reference, status
       FROM transactions
       WHERE user_id = ? AND type = ? AND recipient_phone = ?
         AND operator_id = ? AND total_amount = ?
         AND status IN ('pending', 'processing', 'pending_manual')
         AND created_at > DATE_SUB(NOW(), INTERVAL 15 MINUTE)
       ORDER BY created_at DESC LIMIT 1`,
      [
        params.userId,
        params.type,
        params.recipientPhone,
        params.operatorId,
        params.totalAmount,
      ],
    );
    const row = result.rows[0];
    return row ? { id: row.id, reference: row.reference, status: row.status } : null;
  }
  const result = await db.execute(sql`
    SELECT id, reference, status
    FROM transactions
    WHERE user_id = ${params.userId}
      AND type = ${params.type}
      AND recipient_phone = ${params.recipientPhone}
      AND operator_id = ${params.operatorId}
       AND total_amount::numeric = ${params.totalAmount}
      AND status IN ('pending', 'processing', 'pending_manual')
       AND created_at > NOW() - INTERVAL '15 minutes'
    ORDER BY created_at DESC
    LIMIT 1
  `);
  const row = (result as any).rows?.[0];
  return row ? { id: row.id, reference: row.reference, status: row.status } : null;
}

// ─── Pending admin logins — DB-backed (survives PM2 worker restarts) ──────────
// Stores OTP for admin accounts BEFORE any session is created.
// Session is only created AFTER OTP is verified — impossible to bypass.
// Previously in-memory Map; moved to DB so all PM2 workers share state.
interface PendingAdminLogin {
  userId: string;
  otp: string;
  expiresAt: number;
  attempts: number;
}
const ADMIN_LOGIN_OTP_TTL_MS = 5 * 60 * 1000; // 5 min
const ADMIN_LOGIN_CLAIM_TTL_MS = 15 * 1000;
const ADMIN_NOTIF_EMAIL = "ashtechsarl@gmail.com";

async function setPendingAdminLogin(token: string, entry: PendingAdminLogin): Promise<void> {
  if (isMysqlDialect) {
    await pool.query(
      `INSERT INTO admin_pending_logins (token, user_id, otp, expires_at, attempts)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         user_id = VALUES(user_id), otp = VALUES(otp),
         expires_at = VALUES(expires_at), attempts = VALUES(attempts)`,
      [token, entry.userId, entry.otp, entry.expiresAt, entry.attempts],
    );
    return;
  }
  await pool.query(
    `INSERT INTO admin_pending_logins (token, user_id, otp, expires_at, attempts)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (token) DO UPDATE SET user_id=$2, otp=$3, expires_at=$4, attempts=$5`,
    [token, entry.userId, entry.otp, entry.expiresAt, entry.attempts]
  );
}

// Reserve a pending login atomically before validating its TOTP. This prevents
// concurrent requests (including requests handled by different PM2 workers)
// from consuming the same challenge more than once.
async function claimPendingAdminLogin(token: string, claimId: string): Promise<PendingAdminLogin | null> {
  const now = Date.now();
  if (isMysqlDialect) {
    const updated = await pool.query(
      `UPDATE admin_pending_logins
          SET attempts = attempts + 1,
              claimed_by = ?,
              claimed_until = ?
        WHERE token = ?
          AND expires_at > ?
          AND consumed_at IS NULL
          AND attempts < 5
          AND (claimed_until IS NULL OR claimed_until <= ?)`,
      [claimId, now + ADMIN_LOGIN_CLAIM_TTL_MS, token, now, now],
    );
    if (updated.rowCount === 0) return null;
    const selected = await pool.query(
      `SELECT user_id, otp, expires_at, attempts
       FROM admin_pending_logins
       WHERE token = ? AND claimed_by = ? LIMIT 1`,
      [token, claimId],
    );
    const row = selected.rows[0];
    if (!row) return null;
    return {
      userId: row.user_id,
      otp: row.otp,
      expiresAt: Number(row.expires_at),
      attempts: Number(row.attempts),
    };
  }
  const r = await pool.query(
    `UPDATE admin_pending_logins
        SET attempts = attempts + 1,
            claimed_by = $2,
            claimed_until = $3
      WHERE token = $1
        AND expires_at > $4
        AND consumed_at IS NULL
        AND attempts < 5
        AND (claimed_until IS NULL OR claimed_until <= $4)
      RETURNING user_id, otp, expires_at, attempts`,
    [token, claimId, now + ADMIN_LOGIN_CLAIM_TTL_MS, now],
  );
  const row = r.rows[0];
  if (!row) return null;
  return {
    userId: row.user_id,
    otp: row.otp,
    expiresAt: Number(row.expires_at),
    attempts: Number(row.attempts),
  };
}

async function releasePendingAdminLogin(token: string, claimId: string): Promise<void> {
  await pool.query(
    `UPDATE admin_pending_logins
        SET claimed_by = NULL, claimed_until = NULL
      WHERE token = $1 AND claimed_by = $2 AND consumed_at IS NULL`,
    [token, claimId],
  );
}

async function consumePendingAdminLogin(token: string, claimId: string): Promise<boolean> {
  if (isMysqlDialect) {
    const result = await pool.query(
      `UPDATE admin_pending_logins
          SET consumed_at = ?, claimed_until = NULL
        WHERE token = ? AND claimed_by = ? AND consumed_at IS NULL`,
      [Date.now(), token, claimId],
    );
    return result.rowCount > 0;
  }
  const r = await pool.query(
    `UPDATE admin_pending_logins
        SET consumed_at = $3, claimed_until = NULL
      WHERE token = $1 AND claimed_by = $2 AND consumed_at IS NULL
      RETURNING token`,
    [token, claimId, Date.now()],
  );
  return r.rows.length > 0;
}

async function deletePendingAdminLogin(token: string): Promise<void> {
  await pool.query(`DELETE FROM admin_pending_logins WHERE token = $1`, [token]);
}

// Cleanup expired entries every 2 min (all workers run this, but DELETE is idempotent)
setInterval(() => {
  pool.query(`DELETE FROM admin_pending_logins WHERE expires_at <= $1`, [Date.now()]).catch(() => {});
}, 2 * 60 * 1000);

// ─── Admin IP Whitelist ────────────────────────────────────────────────────────
// Stored in platform_settings (key="admin_ip_whitelist", value=JSON array).
// If list is empty → no restriction (feature disabled).
// If non-empty → ONLY listed IPs may access admin routes.
// ── Admin Panel IP Blocklist ──────────────────────────────────────────────────
// Any IP can access the admin panel by default.
// Admins can manually block specific IPs with an optional expiry duration.
// If expiresAt is undefined → block is permanent until manually removed.

interface AdminPanelBlock {
  ip: string;
  blockedAt: number;
  expiresAt?: number; // undefined = permanent
  reason?: string;
}

let _adminPanelBlockedIps: AdminPanelBlock[] = [];
let _adminPanelBlockedIpsLoadedAt = 0;
const ADMIN_PANEL_BLOCKED_IPS_TTL = 20_000; // 20s cache

async function loadAdminPanelBlockedIps(): Promise<AdminPanelBlock[]> {
  const now = Date.now();
  if (now - _adminPanelBlockedIpsLoadedAt < ADMIN_PANEL_BLOCKED_IPS_TTL) return _adminPanelBlockedIps;
  try {
    const setting = await storage.getSetting("admin_panel_blocked_ips");
    const raw: AdminPanelBlock[] = setting ? JSON.parse(setting.value) : [];
    // Filter out expired entries on load (auto-cleanup)
    _adminPanelBlockedIps = raw.filter(b => !b.expiresAt || b.expiresAt > now);
    // Persist cleaned list if entries were removed
    if (_adminPanelBlockedIps.length !== raw.length) {
      await storage.upsertSetting("admin_panel_blocked_ips", JSON.stringify(_adminPanelBlockedIps)).catch(() => {});
    }
  } catch { /* keep stale */ }
  _adminPanelBlockedIpsLoadedAt = now;
  return _adminPanelBlockedIps;
}

function invalidateAdminPanelBlockedIpsCache() {
  _adminPanelBlockedIpsLoadedAt = 0;
}

function isIpBannedFromAdmin(ip: string, blocklist: AdminPanelBlock[]): boolean {
  const now = Date.now();
  return blocklist.some(b =>
    b.ip.trim() === ip.trim() && (!b.expiresAt || b.expiresAt > now)
  );
}

// ─── Admin OTP verified sessions — dual storage ───────────────────────────────
// PRIMARY: in-memory Map (instant, no async — avoids race condition on refetchOtp)
// BACKUP:  session._avs timestamp (PostgreSQL-backed — survives restarts & multi-process)
// Keyed by sessionID so each browser session is independently verified.
// A new login always gets a fresh sessionID → OTP is always re-asked after logout.
const adminVerifiedSessions = new Map<string, { userId: string; expiresAt: number; ip?: string }>();
const ADMIN_REAUTH_INACTIVITY_TTL_MS = 24 * 60 * 60 * 1000; // 24h without authenticated activity
const ADMIN_OTP_SESSION_TTL_MS = ADMIN_REAUTH_INACTIVITY_TTL_MS; // slides on each requireAdmin pass
const ADMIN_PANEL_ACCESS_TTL_MS = ADMIN_REAUTH_INACTIVITY_TTL_MS; // _pav/_ppv slide while the panel is active
// TOTP is a fixed server-side requirement for every admin API request.
// Deliberately not configurable through an environment variable: an environment
// change must never be able to downgrade admin authentication.
const ADMIN_TOTP_ENFORCEMENT_ENABLED = true as const;

// Rate-limit Telegram "panel_access" notifications — 1 notif per sessionID per 30 min
// to avoid spamming on every API call while the admin navigates the panel.
const adminAccessNotifCache = new Map<string, number>(); // sessionID → lastNotifAt (ms)
const ADMIN_ACCESS_NOTIF_INTERVAL_MS = 30 * 60 * 1000;

// Periodic cleanup of expired in-memory entries (every 10 min)
setInterval(() => {
  const now = Date.now();
  for (const [sid, entry] of adminVerifiedSessions) {
    if (entry.expiresAt <= now) adminVerifiedSessions.delete(sid);
  }
  for (const [sid, ts] of adminAccessNotifCache) {
    if (now - ts > ADMIN_ACCESS_NOTIF_INTERVAL_MS) adminAccessNotifCache.delete(sid);
  }
}, 10 * 60 * 1000);

// ─── OTP brute-force rate limiter (in-memory, per-userId) ─────────────────────
// Max 5 wrong attempts per 15 min window before lockout.
const otpAttempts = new Map<string, { count: number; lockedUntil: number }>();
const OTP_MAX_ATTEMPTS = 5;
const OTP_LOCKOUT_MS = 15 * 60 * 1000;

// ─── Admin-login-otp per-userId rate limiter ───────────────────────────────────
// Prevents token farming: attacker repeatedly calls /login to generate fresh
// adminLoginTokens and tries 5 codes per token to brute-force TOTP.
// Max 10 TOTP attempts per userId per 30 min regardless of how many tokens are issued.
const adminLoginOtpUserAttempts = new Map<string, { count: number; resetAt: number }>();
const ADMIN_LOGIN_OTP_USER_MAX = 10;
const ADMIN_LOGIN_OTP_USER_WINDOW_MS = 30 * 60 * 1000;

function checkAdminLoginOtpRateLimit(userId: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const rec = adminLoginOtpUserAttempts.get(userId);
  if (!rec || rec.resetAt <= now) return { allowed: true };
  if (rec.count >= ADMIN_LOGIN_OTP_USER_MAX) {
    return { allowed: false, retryAfter: Math.ceil((rec.resetAt - now) / 1000) };
  }
  return { allowed: true };
}
function recordAdminLoginOtpAttempt(userId: string): void {
  const now = Date.now();
  const rec = adminLoginOtpUserAttempts.get(userId);
  if (!rec || rec.resetAt <= now) {
    adminLoginOtpUserAttempts.set(userId, { count: 1, resetAt: now + ADMIN_LOGIN_OTP_USER_WINDOW_MS });
  } else {
    rec.count += 1;
  }
}
function clearAdminLoginOtpAttempts(userId: string): void {
  adminLoginOtpUserAttempts.delete(userId);
}
setInterval(() => {
  const now = Date.now();
  for (const [id, rec] of adminLoginOtpUserAttempts) {
    if (rec.resetAt <= now) adminLoginOtpUserAttempts.delete(id);
  }
}, 10 * 60 * 1000);

function checkOtpRateLimit(userId: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const rec = otpAttempts.get(userId);
  if (rec && rec.lockedUntil > now) {
    return { allowed: false, retryAfter: Math.ceil((rec.lockedUntil - now) / 1000) };
  }
  return { allowed: true };
}

function recordOtpFailure(userId: string): void {
  const now = Date.now();
  const rec = otpAttempts.get(userId) ?? { count: 0, lockedUntil: 0 };
  rec.count += 1;
  if (rec.count >= OTP_MAX_ATTEMPTS) {
    rec.lockedUntil = now + OTP_LOCKOUT_MS;
    rec.count = 0; // reset counter after lockout
  }
  otpAttempts.set(userId, rec);
}

function clearOtpFailures(userId: string): void {
  otpAttempts.delete(userId);
}

const TOKEN_EXPIRY_MS = 3 * 24 * 60 * 60 * 1000;

function getTokenSecret(): string {
  return process.env.SESSION_SECRET || _DEV_TOKEN_SECRET;
}

function storeAuthToken(userId: string): string {
  const payload = `${userId}.${Date.now()}`;
  const sig = crypto.createHmac("sha256", getTokenSecret()).update(payload).digest("hex");
  return Buffer.from(`${payload}.${sig}`).toString("base64url");
}

function extractTokenTimestamp(token: string): number | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString();
    const parts = decoded.split(".");
    if (parts.length !== 3) return null;
    const ts = parseInt(parts[1]);
    return isNaN(ts) ? null : ts;
  } catch { return null; }
}

function getUserIdFromToken(token: string): string | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString();
    const parts = decoded.split(".");
    if (parts.length !== 3) return null;
    const [userId, timestamp, sig] = parts;
    const expectedSig = crypto.createHmac("sha256", getTokenSecret()).update(`${userId}.${timestamp}`).digest("hex");
    if (sig !== expectedSig) return null;
    if (Date.now() - parseInt(timestamp) > TOKEN_EXPIRY_MS) return null;
    const ts = parseInt(timestamp);
    // Token révoqué suite à un changement d'IP (Bearer token ancien)
    const revokedBefore = revokedTokensBefore.get(userId);
    if (revokedBefore && ts < revokedBefore) return null;
    // Token révoqué pour un appareil spécifique (déconnexion par l'utilisateur)
    const revokedSet = revokedSpecificTokenTs.get(userId);
    if (revokedSet && revokedSet.has(ts)) return null;
    return userId;
  } catch {
    return null;
  }
}

// Extrait le userId d'un token sans vérifier la révocation (pour détecter les kicks single-device)
function getTokenUserIdIgnoreRevocation(token: string): string | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString();
    const parts = decoded.split(".");
    if (parts.length !== 3) return null;
    const [userId, timestamp, sig] = parts;
    const expectedSig = crypto.createHmac("sha256", getTokenSecret()).update(`${userId}.${timestamp}`).digest("hex");
    if (sig !== expectedSig) return null;
    if (Date.now() - parseInt(timestamp) > TOKEN_EXPIRY_MS) return null;
    return userId;
  } catch {
    return null;
  }
}

function removeAuthToken(token: string): void {
  try {
    const decoded = Buffer.from(token, "base64url").toString();
    const parts = decoded.split(".");
    if (parts.length !== 3) return;
    const [userId, timestamp] = parts;
    const ts = parseInt(timestamp, 10);
    if (!userId || isNaN(ts)) return;
    if (!revokedSpecificTokenTs.has(userId)) revokedSpecificTokenTs.set(userId, new Set());
    revokedSpecificTokenTs.get(userId)!.add(ts);
  } catch {
    // ignore malformed tokens
  }
}

// Extended request to include userId from token
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      forceLogoutRetryAfter?: number;
      singleDeviceKick?: boolean;
    }
  }
}

// Middleware to extract userId from either session or Bearer token
function extractUserId(req: Request, _res: Response, next: NextFunction) {
  if (req.sessionID) {
    // Vérifier si cette session a été kické pour connexion sur autre appareil
    if (singleDeviceKicks.has(req.sessionID)) {
      singleDeviceKicks.delete(req.sessionID);
      req.singleDeviceKick = true;
      return next();
    }
    // Vérifier si cette session a été révoquée (blocage IP / changement d'IP)
    const revokedUntil = revokedSessions.get(req.sessionID);
    if (revokedUntil) {
      if (Date.now() < revokedUntil) {
        req.forceLogoutRetryAfter = revokedUntil;
        return next();
      }
      revokedSessions.delete(req.sessionID);
    }
  }

  let userId: string | undefined;

  if (req.session?.userId) {
    userId = req.session.userId;
    // Backfill clientIp dans les sessions existantes créées avant le fix
    if (!req.session.clientIp) {
      req.session.clientIp = getClientIp(req);
      req.session.save(() => {});
    }
  } else {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const id = getUserIdFromToken(token);
      if (id) {
        userId = id;
        // Persister le userId dans la session si absent (bearer token sur nouvel appareil)
        // → l'appareil apparaîtra dans la liste des sessions connectées
        // EXCEPTION: ne pas créer de session éphémère pour les endpoints de gestion de sessions
        // eux-mêmes — sinon chaque appel GET /api/user/sessions recrée immédiatement une session
        // dans Supabase après une déconnexion, faisant réapparaître l'appareil dans la liste.
        const isSessionMgmtPath = req.path === "/api/user/sessions" ||
          req.path.startsWith("/api/user/sessions/");
        if (!isSessionMgmtPath && req.session && !req.session.userId) {
          req.session.userId = id;
          if (!req.session.clientIp) req.session.clientIp = getClientIp(req);
          if (!req.session.userAgent) req.session.userAgent = req.headers["user-agent"] || "";
          if (!req.session.loginAt) req.session.loginAt = new Date().toISOString();
          // Store token timestamp to identify THIS session across PM2 workers
          // (req.sessionID is unreliable on prod with Cloudflare proxy / Bearer-only auth)
          const tokenTs = extractTokenTimestamp(token);
          if (tokenTs) req.session.tokenIssuedAt = tokenTs;
          req.session.save(() => {});
        } else if (req.session?.userId === id && !req.session.tokenIssuedAt) {
          // Backfill tokenIssuedAt for existing sessions that were created before this fix
          const tokenTs = extractTokenTimestamp(token);
          if (tokenTs) {
            req.session.tokenIssuedAt = tokenTs;
            req.session.save(() => {});
          }
        }
      } else {
        // Token invalide — vérifier si c'est à cause d'une révocation single-device
        // (token valide en signature/expiration mais révoqué via revokedTokensBefore)
        const rawId = getTokenUserIdIgnoreRevocation(token);
        if (rawId) {
          const revokedBefore = revokedTokensBefore.get(rawId);
          if (revokedBefore) {
            try {
              const decoded = Buffer.from(token, "base64url").toString();
              const tokenTs = parseInt(decoded.split(".")[1]);
              if (!isNaN(tokenTs) && tokenTs < revokedBefore) {
                req.singleDeviceKick = true;
                return next();
              }
            } catch {}
          }
        }
      }
    }
  }

  if (userId) {
    const until = forcedLogoutMap.get(userId);
    if (until && Date.now() < until) {
      req.forceLogoutRetryAfter = until;
    } else {
      if (until) forcedLogoutMap.delete(userId);
      req.userId = userId;
    }
  }

  next();
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.singleDeviceKick) {
    return res.status(401).json({
      message: "Votre compte a été connecté sur un autre appareil ou navigateur. Reconnectez-vous.",
      sessionRevoked: true,
    });
  }

  // Vérification IP bloquée sur CHAQUE requête authentifiée.
  // EXCEPTION : les routes /api/admin/ ne sont PAS soumises au blocage automatique
  // par taux d'échec — n'importe quelle IP peut accéder au panneau admin.
  // Le blocage admin spécifique (manuel) est géré dans requireAdmin.
  const isAdminPath = req.path.startsWith("/api/admin/");
  if (!isAdminPath) {
    const ip = getClientIp(req);
    const ipCheck = checkAuthRateLimit(ip);
    if (ipCheck.blocked && ipCheck.retryAfter) {
      return res.status(401).json({
        message: "Votre adresse IP est temporairement bloquée.",
        sessionRevoked: true,
        retryAfter: ipCheck.retryAfter,
      });
    }
  }

  if (req.forceLogoutRetryAfter) {
    return res.status(401).json({
      message: "Session terminée pour raison de sécurité.",
      sessionRevoked: true,
      retryAfter: req.forceLogoutRetryAfter,
    });
  }
  if (!req.userId) {
    console.log("Auth failed - No userId");
    return res.status(401).json({ message: "Non autorisé" });
  }

  // ── Inactivity-based session expiry ──────────────────────────────────────────
    // Admin/support/finance: 24h — Regular users: 24h
  {
    const now = Date.now();
    const lastActivity = req.session.lastActivity;
    if (lastActivity) {
      const role = req.session.role ?? "";
      const isPrivileged = ["admin"].includes(role);
      const maxInactivity = isPrivileged
        ? ADMIN_REAUTH_INACTIVITY_TTL_MS // 24h for admin
        : 24 * 60 * 60 * 1000; // 24h for regular users
      if (now - lastActivity > maxInactivity) {
        req.session.destroy(() => {});
        const label = "24h";
        return res.status(401).json({
          message: `Session expirée après ${label} d'inactivité. Reconnectez-vous.`,
          sessionRevoked: true,
          inactivityExpired: true,
        });
      }
    }
    // Slide lastActivity forward on every authenticated request
    req.session.lastActivity = now;
  }

  // ── Session IP consistency check — detect potential cookie hijacking ──────────
  // Compare current IP with IP stored at login. For regular users: log only (mobile
  // switches IPs frequently). Flag it in logs for SIEM review.
  if (req.session?.clientIp) {
    const currentIp = getClientIp(req);
    const sessionIp = req.session.clientIp;
    const normalize = (ip: string) =>
      ip === "::1" || ip === "::ffff:127.0.0.1" ? "127.0.0.1" : ip;
    if (normalize(currentIp) !== normalize(sessionIp)) {
      console.warn(`[SessionGuard] IP CHANGE — userId=${req.userId} sessionIp=${sessionIp} currentIp=${currentIp} sid=${req.sessionID?.slice(0,8)} — possible cookie theft or mobile switch`);
    }
  }

  next();
}

// ── Admin route cloaking ─────────────────────────────────────────────────────
// Do not reveal the existence of admin API routes to unauthenticated visitors
// or regular users. This runs before requireAdminPin and before every admin
// handler, so all /api/admin/* endpoints have the same external behavior.
async function cloakAdminRoutes(req: Request, res: Response, next: NextFunction) {
  if (!req.userId) {
    console.warn(`[AdminAccess] HIDDEN 404 — no userId — path=${req.path}`);
    return sendClean404(res);
  }

  try {
    const user = await storage.getUser(req.userId);
    if (!user || user.role !== "admin") {
      console.warn(
        `[AdminAccess] HIDDEN 404 — user=${req.userId} role=${user?.role ?? "missing"} — path=${req.path}`,
      );
      // Keep the existing forced logout behavior for authenticated non-admins.
      if (user) {
        req.session.destroy(() => {});
        res.clearCookie("connect.sid");
      }
      return sendClean404(res);
    }
  } catch (error: any) {
    console.error(`[AdminAccess] DB ERROR cloaking route ${req.path}:`, error?.message);
    // Fail closed: a database lookup failure must not reveal an admin route.
    return sendClean404(res);
  }

  next();
}

async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const adminIpEarly = getClientIp(req);
  if (!req.userId) {
    console.warn(`[AdminAccess] BLOCKED — no userId — path=${req.path} sid=${req.sessionID?.slice(0,8)}`);
    notifyAdminPanelAccess({ type: "blocked_no_auth", ip: adminIpEarly, path: req.path }).catch(() => {});
    return sendClean404(res);
  }

  // Always re-fetch role from DB — never trust session cache (CWE-287 Vector 3 fix)
  let user: Awaited<ReturnType<typeof storage.getUser>>;
  try {
    user = await storage.getUser(req.userId);
  } catch (dbErr: any) {
    console.error(`[AdminAccess] DB ERROR fetching user ${req.userId} — path=${req.path}:`, dbErr?.message);
    return sendClean404(res);
  }

  if (!user) {
    console.warn(`[AdminAccess] BLOCKED — user ${req.userId} not found in DB — path=${req.path}`);
    notifyAdminPanelAccess({ type: "blocked_no_role", ip: adminIpEarly, userId: req.userId, path: req.path }).catch(() => {});
    return sendClean404(res);
  }
  if (!["admin"].includes(user.role)) {
    console.warn(`[AdminAccess] BLOCKED+LOGOUT — user ${req.userId} has role="${user.role}" (not admin) — path=${req.path}`);
    notifyAdminPanelAccess({ type: "blocked_no_role", ip: adminIpEarly, userId: user.id, userName: user.fullName || user.username, userEmail: user.email || undefined, userRole: user.role, path: req.path }).catch(() => {});
    // Force logout — destroy session immediately so the intruder is kicked out
    req.session.destroy(() => {});
    res.clearCookie("connect.sid");
    return sendClean404(res);
  }

  // ── Check admin panel IP blocklist ───────────────────────────────────────────
  // Any IP can access by default. Only IPs manually blocked by an admin are denied.
  const panelBlockedIps = await loadAdminPanelBlockedIps();
  if (isIpBannedFromAdmin(adminIpEarly, panelBlockedIps)) {
    console.warn(`[AdminAccess] BLOCKED — IP ${adminIpEarly} is on admin panel blocklist — user=${req.userId} path=${req.path}`);
    notifyAdminPanelAccess({ type: "blocked_ip", ip: adminIpEarly, userId: user.id, userName: user.fullName || user.username, userEmail: user.email || undefined, userRole: user.role, path: req.path }).catch(() => {});
    return res.status(403).json({ message: "Votre adresse IP est bloquée du panneau d'administration.", ipBanned: true });
  }

  if (ADMIN_TOTP_ENFORCEMENT_ENABLED) {
    // ── Mandatory Google Authenticator (TOTP) — enforced server-side ───────────
    // Every admin API call requires TOTP to be (1) configured and (2) verified in
    // this session.
    if (!user.totpEnabled || !user.totpSecret) {
      console.warn(`[AdminAccess] BLOCKED — TOTP not configured — user=${req.userId} role=${user.role} path=${req.path}`);
      notifyAdminPanelAccess({ type: "blocked_no_auth", ip: adminIpEarly, userId: user.id, userName: user.fullName || user.username, userEmail: user.email || undefined, userRole: user.role, path: req.path }).catch(() => {});
      return res.status(403).json({
        message: "Google Authenticator obligatoire. Configurez-le pour accéder au panneau admin.",
        totpNotConfigured: true,
      });
    }

    // Tier 1: in-memory map (instant — no async)
    const nowTotp = Date.now();
    const avsMemEntry = adminVerifiedSessions.get(req.sessionID);
    let avsOk = !!(avsMemEntry && avsMemEntry.userId === req.userId && avsMemEntry.expiresAt > nowTotp);

    // Tier 2: session cookie (no extra round-trip)
    if (!avsOk) {
      const avsExp = req.session._avs;
      if (typeof avsExp === "number" && avsExp > nowTotp) {
        avsOk = true;
        adminVerifiedSessions.set(req.sessionID, { userId: req.userId!, expiresAt: avsExp, ip: req.session._avsIp });
      }
    }

    // Tier 3: DB (multi-process / cold-start fallback — same logic as otp-status)
    if (!avsOk && req.sessionID) {
      for (const queryPool of [sessionPool, pool]) {
        try {
          const dbRow = await queryPool.query(
            `SELECT sess FROM session WHERE sid = $1 AND expire > NOW()`,
            [req.sessionID]
          );
          if (dbRow.rows.length > 0) {
            const sessData = typeof dbRow.rows[0].sess === "string"
              ? JSON.parse(dbRow.rows[0].sess)
              : dbRow.rows[0].sess;
            const dbAvs = sessData?._avs;
            if (typeof dbAvs === "number" && dbAvs > nowTotp) {
              avsOk = true;
              const dbAvsIp = typeof sessData?._avsIp === "string" ? sessData._avsIp : undefined;
              if (dbAvsIp) req.session._avsIp = dbAvsIp;
              adminVerifiedSessions.set(req.sessionID, { userId: req.userId!, expiresAt: dbAvs, ip: dbAvsIp });
            }
          }
          break;
        } catch { /* try next pool */ }
      }
    }

    if (!avsOk) {
      // Session expiry for a legitimate admin — NOT an attack. Do not send Telegram alert.
      // Only log locally so the admin knows to re-verify TOTP.
      console.info(`[AdminAccess] TOTP session expired — user=${req.userId} role=${user.role} path=${req.path} — redirecting to panel-verify`);
      return res.status(403).json({
        message: "Vérification Google Authenticator requise pour accéder au panneau admin.",
        totpRequired: true,
      });
    }

    // ── Admin session IP pinning — prevent stolen cookie reuse from a different IP ──
    // _avsIp is stored when TOTP is verified. If the current IP differs, the _avs is
    // invalidated immediately and the admin must re-verify with Google Authenticator.
    // Grace: IPv6 ↔ IPv4 loopback equivalences are tolerated (::1 === 127.0.0.1).
    const avsIp = req.session._avsIp || avsMemEntry?.ip;
    const normalizeLoopback = (ip: string) =>
      ip === "::1" || ip === "::ffff:127.0.0.1" ? "127.0.0.1" : ip;
    if (!avsIp || normalizeLoopback(adminIpEarly) !== normalizeLoopback(avsIp)) {
      // Refuse legacy/unbound _avs values as well as values from another IP.
      // A fresh TOTP verification is required to bind the session securely.
      delete req.session._avs;
      delete req.session._avsIp;
      req.session.save(() => {});
      adminVerifiedSessions.delete(req.sessionID);
      const ipChanged = !!avsIp;
      console.warn(`[AdminAccess] TOTP session binding rejected — user=${req.userId} avsIp=${avsIp || "missing"} currentIp=${adminIpEarly} — _avs revoked`);
      notifyAdminPanelAccess({ type: "blocked_no_auth", ip: adminIpEarly, userId: user.id, userName: user.fullName || user.username, userEmail: user.email || undefined, userRole: user.role, path: req.path }).catch(() => {});
      return res.status(403).json({
        message: ipChanged
          ? "Votre adresse IP a changé. Vérification Google Authenticator requise."
          : "Vérification Google Authenticator requise pour cette session.",
        totpRequired: true,
        ...(ipChanged ? { ipChanged: true } : {}),
      });
    }

    // The panel TOTP is a separate gate from the login TOTP. It must still be
    // valid when an admin API request is made.
    const panelTotpExp = req.session._pav;
    if (typeof panelTotpExp !== "number" || panelTotpExp <= Date.now()) {
      return res.status(403).json({
        message: "Vérification Google Authenticator requise pour accéder au panneau admin.",
        totpRequired: true,
        panelTotpRequired: true,
      });
    }

    // ── Slide all admin factors by 24h on every successful panel access ─────
    const newAvsExp = Date.now() + ADMIN_OTP_SESSION_TTL_MS;
    req.session._avs = newAvsExp;
    req.session._avsIp = adminIpEarly;
    adminVerifiedSessions.set(req.sessionID, { userId: req.userId!, expiresAt: newAvsExp, ip: adminIpEarly });

    // A valid login/panel TOTP is not enough to open the admin panel.
    // The second gate is the server-side admin PIN, bound to the same IP.
    const panelPinExp = req.session._ppv;
    const panelPinIp = req.session._ppvIp;
    if (typeof panelPinExp !== "number" || panelPinExp <= Date.now() ||
        !panelPinIp || normalizeLoopback(panelPinIp) !== normalizeLoopback(adminIpEarly)) {
      return res.status(403).json({
        message: "Code PIN admin requis pour accéder au panneau d'administration.",
        pinRequired: true,
        panelPinRequired: true,
      });
    }

    const newPanelAuthExp = Date.now() + ADMIN_PANEL_ACCESS_TTL_MS;
    req.session._pav = newPanelAuthExp;
    req.session._ppv = newPanelAuthExp;
    req.session._ppvIp = adminIpEarly;
    req.session.save(() => {});
  }

  console.log(`[AdminAccess] OK — user=${req.userId} role=${user.role} path=${req.path}`);

  // ── Telegram notification — 1x par session toutes les 30 min (anti-spam) ───
  const nowMs = Date.now();
  const lastNotif = adminAccessNotifCache.get(req.sessionID);
  if (!lastNotif || nowMs - lastNotif >= ADMIN_ACCESS_NOTIF_INTERVAL_MS) {
    adminAccessNotifCache.set(req.sessionID, nowMs);
    notifyAdminPanelAccess({ type: "panel_access", ip: adminIpEarly, userId: user.id, userName: user.fullName || user.username, userEmail: user.email || undefined, userRole: user.role, path: req.path }).catch(() => {});
  }

  next();
}

function generateSlug(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.randomBytes(8);
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

// Generate ASHPAY transaction reference
function generateTransactionReference(type: string): string {
  const prefix = "ASHPAY";
  const typeCode = type.toUpperCase().substring(0, 3); // DEP, WIT, TRA, PAY
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `${prefix}-${typeCode}-${timestamp}-${random}`;
}

// loadFxRates, convertFromXAF, convertToXAF, creditUserWallet, cleanupEmptyWallets
// are imported from ./walletHelper

const ASHTECH_MARGIN = 2;

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ─── Dummy hash for timing-safe login (CWE-307 / user-enumeration fix) ────────
// Always run bcrypt even when the user doesn't exist so that response time is
// indistinguishable between "unknown email" and "wrong password" scenarios.
// Pre-computed at startup — cost=10, same as real passwords.
const DUMMY_BCRYPT_HASH = "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

// ─── OTP context cache (keyed by transaction ref, expires after 15 min) ───────
type OtpContext = {
  userId?: string;
  operator: string;
  country: string;
  phone: string;
  amount: number;
  currency: string;
  afribaTransactionId: string;
  expiresAt: number;
  otpType?: "api" | "ussd";
};
const otpContextCache = new Map<string, OtpContext>();

async function persistOtpContext(reference: string, context: OtpContext): Promise<void> {
  if (isMysqlDialect) {
    await pool.query(
      `INSERT INTO api_otp_sessions (reference, user_id, context, expires_at)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         user_id = VALUES(user_id), context = VALUES(context), expires_at = VALUES(expires_at)`,
      [reference, context.userId || null, JSON.stringify(context), new Date(context.expiresAt)],
    );
    otpContextCache.set(reference, context);
    return;
  }
  await db.execute(sql`
    INSERT INTO api_otp_sessions (reference, user_id, context, expires_at)
    VALUES (${reference}, ${context.userId || null}, ${JSON.stringify(context)}::jsonb, to_timestamp(${context.expiresAt / 1000}))
    ON CONFLICT (reference) DO UPDATE
      SET user_id = EXCLUDED.user_id, context = EXCLUDED.context, expires_at = EXCLUDED.expires_at
  `);
  otpContextCache.set(reference, context);
}

async function loadOtpContext(reference: string): Promise<OtpContext | undefined> {
  const cached = otpContextCache.get(reference);
  if (cached) return cached;
  if (isMysqlDialect) {
    const result = await pool.query(
      `SELECT context FROM api_otp_sessions
       WHERE reference = ? AND expires_at > NOW() LIMIT 1`,
      [reference],
    );
    const context = result.rows[0]?.context as OtpContext | undefined;
    if (context) otpContextCache.set(reference, context);
    return context;
  }
  const result = await db.execute(sql`
    SELECT context FROM api_otp_sessions
    WHERE reference = ${reference} AND expires_at > NOW()
    LIMIT 1
  `);
  const context = (result.rows[0] as any)?.context as OtpContext | undefined;
  if (context) otpContextCache.set(reference, context);
  return context;
}

async function deleteOtpContext(reference: string): Promise<void> {
  otpContextCache.delete(reference);
  if (isMysqlDialect) {
    await pool.query(`DELETE FROM api_otp_sessions WHERE reference = ?`, [reference]);
  } else {
    await db.execute(sql`DELETE FROM api_otp_sessions WHERE reference = ${reference}`);
  }
}

setInterval(() => {
  const now = Date.now();
  for (const [key, ctx] of otpContextCache.entries()) {
    if (ctx.expiresAt < now) otpContextCache.delete(key);
  }
  if (isMysqlDialect) {
    pool.query(`DELETE FROM api_otp_sessions WHERE expires_at < NOW()`).catch(() => {});
  } else {
    db.execute(sql`DELETE FROM api_otp_sessions WHERE expires_at < NOW()`).catch(() => {});
  }
}, 5 * 60 * 1000); // Clean expired entries every 5 min

// ─── Forced-logout map : userId → blockedUntil timestamp ─────────────────────
const forcedLogoutMap = new Map<string, number>();
// Map sessionId → expiresAt : sessions révoquées (ex : blocage IP)
const revokedSessions = new Map<string, number>();
// Set sessionId : sessions kické pour connexion sur autre appareil (1 session max)
const singleDeviceKicks = new Set<string>();
// Map userId → timestamp : les Bearer tokens émis AVANT ce moment sont invalides
const revokedTokensBefore = new Map<string, number>();
// Map userId → Set<tokenIssuedAt> : tokens d'appareils spécifiques révoqués (déconnexion par appareil)
const revokedSpecificTokenTs = new Map<string, Set<number>>();
// Map userId → dernière IP de connexion connue
const activeIpRegistry = new Map<string, string>();

// ─── Ring buffer : 100 dernières erreurs sur les opérations de session ────────
interface SessionOpError {
  at: string;           // ISO timestamp
  op: string;           // "disconnect_one" | "disconnect_all" | "list"
  userId?: string;
  targetSid?: string;
  pool: string;         // "session" | "main" | "both_failed"
  error: string;
  stack?: string;
}
const SESSION_OP_ERRORS_MAX = 100;
const sessionOpErrors: SessionOpError[] = [];
function pushSessionError(e: SessionOpError) {
  sessionOpErrors.push(e);
  if (sessionOpErrors.length > SESSION_OP_ERRORS_MAX) sessionOpErrors.shift();
}

async function readMysqlSessionRows(): Promise<Array<{ sid: string; userId?: string; clientIp?: string }>> {
  const result = await pool.query(`SELECT sid, sess FROM session`);
  return result.rows.flatMap((row: any) => {
    try {
      const parsed = typeof row.sess === "string" ? JSON.parse(row.sess) : row.sess;
      return [{
        sid: String(row.sid),
        userId: typeof parsed?.userId === "string" ? parsed.userId : undefined,
        clientIp: typeof parsed?.clientIp === "string" ? parsed.clientIp : undefined,
      }];
    } catch {
      return [];
    }
  });
}

async function destroyUserSessions(userId: string, blockedUntil: number): Promise<void> {
  try {
    // Marque les sessions comme révoquées AVANT la suppression pour que
    // les requêtes en cours reçoivent sessionRevoked:true
    const sessionRows = isMysqlDialect
      ? (await readMysqlSessionRows()).filter((row) => row.userId === userId)
      : (await db.execute(sql`SELECT sid FROM session WHERE sess->>'userId' = ${userId}`)).rows as { sid: string }[];
    for (const row of sessionRows) {
      revokedSessions.set(row.sid, blockedUntil);
    }
    forcedLogoutMap.set(userId, blockedUntil);
    revokedTokensBefore.set(userId, Date.now());
    // Pousse la déconnexion immédiatement via SSE (sans attendre la prochaine requête)
    notifyUserForceLogout(userId, blockedUntil);
    if (isMysqlDialect) {
      for (const row of sessionRows) await pool.query(`DELETE FROM session WHERE sid = ?`, [row.sid]);
    } else {
      await db.execute(sql`DELETE FROM session WHERE sess->>'userId' = ${userId}`);
    }
    console.log(`[Auth] destroyUserSessions — userId=${userId} déconnecté immédiatement`);
  } catch (err: any) {
    console.error("[Auth] Failed to destroy sessions for user:", userId, err?.message);
  }
}

// Révocation de sessions lors d'un changement d'IP : marque les anciennes sessions
// individuellement pour qu'elles reçoivent sessionRevoked:true, puis les supprime.
async function revokeSessionsForIpChange(userId: string): Promise<void> {
  try {
    const sessionRows = isMysqlDialect
      ? (await readMysqlSessionRows()).filter((row) => row.userId === userId)
      : (await db.execute(sql`SELECT sid FROM session WHERE sess->>'userId' = ${userId}`)).rows as { sid: string }[];
    const expiresAt = Date.now() + 30 * 60 * 1000;
    for (const row of sessionRows) {
      revokedSessions.set(row.sid, expiresAt);
    }
    if (isMysqlDialect) {
      for (const row of sessionRows) await pool.query(`DELETE FROM session WHERE sid = ?`, [row.sid]);
    } else {
      await db.execute(sql`DELETE FROM session WHERE sess->>'userId' = ${userId}`);
    }
    revokedTokensBefore.set(userId, Date.now());
    console.log(`[Auth] IP change — sessions révoquées pour userId=${userId}`);
  } catch (err: any) {
    console.error("[Auth] revokeSessionsForIpChange failed:", err?.message);
  }
}

// Révocation de toutes les sessions actives provenant d'une IP bloquée.
// Interroge directement la table session PostgreSQL (champ clientIp persisté au login)
// → fonctionne même après un redémarrage serveur.
async function revokeSessionsByIp(ip: string, blockedUntil: number): Promise<void> {
  try {
    // Cherche toutes les sessions dont l'IP stockée correspond à l'IP bloquée
    const rows = isMysqlDialect
      ? (await readMysqlSessionRows())
          .filter((row) => row.clientIp === ip)
          .map((row) => ({ sid: row.sid, user_id: row.userId || "" }))
      : (await db.execute(
          sql`SELECT sid, sess->>'userId' as user_id FROM session WHERE sess->>'clientIp' = ${ip}`
        )).rows as { sid: string; user_id: string }[];
    if (rows.length === 0) return;

    // Déduplique les userIds
    const userIds = [...new Set(rows.map(r => r.user_id).filter(Boolean))];
    console.log(`[Auth] IP blocked (${ip}) — révocation de ${rows.length} session(s) pour ${userIds.length} utilisateur(s)`);

    // Marque chaque session comme révoquée (réponse sessionRevoked:true au prochain appel)
    for (const row of rows) {
      revokedSessions.set(row.sid, blockedUntil);
    }

    // Notifie via SSE pour déconnexion immédiate dans les onglets ouverts
    for (const userId of userIds) {
      notifyUserForceLogout(userId, blockedUntil);
      forcedLogoutMap.set(userId, blockedUntil);
      revokedTokensBefore.set(userId, Date.now());
    }

    // Supprime les sessions de la DB
    if (isMysqlDialect) {
      for (const row of rows) await pool.query(`DELETE FROM session WHERE sid = ?`, [row.sid]);
    } else {
      await db.execute(sql`DELETE FROM session WHERE sess->>'clientIp' = ${ip}`);
    }
    console.log(`[Auth] IP block — sessions supprimées pour IP=${ip}`);
  } catch (err: any) {
    console.error("[Auth] revokeSessionsByIp failed:", err?.message);
  }
}

// Révocation des autres sessions pour la règle "1 session active max par compte"
// Les sessions expulsées reçoivent sessionRevoked:true sans retryAfter → redirigées vers /login
async function revokeOtherSessionsForSingleDevice(userId: string): Promise<void> {
  try {
    const sessionRows = isMysqlDialect
      ? (await readMysqlSessionRows()).filter((row) => row.userId === userId)
      : (await db.execute(sql`SELECT sid FROM session WHERE sess->>'userId' = ${userId}`)).rows as { sid: string }[];
    for (const row of sessionRows) {
      singleDeviceKicks.add(row.sid);
    }
    // Pousser l'événement SSE en temps réel AVANT de supprimer les sessions
    // → l'ancien navigateur reçoit force_logout immédiatement via la connexion SSE ouverte
    notifyUserForceLogout(userId, undefined, "new_device");
    if (isMysqlDialect) {
      for (const row of sessionRows) await pool.query(`DELETE FROM session WHERE sid = ?`, [row.sid]);
    } else {
      await db.execute(sql`DELETE FROM session WHERE sess->>'userId' = ${userId}`);
    }
    const revokedAt = Date.now();
    revokedTokensBefore.set(userId, revokedAt);
    // Persister en DB pour survivre aux redémarrages du serveur
    await db.execute(sql`UPDATE users SET token_revoked_before = ${revokedAt} WHERE id = ${userId}`);
    console.log(`[Auth] Single-device — ${sessionRows.length} session(s) révoquée(s) pour userId=${userId}`);
  } catch (err: any) {
    console.error("[Auth] revokeOtherSessionsForSingleDevice failed:", err?.message);
  }
}

// Charge les révocations de tokens depuis la DB au démarrage pour les restaurer en mémoire
async function loadTokenRevocationsFromDb(): Promise<void> {
  try {
    const result = await db.execute(
      drizzleSql`SELECT id, token_revoked_before FROM users WHERE token_revoked_before IS NOT NULL AND token_revoked_before > 0`
    );
    let count = 0;
    for (const row of result.rows as { id: string; token_revoked_before: number }[]) {
      if (row.token_revoked_before > 0) {
        revokedTokensBefore.set(row.id, Number(row.token_revoked_before));
        count++;
      }
    }
    if (count > 0) console.log(`[Auth] Restauré ${count} révocation(s) de tokens depuis la DB`);
  } catch (err: any) {
    console.warn("[Auth] Impossible de charger les révocations depuis la DB:", err?.message);
  }
}

setInterval(() => {
  const now = Date.now();
  for (const [uid, until] of forcedLogoutMap.entries()) {
    if (now > until) forcedLogoutMap.delete(uid);
  }
  for (const [sid, until] of revokedSessions.entries()) {
    if (now > until) revokedSessions.delete(sid);
  }
  for (const [uid, ts] of revokedTokensBefore.entries()) {
    if (now - ts > TOKEN_EXPIRY_MS) revokedTokensBefore.delete(uid);
  }
  // revokedSpecificTokenTs : nettoyer les timestamps expirés (> 3 jours)
  for (const [uid, tsSet] of revokedSpecificTokenTs.entries()) {
    for (const ts of tsSet) {
      if (now - ts > TOKEN_EXPIRY_MS) tsSet.delete(ts);
    }
    if (tsSet.size === 0) revokedSpecificTokenTs.delete(uid);
  }
  // singleDeviceKicks : vider les sessions non réclamées après 10 min
  // (cas rare où le navigateur ne refait jamais de requête)
  if (singleDeviceKicks.size > 500) singleDeviceKicks.clear();
}, 5 * 60 * 1000);

function getClientIp(req: Request): string {
  // CF-Connecting-IP is the real client IP set by Cloudflare (overrides proxy IPs)
  const cfIp = req.headers["cf-connecting-ip"];
  if (cfIp) return Array.isArray(cfIp) ? cfIp[0].trim() : cfIp.trim();

  // True-Client-IP is also set by Cloudflare Enterprise plans
  const trueIp = req.headers["true-client-ip"];
  if (trueIp) return Array.isArray(trueIp) ? trueIp[0].trim() : trueIp.trim();

  const realIp = req.headers["x-real-ip"];
  if (realIp) return Array.isArray(realIp) ? realIp[0].trim() : realIp.trim();

  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    return raw.split(",")[0].trim();
  }
  return req.ip || "unknown";
}


// ─── African Country Codes ────────────────────────────────────────────────────
const AFRICAN_COUNTRY_CODES = new Set([
  "DZ","AO","BJ","BW","BF","BI","CM","CV","CF","TD","KM","CG","CD",
  "CI","DJ","EG","GQ","ER","ET","GA","GM","GH","GN","GW","KE","LS",
  "LR","LY","MG","MW","ML","MR","MU","MA","MZ","NA","NE","NG","RW",
  "ST","SN","SL","SO","ZA","SS","SD","SZ","TZ","TG","TN","UG","ZM",
  "ZW","EH","SC","RE","YT","MU",
]);

function isPrivateIp(ip: string): boolean {
  return (
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip.startsWith("10.") ||
    ip.startsWith("172.") ||
    ip.startsWith("192.168.") ||
    ip.startsWith("::ffff:10.") ||
    ip.startsWith("::ffff:127.") ||
    ip.startsWith("::ffff:172.") ||
    ip.startsWith("::ffff:192.168.")
  );
}

// ─── VPN / Proxy detection cache ──────────────────────────────────────────────
const vpnCache = new Map<string, { isVpn: boolean; ts: number }>();
const VPN_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function checkVpnOrProxy(ip: string): Promise<boolean> {
  if (isPrivateIp(ip)) return false;
  const cached = vpnCache.get(ip);
  if (cached && Date.now() - cached.ts < VPN_CACHE_TTL_MS) return cached.isVpn;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(
      `https://ip-api.com/json/${ip}?fields=status,proxy,hosting`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);
    const data: any = await res.json();
    const isVpn = data.status === "success" && (data.proxy === true || data.hosting === true);
    vpnCache.set(ip, { isVpn, ts: Date.now() });
    return isVpn;
  } catch {
    return false;
  }
}

// Clean up VPN cache periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of vpnCache.entries()) {
    if (now - entry.ts > VPN_CACHE_TTL_MS) vpnCache.delete(ip);
  }
}, 10 * 60 * 1000);

// ─── Helper : résoudre le chemin d'un fichier en URL publique ────────────────
async function resolveFileUrl(filePath: string): Promise<string | null> {
  if (!filePath) return null;
  // Already a full URL (Supabase public/signed URL)
  if (filePath.startsWith("http")) return filePath;
  // Determine the base domain: prefer APP_URL (production), fallback REPLIT_DEV_DOMAIN (dev)
  const appUrl = process.env.APP_URL || (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : null);
  // Local /uploads/ path
  if (filePath.startsWith("/uploads/")) {
    return appUrl ? `${appUrl}${filePath}` : null;
  }
  // Supabase storage path (e.g. "kyc/timestamp-file.jpg")
  try {
    const { getSignedImageUrl } = await import("./supabase");
    const signed = await getSignedImageUrl(filePath, 3600);
    if (signed) return signed;
  } catch {}
  // Fallback: treat as local uploads
  return appUrl ? `${appUrl}/uploads/${filePath}` : null;
}

/**
 * Sanitize upstream gateway messages before returning them to merchants/customers.
 * If the upstream message mentions an internal provider name (AfribaPay/PixPay),
 * the raw message is logged server-side and a neutral fallback is returned instead.
 */
function sanitizeGatewayMessage(msg: string | null | undefined, fallback: string): string {
  if (!msg || !msg.trim()) return fallback;
  if (/afribapay|pixpay/i.test(msg)) {
    console.warn(`[GatewaySanitize] provider name stripped from upstream message: ${msg}`);
    return fallback;
  }
  return msg.trim();
}

function isDefinitivePayoutRejection(result: {
  message?: string | null;
  status?: string | null;
  providerCode?: string | null;
  providerStatus?: number | string | null;
}): boolean {
  const status = String(result.status || "").trim().toLowerCase();
  if (["failed", "refunded", "cancelled", "canceled", "rejected", "not_found", "not found"].includes(status)) return true;

  const providerStatus = Number(result.providerStatus);
  if (providerStatus === 404) return true;

  const message = `${String(result.message || "")} ${String(result.providerCode || "")}`.toLocaleLowerCase();
  return (
    message.includes("invalid phone") ||
    message.includes("invalid number") ||
    message.includes("invalid operator") ||
    message.includes("numéro invalide") ||
    message.includes("numero invalide") ||
    message.includes("opérateur invalide") ||
    message.includes("operateur invalide") ||
    message.includes("not supported") ||
    message.includes("unsupported") ||
    message.includes("non supporté") ||
    message.includes("non supporte") ||
    message.includes("opération non supportée") ||
    message.includes("operation non supportee") ||
    message.includes("blacklist") ||
    message.includes("opération refusée") ||
    message.includes("operation refusee") ||
    message.includes("not found") ||
    message.includes("not_found") ||
    message.includes("introuvable") ||
    message.includes("does not exist") ||
    message.includes("transaction inconnue") ||
    message.includes("payout inconnue")
  );
}

function createProviderFailure(
  message: string,
  details: { provider: string; raw?: unknown; providerCode?: unknown; providerStatus?: unknown },
): Error & typeof details {
  const error = new Error(message) as Error & typeof details;
  Object.assign(error, details);
  return error;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Restaurer les révocations de tokens depuis la DB sans bloquer l'ouverture
  // des routes. Sur Plesk/Supavisor, une requête de restauration peut attendre
  // une connexion alors que le serveur est déjà capable de servir la page.
  // La carte est hydratée dès que la DB répond ; le démarrage HTTP reste rapide.
  void loadTokenRevocationsFromDb();

  // ── Filet de sécurité global : aucune réponse non-admin ne doit contenir
  //    un nom de fournisseur interne (AfribaPay/PixPay), même en cas d'erreur
  //    imprévue. Purge les champs texte "message" / "error" juste avant l'envoi.
  const PROVIDER_NAME_RE = /afriba\s*pay|pix\s*pay|pawa\s*pay/gi;
  app.use((req, res, next) => {
    if (req.path.startsWith("/api/admin") || req.path.startsWith("/api/pixpay/webhook") || req.path.startsWith("/api/afribapay/webhook") || req.path.startsWith("/api/pawapay/")) return next();
    const originalJson = res.json.bind(res);
    res.json = ((body: any) => {
      try {
        if (body && typeof body === "object" && !Array.isArray(body)) {
          for (const key of ["message", "error", "detail"]) {
            const v = (body as any)[key];
            if (typeof v === "string" && PROVIDER_NAME_RE.test(v)) {
              PROVIDER_NAME_RE.lastIndex = 0;
              console.warn(`[ResponseSanitize] ${req.method} ${req.path} — provider name stripped from "${key}": ${v}`);
              (body as any)[key] = v.replace(PROVIDER_NAME_RE, "notre partenaire de paiement");
            }
            PROVIDER_NAME_RE.lastIndex = 0;
          }
        }
      } catch { /* never block the response */ }
      return originalJson(body);
    }) as any;
    next();
  });

  /**
   * Resolve the crypto Pay-In split from the Crypto settings in the
   * Pays et opérateurs administration page.
   *
   * Crypto pricing is global: it does not depend on the payer's country or
   * Mobile Money operator. The two fee settings are the provider fee and the
   * AshTechPay margin; the total is always their sum.
   */
  async function resolveCryptoFeeBreakdown(
    grossUsdt: number,
  ) {
    const [ashtechSetting, providerSetting] = await Promise.all([
      storage.getSetting("izichange_fee_percent"),
      storage.getSetting("izichange_provider_fee_percent"),
    ]);

    let ashtechPercent = parseFloat(ashtechSetting?.value || "2.5");
    let providerPercent = parseFloat(providerSetting?.value || "0");
    return computeDirectCryptoFeeBreakdown(grossUsdt, providerPercent, ashtechPercent);
  }

  // Serve uploaded files statically.
  // H-6 hardening: force download disposition + nosniff so a stray script-like
  // upload can never be interpreted/executed by the browser as HTML/JS, even if
  // the reverse proxy were ever misconfigured to execute files from this folder.
  const express = await import("express");
  app.use("/uploads", express.default.static(uploadsDir, {
    setHeaders: (res, filePath) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox;");
      const ext = filePath.toLowerCase();
      const isImage = ext.endsWith(".jpg") || ext.endsWith(".jpeg") || ext.endsWith(".png") || ext.endsWith(".gif") || ext.endsWith(".webp");
      if (!isImage) {
        res.setHeader("Content-Disposition", "attachment");
      }
    },
  }));

  // ── IP block redirect: GET /login, /register → /blocked?until=X ─────────────
  // Works server-side BEFORE React loads — any browser on a blocked IP gets
  // redirected immediately, no JS needed.
  app.get(["/login", "/register"], (req, res, next) => {
    const ip = getClientIp(req);
    const check = checkAuthRateLimit(ip);
    if (check.blocked && check.retryAfter) {
      return res.redirect(302, `/blocked?until=${check.retryAfter}`);
    }
    next();
  });

  // ── Blocked page — served as standalone HTML (no React dependency) ────────
  // Explicit Content-Type prevents Safari from downloading the page as a file.
  app.get("/blocked", (req, res) => {
    const until = parseInt(String(req.query.until ?? "0"), 10) || 0;
    res.set("Content-Type", "text/html; charset=utf-8").send(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Accès bloqué — AshTech Pay</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{min-height:100vh;background:#0B0E11;display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:1rem}
    .card{background:#1E2329;border:1px solid #2B3139;border-radius:16px;padding:2rem;max-width:360px;width:100%;text-align:center}
    .logo{margin-bottom:1.5rem}
    .logo img{height:64px;width:auto}
    .icon{width:64px;height:64px;background:rgba(220,53,69,.1);border:1px solid rgba(220,53,69,.3);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 1.5rem}
    .icon svg{width:32px;height:32px;color:#dc3545;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
    h1{color:#EAECEF;font-size:1.25rem;margin-bottom:.5rem}
    p{color:#848E9C;font-size:.875rem;line-height:1.5;margin-bottom:1.5rem}
    .timer-box{background:rgba(220,53,69,.05);border:1px solid rgba(220,53,69,.2);border-radius:12px;padding:1.5rem;margin-bottom:1.5rem}
    .timer-label{color:#848E9C;font-size:.75rem;margin-bottom:.75rem;display:flex;align-items:center;justify-content:center;gap:.4rem}
    .timer{display:flex;align-items:center;gap:1rem;justify-content:center}
    .time-block{display:flex;flex-direction:column;align-items:center}
    .time-val{font-size:3rem;font-weight:700;color:#f47c7c;font-variant-numeric:tabular-nums;line-height:1}
    .time-unit{font-size:.65rem;color:#848E9C;text-transform:uppercase;letter-spacing:.1em;margin-top:.25rem}
    .colon{font-size:2.5rem;font-weight:700;color:rgba(244,124,124,.5);margin-bottom:1rem}
    .note{color:#848E9C;font-size:.7rem;line-height:1.5;margin-bottom:1.5rem}
    .home-btn{display:inline-flex;align-items:center;gap:.4rem;color:#848E9C;font-size:.8rem;text-decoration:none;padding:.5rem 1rem;border-radius:8px;border:1px solid #2B3139;transition:background .2s}
    .home-btn:hover{background:#2B3139;color:#EAECEF}
  </style>
</head>
<body>
  <div class="card">
    <div class="logo"><img src="/logo.png" alt="AshTech Pay" onerror="this.style.display='none'" /></div>
    <div class="icon">
      <svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
    </div>
    <h1>Accès temporairement bloqué</h1>
    <p>Trop de tentatives incorrectes ont été détectées depuis votre adresse IP.</p>
    <div class="timer-box">
      <div class="timer-label">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        Réessayez dans
      </div>
      <div class="timer">
        <div class="time-block"><span class="time-val" id="min">--</span><span class="time-unit">min</span></div>
        <span class="colon">:</span>
        <div class="time-block"><span class="time-val" id="sec">--</span><span class="time-unit">sec</span></div>
      </div>
    </div>
    <p class="note">Pour votre sécurité, l'accès est bloqué après 4 tentatives incorrectes. Vous serez redirigé automatiquement à l'expiration du délai.</p>
    <a href="/" class="home-btn">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
      Retour à l'accueil
    </a>
  </div>
  <script>
    var until = ${until};
    function tick() {
      var remaining = Math.max(0, Math.ceil((until - Date.now()) / 1000));
      document.getElementById('min').textContent = String(Math.floor(remaining / 60)).padStart(2, '0');
      document.getElementById('sec').textContent = String(remaining % 60).padStart(2, '0');
      if (remaining <= 0) { clearInterval(timer); window.location.href = '/login'; }
    }
    tick();
    var timer = setInterval(tick, 1000);
  </script>
</body>
</html>`);
  });

  // Trust proxy (Replit uses reverse proxy in all environments)
  app.set("trust proxy", 1);

  // CORS middleware — restrict to known origins in production
  const appUrl = process.env.APP_URL ? process.env.APP_URL.replace(/\/$/, "") : null;

  // Build all valid origins: custom domain + www variant + Replit domains (dev & prod)
  const rawOrigins: (string | null)[] = [
    appUrl,
    // www variant of APP_URL (e.g. https://www.ashtechpay.top)
    appUrl ? appUrl.replace(/^(https?:\/\/)/, "$1www.") : null,
    // Replit dev domain
    process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : null,
    // Replit production deployment domains (comma-separated in REPLIT_DOMAINS)
    ...(process.env.REPLIT_DOMAINS
      ? process.env.REPLIT_DOMAINS.split(",").map(d => `https://${d.trim()}`)
      : []),
    process.env.REPL_SLUG ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co` : null,
    "http://localhost:5000",
    "https://localhost:5000",
    "http://localhost:3000",
  ];
  const allowedOrigins = new Set<string>(rawOrigins.filter(Boolean) as string[]);

  app.use((req, res, next) => {
    const origin = req.headers.origin;
    const isProd = process.env.NODE_ENV === "production";

    if (origin) {
      // In production: only allow listed origins. In dev: allow any origin.
      const allowed = !isProd || allowedOrigins.has(origin);
      if (allowed) {
        res.header("Access-Control-Allow-Origin", origin);
        res.header("Access-Control-Allow-Credentials", "true");
      }
    }
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");

    if (req.method === "OPTIONS") return res.sendStatus(200);
    next();
  });

  // ─── FIX-9: Protection CSRF par vérification de l'Origin ─────────────────────
  // sameSite:"none" (nécessaire pour les iframes de paiement hébergé) permet aux
  // navigateurs d'envoyer les cookies cross-origin. On bloque donc les requêtes
  // mutantes (POST/PATCH/PUT/DELETE) dont l'Origin n'est pas dans la liste autorisée.
  // Endpoints webhook et paiement public exemptés (appelés par des serveurs, pas des navigateurs).
  const CSRF_EXEMPT_PREFIXES = [
    "/api/afribapay/webhook", "/api/pixpay/webhook",
    "/api/pawapay/deposit-callback", "/api/pawapay/payout-callback",
    "/api/izichange/webhook",
    "/api/telegram/webhook", "/api/payment-links/", "/api/public/",
    "/api/v1/hosted-payment", "/api/public/hosted-session",
  ];
  app.use((req, res, next) => {
    if (!["POST", "PATCH", "PUT", "DELETE"].includes(req.method)) return next();
    if (!req.path.startsWith("/api/")) return next();
    const isExempt = CSRF_EXEMPT_PREFIXES.some(p => req.path.startsWith(p));
    if (isExempt) return next();

    const origin = req.headers.origin;
    const referer = req.headers.referer;
    const source = origin || (referer ? new URL(referer).origin : null);

    // Pas d'Origin = requête serveur-à-serveur (Bearer token) ou navigateur ancien — laisser passer
    if (!source) return next();

    const isProd = process.env.NODE_ENV === "production";
    if (isProd && !allowedOrigins.has(source)) {
      console.warn(`[CSRF] Requête bloquée — Origin non autorisé: ${source} → ${req.method} ${req.path}`);
      return res.status(403).json({ message: "Requête invalide (origine non autorisée)" });
    }
    next();
  });

  // Session middleware
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    console.warn("[Session] WARNING: SESSION_SECRET env var not set. Using per-process dev secret (tokens reset on restart). Set SESSION_SECRET in production.");
  }
  const isSecureProxy = process.env.TRUST_PROXY === "true" || !!process.env.REPL_ID;
  const cookieSecure = process.env.COOKIE_SECURE !== "false";
  const cookieSameSite = (process.env.COOKIE_SAMESITE as "none" | "lax" | "strict") || "lax";
  // Resilient session pool: tries sessionPool first, falls back to main pool if exhausted.
  // This prevents session save failures when PM2_INSTANCES is misconfigured on production
  // and sessionPool runs out of connections (which causes 401 right after login).
  const resilientSessionPool = {
    query: async (...args: Parameters<typeof sessionPool.query>) => {
      try {
        return await sessionPool.query(...(args as unknown as [any, ...any[]]));
      } catch (err: any) {
        if (
          err?.code === "53300" || // too_many_connections
          err?.message?.includes("timeout") ||
          err?.message?.includes("pool") ||
          err?.message?.includes("connect")
        ) {
          console.warn("[SessionStore] sessionPool exhausted — falling back to main pool:", err.message);
          poolStats.session.fallbackToMain++;
          return await pool.query(...(args as unknown as [any, ...any[]]));
        }
        throw err;
      }
    },
  };

  app.use(
    session({
      // FIX-1: utilise _DEV_TOKEN_SECRET (même valeur que getTokenSecret()) en dev
      // pour que sessions cookie et tokens Bearer soient cohérents dans le même processus.
      secret: sessionSecret || _DEV_TOKEN_SECRET,
      resave: false,
      saveUninitialized: false,
      store: process.env.DB_DIALECT?.toLowerCase() === "mysql"
        ? new MySqlSessionStore({
            pool: sessionPool as any,
            tableName: "session",
            errorLog: (err: Error) => console.error("[SessionStore]", err.message),
          })
        : new SessionStore({
            pool: resilientSessionPool as any,
            tableName: "session",
            errorLog: (err: Error) => console.error("[SessionStore]", err.message),
          }),
      proxy: isSecureProxy,
      name: "__ash_sid",
      cookie: {
        secure: cookieSecure,
        httpOnly: true,
        sameSite: cookieSameSite,
        maxAge: 3 * 24 * 60 * 60 * 1000,
      },
    })
  );
  
  console.log(`[Session] Configured - secure=${cookieSecure}, sameSite=${cookieSameSite}, proxy=${isSecureProxy}`);

  // Middleware to extract userId from either session or Bearer token
  app.use(async (req, res, next) => {
    // Check if this session was kicked for single-device rule
    if (req.sessionID && singleDeviceKicks.has(req.sessionID)) {
      singleDeviceKicks.delete(req.sessionID);
      req.singleDeviceKick = true;
      return next();
    }

    // Check if this session was revoked (IP block / IP change)
    if (req.sessionID) {
      const revokedUntil = revokedSessions.get(req.sessionID);
      if (revokedUntil) {
        if (Date.now() < revokedUntil) {
          req.forceLogoutRetryAfter = revokedUntil;
          return next();
        }
        revokedSessions.delete(req.sessionID);
      }
    }

    // First check session
    let userId = req.session?.userId;
    
    // Then check Bearer token
    const authHeader = req.headers.authorization;
    if (!userId && authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const resolvedId = getUserIdFromToken(token);
      if (resolvedId) {
        userId = resolvedId;
      } else {
        // Token present but invalid/revoked → signal single-device kick
        // so requireAuth returns sessionRevoked:true and the frontend redirects to login
        req.singleDeviceKick = true;
        return next();
      }
    }

    if (userId) {
      const user = await storage.getUser(userId);
      if (user?.isBanned) {
        console.log(`Banned user ${userId} attempted access. Reason: ${user.banReason}`);
        // Clear session and token if banned
        if (req.session) {
          req.session.userId = undefined;
        }
        if (authHeader && authHeader.startsWith('Bearer ')) {
          const token = authHeader.substring(7);
          removeAuthToken(token);
        }
        return res.status(403).json({ 
          message: user.banReason || "Votre compte a été banni par l'administrateur.",
          banned: true 
        });
      }

      // VPN check for authenticated users — skip for admins (trusted + OTP-verified)
      const isAdminRole = user && ["admin"].includes(user.role);
      if (!isAdminRole && req.path.startsWith("/api/") && !req.path.startsWith("/api/public/")) {
        const ip = getClientIp(req);
        const isVpn = await checkVpnOrProxy(ip);
        if (isVpn) {
          console.log(`[VPN] Disconnecting user ${userId} — VPN/proxy detected from ${ip}`);
          if (req.session) req.session.userId = undefined;
          if (authHeader && authHeader.startsWith('Bearer ')) {
            removeAuthToken(authHeader.substring(7));
          }
          return res.status(403).json({
            message: "Connexion VPN détectée. Veuillez désactiver votre VPN ou proxy pour continuer.",
            vpnDetected: true,
          });
        }
      }

      req.userId = userId;
    }
    next();
  });

  // ── Security: 404 on admin frontend paths for unauthenticated requests ───────
  // Placed HERE (after session + extractUserId) so req.userId is always populated.
  // Prevents route enumeration: unauthenticated visitors get 404 (not 200/HTML)
  // on any URL that starts with the secret admin path prefix.
  //
  // IMPORTANT: /admin-panel-verify and /admin-login-otp are intentionally exempt
  // from the 404 guard. When a session expires mid-navigation, queryClient.ts does
  // a full-page redirect to /admin-panel-verify. If the server returns 404 (because
  // req.userId is now undefined), the admin sees a blank page and cannot re-verify.
  // The pages themselves are harmless — the TOTP verification API still requires a
  // valid session, so serving the HTML shell is safe.
  {
    const ADMIN_FRONTEND_PATH = "/Ashtech76638393947vdkdbdozyzujebfkdbdj";
    const ADMIN_REVEAL_PATHS = ["/admin-panel-verify", "/admin-login-otp"];
    app.use(async (req: Request, res: Response, next: NextFunction) => {
      const p = req.path;
      if (p.startsWith("/api/")) return next();
      // Reveal paths (verify/OTP pages) are always served — no 404 guard
      const isAdminReveal = ADMIN_REVEAL_PATHS.some(r => p === r || p.startsWith(r + "/"));
      if (isAdminReveal) return next();
      // Only gate the secret admin frontend path
      const isAdminFrontend = ADMIN_FRONTEND_PATH && p.startsWith(ADMIN_FRONTEND_PATH);
      if (!isAdminFrontend) return next();
      // req.userId is set by extractUserId above — valid session or bearer token
      // Also accept _apl (admin pending login) set during mid-login OTP step
      const sessionAdminPending = (req.session as any)?._apl;
      if (!req.userId && !sessionAdminPending) {
        return sendClean404(res);
      }
      if (req.userId) {
        const user = await storage.getUser(req.userId).catch(() => null);
        if (!user || user.role !== "admin") {
          console.warn(`[AdminAccess] HIDDEN 404 — frontend role=${user?.role ?? "missing"} — path=${p}`);
          if (user) {
            req.session.destroy(() => {});
            res.clearCookie("__ash_sid");
            res.clearCookie("connect.sid");
          }
          return sendClean404(res);
        }
      }
      next();
    });
  }

  // ─── Probe-path blocker ────────────────────────────────────────────────────
  // Return 404 for paths that scanners commonly probe but that this app never
  // serves. Without this the React SPA catch-all returns 200 for everything,
  // making every probe path appear "accessible" to security scanners.
  //
  // Two categories:
  //  1. Well-known non-app paths (WordPress, cPanel, phpMyAdmin, …) — always 404.
  //  2. Default /admin/* paths — always 404 since the real admin path is
  //     hardcoded to a different, secret value.
  //
  // Security notes:
  //  - Paths are normalised (URI-decoded, double-slashes collapsed, lowercase)
  //    before matching to prevent trivial encoding bypasses (%77p-admin, //wp-admin).
  //  - All blocked prefixes use "exact OR starts-with-slash" logic so sub-paths
  //    like /phpmyadmin/ and /pma/index.php are also caught.
  {
    /**
     * Normalise a raw URL path for reliable probe matching:
     *  1. Iteratively decode percent-encoding until stable (catches double-encoded
     *     bypasses like /%252eenv → /%2eenv → /.env)
     *  2. Collapse runs of slashes (// → /)
     *  3. Lower-case for case-insensitive comparison
     *
     * Decoding stops after 5 passes or when the string no longer changes.
     * Falls back to the previous value if a decode pass throws (malformed URI).
     */
    function normalisePath(raw: string): string {
      let current = raw;
      for (let i = 0; i < 5; i++) {
        let next = current;
        try { next = decodeURIComponent(current); } catch { break; }
        if (next === current) break;
        current = next;
      }
      return current.replace(/\/+/g, "/").toLowerCase();
    }

    // Paths (and their sub-paths) that are never part of this application.
    // Each entry is treated as both an exact match AND a prefix (entry + "/…").
    const PROBE_PREFIXES: readonly string[] = [
      // WordPress
      "/wp-admin", "/wp-login.php", "/wp-content", "/wp-includes",
      // Hosting control panels
      "/cpanel", "/whm", "/webmail",
      // Database UIs
      "/pma", "/phpmyadmin", "/adminer", "/dbadmin",
      // User/account probe paths — not real routes in this app
      // (real auth routes are /login, /register; account UI is at /dashboard/*)
      "/user", "/users", "/user/login", "/user/register", "/user/profile",
      "/profile", "/profiles", "/account", "/accounts",
      "/customers", "/members", "/member",
      // Generic admin probes
      "/administrator", "/administration", "/administra",
      "/siteadmin", "/sitemanager",
      "/admin1", "/admin2", "/admin123",
      "/admin/login", "/admin/dashboard", "/admin/dash",
      "/admin/panel", "/admin/portal", "/admin/console",
      "/admin/config", "/admin/manage",
      // Other common probes
      "/shell", "/cmd", "/cgi-bin", "/xmlrpc.php",
      // Dotfiles and project metadata — leak repo structure / dependency info
      "/.env", "/.git", "/.svn", "/.htaccess", "/.gitignore", "/.gitmodules",
      "/.gitattributes", "/.npmrc", "/.yarnrc", "/.dockerignore", "/.ssh",
      "/.idea", "/.ds_store", "/.htpasswd",
      "/package.json", "/package-lock.json", "/yarn.lock", "/pnpm-lock.yaml",
      "/composer.json", "/composer.lock", "/gemfile", "/gemfile.lock",
      "/requirements.txt", "/pyproject.toml", "/dockerfile", "/docker-compose.yml",
      "/docker-compose.yaml", "/makefile",
      // Framework/ops internals never exposed by this app
      "/actuator", "/rest/v1", "/graphql", "/graphiql", "/__graphql",
      "/swagger", "/swagger-ui", "/swagger-ui.html", "/swagger.json", "/swagger.yaml",
      "/openapi", "/openapi.json", "/openapi.yaml", "/api-docs", "/redoc",
      "/internal", "/private", "/debug", "/debug.log", "/logs",
      "/wp-json", "/wp-config.php", "/shell.php", "/cmd.php", "/c99.php", "/r57.php",
      "/eval.php", "/webshell.php", "/config.php", "/database.php", "/setup.php",
      "/install.php", "/backup", "/backups", "/backup.zip", "/backup.sql",
      "/backup.tar.gz", "/dump.sql", "/db.sql", "/database.sql", "/db_backup.sql",
      "/site.tar.gz", "/wwwroot.zip", "/sftp-config.json",
      // Additional scanner probes (CMS, dev/ops leftovers, cloud creds, etc.)
      "/drupal", "/joomla", "/flask-admin", "/django-admin", "/rails/info",
      "/nginx_status", "/realtime/v1", "/storage/v1", "/auth/v1",
      "/__debug", "/_debug", "/trace", "/.logs", "/var/log",
      "/application.log", "/server.log", "/app.log", "/access.log", "/error.log", "/log",
      "/qa", "/testing", "/test", "/staging", "/development", "/dev", "/hidden", "/secret",
      "/webpack-stats.json", "/.nuxt", "/.next", "/vendor", "/.cache",
      "/go.sum", "/go.mod", "/pipfile", "/pipfile.lock",
      "/__status", "/_nodes", "/_cat/indices", "/archive", "/old",
      "/www.zip", "/htdocs.zip", "/site.zip", "/website.zip",
      "/.bzr", "/.hg", "/.gitconfig", "/.aws", "/.aws/credentials",
      "/application.properties", "/application.yml",
      "/administrator/index.php",
    ];

    // The real admin path is hardcoded (not "/admin"), so any request that
    // starts with the generic "/admin" prefix is always a scanner probe.
    const defaultAdminBlocked = true;

    /** True if the normalised path matches a blocked prefix exactly or as a sub-path. */
    function isBlockedProbe(p: string): boolean {
      return PROBE_PREFIXES.some(prefix => p === prefix || p.startsWith(prefix + "/"));
    }

    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.path.startsWith("/api/")) return next();

      const p = normalisePath(req.path);

      // Block well-known non-app probe paths
      if (isBlockedProbe(p)) return sendClean404(res);

      // Block "/admin" and sub-paths when a different secret path is configured
      if (defaultAdminBlocked && (p === "/admin" || p.startsWith("/admin/"))) {
        return sendClean404(res);
      }

      next();
    });
  }

  // File upload endpoint using local storage
  app.post("/api/uploads/local", requireAuth, upload.single("file"), (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "Aucun fichier fourni" });
      }

      // Magic bytes check — the diskStorage saves before we can inspect content,
      // so we read back the first 12 bytes and validate, then delete if invalid.
      const fileBuffer = fs.readFileSync(req.file.path);
      const magicCheck = validateFileMagicBytes(fileBuffer);
      if (!magicCheck.valid) {
        fs.unlinkSync(req.file.path);
        console.warn(`[Upload/local] Magic bytes invalides pour ${req.file.originalname} — détecté: ${magicCheck.detected}`);
        return res.status(400).json({ message: "Le contenu du fichier ne correspond pas à son type déclaré" });
      }

      const filePath = `/uploads/${req.file.filename}`;
      res.json({ 
        success: true,
        objectPath: filePath,
        filename: req.file.filename,
        size: req.file.size,
        mimetype: req.file.mimetype
      });
    } catch (error) {
      console.error("Local upload error:", error);
      res.status(500).json({ message: "Erreur lors de l'upload" });
    }
  });

  // Image proxy - streams image bytes through server to prevent cached signed URL expiry
  // Security: requires authentication + strict path whitelist (no SSRF, no path traversal)
  app.get("/api/image-proxy", requireAuth, async (req, res) => {
    try {
      const storagePath = req.query.path as string;
      if (!storagePath) return res.status(400).send("Path required");

      // Strict allowlist: only accept relative storage paths (no URLs, no traversal)
      // Valid: "payment-links/1234-image.png" or "kyc/5678-doc.pdf"
      // Rejected: "http://...", "../etc/passwd", absolute paths, query strings
      const ALLOWED_FOLDERS = ["payment-links", "kyc"];
      const isRelativePath = !storagePath.startsWith("http") &&
        !storagePath.startsWith("/") &&
        !storagePath.includes("..") &&
        !storagePath.includes("?") &&
        !storagePath.includes("\0");
      const startsWithAllowedFolder = ALLOWED_FOLDERS.some(f => storagePath.startsWith(f + "/"));

      // Also allow full Supabase storage URLs (validated by regex in downloadFromSupabase)
      const isSupabaseUrl = storagePath.startsWith("https://") &&
        storagePath.includes(".supabase.co/storage/v1/object/");

      if (!isRelativePath && !isSupabaseUrl) {
        return res.status(400).send("Invalid path");
      }
      if (isRelativePath && !startsWithAllowedFolder) {
        return res.status(400).send("Invalid storage folder");
      }

      // ── 5.2 IDOR fix: KYC documents require ownership or admin role ──────────
      if (isRelativePath && storagePath.startsWith("kyc/")) {
        const requestingUser = await storage.getUser(req.userId!);
        const isAdminRole = requestingUser && ["admin"].includes(requestingUser.role);
        if (!isAdminRole) {
          // Verify the path belongs to a KYC submission owned by this user
          // FIX: exact path comparison only — no suffix/filename matching (IDOR)
          const kycSub = await storage.getKycSubmissionByUserId(req.userId!);
          const ownedPaths = [kycSub?.documentFrontPath, kycSub?.documentBackPath, kycSub?.selfiePath]
            .filter(Boolean) as string[];
          const isOwned = ownedPaths.some(p => p === storagePath);
          if (!isOwned) {
            return res.status(403).send("Accès refusé");
          }
        }
      }

      // ── Public bucket fast path: redirect directly to Supabase CDN URL ──────
      // Since the Supabase "uploads" bucket is PUBLIC, we can serve the file via
      // a 302 redirect to the public URL instead of proxying bytes through the server.
      // Auth/IDOR checks above still apply — this only resolves after access is granted.
      const supabasePublicBase = process.env.SUPABASE_URL;
      if (supabasePublicBase && isRelativePath) {
        const publicUrl = `${supabasePublicBase}/storage/v1/object/public/${STORAGE_BUCKET}/${storagePath}`;
        res.setHeader("Cache-Control", "public, max-age=3600");
        return res.redirect(302, publicUrl);
      }

      // Fallback: download through server (private bucket or no SUPABASE_URL)
      const result = await downloadFromSupabase(storagePath);
      if (!result) return res.status(404).send("Image not found");

      // Only allow image and PDF content types
      const ALLOWED_CONTENT_TYPES = [
        "image/jpeg", "image/png", "image/gif", "image/webp",
        "image/svg+xml", "application/pdf",
      ];
      if (!ALLOWED_CONTENT_TYPES.includes(result.contentType)) {
        return res.status(415).send("Unsupported media type");
      }

      const buffer = Buffer.from(await result.data.arrayBuffer());
      res.setHeader("Content-Type", result.contentType);
      res.setHeader("Content-Disposition", "inline");
      res.setHeader("X-Content-Type-Options", "nosniff");

      const etag = `"${storagePath.replace(/[^a-zA-Z0-9]/g, "")}-${buffer.length}"`;
      res.setHeader("ETag", etag);

      if (req.headers["if-none-match"] === etag) {
        return res.status(304).end();
      }

      res.setHeader("Cache-Control", "private, max-age=86400");
      res.setHeader("Content-Length", buffer.length);
      res.end(buffer);
    } catch (error) {
      console.error("Image proxy error:", error);
      res.status(500).send("Erreur serveur");
    }
  });

  // Direct file upload endpoint - uses Supabase Storage for persistence
  app.post("/api/uploads/file", requireAuth, memoryUpload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "Aucun fichier fourni" });
      }

      // FIX-10: Vérification des magic bytes — rejette les fichiers dont le contenu
      // ne correspond pas à leur extension déclarée (ex: .exe renommé en .jpg).
      const magicCheck = validateFileMagicBytes(req.file.buffer);
      if (!magicCheck.valid) {
        console.warn(`[Upload] Magic bytes invalides pour ${req.file.originalname} — détecté: ${magicCheck.detected}, déclaré: ${req.file.mimetype}`);
        return res.status(400).json({ error: "Le contenu du fichier ne correspond pas à son type déclaré" });
      }

      const folder = (req.query.folder as string) || "payment-links";
      const allowedFolders = ["payment-links", "kyc"];
      const safeFolder = allowedFolders.includes(folder) ? folder : "payment-links";

      // Try Supabase Storage first (file is already in memory — no disk I/O needed)
      const supabaseResult = await uploadToSupabase(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        safeFolder
      );

      if (supabaseResult) {
        res.json({ 
          success: true,
          objectPath: supabaseResult.path,
          url: supabaseResult.url,
          filename: req.file.originalname,
          originalName: req.file.originalname,
          size: req.file.size,
          mimetype: req.file.mimetype
        });
      } else {
        // Fallback: write buffer to disk
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        // Sanitize extension — only allow alphanumeric to prevent path traversal
        const rawExt = path.extname(req.file.originalname).toLowerCase();
        const ext = /^\.[a-z0-9]+$/.test(rawExt) ? rawExt : "";
        const filename = `${uniqueSuffix}${ext}`;
        const diskPath = path.join(uploadsDir, filename);
        fs.writeFileSync(diskPath, req.file.buffer);
        const urlPath = `/uploads/${filename}`;
        res.json({ 
          success: true,
          objectPath: urlPath,
          url: urlPath,
          filename,
          originalName: req.file.originalname,
          size: req.file.size,
          mimetype: req.file.mimetype
        });
      }
    } catch (error) {
      console.error("File upload error:", error);
      res.status(500).json({ error: "Erreur lors de l'upload" });
    }
  });

  // ─── Geo Check Endpoint ──────────────────────────────────────────────────────
  // GET /api/img — public image redirect to Supabase CDN (no auth required).
  // Since the Supabase "uploads" bucket is PUBLIC, we redirect directly to the CDN URL.
  // Path validation (allowlist) is still enforced to prevent SSRF.
  app.get("/api/img", externalProxyLimiter, async (req, res) => {
    const storagePath = req.query.path as string;
    if (!storagePath) return res.status(400).send("Path required");

    // KYC documents are sensitive — require authentication to prevent enumeration
    if (storagePath.startsWith("kyc/") && !req.session?.userId) {
      return res.status(401).json({ message: "Authentification requise" });
    }

    const ALLOWED_FOLDERS = ["payment-links", "kyc"];
    const isValid =
      !storagePath.startsWith("http") &&
      !storagePath.startsWith("/") &&
      !storagePath.includes("..") &&
      !storagePath.includes("?") &&
      !storagePath.includes("\0") &&
      ALLOWED_FOLDERS.some(f => storagePath.startsWith(f + "/"));

    if (!isValid) return res.status(400).send("Invalid path");

    const supabaseUrl = process.env.SUPABASE_URL;
    const bucket = process.env.SUPABASE_STORAGE_BUCKET || "uploads";

    if (!supabaseUrl) {
      // No Supabase configured — try local fallback
      return res.status(404).send("Storage not configured");
    }

    const publicUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${storagePath}`;
    res.setHeader("Cache-Control", "public, max-age=86400");
    return res.redirect(302, publicUrl);
  });

  app.get("/api/public/geo", externalProxyLimiter, async (req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    try {
      // Cloudflare and some trusted hosting proxies already resolve the
      // visitor's country from the client IP. Use that fast path when
      // available, then fall back to the IP lookup below.
      const proxyCountry = [
        req.headers["cf-ipcountry"],
        req.headers["x-vercel-ip-country"],
        req.headers["x-country-code"],
        req.headers["x-geo-country"],
        req.headers["x-geo-country-code"],
      ]
        .flatMap(value => Array.isArray(value) ? value : [value])
        .map(value => String(value || "").trim().toUpperCase())
        .find(value => /^[A-Z]{2}$/.test(value) && value !== "XX");
      if (proxyCountry) {
        return res.json({
          country: proxyCountry,
          countryName: proxyCountry,
          isAfrica: AFRICAN_COUNTRY_CODES.has(proxyCountry),
          isVpn: false,
        });
      }

      const ip = getClientIp(req);
      if (isPrivateIp(ip) || ip === "unknown") {
        // The Replit preview uses a private proxy IP and is known to run in
        // the Cameroon test environment. Production must never guess from a
        // private IP because it does not identify the visitor's country.
        if (process.env.NODE_ENV !== "production") {
          return res.json({ country: "CM", countryName: "Cameroun", isAfrica: true, isVpn: false });
        }
        return res.json({ country: "XX", countryName: "Unknown", isAfrica: true, isVpn: false });
      }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      try {
        const geoRes = await fetch(`https://ip-api.com/json/${ip}?fields=status,country,countryCode,proxy,hosting`, { signal: controller.signal });
        clearTimeout(timeout);
        const geoData: any = await geoRes.json();
        const countryCode = String(geoData.countryCode || "").trim().toUpperCase();
        if (geoData.status === "success" && /^[A-Z]{2}$/.test(countryCode)) {
          const isAfrica = AFRICAN_COUNTRY_CODES.has(countryCode);
          const isVpn = geoData.proxy === true || geoData.hosting === true;
          // Cache the result
          vpnCache.set(ip, { isVpn, ts: Date.now() });
          return res.json({ country: countryCode, countryName: geoData.country, isAfrica, isVpn });
        }
      } catch {
        clearTimeout(timeout);
      }

      // Secondary provider for networks where ip-api is unavailable or rate-limited.
      const fallbackController = new AbortController();
      const fallbackTimeout = setTimeout(() => fallbackController.abort(), 2500);
      try {
        const fallbackRes = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}?fields=success,country,country_code`, {
          signal: fallbackController.signal,
        });
        clearTimeout(fallbackTimeout);
        const fallbackData: any = await fallbackRes.json();
        const countryCode = String(fallbackData.country_code || "").trim().toUpperCase();
        if (fallbackData.success === true && /^[A-Z]{2}$/.test(countryCode)) {
          return res.json({
            country: countryCode,
            countryName: fallbackData.country || countryCode,
            isAfrica: AFRICAN_COUNTRY_CODES.has(countryCode),
            isVpn: false,
          });
        }
      } catch {
        clearTimeout(fallbackTimeout);
      }

      return res.json({ country: "XX", countryName: "Unknown", isAfrica: true, isVpn: false });
    } catch {
      return res.json({ country: "XX", countryName: "Unknown", isAfrica: true, isVpn: false });
    }
  });

  // Auth routes — check IP block status (public, no auth)
  app.get("/api/auth/ip-status", publicInfoLimiter, (req, res) => {
    const ip = getClientIp(req);
    const check = checkAuthRateLimit(ip);
    if (check.blocked) {
      return res.json({ blocked: true, retryAfter: check.retryAfter });
    }
    return res.json({ blocked: false });
  });

  // Endpoint léger pour vérifier la validité de session (polling client toutes les 10s)
  // Passe par requireAuth → retourne sessionRevoked:true si la session est révoquée (kick single-device)
  app.get("/api/auth/ping", requireAuth, (req, res) => {
    const ip = getClientIp(req);
    const ipCheck = checkAuthRateLimit(ip);
    res.json({ ok: true, blocked: ipCheck.blocked, retryAfter: ipCheck.retryAfter });
  });

  // ── Admin route cloaking ─────────────────────────────────────────────────────
  // Unauthenticated visitors and non-admin users receive the same clean 404 as
  // an unknown route. Admin users continue to the normal PIN/TOTP protections.
  app.use("/api/admin", cloakAdminRoutes);

  // ── Admin PIN: require 4-digit PIN for all state-changing admin requests ─────
  // Applied globally here so it covers every /api/admin/* POST/PATCH/PUT/DELETE
  // defined below, without modifying each individual handler.
  // requireAdminPin runs AFTER requireAuth (user is known) so it can track
  // attempts per user ID. Exempt paths are listed inside requireAdminPin.
  app.use("/api/admin", requireAdminPin);

  // Admin — liste des IPs bloquées (temps réel)
  app.get("/api/admin/blocked-ips", requireAuth, requireAdmin, (_req, res) => {
    res.json(getBlockedIps());
  });

  // Admin — débloquer manuellement une IP
  app.delete("/api/admin/blocked-ips/:ip", requireAuth, requireAdmin, async (req, res) => {
    const ip = decodeURIComponent(req.params.ip);
    await clearAuthAttempts(ip);
    res.json({ ok: true, message: `IP ${ip} débloquée.` });
  });

  // ── Admin Panel IP Blocklist endpoints ───────────────────────────────────────
  // Any IP is allowed by default. Admin can block specific IPs from the panel.

  // GET — return the current request IP (helper for UI)
  // VULN-A6: restricted to admins only — no reason for regular users to probe this
  app.get("/api/admin/my-ip", requireAuth, requireAdmin, (req, res) => {
    res.json({ ip: getClientIp(req) });
  });

  // GET — list panel blocked IPs (returns full objects with expiry info)
  app.get("/api/admin/panel-blocked-ips", requireAuth, requireAdmin, async (_req, res) => {
    try {
      const blocks = await loadAdminPanelBlockedIps();
      invalidateAdminPanelBlockedIpsCache(); // force fresh load next time
      res.json({ blocks });
    } catch {
      res.json({ blocks: [] });
    }
  });

  // POST — add IP to panel blocklist with optional duration in days
  // Body: { ip: string, days?: number }  — days=undefined means permanent
  app.post("/api/admin/panel-blocked-ips", requireAuth, requireAdmin, async (req, res) => {
    const { ip, days } = req.body;
    if (!ip || typeof ip !== "string") return res.status(400).json({ message: "IP requise." });
    const trimmed = ip.trim();
    if (!trimmed || trimmed.length > 45) return res.status(400).json({ message: "Format IP invalide." });
    const ipv4Re = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Re = /^[0-9a-fA-F:]{3,39}$/;
    if (!ipv4Re.test(trimmed) && !ipv6Re.test(trimmed)) {
      return res.status(400).json({ message: "Format IP invalide (ex: 1.2.3.4)." });
    }
    const daysNum = days !== undefined ? parseInt(String(days), 10) : undefined;
    if (daysNum !== undefined && (isNaN(daysNum) || daysNum < 1 || daysNum > 3650)) {
      return res.status(400).json({ message: "Durée invalide (1–3650 jours)." });
    }
    try {
      invalidateAdminPanelBlockedIpsCache();
      const list = await loadAdminPanelBlockedIps();
      if (list.some(b => b.ip.trim() === trimmed)) {
        return res.status(400).json({ message: "Cette IP est déjà bloquée." });
      }
      const now = Date.now();
      const block: AdminPanelBlock = {
        ip: trimmed,
        blockedAt: now,
        expiresAt: daysNum !== undefined ? now + daysNum * 86_400_000 : undefined,
      };
      list.push(block);
      await storage.upsertSetting("admin_panel_blocked_ips", JSON.stringify(list));
      invalidateAdminPanelBlockedIpsCache();
      res.json({ blocks: list });
    } catch {
      res.status(500).json({ message: "Erreur serveur." });
    }
  });

  // DELETE — remove IP from panel blocklist (unblock immediately)
  app.delete("/api/admin/panel-blocked-ips/:ip", requireAuth, requireAdmin, async (req, res) => {
    const ip = decodeURIComponent(req.params.ip);
    try {
      invalidateAdminPanelBlockedIpsCache();
      const list = await loadAdminPanelBlockedIps();
      const filtered = list.filter(b => b.ip !== ip);
      await storage.upsertSetting("admin_panel_blocked_ips", JSON.stringify(filtered));
      invalidateAdminPanelBlockedIpsCache();
      res.json({ blocks: filtered });
    } catch {
      res.status(500).json({ message: "Erreur serveur." });
    }
  });

  // GET — IP check (polled by admin frontend)
  // requireAuth first: enforces singleDeviceKick, inactivity expiry, forceLogout.
  // requireAdmin second: enforces role=admin + TOTP verification.
  app.get("/api/admin/ip-check", requireAuth, requireAdmin, async (req, res) => {
    try {
      const ip = getClientIp(req);
      res.json({ allowed: true, ip });
    } catch {
      res.status(500).json({ message: "Erreur serveur." });
    }
  });

  // GET /api/admin/session-info — diagnostic endpoint (TOTP protected)
  app.get("/api/admin/session-info", requireAuth, requireAdmin, async (req, res) => {
    try {
      const user = await storage.getUser(req.userId!).catch(() => null);
      if (!user || !["admin"].includes(user.role)) {
        return res.status(403).json({ message: "Accès refusé" });
      }
      const now = Date.now();
      const memEntry = adminVerifiedSessions.get(req.sessionID);
      const memValid = !!(memEntry && memEntry.userId === req.userId && memEntry.expiresAt > now);
      const avsExp = req.session._avs;
      const sessionValid = typeof avsExp === "number" && avsExp > now;
      const avsExpiredAt = typeof avsExp === "number" && avsExp <= now ? new Date(avsExp).toISOString() : null;

      // Tier 3: DB query
      let dbValid = false;
      let dbError: string | null = null;
      try {
        const dbRow = await sessionPool.query(
          `SELECT sess FROM session WHERE sid = $1 AND expire > NOW()`,
          [req.sessionID]
        );
        if (dbRow.rows.length > 0) {
          const sessData = typeof dbRow.rows[0].sess === "string"
            ? JSON.parse(dbRow.rows[0].sess)
            : dbRow.rows[0].sess;
          const dbAvs = sessData?._avs;
          dbValid = typeof dbAvs === "number" && dbAvs > now;
        }
      } catch (e: any) {
        dbError = e?.message || "Unknown error";
      }

      // Admin panel IP blocklist status
      const blocklist = await loadAdminPanelBlockedIps().catch(() => [] as AdminPanelBlock[]);
      const currentIp = getClientIp(req);
      const ipBanned = isIpBannedFromAdmin(currentIp, blocklist);

      res.json({
        userId: req.userId,
        role: user.role,
        sessionId: req.sessionID?.slice(0, 12) + "…",
        tier1_memory: memValid,
        tier2_session: sessionValid,
        tier2_avsExpiredAt: avsExpiredAt,
        tier3_db: dbValid,
        tier3_dbError: dbError,
        otpValid: memValid || sessionValid || dbValid,
        ip: currentIp,
        ipBanned,
        panelBlockedCount: blocklist.length,
        totpEnabled: !!user.totpEnabled,
        timestamp: new Date().toISOString(),
      });
    } catch (e: any) {
      res.status(500).json({ message: "Erreur serveur", error: e?.message });
    }
  });

  app.post("/api/auth/register", registerLimiter, async (req, res) => {
    try {
      const ip = getClientIp(req);
      const rateCheck = checkAuthRateLimit(ip);
      if (rateCheck.blocked) {
        return res.status(429).json({
          message: "Trop de tentatives. Accès temporairement bloqué.",
          blocked: true,
          retryAfter: rateCheck.retryAfter,
        });
      }

      // Turnstile verification — token required when secret is configured
      const turnstileSecret = process.env.TURNSTILE_SECRET_KEY?.trim();
      const turnstileRequired = process.env.NODE_ENV === "production" || Boolean(turnstileSecret);
      if (turnstileRequired && !turnstileSecret) {
        return res.status(503).json({ message: "Vérification anti-bot temporairement indisponible. Veuillez réessayer." });
      }
      if (turnstileSecret) {
        const turnstileToken = req.body.turnstileToken;
        if (!turnstileToken) {
          return res.status(400).json({ message: "Vérification anti-bot requise. Veuillez compléter le captcha." });
        }
        const verifyRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ secret: turnstileSecret, response: turnstileToken, remoteip: ip }),
        });
        const verifyData = await verifyRes.json() as { success: boolean };
        if (!verifyData.success) {
          return res.status(400).json({ message: "Vérification anti-bot échouée. Veuillez réessayer." });
        }
      }

      const isVpn = await checkVpnOrProxy(ip);
      if (isVpn) {
        return res.status(403).json({
          message: "Connexion VPN détectée. Veuillez désactiver votre VPN ou proxy pour vous inscrire.",
          vpnDetected: true,
        });
      }

      // Bloquer si une adresse IP a déjà créé un compte
      const existingIpUser = await storage.getUserByRegistrationIp(ip);
      if (existingIpUser) {
        return res.status(403).json({
          message: "Un compte a déjà été créé depuis cette adresse IP. Une seule inscription par adresse IP est autorisée.",
          ipBlocked: true,
        });
      }

      const rawData = registerSchema.parse(req.body);
      // Normalize: email → lowercase, username → lowercase, phone → strip + and spaces
      const data = {
        ...rawData,
        email: rawData.email.trim().toLowerCase(),
        username: rawData.username.trim().toLowerCase(),
        phone: normalizePhone(rawData.phone) ?? rawData.phone,
      };

      // Resolve the selected country from the database so registration uses
      // the canonical country name and wallet key. The public catalog is the
      // source of truth for newly seeded PawaPay countries.
      const registrationCountryValue = String(data.country || "").trim();
      const registrationCountry = (await storage.getAllCountries()).find(country =>
        country.isActive &&
        country.isActiveForRegistration !== false &&
        (
          country.name.toLowerCase() === registrationCountryValue.toLowerCase() ||
          country.code.toLowerCase() === registrationCountryValue.toLowerCase()
        )
      );
      if (!registrationCountry) {
        return res.status(400).json({ message: "Ce pays n'est pas disponible pour l'inscription." });
      }
      (data as any).country = registrationCountry.name;

      const existingEmail = await storage.getUserByEmail(data.email);
      if (existingEmail) {
        await recordAuthFailure(ip);
        return res.status(400).json({ message: "Cet email est déjà utilisé" });
      }

      if (data.phone) {
        const existingPhone = await storage.getUserByPhone(data.phone);
        if (existingPhone) {
          await recordAuthFailure(ip);
          return res.status(400).json({ message: "Ce numéro de téléphone est déjà utilisé" });
        }
      }

      const existingUsername = await storage.getUserByUsername(data.username);
      if (existingUsername) {
        await recordAuthFailure(ip);
        return res.status(400).json({ message: "Ce nom d'utilisateur est déjà pris" });
      }

      const hashedPassword = await hashPassword(data.password);
      
      const preferredCurrency =
        CURRENCY_ZONE[registrationCountry.code.toUpperCase()] ||
        COUNTRY_CURRENCIES[registrationCountry.name] ||
        "XAF";

      const user = await storage.createUser({
        ...data,
        password: hashedPassword,
        preferredCurrency,
        registrationIp: ip,
      });

      await clearAuthAttempts(ip);

      // Send welcome email asynchronously (non-blocking)
      if (user.email) {
        sendWelcomeEmail(user.email, user.fullName || user.username).catch(() => {});
      }

      notifyNewUser({ userName: user.fullName || user.username, email: user.email || "", country: data.country || undefined }).catch(() => {});

      // Generate auth token for token-based auth (works in iframes where cookies fail)
      const authToken = storeAuthToken(user.id);

      req.session.regenerate((regenErr) => {
        if (regenErr) console.error("Session regenerate error (register):", regenErr);
        req.session.userId = user.id;
        req.session.clientIp = ip;
        req.session.userAgent = req.headers["user-agent"] || "";
        req.session.loginAt = new Date().toISOString();
        req.session.tokenIssuedAt = extractTokenTimestamp(authToken) ?? undefined;
        delete req.session._avs;
        req.session.save((err) => {
          if (err) console.error("Session save error (register):", err);
          audit(req, AUDIT.REGISTER, {
            userId: user.id,
            userName: user.fullName || user.username,
            userEmail: user.email || undefined,
            details: { country: (user as any).country ?? null },
          });
          const { password: _, ...safeUser } = user;
          res.json({ user: safeUser, token: authToken });
        });
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Register error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.post("/api/auth/login", loginLimiter, async (req, res) => {
    try {
      const ip = getClientIp(req);
      const rateCheck = checkAuthRateLimit(ip);
      if (rateCheck.blocked) {
        return res.status(429).json({
          message: "Trop de tentatives. Accès temporairement bloqué.",
          blocked: true,
          retryAfter: rateCheck.retryAfter,
        });
      }

      // Turnstile verification — token required when secret is configured
      const turnstileSecret = process.env.TURNSTILE_SECRET_KEY?.trim();
      const turnstileRequired = process.env.NODE_ENV === "production" || Boolean(turnstileSecret);
      if (turnstileRequired && !turnstileSecret) {
        return res.status(503).json({ message: "Vérification anti-bot temporairement indisponible. Veuillez réessayer." });
      }
      if (turnstileSecret) {
        const turnstileToken = req.body.turnstileToken;
        if (!turnstileToken) {
          return res.status(400).json({ message: "Vérification anti-bot requise. Veuillez compléter le captcha." });
        }
        const verifyRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ secret: turnstileSecret, response: turnstileToken, remoteip: ip }),
        });
        const verifyData = await verifyRes.json() as { success: boolean };
        if (!verifyData.success) {
          return res.status(400).json({ message: "Vérification anti-bot échouée. Veuillez réessayer." });
        }
      }

      const isVpn = await checkVpnOrProxy(ip);
      if (isVpn) {
        return res.status(403).json({
          message: "Connexion VPN détectée. Veuillez désactiver votre VPN ou proxy pour vous connecter.",
          vpnDetected: true,
        });
      }

      const data = loginSchema.parse(req.body);

      // Per-account lockout (independent of IP) — stops brute-forcing one
      // account's password without punishing other users on a shared IP
      // (CGNAT / mobile carrier networks).
      const identCheck = checkIdentifierRateLimit(data.identifier);
      if (identCheck.blocked) {
        return res.status(429).json({
          message: "Trop de tentatives incorrectes. Accès bloqué pendant 30 minutes.",
          blocked: true,
          retryAfter: identCheck.retryAfter,
        });
      }

      const user = await storage.getUserByEmailOrPhone(data.identifier);
      // ── Timing-safe comparison (CWE-307 / user enumeration fix) ─────────────
      // Always run bcrypt regardless of whether the user exists, so response
      // time is identical for "unknown email" and "wrong password".
      const passwordValid = user
        ? await verifyPassword(data.password, user.password)
        : (await bcrypt.compare(data.password, DUMMY_BCRYPT_HASH), false);

      if (!user || !passwordValid) {
        audit(req, AUDIT.LOGIN_FAILED, {
          userId: user?.id ?? null,
          success: false,
          details: { identifier: data.identifier, reason: !user ? "unknown_identifier" : "wrong_password" },
        });
        const failure = await recordAuthFailure(ip, data.identifier);
        const remaining = failure.attemptsLeft;
        const msg = failure.blocked
          ? "Trop de tentatives incorrectes. Accès bloqué pendant 30 minutes."
          : `Email/téléphone ou mot de passe incorrect. ${remaining} tentative(s) restante(s).`;
        notifyLoginFailed({ identifier: data.identifier, ip, attemptsLeft: remaining, blocked: !!failure.blocked }).catch(() => {});
        if (failure.blocked && failure.retryAfter) {
          notifyIpBlocked({
            ip,
            identifier: data.identifier,
            attempts: 4,
            blockedUntil: failure.retryAfter,
          }).catch(() => {});
        }
        if (user?.role === "admin") {
          notifyAdminLoginFailed({ identifier: data.identifier, ip }).catch(() => {});
        }
        // Ne déconnecter TOUTE l'IP que si c'est réellement le blocage IP global
        // qui a été déclenché (scope "ip" — attaque distribuée sur plusieurs
        // comptes). Un blocage sur UN SEUL compte (scope "identifier") ne doit
        // jamais faire sauter les autres utilisateurs partageant la même IP
        // (réseaux mobiles/CGNAT en Afrique).
        if (failure.blocked && failure.retryAfter && failure.scope === "ip") {
          revokeSessionsByIp(ip, failure.retryAfter).catch(() => {});
        }
        // Détruire les sessions du compte ciblé dans tous les cas de blocage.
        if (failure.blocked && failure.retryAfter && user) {
          destroyUserSessions(user.id, failure.retryAfter).catch(() => {});
        }

        return res.status(failure.blocked ? 429 : 401).json({
          message: msg,
          blocked: failure.blocked,
          retryAfter: failure.retryAfter,
          attemptsLeft: remaining,
        });
      }

      if (user.isBanned) {
        return res.status(403).json({ 
          message: user.banReason || "Votre compte a été banni par l'administrateur." 
        });
      }

      await clearAuthAttempts(ip, data.identifier);

      // Admin login is deliberately incomplete until Google Authenticator is
      // verified. No admin session or bearer token is issued before this gate.
      if (user.role === "admin") {
        if (!user.totpEnabled || !user.totpSecret) {
          return res.status(403).json({
            message: "Google Authenticator est obligatoire pour ce compte administrateur.",
            totpNotConfigured: true,
          });
        }

        const adminLoginToken = crypto.randomBytes(32).toString("base64url");
        await setPendingAdminLogin(adminLoginToken, {
          userId: user.id,
          // Retained only for compatibility with the existing table. This is
          // not an OTP and is never accepted as authentication proof.
          otp: crypto.randomBytes(32).toString("hex"),
          expiresAt: Date.now() + ADMIN_LOGIN_OTP_TTL_MS,
          attempts: 0,
        });
        return res.json({
          requiresAdminOtp: true,
          adminLoginToken,
        });
      }

      activeIpRegistry.set(user.id, ip);

      // Generate auth token for token-based auth (works in iframes where cookies fail)
      const authToken = storeAuthToken(user.id);

      // Regenerate session on every login — prevents session fixation AND ensures _avs
      // from a previous admin OTP verification never carries over into the new session,
      // even if the previous logout/destroy failed silently (e.g. DB timeout).
      req.session.regenerate((regenErr) => {
        if (regenErr) console.error("Session regenerate error (login):", regenErr);
        req.session.userId = user.id;
        req.session.clientIp = ip;
        req.session.userAgent = req.headers["user-agent"] || "";
        req.session.loginAt = new Date().toISOString();
        req.session.tokenIssuedAt = extractTokenTimestamp(authToken) ?? undefined;
        req.session.role = user.role;
        req.session.lastActivity = Date.now();
        // Belt-and-suspenders: explicitly clear any stale OTP verification state
        delete req.session._avs;
        delete (req.session as any)._otpCode;
        delete (req.session as any)._otpExpiry;

        req.session.save((err) => {
          if (err) console.error("Session save error (login):", err);
          audit(req, AUDIT.LOGIN_SUCCESS, {
            userId: user.id,
            userName: user.fullName || user.username,
            userEmail: user.email || undefined,
            details: { role: user.role },
          });
          const { password: _, ...safeUser } = user;
          res.json({ user: safeUser, token: authToken });
        });
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      const requestId = crypto.randomUUID();
      console.error(`[Login error][${requestId}]`, error);
      const debugMessage = shouldExposeDebugErrors
        ? `Erreur de connexion [${requestId}] : ${formatDebugError(error)}`
        : "Erreur serveur";
      res.status(500).json({
        message: debugMessage,
        ...(shouldExposeDebugErrors ? { request_id: requestId } : {}),
      });
    }
  });

  // ── Admin Login OTP — verify code and create session ─────────────────────────
  // This is the ONLY place where session.userId is created for admin accounts.
  app.post("/api/auth/admin-login-otp", loginLimiter, async (req, res) => {
    try {
      const { adminLoginToken, code } = req.body;

      if (!adminLoginToken || !code) {
        return res.status(400).json({ message: "Token et code requis." });
      }
      const submitted = String(code).replace(/\s/g, "");
      if (!/^\d{6}$/.test(submitted)) {
        return res.status(400).json({ message: "Code Google Authenticator à 6 chiffres requis." });
      }

      const claimId = crypto.randomBytes(16).toString("hex");
      const pending = await claimPendingAdminLogin(String(adminLoginToken), claimId);
      if (!pending) {
        return res.status(400).json({ message: "Session expirée. Veuillez vous reconnecter.", expired: true });
      }

      if (Date.now() > pending.expiresAt) {
        await releasePendingAdminLogin(String(adminLoginToken), claimId);
        await deletePendingAdminLogin(String(adminLoginToken));
        return res.status(400).json({ message: "Code expiré. Veuillez vous reconnecter.", expired: true });
      }

      // ── Rate-limit par userId (anti-token-farming) ────────────────────────────
      // Prevents generating many tokens via /login and cycling through 5 attempts per token.
      // Max 10 total TOTP attempts per userId per 30 min, across all tokens.
      const userRateCheck = checkAdminLoginOtpRateLimit(pending.userId);
      if (!userRateCheck.allowed) {
        await releasePendingAdminLogin(String(adminLoginToken), claimId);
        return res.status(429).json({
          message: `Trop de tentatives. Réessayez dans ${Math.ceil((userRateCheck.retryAfter ?? 1800) / 60)} minute(s).`,
          expired: true,
        });
      }

      // ── Vérification Google Authenticator (TOTP) ─────────────────────────────
      const userForTotp = await storage.getUser(pending.userId);
      if (!userForTotp) {
        await releasePendingAdminLogin(String(adminLoginToken), claimId);
        await deletePendingAdminLogin(String(adminLoginToken));
        return res.status(404).json({ message: "Utilisateur introuvable.", expired: true });
      }
      if (userForTotp.role !== "admin") {
        await releasePendingAdminLogin(String(adminLoginToken), claimId);
        await deletePendingAdminLogin(String(adminLoginToken));
        return res.status(403).json({ message: "Accès administrateur révoqué.", expired: true });
      }
      if (!userForTotp.totpEnabled || !userForTotp.totpSecret) {
        await releasePendingAdminLogin(String(adminLoginToken), claimId);
        await deletePendingAdminLogin(String(adminLoginToken));
        return res.status(400).json({ message: "Google Authenticator non configuré sur ce compte.", expired: true });
      }
      const { decryptField } = await import("./fieldEncryption");
      const { TOTP, Secret } = await import("otpauth");
      const rawSecret = decryptField(userForTotp.totpSecret);
      if (!rawSecret) {
        await releasePendingAdminLogin(String(adminLoginToken), claimId);
        await deletePendingAdminLogin(String(adminLoginToken));
        return res.status(400).json({ message: "Erreur de configuration Google Authenticator.", expired: true });
      }
      const totp = new TOTP({
        issuer: "AshTech Pay Admin",
        label: userForTotp.email || userForTotp.username,
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        secret: Secret.fromBase32(rawSecret),
      });
      const delta = totp.validate({ token: submitted, window: 1 });
      if (delta === null) {
        recordAdminLoginOtpAttempt(pending.userId); // count against per-userId quota
        await releasePendingAdminLogin(String(adminLoginToken), claimId);
        const remaining = 5 - pending.attempts;
        return res.status(400).json({
          message: `Code Google Authenticator incorrect. ${remaining} tentative(s) restante(s).`,
          attemptsLeft: remaining,
        });
      }

      // ✅ TOTP correct — single-use: supprimer l'entrée en attente
      const userId = userForTotp.id;
      clearAdminLoginOtpAttempts(userId); // reset per-userId counter on success
      const consumed = await consumePendingAdminLogin(String(adminLoginToken), claimId);
      if (!consumed) {
        return res.status(400).json({ message: "Session de connexion déjà utilisée. Veuillez vous reconnecter.", expired: true });
      }

      const user = userForTotp;
      if (user.isBanned) return res.status(403).json({ message: user.banReason || "Compte banni." });

      const ip = getClientIp(req);

      // Detect new/unknown IP — load known IPs for this admin and alert if new
      (async () => {
        try {
          const knownKey = `admin_known_ips_${user.id}`;
          const setting = await storage.getSetting(knownKey);
          const knownIps: string[] = setting ? JSON.parse(setting.value) : [];
          if (!knownIps.includes(ip)) {
            // Save the new IP immediately
            knownIps.push(ip);
            await storage.upsertSetting(knownKey, JSON.stringify(knownIps));
            // Send Telegram alert
            const { sendMessage } = await import("./telegram");
            const timestamp = new Date().toLocaleString("fr-FR", { timeZone: "Africa/Douala" });
            await sendMessage(
              `🚨 <b>Nouvel IP détecté — Panneau Admin</b>\n\n` +
              `👤 <b>${user.fullName || user.username}</b>\n` +
              `📧 ${user.email || "—"}\n` +
              `🌐 Nouvel IP: <code>${ip}</code>\n\n` +
              `⚠️ Si ce n'est pas vous, changez votre mot de passe immédiatement.\n` +
              `🕐 ${timestamp}`
            );
          }
        } catch (e) {
          console.warn("[AdminLogin] IP tracking error:", e);
        }
      })();

      activeIpRegistry.set(user.id, ip);

      // Generate auth token (works in iframes where cookies fail)
      const authToken = storeAuthToken(user.id);
      const avsExpiresAt = Date.now() + ADMIN_OTP_SESSION_TTL_MS;

      req.session.regenerate((regenErr) => {
        if (regenErr) console.error("Session regenerate error (admin-login-otp):", regenErr);

        req.session.userId = user.id;
        req.session.clientIp = ip;
        req.session.userAgent = req.headers["user-agent"] || "";
        req.session.loginAt = new Date().toISOString();
        req.session.tokenIssuedAt = extractTokenTimestamp(authToken) ?? undefined;
        // Set _avs immediately — admin OTP was verified at login time
        req.session._avs = avsExpiresAt;
        req.session._avsIp = ip;
        // Do not grant panel access at login. The hidden panel button must
        // trigger a fresh TOTP challenge followed by the admin PIN.
        delete req.session._pav;
        delete req.session._ppv;
        delete req.session._ppvIp;

        req.session.save((err) => {
          if (err) console.error("Session save error (admin-login-otp):", err);

          // Also populate in-memory cache for instant requireAdmin checks
          adminVerifiedSessions.set(req.sessionID, { userId: user.id, expiresAt: avsExpiresAt, ip });

          audit(req, AUDIT.LOGIN_SUCCESS, {
            userId: user.id,
            userName: user.fullName || user.username,
            userEmail: user.email || undefined,
            details: { role: user.role, method: "admin_login_otp" },
          });

          storage.createAdminLog?.({
            adminId: user.id,
            action: "login_otp_verified",
            details: `Connexion ${user.role} vérifiée par OTP login depuis ${ip}`,
            ipAddress: ip,
          } as any).catch(() => {});

          const { password: _, ...safeUser } = user;
          res.json({ user: safeUser, token: authToken });
        });
      });
    } catch (error) {
      console.error("admin-login-otp error:", error);
      res.status(500).json({ message: "Erreur serveur." });
    }
  });

  // ── Admin Login OTP — resend désactivé (TOTP Google Auth ne nécessite pas de renvoi)
  app.post("/api/auth/admin-login-otp/resend", loginLimiter, (_req, res) => {
    res.status(410).json({ message: "Le renvoi de code n'est plus disponible. Utilisez Google Authenticator." });
  });

  // ── Admin Panel Re-verify — vérifie le TOTP avant d'ouvrir le panneau admin ──
  // Appelé depuis le sidebar à chaque clic sur "Panel Admin" pour l'utilisateur déjà connecté.
  app.post("/api/auth/admin-panel-verify", requireAuth, loginLimiter, async (req, res) => {
    try {
      const { code } = req.body;
      const submittedCode = typeof code === "string" ? code.replace(/\s/g, "") : "";
      if (!/^\d{6}$/.test(submittedCode)) {
        return res.status(400).json({ message: "Code Google Authenticator à 6 chiffres requis." });
      }

      const user = await storage.getUser(req.userId!);
      if (!user) return res.status(401).json({ message: "Utilisateur introuvable." });
      if (!["admin"].includes(user.role)) {
        return res.status(403).json({ message: "Accès réservé aux administrateurs." });
      }
      if (!user.totpEnabled || !user.totpSecret) {
        return res.status(400).json({ message: "Google Authenticator non configuré sur ce compte.", totpNotConfigured: true });
      }
      const rateCheck = checkOtpRateLimit(req.userId!);
      if (!rateCheck.allowed) {
        return res.status(429).json({
          message: `Trop de tentatives. Réessayez dans ${Math.ceil((rateCheck.retryAfter ?? 900) / 60)} minute(s).`,
          retryAfter: rateCheck.retryAfter,
        });
      }

      const { decryptField } = await import("./fieldEncryption");
      const { TOTP, Secret } = await import("otpauth");
      const rawSecret = decryptField(user.totpSecret);
      if (!rawSecret) return res.status(400).json({ message: "Erreur de configuration Google Authenticator." });

      const totp = new TOTP({
        issuer: "AshTech Pay Admin",
        label: user.email || user.username,
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        secret: Secret.fromBase32(rawSecret),
      });
      const delta = totp.validate({ token: submittedCode, window: 1 });
      if (delta === null) {
        recordOtpFailure(req.userId!);
        return res.status(400).json({ message: "Code Google Authenticator incorrect." });
      }
      clearOtpFailures(req.userId!);

      // Set _avs (admin verified session, 24h inactivity TTL) — makes requireAdmin pass
      // Set _pav (panel TOTP verified, 24h inactivity TTL) — the PIN gate follows this.
      const avsPanelExp = Date.now() + ADMIN_OTP_SESSION_TTL_MS;
      req.session._avs = avsPanelExp;
      req.session._avsIp = getClientIp(req);
      req.session._pav = Date.now() + ADMIN_PANEL_ACCESS_TTL_MS;
      delete req.session._ppv;
      delete req.session._ppvIp;
      await new Promise<void>((resolve) => req.session.save((err) => {
        if (err) console.error("admin-panel-verify session save error:", err);
        resolve();
      }));
      // Populate in-memory cache so requireAdmin is instant on subsequent requests
      adminVerifiedSessions.set(req.sessionID, {
        userId: user.id,
        expiresAt: avsPanelExp,
        ip: getClientIp(req),
      });

      // Telegram : notifier la connexion OTP réussie au panneau admin
      notifyAdminPanelAccess({
        type: "otp_success",
        ip: getClientIp(req),
        userId: user.id,
        userName: user.fullName || user.username,
        userEmail: user.email || undefined,
        userRole: user.role,
        path: req.path,
      }).catch(() => {});

      res.json({ ok: true });
    } catch (error) {
      console.error("admin-panel-verify error:", error);
      res.status(500).json({ message: "Erreur serveur." });
    }
  });

  // ── Admin Panel PIN — second gate after the panel TOTP challenge ───────────
  app.post("/api/auth/admin-panel-pin-verify", requireAuth, loginLimiter, async (req, res) => {
    try {
      const user = await storage.getUser(req.userId!);
      if (!user || user.role !== "admin") {
        return res.status(403).json({ message: "Accès réservé aux administrateurs." });
      }

      const currentIp = getClientIp(req);
      const normalizeLoopback = (ip: string) =>
        ip === "::1" || ip === "::ffff:127.0.0.1" ? "127.0.0.1" : ip;
      const panelTotpExp = req.session._pav;
      const panelTotpIp = req.session._avsIp;
      if (typeof panelTotpExp !== "number" || panelTotpExp <= Date.now() ||
          typeof panelTotpIp !== "string" ||
          normalizeLoopback(panelTotpIp) !== normalizeLoopback(currentIp)) {
        return res.status(403).json({
          message: "Vérification Google Authenticator requise avant le code PIN.",
          totpRequired: true,
        });
      }

      const submittedPin = typeof req.body?.pin === "string" ? req.body.pin.trim() : "";
      const result = verifyAdminPinCode(user.id, submittedPin);
      if (!result.ok) {
        console.error(`[AdminPin] Panel gate blocked — status=${result.status} userId=${user.id}`);
        return res.status(result.status).json(result.body);
      }

      const panelAuthExp = Date.now() + ADMIN_PANEL_ACCESS_TTL_MS;
      req.session._pav = panelAuthExp;
      req.session._ppv = panelAuthExp;
      req.session._ppvIp = currentIp;
      await new Promise<void>((resolve) => req.session.save((err) => {
        if (err) console.error("admin-panel-pin-verify session save error:", err);
        resolve();
      }));

      console.log(`[AdminPin] ✅ Panel PIN vérifié — userId=${user.id}`);
      res.json({ ok: true });
    } catch (error) {
      console.error("admin-panel-pin-verify error:", error);
      res.status(500).json({ message: "Erreur serveur." });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    // Remove the Bearer token if present
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      removeAuthToken(token);
    }

    const logoutUserId = req.userId ?? null;
    audit(req, AUDIT.LOGOUT, { userId: logoutUserId });

    // Clear in-memory OTP verification for THIS session + destroy session
    adminVerifiedSessions.delete(req.sessionID);
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Erreur lors de la déconnexion" });
      }
      res.json({ message: "Déconnecté" });
    });
  });

  // Forgot password
  app.post("/api/auth/forgot-password", passwordResetLimiter, async (req, res) => {
    try {
      const data = forgotPasswordSchema.parse(req.body);
      
      const user = await storage.getUserByEmailOrPhone(data.identifier);

      // Always return the same 200 response regardless of whether the user exists.
      // Returning 404 leaks which emails/phones are registered (user enumeration CWE-204).
      if (user) {
        const resetToken = crypto.randomBytes(32).toString("hex");
        const expiry = new Date(Date.now() + 60 * 60 * 1000);
        await storage.setResetToken(user.id, resetToken, expiry);
        if (user.email) {
          sendPasswordResetEmail(user.email, user.fullName || user.username, resetToken).catch(() => {});
        }
      }
      
      res.json({ 
        message: "Si un compte correspond à cet identifiant, un lien de réinitialisation a été envoyé."
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Forgot password error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Reset password
  app.post("/api/auth/reset-password", passwordResetLimiter, async (req, res) => {
    try {
      const data = resetPasswordSchema.parse(req.body);

      // getUserByResetToken now checks expiry in the DB query (no second code-level check needed)
      const user = await storage.getUserByResetToken(data.token);
      if (!user) {
        return res.status(400).json({ message: "Lien de réinitialisation invalide ou expiré" });
      }
      
      const hashedPassword = await hashPassword(data.password);
      await storage.updatePassword(user.id, hashedPassword);
      await storage.clearResetToken(user.id);

      // Invalidate ALL existing sessions and Bearer tokens for this user.
      // If an attacker resets the password, the real owner (still logged in) gets kicked.
      // If the real owner resets it, any stolen session is immediately revoked.
      destroyUserSessions(user.id, Date.now()).catch(() => {});
      
      res.json({ message: "Mot de passe réinitialisé avec succès" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Reset password error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // User routes
  app.get("/api/user/otp-lock", requireAuth, async (req, res) => {
    const remainingSeconds = await getOtpOpLockRemaining(req.userId!);
    res.json({ remainingSeconds });
  });

  app.get("/api/user", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.userId!);
      if (!user) {
        return res.status(404).json({ message: "Utilisateur non trouvé" });
      }
      const { password: _, ...safeUser } = user;
      const impersonatedBy = req.session.impersonatedBy || null;
      res.json({ ...safeUser, impersonatedBy });
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Get user statistics
  app.get("/api/user/stats", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      const transactions = await storage.getTransactionsByUserId(userId);
      const paymentLinks = await storage.getPaymentLinksByUserId(userId);
      
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      const completedTransactions = transactions.filter(t => t.status === "completed");
      
      const totalReceived = completedTransactions
        .filter(t => t.type === "deposit" || t.type === "transfer_in" || t.type === "payment_link")
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);
      
      const totalSent = completedTransactions
        .filter(t => t.type === "withdrawal" || t.type === "transfer_out")
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);
      
      const monthlyTransactions = transactions.filter(t => 
        t.createdAt && new Date(t.createdAt) >= startOfMonth
      );
      
      const totalClicks = paymentLinks.reduce((sum, link) => sum + (link.clickCount || 0), 0);
      
      const linkPayments = completedTransactions.filter(t => t.type === "payment_link");
      const totalCollected = linkPayments.reduce((sum, t) => sum + parseFloat(t.amount), 0);
      
      res.json({
        totalReceived: totalReceived.toFixed(2),
        totalSent: totalSent.toFixed(2),
        totalTransactions: transactions.length,
        monthlyTransactions: monthlyTransactions.length,
        pendingTransactions: transactions.filter(t => t.status === "pending").length,
        totalClicks,
        linkPayments: linkPayments.length,
        totalCollected: totalCollected.toFixed(2),
        activeLinks: paymentLinks.filter(l => l.isActive).length,
      });
    } catch (error) {
      console.error("Get user stats error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // ─── Sessions / appareils connectés ──────────────────────────────────────────

  function parseDeviceFromUA(ua: string): { device: string; browser: string } {
    const isMobile = /Mobile|Android|iPhone|iPad|iPod/i.test(ua);
    const isTablet = /iPad|Tablet/i.test(ua);
    let device = isMobile ? (isTablet ? "Tablette" : "Mobile") : "Ordinateur";
    let browser = "Navigateur inconnu";
    if (/Chrome\/(\d+)/.test(ua) && !/Chromium|Edg|OPR/.test(ua)) browser = "Chrome";
    else if (/Firefox\/(\d+)/.test(ua)) browser = "Firefox";
    else if (/Safari\/(\d+)/.test(ua) && !/Chrome/.test(ua)) browser = "Safari";
    else if (/Edg\/(\d+)/.test(ua)) browser = "Edge";
    else if (/OPR\/(\d+)/.test(ua)) browser = "Opera";
    else if (/SamsungBrowser\/(\d+)/.test(ua)) browser = "Samsung Internet";
    return { device, browser };
  }

  app.get("/api/user/sessions", requireAuth, async (req, res) => {
    try {
      let rows: any[] = [];
      let usedPool = "session";
      try {
        const result = await sessionPool.query(
          `SELECT sid, sess, expire FROM session WHERE sess->>'userId' = $1 ORDER BY expire DESC`,
          [req.userId]
        );
        rows = result.rows || [];
      } catch (dbErr: any) {
        // Fallback to main pool
        usedPool = "main";
        try {
          const result2 = await pool.query(
            `SELECT sid, sess, expire FROM session WHERE sess->>'userId' = $1 ORDER BY expire DESC`,
            [req.userId]
          );
          rows = result2.rows || [];
        } catch (dbErr2: any) {
          usedPool = "both_failed";
          pushSessionError({ at: new Date().toISOString(), op: "list", userId: req.userId, pool: "both_failed", error: dbErr2?.message || String(dbErr2) });
          console.error("[Sessions] Impossible de lire la table session:", dbErr2?.message);
          return res.json([]);
        }
      }

      // Detect current session by token timestamp (reliable on Cloudflare proxy / Bearer-only auth)
      // req.sessionID is unreliable because Bearer token creates ephemeral sessions
      const currentTokenTs = (() => {
        const authHeader = req.headers.authorization;
        if (authHeader?.startsWith("Bearer ")) {
          return extractTokenTimestamp(authHeader.substring(7));
        }
        return null;
      })();

      const sessions = rows.map((row) => {
        const sess = typeof row.sess === "string" ? JSON.parse(row.sess) : (row.sess || {});
        const ua = sess.userAgent || "";
        const { device, browser } = parseDeviceFromUA(ua);
        const tokenTsMatch = currentTokenTs != null && sess.tokenIssuedAt != null &&
          Number(sess.tokenIssuedAt) === currentTokenTs;
        return {
          id: row.sid,
          isCurrent: row.sid === req.sessionID || tokenTsMatch,
          ip: sess.clientIp || "Inconnu",
          device,
          browser,
          loginAt: sess.loginAt || null,
          expire: row.expire,
        };
      });
      res.json(sessions);
    } catch (error) {
      console.error("[Sessions] Erreur:", error);
      res.json([]);
    }
  });

  // Déconnecter un appareil spécifique par son session ID
  // IMPORTANT: /others must be defined BEFORE /:sid — otherwise Express matches "others" as :sid
  app.delete("/api/user/sessions/others", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      const currentSid = req.sessionID;

      let count = 0;
      try {
        // Fallback: sessionPool → main pool (handles PM2 / pool exhaustion)
        let qPool = sessionPool;
        try { await sessionPool.query("SELECT 1"); } catch { qPool = pool; }

        // Count other sessions
        const countResult = await qPool.query(
          `SELECT COUNT(*) as cnt FROM session WHERE sess->>'userId' = $1 AND sid != $2`,
          [userId, currentSid ?? ""]
        );
        count = parseInt(countResult.rows[0]?.cnt || "0", 10);

        // Add them to in-memory kicks so pending requests get sessionRevoked
        const othersResult = await qPool.query(
          `SELECT sid FROM session WHERE sess->>'userId' = $1 AND sid != $2`,
          [userId, currentSid ?? ""]
        );
        for (const row of othersResult.rows as { sid: string }[]) {
          singleDeviceKicks.add(row.sid);
        }

        // Send SSE force_logout to other browsers in real-time (not current)
        notifyOtherSessionsForceLogout(userId, currentSid ?? "");

        // Delete other sessions from DB
        await qPool.query(
          `DELETE FROM session WHERE sess->>'userId' = $1 AND sid != $2`,
          [userId, currentSid ?? ""]
        );
      } catch (sessErr: any) {
        console.error("[Sessions] Erreur opérations session:", sessErr?.message);
        // Continue — revoke tokens even if session table is unavailable
      }

      // Revoke old bearer tokens and issue a fresh one for current user
      const revokedAt = Date.now();
      revokedTokensBefore.set(userId, revokedAt);
      try {
        await db.execute(sql`UPDATE users SET token_revoked_before = ${revokedAt} WHERE id = ${userId}`);
      } catch {}

      let newToken: string;
      try {
        newToken = storeAuthToken(userId);
      } catch (tokenErr) {
        console.error("[Sessions] storeAuthToken error:", (tokenErr as Error).message);
        return res.status(500).json({ message: "Erreur génération token" });
      }

      // Sync the current session's tokenIssuedAt to the new token so that
      // GET /api/user/sessions correctly marks isCurrent=true on the next fetch.
      try {
        const newTokenTs = extractTokenTimestamp(newToken);
        if (newTokenTs && req.session) {
          req.session.tokenIssuedAt = newTokenTs;
          req.session.save(() => {});
        }
      } catch { /* non-critical */ }

      res.json({ ok: true, count, token: newToken });
    } catch (error) {
      console.error("[Sessions] Déconnexion autres appareils erreur:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Déconnecter un appareil spécifique par son session ID
  app.delete("/api/user/sessions/:sid", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      const currentSid = req.sessionID;
      const targetSid = req.params.sid;

      if (!targetSid || targetSid === currentSid) {
        return res.status(400).json({ message: "Utilisez /logout pour vous déconnecter." });
      }

      // Helper: pick a working pool (sessionPool → fallback pool)
      async function getWorkingPool() {
        try { await sessionPool.query("SELECT 1"); return sessionPool; } catch { return pool; }
      }

      try {
        const qPool = await getWorkingPool();

        // Look up the session by SID only — avoids sess->>'userId' comparison failures
        // when sessions are saved asynchronously (race with req.session.save())
        let sessRow: { sid: string; sess_user_id: string | null; token_ts: string | null } | null = null;
        try {
          const check = await qPool.query(
            `SELECT sid,
                    sess->>'userId' AS sess_user_id,
                    sess->>'tokenIssuedAt' AS token_ts
             FROM session WHERE sid = $1`,
            [targetSid]
          );
          sessRow = check.rows[0] ?? null;
        } catch (lookupErr: any) {
          // Pool issue — try fallback
          console.warn("[Sessions] Lookup error, retrying with main pool:", lookupErr?.message);
          const check2 = await pool.query(
            `SELECT sid,
                    sess->>'userId' AS sess_user_id,
                    sess->>'tokenIssuedAt' AS token_ts
             FROM session WHERE sid = $1`,
            [targetSid]
          );
          sessRow = check2.rows[0] ?? null;
        }

        if (!sessRow) {
          // Session already gone — treat as success (idempotent)
          return res.json({ ok: true, alreadyGone: true });
        }

        // Ownership check in JavaScript — use String() on both sides because
        // session.userId may be stored as a number (Drizzle integer PK), while
        // req.userId from Bearer token parsing is always a string.
        if (String(sessRow.sess_user_id) !== String(userId)) {
          return res.status(403).json({ message: "Accès refusé." });
        }

        // Revoke Bearer token for this specific session
        const rawTs = sessRow.token_ts;
        const tokenTs = rawTs ? parseInt(rawTs, 10) : null;
        if (tokenTs && !isNaN(tokenTs)) {
          if (!revokedSpecificTokenTs.has(userId)) revokedSpecificTokenTs.set(userId, new Set());
          revokedSpecificTokenTs.get(userId)!.add(tokenTs);
        }

        // Mark session as kicked in-memory + notify via SSE
        singleDeviceKicks.add(targetSid);
        notifySpecificSessionForceLogout(targetSid);

        // Delete from DB — use both pools for resilience
        try {
          await qPool.query(`DELETE FROM session WHERE sid = $1`, [targetSid]);
        } catch (delErr: any) {
          console.warn("[Sessions] Delete error on primary pool, retrying:", delErr?.message);
          await pool.query(`DELETE FROM session WHERE sid = $1`, [targetSid]);
        }
      } catch (sessErr: any) {
        const detail = sessErr?.message || String(sessErr);
        pushSessionError({ at: new Date().toISOString(), op: "disconnect_one", userId, targetSid, pool: "both_failed", error: detail, stack: sessErr?.stack });
        console.error("[Sessions] Erreur déconnexion appareil:", detail, sessErr?.stack);
        return res.status(500).json({ message: `Erreur déconnexion: ${detail}` });
      }

      res.json({ ok: true });
    } catch (error: any) {
      const detail = error?.message || String(error);
      pushSessionError({ at: new Date().toISOString(), op: "disconnect_one", pool: "both_failed", error: detail, stack: error?.stack });
      console.error("[Sessions] Déconnexion appareil erreur:", detail, error?.stack);
      res.status(500).json({ message: `Erreur déconnexion: ${detail}` });
    }
  });

  // Combined dashboard endpoint — returns all data needed for dashboard in one request
  app.get("/api/dashboard", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;

      // Run all queries in parallel for maximum speed
      const [user, recentTransactions, paymentLinks, extraWallets, notifications, txStats, globalMsgs, ticketStatsRow] = await Promise.all([
        storage.getUser(userId),
        // Only fetch the 50 most recent transactions for display
        db.select().from(transactionsTable).where(and(
          eq(transactionsTable.userId, userId),
          sql`${transactionsTable.type} NOT IN ('admin_debit', 'admin_credit')`,
        ))
          .orderBy(desc(transactionsTable.createdAt)).limit(50),
        storage.getPaymentLinksByUserId(userId),
        storage.getUserWallets(userId),
        storage.getUserNotifications(userId, 20),
        // Compute stats in a single SQL aggregate query instead of JS iteration
        db.execute(drizzleSql`
          SELECT
            COALESCE(SUM(amount::numeric) FILTER (WHERE status='completed' AND type IN ('deposit','transfer_in','payment_link')), 0) AS total_received,
            COALESCE(SUM(amount::numeric) FILTER (WHERE status='completed' AND type IN ('withdrawal','transfer_out')), 0) AS total_sent,
            COUNT(*)::int AS total_transactions,
            COUNT(*) FILTER (WHERE created_at >= date_trunc('month', NOW()))::int AS monthly_transactions,
            COUNT(*) FILTER (WHERE status='pending')::int AS pending_transactions,
            COUNT(*) FILTER (WHERE status='completed' AND type='payment_link')::int AS link_payments,
            COALESCE(SUM(amount::numeric) FILTER (WHERE status='completed' AND type='payment_link'), 0) AS total_collected
          FROM transactions
          WHERE user_id = ${userId}
            AND type NOT IN ('admin_debit', 'admin_credit')
        `),
        // Global messages (banner announcements)
        storage.getActiveGlobalMessages().then(all => {
          const now = new Date();
          return all.filter((m: any) => !m.expiresAt || new Date(m.expiresAt) > now);
        }),
        // Ticket stats — single SQL query instead of N message fetches
        db.execute(drizzleSql`
          SELECT
            COUNT(*)::int AS total_count,
            COUNT(*) FILTER (
              WHERE st.status IN ('open', 'in_progress')
              AND EXISTS (
                SELECT 1 FROM ticket_messages tm
                WHERE tm.ticket_id = st.id AND tm.is_admin = true
                AND tm.created_at = (SELECT MAX(tm2.created_at) FROM ticket_messages tm2 WHERE tm2.ticket_id = st.id)
              )
            )::int AS unread_count
          FROM support_tickets st WHERE st.user_id = ${userId}
        `),
      ]);

      if (!user) return res.status(404).json({ message: "Utilisateur non trouvé" });

      // Build wallets list
      const primaryCurrency = (user.preferredCurrency || "XAF") as SupportedCurrency;
      const wallets = [
        { currency: primaryCurrency, balance: user.balance, symbol: CURRENCY_SYMBOLS[primaryCurrency] || primaryCurrency },
        ...extraWallets
          .filter(w => w.currency !== primaryCurrency)
          .map(w => ({ currency: w.currency, balance: w.balance, symbol: CURRENCY_SYMBOLS[w.currency as SupportedCurrency] || w.currency })),
      ];

      const row = (txStats.rows?.[0] || {}) as Record<string, any>;
      const stats = {
        totalReceived: parseFloat(row.total_received || "0").toFixed(2),
        totalSent: parseFloat(row.total_sent || "0").toFixed(2),
        totalTransactions: Number(row.total_transactions || 0),
        monthlyTransactions: Number(row.monthly_transactions || 0),
        pendingTransactions: Number(row.pending_transactions || 0),
        totalClicks: paymentLinks.reduce((s, l) => s + (l.clickCount || 0), 0),
        linkPayments: Number(row.link_payments || 0),
        totalCollected: parseFloat(row.total_collected || "0").toFixed(2),
        activeLinks: paymentLinks.filter(l => l.isActive).length,
      };

      const ticketRow = (ticketStatsRow.rows?.[0] || {}) as any;
      const ticketStats = { unreadCount: Number(ticketRow.unread_count || 0), totalCount: Number(ticketRow.total_count || 0) };

      const { password: _, ...safeUser } = user;
      res.json({ user: safeUser, transactions: recentTransactions, paymentLinks, wallets, stats, notifications, globalMessages: globalMsgs, ticketStats });
    } catch (error) {
      console.error("Dashboard error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Update user currency preference
  app.patch("/api/user/currency", requireAuth, async (req, res) => {
    try {
      const { currency } = req.body;
      if (!SUPPORTED_CURRENCIES.includes(currency)) {
        return res.status(400).json({ message: "Devise non supportée" });
      }
      
      const user = await storage.updateUserCurrency(req.userId!, currency as SupportedCurrency);
      if (!user) {
        return res.status(404).json({ message: "Utilisateur non trouvé" });
      }
      
      const { password: _, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      console.error("Update currency error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Update user profile
  app.patch("/api/user/profile", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;

      // Strict whitelist + sanitize HTML from text inputs (XSS prevention)
      const stripHtml = (v: unknown) => typeof v === "string" ? v.replace(/<[^>]*>/g, "").trim() : undefined;
      const fullName  = stripHtml(req.body.fullName);
      const email     = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : undefined;
      const phone     = typeof req.body.phone === "string" ? normalizePhone(req.body.phone) : undefined;
      const country   = stripHtml(req.body.country);

      if (fullName !== undefined && fullName.length < 2) {
        return res.status(400).json({ message: "Le nom complet doit comporter au moins 2 caractères." });
      }

      // Validate email uniqueness if changed (case-insensitive)
      if (email) {
        const existingUser = await storage.getUserByEmail(email);
        if (existingUser && existingUser.id !== userId) {
          return res.status(400).json({ message: "Cet email est déjà utilisé" });
        }
      }

      // Validate phone uniqueness if changed
      if (phone) {
        const existingPhone = await storage.getUserByPhone(phone);
        if (existingPhone && existingPhone.id !== userId) {
          return res.status(400).json({ message: "Ce numéro de téléphone est déjà utilisé" });
        }
      }

      const updates: Record<string, unknown> = {};
      if (fullName !== undefined) updates.fullName = fullName;
      if (email !== undefined)    updates.email    = email;
      if (phone !== undefined)    updates.phone    = phone;
      if (country !== undefined)  updates.country  = country;

      const user = await storage.updateUser(userId, updates);
      if (!user) {
        return res.status(404).json({ message: "Utilisateur non trouvé" });
      }
      
      const { password: _, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      console.error("Update profile error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Delete own account
  app.delete("/api/user/account", requireAuth, async (req, res) => {
    try {
      const { username } = req.body;
      const userId = req.userId!;
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "Utilisateur non trouvé" });
      }
      
      if (user.username !== username) {
        return res.status(400).json({ message: "Le nom d'utilisateur ne correspond pas" });
      }
      
      // Send confirmation email before deleting (async, non-blocking)
      if (user.email) {
        sendAccountDeletedEmail(user.email, user.fullName || user.username).catch(() => {});
      }

      await storage.deleteUser(userId);
      
      req.session.destroy((err) => {
        if (err) {
          console.error("Session destroy error:", err);
        }
      });
      
      res.json({ message: "Compte supprimé avec succès" });
    } catch (error) {
      console.error("Delete account error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // ─── Password Change with OTP ────────────────────────────────────────────────
  // In-memory store: userId → { otp, newPasswordHash, expiresAt, attempts }
  const passwordChangeOtpStore = new Map<string, {
    otp: string;
    newPasswordHash: string;
    expiresAt: number;
    attempts: number;
  }>();

  app.post("/api/user/password-change/request", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Mot de passe actuel et nouveau mot de passe requis" });
      }
      if (typeof newPassword !== "string" || newPassword.length < 8) {
        return res.status(400).json({ message: "Le nouveau mot de passe doit contenir au moins 8 caractères" });
      }

      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "Utilisateur non trouvé" });

      const valid = await bcrypt.compare(currentPassword, user.password);
      if (!valid) {
        return res.status(400).json({ message: "Mot de passe actuel incorrect" });
      }

      const newHash = await bcrypt.hash(newPassword, 10);
      // FIX: crypto.randomInt (CSPRNG) — 6 chiffres = 1 000 000 combinaisons
      const otp = crypto.randomInt(100000, 1000000).toString();
      const expiresAt = Date.now() + 10 * 60 * 1000;

      passwordChangeOtpStore.set(userId, { otp, newPasswordHash: newHash, expiresAt, attempts: 0 });

      if (user.email) {
        sendPasswordChangeOtpEmail(user.email, user.fullName || user.username, otp).catch(() => {});
      }

      res.json({ message: "Code OTP envoyé par email" });
    } catch (err) {
      console.error("[PasswordChange] request error:", err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.post("/api/user/password-change/confirm", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      const { otp } = req.body;

      if (!otp) return res.status(400).json({ message: "Code OTP requis" });

      const entry = passwordChangeOtpStore.get(userId);
      if (!entry) return res.status(400).json({ message: "Aucune demande de changement en cours. Veuillez recommencer." });
      if (Date.now() > entry.expiresAt) {
        passwordChangeOtpStore.delete(userId);
        return res.status(400).json({ message: "Le code OTP a expiré. Veuillez recommencer." });
      }

      entry.attempts += 1;
      if (entry.attempts > 5) {
        passwordChangeOtpStore.delete(userId);
        return res.status(400).json({ message: "Trop de tentatives. Veuillez recommencer." });
      }

      if (otp.trim() !== entry.otp) {
        return res.status(400).json({ message: "Code OTP incorrect" });
      }

      await storage.updatePassword(userId, entry.newPasswordHash);
      passwordChangeOtpStore.delete(userId);
      // Récupérer nom/email pour la notif Telegram (best-effort)
      const pwdUser = await storage.getUser(userId).catch(() => null);
      audit(req, AUDIT.PASSWORD_CHANGED, {
        userId,
        userName: pwdUser ? (pwdUser.fullName || pwdUser.username) : undefined,
        userEmail: pwdUser?.email || undefined,
      });
      // Invalidate all OTHER sessions and tokens for this user (except the current one).
      // This kicks any attacker who may have had an active session.
      destroyUserSessions(userId, Date.now()).catch(() => {});
      res.json({ message: "Mot de passe modifié avec succès" });
    } catch (err) {
      console.error("[PasswordChange] confirm error:", err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // ─── API Key routes ─────────────────────────────────────────────────────────
  app.get("/api/user/api-key", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      let user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "Utilisateur non trouvé" });

      // Auto-generate key on first access
      if (!user.apiKey) {
        const { randomBytes } = await import("crypto");
        const key = `ak_${randomBytes(24).toString("hex")}`;
        user = (await storage.setUserApiKey(userId, key)) || user;
        // setUserApiKey returns the plaintext key directly — use as-is
        return res.json({ apiKey: user.apiKey });
      }

      // Decrypt existing key before returning to client
      res.json({ apiKey: decryptField(user.apiKey) });
    } catch (error) {
      console.error("Get API key error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.post("/api/user/api-key/regenerate", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      const { randomBytes } = await import("crypto");
      const key = `ak_${randomBytes(24).toString("hex")}`;
      const user = await storage.setUserApiKey(userId, key);
      if (!user) return res.status(404).json({ message: "Utilisateur non trouvé" });
      res.json({ apiKey: user.apiKey });
    } catch (error) {
      console.error("Regenerate API key error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Merchant webhook signing secret. It is encrypted at rest and only shown
  // after an authenticated request; webhook deliveries never expose it.
  app.get("/api/user/webhook-secret", requireAuth, async (req, res) => {
    try {
      if (!isFieldEncryptionConfigured()) {
        return res.status(503).json({ message: "Le chiffrement des secrets webhook n'est pas configuré." });
      }
      const user = await storage.getUser(req.userId!);
      if (!user) return res.status(404).json({ message: "Utilisateur non trouvé" });
      let secret = decryptField((user as any).apiWebhookSecret);
      if (!secret) {
        secret = `whsec_${crypto.randomBytes(32).toString("hex")}`;
        await storage.updateUser(user.id, { apiWebhookSecret: encryptField(secret) } as any);
      } else if (!(user as any).apiWebhookSecret?.startsWith("enc:")) {
        await storage.updateUser(user.id, { apiWebhookSecret: encryptField(secret) } as any);
      }
      res.json({ webhookSecret: secret });
    } catch (error) {
      console.error("Get webhook secret error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.post("/api/user/webhook-secret/regenerate", requireAuth, async (req, res) => {
    try {
      if (!isFieldEncryptionConfigured()) {
        return res.status(503).json({ message: "Le chiffrement des secrets webhook n'est pas configuré." });
      }
      const secret = `whsec_${crypto.randomBytes(32).toString("hex")}`;
      const user = await storage.updateUser(req.userId!, { apiWebhookSecret: encryptField(secret) } as any);
      if (!user) return res.status(404).json({ message: "Utilisateur non trouvé" });
      res.json({ webhookSecret: secret });
    } catch (error) {
      console.error("Regenerate webhook secret error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Transaction routes
  app.get("/api/transactions", requireAuth, async (req, res) => {
    try {
      const all = await storage.getTransactionsByUserId(req.userId!);
      const user = await storage.getUser(req.userId!);
      const wallets = await storage.getUserWallets(req.userId!);
      const snapshots = user
        ? buildTransactionBalanceSnapshots(all, user.preferredCurrency || "XAF", parseFloat(user.balance || "0"), wallets)
        : new Map();
      // Admin-only adjustments (admin_debit / admin_credit) must not appear
      // in the user's transaction history — they are internal ledger operations.
      const HIDDEN_TYPES = new Set(["admin_debit", "admin_credit"]);
      res.json(all
        .filter(t => !HIDDEN_TYPES.has(t.type))
        .map(t => ({ ...t, ...(snapshots.get(t.id) || {}) })));
    } catch (error) {
      console.error("Get transactions error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Get transaction details by ID
  app.get("/api/transactions/:id", requireAuth, async (req, res) => {
    try {
      const transaction = await storage.getTransactionById(req.params.id);
      if (!transaction) {
        return res.status(404).json({ message: "Transaction non trouvée" });
      }
      
      // Ensure user owns this transaction
      if (transaction.userId !== req.userId) {
        return res.status(403).json({ message: "Accès refusé" });
      }
      
      // Get additional context based on transaction type
      let additionalInfo: any = {};
      
      if (transaction.paymentLinkId) {
        const paymentLink = await storage.getPaymentLinkById(transaction.paymentLinkId);
        additionalInfo.paymentLink = paymentLink ? { title: paymentLink.title, slug: paymentLink.slug } : null;
      }
      
      if (transaction.paymentIntentId) {
        const paymentIntent = await storage.getPaymentIntentById(transaction.paymentIntentId);
        additionalInfo.paymentIntent = paymentIntent ? { payerCountry: paymentIntent.payerCountry, payerPhone: paymentIntent.payerPhone } : null;
      }
      
      if (transaction.recipientId) {
        const recipient = await storage.getUser(transaction.recipientId);
        additionalInfo.recipient = recipient ? { fullName: recipient.fullName, username: recipient.username } : null;
      }

      const user = await storage.getUser(req.userId!);
      const wallets = await storage.getUserWallets(req.userId!);
      const snapshots = user
        ? buildTransactionBalanceSnapshots(
            await storage.getTransactionsByUserId(req.userId!),
            user.preferredCurrency || "XAF",
            parseFloat(user.balance || "0"),
            wallets,
          )
        : new Map();
      
      res.json({ ...transaction, ...(snapshots.get(transaction.id) || {}), ...additionalInfo });
    } catch (error) {
      console.error("Get transaction error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Search transaction by reference
  app.get("/api/transactions/reference/:reference", requireAuth, async (req, res) => {
    try {
      const transaction = await storage.getTransactionByReference(req.params.reference);
      if (!transaction) {
        return res.status(404).json({ message: "Transaction non trouvée" });
      }
      
      // Ensure user owns this transaction
      if (transaction.userId !== req.userId) {
        return res.status(403).json({ message: "Accès refusé" });
      }
      
      res.json(transaction);
    } catch (error) {
      console.error("Get transaction by reference error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Public endpoint to check transaction status (for payment page polling)
  app.get("/api/transactions/status/:reference", transactionStatusLimiter, async (req, res) => {
    try {
      // Validate reference format — prevents enumeration via arbitrary strings
      const { reference } = req.params;
      if (!reference || !/^[A-Za-z0-9_-]{6,64}$/.test(reference)) {
        return res.status(400).json({ message: "Référence invalide", status: "not_found" });
      }
      const transaction = await storage.getTransactionByReference(reference);
      if (!transaction) {
        return res.status(404).json({ message: "Transaction non trouvée", status: "not_found" });
      }
      // `notify_url` is optional. For crypto transactions, expire on demand so
      // a client-server polling this endpoint gets `failed` after 15 minutes
      // even when the background poller has not reached its next cycle.
      if (transaction.status === "pending" && transaction.paymentMethod === "crypto") {
        await expireCryptoPaymentIfNeeded(reference);
      }
      const latestTransaction = await storage.getTransactionByReference(reference);
      if (!latestTransaction) {
        return res.status(404).json({ message: "Transaction non trouvée", status: "not_found" });
      }
      // The browser must only read our local transaction state. The background
      // poller is the single component that talks to PawaPay, so a temporary
      // provider outage cannot turn every public browser poll into a second
      // provider request (or make Safari report an opaque "Load failed").
      res.json(buildPublicPaymentStatus({
        status: latestTransaction.status,
        reference: latestTransaction.reference,
        description: latestTransaction.description,
        metadata: (latestTransaction as any).metadata,
      }));
    } catch (error) {
      console.error("Get transaction status error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // User-initiated cancel of a pending deposit
  app.post("/api/transactions/cancel/:reference", requireAuth, async (req, res) => {
    try {
      const transaction = await storage.getTransactionByReference(req.params.reference);
      if (!transaction) {
        return res.status(404).json({ message: "Transaction non trouvée" });
      }
      if (transaction.userId !== req.userId) {
        return res.status(403).json({ message: "Accès refusé" });
      }
      if (transaction.status !== "pending") {
        return res.json({ success: true, status: transaction.status });
      }
      await storage.updateTransactionStatus(transaction.id, "failed");
      removePendingPayment(req.params.reference);
      console.log(`[Cancel] Transaction ${req.params.reference} cancelled by user ${req.userId}`);
      // Notify admin via Telegram
      Promise.all([
        storage.getUser(transaction.userId).catch(() => null),
        transaction.operatorId ? storage.getOperator(transaction.operatorId).catch(() => null) : Promise.resolve(null),
      ]).then(([txUser, txOp]) => {
        notifyDepositFailed({
          userName: txUser?.fullName || txUser?.username || "Utilisateur",
          userEmail: txUser?.email || "",
          userPhone: txUser?.phone || undefined,
          userCountry: txUser?.country || undefined,
          amount: transaction.totalAmount || transaction.amount,
          currency: transaction.currency || "XAF",
          reference: transaction.reference || req.params.reference,
          reason: "Annulé par l'utilisateur",
          country: undefined,
          depositType: transaction.type,
          paymentMethod: transaction.paymentMethod || undefined,
          phone: transaction.recipientPhone || undefined,
          operator: (txOp as any)?.name || undefined,
          source: (transaction as any).source || undefined,
        }).catch(() => {});
      }).catch(() => {});
      res.json({ success: true, status: "failed" });
    } catch (error) {
      console.error("Cancel transaction error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Get transfer configuration (countries, operators, fees)
  app.get("/api/transfers/config", requireAuth, async (req, res) => {
    try {
      const transactionType = (req.query.type as string) || "transfer";
      const countries = (await storage.getActiveCountries()).filter(country => {
        if (transactionType === "deposit") return country.isActiveForDeposit !== false;
        if (transactionType === "withdrawal") return country.isActiveForWithdrawal !== false;
        return country.isActiveForTransfer !== false;
      });
      const allOperators = await storage.getAllOperators();
      const allFees = await storage.getAllFees();
      
      // Build config with operators per country and their fees
      const config = countries.map(country => {
        const countryOperators = allOperators
          .filter(op => op.countryId === country.id && op.isActive && !op.isInMaintenance)
          .map(op => {
            // Find operator-specific fee first
            let operatorFee = allFees.find(
              f => f.operatorId === op.id && f.transactionType === transactionType && f.isActive
            );
            // If no operator-specific, try country-level fee
            if (!operatorFee) {
              operatorFee = allFees.find(
                f => !f.operatorId && f.countryId === country.id && f.transactionType === transactionType && f.isActive
              );
            }
            // If no country-level, try global fee
            if (!operatorFee) {
              operatorFee = allFees.find(
                f => !f.operatorId && !f.countryId && f.transactionType === transactionType && f.isActive
              );
            }
            // For deposits, use depositPaymentProvider; for others use paymentProvider
            const provider = transactionType === "deposit"
              ? ((op as any).depositPaymentProvider || (op as any).paymentProvider)
              : (op as any).paymentProvider;
            if (provider !== "afribapay" && provider !== "pixpay" && provider !== "pawapay") return null;
            const afribaRate = operatorFee ? parseFloat((operatorFee as any).afribapayFee || "0") : 0;
            const pixpayRate = operatorFee ? parseFloat((operatorFee as any).pixpayFee || "0") : 0;
            const pawapayRate = operatorFee ? parseFloat((operatorFee as any).pawapayFee || "0") : 0;
            const marginRate = operatorFee ? parseFloat((operatorFee as any).ashtechMargin || "0") : 0;
            let feePercentage = 0;
            if (provider === "afribapay") {
              feePercentage = afribaRate + marginRate;
            } else if (provider === "pixpay") {
              feePercentage = pixpayRate + marginRate;
            } else if (provider === "pawapay") {
              feePercentage = pawapayRate + marginRate;
            }
            return {
              id: op.id,
              name: op.name,
              type: op.type,
              gateway: (op as any).gateway || "soleapay",
              paymentProvider: provider,
              feePercentage,
              feeFixed: operatorFee?.feeType === "fixed" ? parseFloat(operatorFee.feeValue) : 0,
              afribapayFee: afribaRate,
              pixpayFee: pixpayRate,
              pawapayFee: pawapayRate,
              ashtechMargin: marginRate,
              minFee: operatorFee?.minFee ? parseFloat(operatorFee.minFee) : null,
              maxFee: operatorFee?.maxFee ? parseFloat(operatorFee.maxFee) : null,
            };
          });
        
        return {
          id: country.id,
          name: country.name,
          code: country.code,
          // `currency` is the accounting wallet key. PawaPay receives the
          // ISO code through toPawaPayCurrency(), never this country key.
          currency: CURRENCY_ZONE[country.code.toUpperCase()] || country.currency,
          operators: countryOperators,
        };
      }).filter(country => country.operators.length > 0);
      
      res.json(config);
    } catch (error) {
      console.error("Get transfer config error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });
  
  // Calculate transfer fee preview
  app.post("/api/transfers/calculate-fee", requireAuth, async (req, res) => {
    try {
      const { operatorId, amount } = req.body;
      
      if (!operatorId || !amount) {
        return res.status(400).json({ message: "Opérateur et montant requis" });
      }
      
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ message: "Montant invalide" });
      }
      
      const operator = await storage.getOperator(operatorId);
      if (!operator) {
        return res.status(404).json({ message: "Opérateur non trouvé" });
      }

      const provider = (operator as any).paymentProvider;
      if (provider !== "afribapay" && provider !== "pixpay" && provider !== "pawapay") {
        return res.status(400).json({ message: "Aucun fournisseur de paiement configuré pour cet opérateur." });
      }
      const fee = await storage.resolveFee("transfer", (operator as any).countryId, operatorId);
      let feeAmount = 0;
      let feePercentage = 0;
      
      if (fee) {
        const marginRate = fee.ashtechMargin ? parseFloat(fee.ashtechMargin.toString()) : 0;
        let providerRate = 0;
        if (provider === "afribapay") {
          providerRate = fee.afribapayFee ? parseFloat((fee as any).afribapayFee.toString()) : 0;
        } else if (provider === "pixpay") {
          providerRate = fee.pixpayFee ? parseFloat((fee as any).pixpayFee.toString()) : 0;
        } else if (provider === "pawapay") {
          providerRate = (fee as any).pawapayFee ? parseFloat((fee as any).pawapayFee.toString()) : 0;
        }
        const totalRate = providerRate + marginRate;

        if (fee.feeType === "percentage" || totalRate > 0) {
          feePercentage = totalRate > 0 ? totalRate : parseFloat(fee.feeValue.toString());
          feeAmount = (parsedAmount * feePercentage) / 100;
        } else {
          feeAmount = parseFloat(fee.feeValue.toString());
        }

        if (fee.maxFee && feeAmount > parseFloat(fee.maxFee.toString())) {
          feeAmount = parseFloat(fee.maxFee.toString());
        }
      }
      
      const totalAmount = parsedAmount + feeAmount;
      
      res.json({
        amount: parsedAmount,
        feeAmount,
        feePercentage,
        totalAmount,
        minFee: null,
        maxFee: fee?.maxFee ? parseFloat(fee.maxFee.toString()) : null,
      });
    } catch (error) {
      console.error("Calculate fee error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Request OTP for transfer (external or internal)
  app.post("/api/transfers/request-otp", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "Utilisateur non trouvé" });

      const lockRemaining = await getOtpOpLockRemaining(userId);
      if (lockRemaining > 0) {
        return res.status(429).json({
          message: `Une opération est déjà en cours. Réessayez dans ${Math.floor(lockRemaining / 60)}:${String(lockRemaining % 60).padStart(2, "0")}.`,
          code: "OTP_LOCKED",
          remainingSeconds: lockRemaining,
        });
      }

      // Cooldown 5min après rejet d'une opération précédente
      const xferCooldown = getFailedCooldown(userId);
      if (xferCooldown.active) {
        const rem = xferCooldown.remainingMs;
        const m = Math.floor(rem / 60000), s = Math.floor((rem % 60000) / 1000);
        return res.status(429).json({
          message: `Votre dernière opération a été rejetée. Veuillez attendre encore ${m}:${String(s).padStart(2, "0")} avant de réessayer.`,
          code: "COOLDOWN_ACTIVE",
          waitUntil: xferCooldown.waitUntilMs,
        });
      }

      const { type, recipient, phone, countryOperator, feeBearer, amount, fee, net, currency } = req.body;
      const otpType = type === "internal" ? "transfer_internal" : "transfer_external";

      if (!(await isOtpEmailEnabled())) {
        return res.json({ ref: "OTP_DISABLED", expiresIn: 0, disabled: true });
      }

      const code = String(Math.floor(100000 + Math.random() * 900000));
      const ref = crypto.randomUUID();
      txOtpStore.set(ref, { userId, otpHash: hashOtp(code), type: otpType, expiresAt: Date.now() + TX_OTP_TTL_MS });

      await setOtpOpLock(userId);

      const { sendTransferOtpEmail } = await import("./email");
      sendTransferOtpEmail(user.email, user.fullName || user.username, code, {
        type: type === "internal" ? "internal" : "external",
        recipient, phone, countryOperator, feeBearer,
        amount: String(amount), fee: String(fee), net: String(net), currency: String(currency || "XAF"),
      }).catch((err: Error) => console.error("[TransferOTP] Email error:", err.message));

      res.json({ ref, expiresIn: 600 });
    } catch (error) {
      console.error("Transfer OTP request error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Send money externally (with operator and fees)
  app.post("/api/transfers/send", requireAuth, transferLimiter, otpConfirmLimiter, async (req, res) => {
    let payoutLockUntil: number | null = null;
    try {
      const { recipientName, recipientPhone, countryId, operatorId, amount, description, feeBearer } = req.body;

      if (!recipientName || !recipientPhone || !countryId || !operatorId || !amount) {
        return res.status(400).json({ message: "Tous les champs sont requis" });
      }

      const senderId = req.userId!;
      const parsedAmount = parseFloat(amount);

      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ message: "Montant invalide" });
      }

      const sender = await storage.getUser(senderId);
      if (!sender) {
        return res.status(404).json({ message: "Utilisateur non trouvé" });
      }

      // ── OTP verification (skipped when admin disabled email OTP) ──
      if (await isOtpEmailEnabled()) {
        const { otpRef: sendOtpRef, otpCode: sendOtpCode } = req.body as any;
        if (!sendOtpRef || !sendOtpCode) {
          return res.status(400).json({ message: "Code OTP requis", code: "OTP_REQUIRED" });
        }
        const sendOtpEntry = txOtpStore.get(sendOtpRef);
        if (!sendOtpEntry || sendOtpEntry.userId !== senderId || sendOtpEntry.type !== "transfer_external") {
          return res.status(400).json({ message: "Code OTP invalide ou expiré", code: "OTP_INVALID" });
        }
        if (sendOtpEntry.expiresAt < Date.now()) {
          txOtpStore.delete(sendOtpRef);
          return res.status(400).json({ message: "Code OTP expiré, veuillez en demander un nouveau", code: "OTP_EXPIRED" });
        }
        if (hashOtp(String(sendOtpCode)) !== sendOtpEntry.otpHash) {
          txOtpStore.delete(sendOtpRef);
          clearOtpOpLock(senderId);
          return res.status(400).json({ message: "Code OTP incorrect. Demandez un nouveau code.", code: "OTP_WRONG" });
        }
        txOtpStore.delete(sendOtpRef);
        clearOtpOpLock(senderId);
      }
      // ── End OTP ──

      if (sender.withdrawalBlocked) {
        const reason = sender.withdrawalBlockReason || "Votre compte a été restreint. Contactez le support.";
        return res.status(403).json({ message: reason, code: "WITHDRAWAL_BLOCKED" });
      }

      // Cooldown 5min après rejet d'une opération précédente
      const sendCooldown = getFailedCooldown(senderId);
      if (sendCooldown.active) {
        const rem = sendCooldown.remainingMs;
        const m = Math.floor(rem / 60000), s = Math.floor((rem % 60000) / 1000);
        return res.status(429).json({
          message: `Votre dernière opération a été rejetée. Veuillez attendre encore ${m}:${String(s).padStart(2, "0")} avant de réessayer.`,
          code: "COOLDOWN_ACTIVE",
          waitUntil: sendCooldown.waitUntilMs,
        });
      }

      const operator = await storage.getOperator(operatorId);
      if (!operator) {
        return res.status(404).json({ message: "Opérateur non trouvé" });
      }

      const country = await storage.getCountry(countryId);
      if (!country) {
        return res.status(404).json({ message: "Pays non trouvé" });
      }
      if (country.isActiveForTransfer === false) {
        return res.status(400).json({ message: "Ce pays n'est pas disponible pour les transferts." });
      }
      if (operator.countryId !== country.id || !operator.isActive || operator.isInMaintenance) {
        return res.status(400).json({ message: "Opérateur invalide pour le pays sélectionné." });
      }

      const phoneValidationError = validateMobileMoneyPhone(
        recipientPhone,
        country.code,
      );
      if (phoneValidationError) {
        return res.status(400).json({
          message: phoneValidationError,
          code: "INVALID_RECIPIENT_PHONE",
        });
      }

      const txCurrency = CURRENCY_ZONE[country.code.toUpperCase()] || country.currency || sender.preferredCurrency || "XAF";

      // walletCurrency = the internal wallet code to debit. Uses CURRENCY_ZONE (which holds
      // Ashtech's internal per-country codes, e.g. NE→XOFN, ML→XOFM) so we look up the
      // correct secondary wallet. This may differ from the external country currency code.
      // No cross-family tolerance: a user sending to Bénin (XOFB) must have XOFB funds.
      const walletCurrency = CURRENCY_ZONE[country.code] || txCurrency;

      const fxRates = await loadFxRates();
      const minTransferSetting = await storage.getSetting("min_transfer");
      const minTransferXAF = minTransferSetting ? parseFloat(minTransferSetting.value) : 150;
      const minTransfer = Math.ceil(convertFromXAF(minTransferXAF, txCurrency, fxRates));
      if (parsedAmount < minTransfer) {
        return res.status(400).json({ message: `Le montant minimum de transfert est de ${minTransfer.toLocaleString()} ${txCurrency}` });
      }

      const transferProvider = (operator as any).paymentProvider;
      if (transferProvider !== "afribapay" && transferProvider !== "pixpay" && transferProvider !== "pawapay") {
        return res.status(400).json({ message: "Aucun fournisseur de paiement configuré pour cet opérateur." });
      }

      const fee = await storage.resolveFee("transfer", countryId, operatorId);
      let feeAmount = 0;
      let ashtechFeeAmount = 0;

      if (fee) {
        const marginRate = fee.ashtechMargin ? parseFloat(fee.ashtechMargin.toString()) : 0;

        let providerRate = 0;
        if (transferProvider === "afribapay") {
          providerRate = fee.afribapayFee ? parseFloat((fee as any).afribapayFee.toString()) : 0;
        } else if (transferProvider === "pixpay") {
          providerRate = fee.pixpayFee ? parseFloat((fee as any).pixpayFee.toString()) : 0;
        } else if (transferProvider === "pawapay") {
          providerRate = (fee as any).pawapayFee ? parseFloat((fee as any).pawapayFee.toString()) : 0;
        }
        const totalRate = providerRate + marginRate;

        let calculatedFee = 0;
        if (fee.feeType === "percentage" || totalRate > 0) {
          const rateToUse = totalRate > 0 ? totalRate : parseFloat(fee.feeValue.toString());
          calculatedFee = (parsedAmount * rateToUse) / 100;
          ashtechFeeAmount = totalRate > 0 ? (parsedAmount * marginRate) / 100 : calculatedFee;
        } else {
          calculatedFee = parseFloat(fee.feeValue.toString());
          ashtechFeeAmount = calculatedFee;
        }

        if (fee.maxFee && calculatedFee > parseFloat(fee.maxFee.toString())) {
          calculatedFee = parseFloat(fee.maxFee.toString());
        }

        feeAmount = calculatedFee;
      }

      // Fee bearer logic:
      // "sender" (default) = sender pays fees on top → debit amount+fee, recipient gets full amount
      // "receiver" = fees deducted from received amount → debit amount, recipient gets amount-fee
      const senderPaysFees = !feeBearer || feeBearer === "sender";
      const creditedAmount = senderPaysFees ? parsedAmount : parsedAmount - feeAmount;
      const totalAmount = senderPaysFees ? parsedAmount + feeAmount : parsedAmount;

      payoutLockUntil = await acquirePayoutOperationLock(senderId);
      if (!payoutLockUntil) {
        return res.status(409).json({
          message: "Une opération de retrait ou de transfert est déjà en cours. Attendez sa confirmation avant de recommencer.",
          code: "PAYOUT_ALREADY_IN_PROGRESS",
        });
      }
      const duplicateTransfer = await findRecentActivePayoutDuplicate({
        userId: senderId,
        type: "transfer_out",
        recipientPhone,
        operatorId: String(operatorId),
        totalAmount,
      });
      if (duplicateTransfer) {
        await releasePayoutOperationLock(senderId, payoutLockUntil);
        payoutLockUntil = null;
        return res.status(409).json({
          message: "Un transfert identique est déjà en cours de traitement.",
          code: "DUPLICATE_PAYOUT",
          reference: duplicateTransfer.reference,
        });
      }

      // Debit the wallet matching the destination country exactly (walletCurrency = txCurrency).
      // Strict match only — no cross-family CFA tolerance (must convert first otherwise).
      const senderPrimaryCurrency = sender.preferredCurrency || "XAF";
      const isPrimaryTransfer = (walletCurrency === senderPrimaryCurrency);

      if (isPrimaryTransfer) {
        if (parseFloat(sender.balance) < totalAmount) {
          await releasePayoutOperationLock(senderId, payoutLockUntil);
          payoutLockUntil = null;
          return res.status(400).json({
            message: `Solde insuffisant dans votre compte ${senderPrimaryCurrency}. Vous avez ${parseFloat(sender.balance).toFixed(0)} ${senderPrimaryCurrency} — besoin de ${totalAmount.toFixed(0)} ${senderPrimaryCurrency}`,
          });
        }
      } else {
        const senderWallet = await storage.getWallet(senderId, walletCurrency);
        const walletBalance = senderWallet ? parseFloat(senderWallet.balance) : 0;
        if (walletBalance < totalAmount) {
          await releasePayoutOperationLock(senderId, payoutLockUntil);
          payoutLockUntil = null;
          return res.status(400).json({
            message: `Solde insuffisant dans votre compte ${walletCurrency}. Vous avez ${walletBalance.toFixed(0)} ${walletCurrency} — besoin de ${totalAmount.toFixed(0)} ${walletCurrency}. Convertissez d'abord depuis votre compte ${senderPrimaryCurrency}.`,
          });
        }
      }

      if (transferProvider === "pawapay") {
        try {
          await assertPawaPayProviderActive(
            resolvePawaPayProviderCode(operator, operator.name || "", country.code),
            "PAYOUT", pawaPayCountry(country.code),
          );
        } catch {
          await releasePayoutOperationLock(senderId, payoutLockUntil);
          payoutLockUntil = null;
          return res.status(503).json({ message: "Le service de paiement est temporairement indisponible." });
        }
      }

      // Debit the correct wallet immediately
      console.log(`[Transfer] Sender=${senderId}, Amount=${parsedAmount}, Fee=${feeAmount}, Net=${creditedAmount} (${walletCurrency} → provider currency: ${txCurrency})`);
      if (isPrimaryTransfer) {
        await storage.updateUserBalance(senderId, -totalAmount);
      } else {
        await storage.upsertWallet(senderId, walletCurrency, -totalAmount);
      }

      // Create pending transaction
      const reference = generateTransactionReference("transfer_out");
      const transaction = await storage.createTransaction({
        userId: senderId,
        type: "transfer_out",
        amount: creditedAmount.toFixed(2),
        currency: txCurrency,
        status: "pending",
        description: description || `Envoi à ${recipientName}`,
        recipientName,
        recipientPhone,
        recipientCountry: country.name,
        operatorId,
        feeAmount: ashtechFeeAmount.toFixed(2),
        totalAmount: totalAmount.toFixed(2),
        paymentMethod: operator.type,
        reference,
        ...(transferProvider === "pawapay" ? { metadata: {
          paymentProvider: "pawapay", pawaCountry: pawaPayCountry(country.code), walletCurrency,
        } } : {}),
      });

      console.log(`[Transfer] Created transfer ${reference} for ${creditedAmount} net to ${recipientName} — calling payment provider immediately`);

      let transferCountryCode = "CM";
      if (country?.code) transferCountryCode = country.code;

      console.log(`[Transfer] Payout Data: Country=${transferCountryCode}, Amount=${creditedAmount}, Operator=${operator.name}`);

      try {
        const operatorName = (operator.name || "").toUpperCase();
        const countryCode = transferCountryCode.toUpperCase();

        let payoutResult: {
          success: boolean;
          transaction_id?: string;
          message?: string;
          status?: string;
          providerStatus?: number;
        } = {
          success: false,
          message: "Aucun fournisseur de paiement configuré",
        };

        if (transferProvider === "afribapay") {
          const afribapayOperatorCode = resolveAfribaPayOperatorCode(operator, operatorName);
          const afribapayCurrency = AFRIBAPAY_ISO_CURRENCY[countryCode] || txCurrency;
          console.log(`[Transfer] AfribaPay | country=${countryCode} | currency=${afribapayCurrency} | operator=${afribapayOperatorCode}`);
          const callbackUrl = buildWebhookUrl("/api/afribapay/webhook");

          const localPhone = toLocalMobileMoneyPhone(recipientPhone, countryCode);

          const afribaResult = await initiateAfribaPayout({
            operator: afribapayOperatorCode,
            country: countryCode,
            phone_number: localPhone,
            amount: creditedAmount,
            currency: afribapayCurrency,
            order_id: reference,
            reference_id: reference,
            notify_url: callbackUrl,
          });
          if (afribaResult.success) {
            // Persist submitted order_id (= reference) as externalReference so restart
            // recovery uses the same value the poller checks with (order_id, not transaction_id).
            await storage.updateTransactionExternalReference(transaction.id, reference);
          }
          payoutResult = afribaResult;

        } else if (transferProvider === "pixpay") {
          const cashInServiceId = getPixPayServiceId(operator?.name || "", countryCode, "cash_in");
          if (!cashInServiceId) {
            console.error(`[Transfer] PixPay: no cash_in service_id for ${operator?.name} in ${countryCode}`);
            await storage.updateTransactionStatus(transaction.id, "failed");
            if (isPrimaryTransfer) {
              await storage.updateUserBalance(senderId, totalAmount);
            } else {
              await storage.upsertWallet(senderId, walletCurrency, totalAmount);
            }
            return res.status(400).json({
              message: `Envoi non supporté pour cet opérateur (${operator?.name}) dans ce pays`,
            });
          }
          console.log(`[Transfer] PixPay | country=${countryCode} | service_id=${cashInServiceId} | operator=${operator?.name}`);
          const pixpayIpnUrl = buildWebhookUrl("/api/pixpay/webhook");
          const pixpayResult = await initiatePixPayPayout({
            serviceId: String(cashInServiceId),
            amount: creditedAmount,
            phone: recipientPhone.replace(/\s/g, ""),
            countryCode,
            orderId: reference,
            ipnUrl: pixpayIpnUrl,
            customData: reference,
          });
          if (pixpayResult.success && pixpayResult.transactionId) {
            await storage.updateTransactionExternalReference(transaction.id, pixpayResult.transactionId);
          }
          payoutResult = {
            success: pixpayResult.success,
            transaction_id: pixpayResult.transactionId,
            message: pixpayResult.message,
            status: pixpayResult.status,
            providerStatus: pixpayResult.providerStatus,
          };

        } else if (transferProvider === "pawapay") {
          const payoutId = createPawaPayId();
          // Persist before the network call: a timeout can still mean PawaPay
          // accepted the request and its callback/poller must find this UUID.
          await storage.updateTransactionExternalReference(transaction.id, payoutId);
          const pawaResult = await createPawaPayPayout({
            payoutId,
            country: pawaPayCountry(countryCode),
            amount: creditedAmount.toFixed(2),
            currency: toPawaPayCurrency(txCurrency),
            recipient: {
              provider: resolvePawaPayProviderCode(operator, operator.name || "", countryCode),
              phoneNumber: normalizePhone(recipientPhone) || "",
            },
            clientReferenceId: reference,
            customerMessage: PAWAPAY_CUSTOMER_MESSAGE,
          });
          payoutResult = {
            success: pawaResult.success,
            transaction_id: payoutId,
            message: pawaResult.providerMessage,
            status: pawaResult.status,
          };
        }

        if (payoutResult.success) {
          console.log(`[Transfer] Payout submitted OK: ${reference} (ext: ${payoutResult.transaction_id})`);
          // AfribaPay: poll by submitted order_id (= reference), NOT by transaction_id.
          // PixPay: poll by provider transaction_id when available.
          const transferPollerRef = transferProvider === "afribapay"
            ? reference
            : (payoutResult.transaction_id || reference);
          addPendingPayout({
            transactionId: transaction.id,
            reference:     transferPollerRef,
            userId:        senderId,
            amount:        creditedAmount.toFixed(2),
            totalDebited:  totalAmount.toFixed(2),
            provider:      transferProvider as "afribapay" | "pixpay" | "pawapay",
            ...(transferProvider === "pawapay" ? { externalReference: payoutResult.transaction_id } : {}),
            countryCode:   transferCountryCode.toUpperCase(),
            txType:        "transfer_out",
            txCurrency:    txCurrency,
            walletCurrency: walletCurrency,
          });
          notifyTransferSent({
            senderName: sender.fullName || sender.username,
            senderEmail: sender.email || "",
            senderPhone: sender.phone || undefined,
            senderCountry: sender.country || undefined,
            recipientName,
            recipientPhone,
            recipientCountry: (country as any)?.name || transferCountryCode,
            amount: creditedAmount.toFixed(2),
            grossAmount: totalAmount.toFixed(2),
            feeAmount: feeAmount.toFixed(2),
            currency: txCurrency,
            reference,
            externalReference: payoutResult?.transaction_id || (payoutResult as any)?.order_id || undefined,
            operator: (operator as any)?.name || undefined,
            provider: transferProvider,
            isInternal: false,
          }).catch(() => {});
        } else if (isDefinitivePayoutRejection(payoutResult)) {
          console.error(`[Transfer] Payout rejected for ${reference} (${transferProvider}): ${payoutResult.message || payoutResult.status}`);
          await storage.updateTransactionStatus(transaction.id, "failed");
          if (isPrimaryTransfer) {
            await releasePayoutOperationLock(senderId, payoutLockUntil);
            payoutLockUntil = null;
            await storage.updateUserBalance(senderId, totalAmount);
          } else {
            await releasePayoutOperationLock(senderId, payoutLockUntil);
            payoutLockUntil = null;
            await storage.upsertWallet(senderId, walletCurrency, totalAmount);
          }
          transaction.status = "failed";
          await storage.createUserNotification({
            userId: senderId,
            type: "transfer_failed",
            title: "Transfert rejeté",
            message: `Votre transfert de ${parsedAmount.toLocaleString()} ${txCurrency} vers ${recipientName} a été rejeté. Aucun montant n'a été conservé.`,
            transactionId: transaction.id,
            isRead: false,
          });
          return res.status(400).json({
            message: `Le transfert a été rejeté: ${sanitizeGatewayMessage(payoutResult.message, "numéro ou opération non supporté.")}`,
          });
        } else {
          // Provider balance shortages and every non-terminal/ambiguous error
          // remain manual. The amount stays reserved until an administrator
          // resolves the provider outcome.
          console.error(`[Transfer] Provider error — pending manual review for ${reference} (${transferProvider}): ${payoutResult.message}`);
          await storage.updateTransactionStatus(transaction.id, "pending_manual");
          transaction.status = "pending_manual";
          await storage.createUserNotification({
            userId: senderId,
            type: "transfer_pending",
            title: "Transfert en attente",
            message: `Votre transfert de ${parsedAmount.toLocaleString()} ${txCurrency} vers ${recipientName} est en attente de vérification par l'équipe AshTech Pay.`,
            transactionId: transaction.id,
            isRead: false,
          });
        }
      } catch (payoutErr: any) {
        console.error(`[Transfer] Payout error for ${reference}:`, payoutErr.message);
        await storage.updateTransactionStatus(transaction.id, "pending_manual");
        transaction.status = "pending_manual";
        await storage.createUserNotification({
          userId: senderId,
          type: "transfer_pending",
          title: "Transfert en attente",
          message: `Votre transfert vers ${recipientName} est en attente de vérification par l'équipe Ashtech Pay.`,
          transactionId: transaction.id,
          isRead: false,
        });
      }

      audit(req, AUDIT.TRANSFER_SENT, {
        userId: senderId,
        details: {
          amount: parsedAmount,
          currency: txCurrency,
          reference,
          feeAmount,
          totalAmount,
          recipientName,
          recipientPhone,
        },
      });
      res.json({
        message: "Votre transfert est en cours de traitement",
        transaction,
        feeAmount: feeAmount.toFixed(2),
        totalAmount: totalAmount.toFixed(2),
      });
      await releasePayoutOperationLock(senderId, payoutLockUntil);
      payoutLockUntil = null;
    } catch (error) {
      await releasePayoutOperationLock(req.userId!, payoutLockUntil);
      console.error("Send transfer error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Transfer between Ashtech Pay accounts (by email or username)
  app.post("/api/transfers/internal", requireAuth, transferLimiter, otpConfirmLimiter, async (req, res) => {
    try {
      const { recipientIdentifier, amount, description, sourceCurrency } = req.body;
      const senderId = req.userId!;
      const amountNum = parseFloat(amount);

      if (!recipientIdentifier || !recipientIdentifier.trim()) {
        return res.status(400).json({ message: "Identifiant du destinataire requis" });
      }
      if (!amountNum || amountNum <= 0) {
        return res.status(400).json({ message: "Montant invalide" });
      }

      const sender = await storage.getUser(senderId);
      if (!sender) return res.status(404).json({ message: "Utilisateur non trouvé" });

      // ── OTP verification (skipped when admin disabled email OTP) ──
      if (await isOtpEmailEnabled()) {
        const { otpRef: intOtpRef, otpCode: intOtpCode } = req.body as any;
        if (!intOtpRef || !intOtpCode) {
          return res.status(400).json({ message: "Code OTP requis", code: "OTP_REQUIRED" });
        }
        const intOtpEntry = txOtpStore.get(intOtpRef);
        if (!intOtpEntry || intOtpEntry.userId !== senderId || intOtpEntry.type !== "transfer_internal") {
          return res.status(400).json({ message: "Code OTP invalide ou expiré", code: "OTP_INVALID" });
        }
        if (intOtpEntry.expiresAt < Date.now()) {
          txOtpStore.delete(intOtpRef);
          return res.status(400).json({ message: "Code OTP expiré, veuillez en demander un nouveau", code: "OTP_EXPIRED" });
        }
        if (hashOtp(String(intOtpCode)) !== intOtpEntry.otpHash) {
          txOtpStore.delete(intOtpRef);
          clearOtpOpLock(senderId);
          return res.status(400).json({ message: "Code OTP incorrect. Demandez un nouveau code.", code: "OTP_WRONG" });
        }
        txOtpStore.delete(intOtpRef);
        clearOtpOpLock(senderId);
      }
      // ── End OTP ──

      // Block if admin has restricted withdrawals/transfers on this account
      if (sender.withdrawalBlocked) {
        const reason = sender.withdrawalBlockReason || "Votre compte a été restreint. Contactez le support.";
        return res.status(403).json({ message: reason, code: "WITHDRAWAL_BLOCKED" });
      }

      // Cooldown 5min après rejet d'une opération précédente
      const intCooldown = getFailedCooldown(senderId);
      if (intCooldown.active) {
        const rem = intCooldown.remainingMs;
        const m = Math.floor(rem / 60000), s = Math.floor((rem % 60000) / 1000);
        return res.status(429).json({
          message: `Votre dernière opération a été rejetée. Veuillez attendre encore ${m}:${String(s).padStart(2, "0")} avant de réessayer.`,
          code: "COOLDOWN_ACTIVE",
          waitUntil: intCooldown.waitUntilMs,
        });
      }

      // Lookup recipient by email, phone or username
      const identifier = recipientIdentifier.trim();
      let recipient = await storage.getUserByEmail(identifier);
      if (!recipient) {
        recipient = await storage.getUserByPhone(identifier);
      }
      if (!recipient) {
        recipient = await storage.getUserByUsername(identifier);
      }
      if (!recipient) {
        return res.status(404).json({ message: "Aucun compte Ashtech Pay trouvé avec cet identifiant" });
      }
      if (recipient.id === senderId) {
        return res.status(400).json({ message: "Vous ne pouvez pas vous envoyer de l'argent à vous-même" });
      }

      const currency = sourceCurrency || sender.preferredCurrency || "XAF";
      const senderPrimary = sender.preferredCurrency || "XAF";
      const recipientPrimary = recipient.preferredCurrency || "XAF";

      // Check balance before any debit
      if (currency === senderPrimary) {
        if (parseFloat(sender.balance) < amountNum) {
          return res.status(400).json({ message: "Solde insuffisant" });
        }
      } else {
        const wallet = await storage.getWallet(senderId, currency);
        if (!wallet || parseFloat(wallet.balance) < amountNum) {
          return res.status(400).json({ message: "Solde insuffisant dans ce portefeuille" });
        }
      }

      const transferRef = generateTransactionReference("transfer_out");

      // Create transaction records BEFORE moving money
      const transactionOut = await storage.createTransaction({
        userId: senderId,
        type: "transfer_out",
        amount: amountNum.toFixed(2),
        currency,
        status: "completed",
        description: description || `Transfert à ${recipient.fullName}`,
        recipientId: recipient.id,
        recipientName: recipient.fullName,
        reference: transferRef,
        feeAmount: "0.00",
        totalAmount: amountNum.toFixed(2),
      });

      const transactionIn = await storage.createTransaction({
        userId: recipient.id,
        type: "transfer_in",
        amount: amountNum.toFixed(2),
        currency,
        status: "completed",
        description: `Reçu de ${sender.fullName}`,
        recipientId: senderId,
        reference: transferRef,
        feeAmount: "0.00",
        totalAmount: amountNum.toFixed(2),
      });

      // Move money only after both transactions are created
      if (currency === senderPrimary) {
        await storage.updateUserBalance(senderId, -amountNum);
      } else {
        await storage.upsertWallet(senderId, currency, -amountNum);
      }
      if (currency === recipientPrimary) {
        await storage.updateUserBalance(recipient.id, amountNum);
      } else {
        await storage.upsertWallet(recipient.id, currency, amountNum);
      }

      await storage.createUserNotification({
        userId: recipient.id,
        type: "transfer_received",
        title: "Argent reçu",
        message: `Vous avez reçu ${amountNum.toFixed(2)} ${currency} de ${sender.fullName}.`,
        transactionId: transactionIn.id,
        isRead: false,
      });

      notifyTransferSent({
        senderName: sender.fullName || sender.username,
        senderEmail: sender.email || "",
        senderPhone: sender.phone || undefined,
        senderCountry: sender.country || undefined,
        recipientName: recipient.fullName || recipient.username,
        recipientEmail: recipient.email || undefined,
        recipientCountry: recipient.country || undefined,
        amount: amountNum.toFixed(2),
        currency,
        reference: transferRef,
        isInternal: true,
      }).catch(() => {});

      res.json({ message: "Transfert réussi", transaction: transactionOut, recipientName: recipient.fullName });
    } catch (error) {
      console.error("Internal transfer error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Deposit money (creates pending deposit - needs admin confirmation to credit account)
  app.post("/api/deposits", requireAuth, depositLimiter, async (req, res) => {
    try {
      const data = depositSchema.parse(req.body);
      const userId = req.userId!;
      const amount = parseFloat(data.amount);

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "Utilisateur non trouvé" });
      }

      // Get operator + country details (single fetch, used throughout)
      let operatorName = "Mobile Money";
      let countryCode = "CM";
      let countryCurrency = "XAF";
      let operatorRecord: Awaited<ReturnType<typeof storage.getOperator>> | null = null;
      if (data.operatorId) {
        operatorRecord = await storage.getOperator(data.operatorId);
        if (operatorRecord) operatorName = operatorRecord.name;
      }
      let depositCountry: Awaited<ReturnType<typeof storage.getCountry>> | undefined;
      if (data.countryId) {
        depositCountry = await storage.getCountry(data.countryId);
        if (depositCountry) {
          countryCode = depositCountry.code.toUpperCase();
          countryCurrency = CURRENCY_ZONE[countryCode] || depositCountry.currency || "XAF";
        }
      }

      if (data.paymentMethod === "mobile_money") {
        if (!depositCountry || depositCountry.isActiveForDeposit === false) {
          return res.status(400).json({ message: "Ce pays n'est pas disponible pour les dépôts." });
        }
        if (!operatorRecord || operatorRecord.countryId !== depositCountry.id ||
            !operatorRecord.isActive || operatorRecord.isInMaintenance) {
          return res.status(400).json({ message: "Opérateur invalide pour le pays sélectionné." });
        }
      }

      // Determine payment provider BEFORE fee calculation — dépôt utilise depositPaymentProvider si défini
      const paymentProvider = (operatorRecord as any)?.depositPaymentProvider || (operatorRecord as any)?.paymentProvider;
      if (paymentProvider !== "afribapay" && paymentProvider !== "pixpay" && paymentProvider !== "pawapay") {
        return res.status(400).json({ message: "Aucun fournisseur de paiement configuré pour cet opérateur." });
      }
      let pawaPayOperation: Awaited<ReturnType<typeof resolvePawaPayOperationConfiguration>> | undefined;
      if (paymentProvider === "pawapay") {
        const pawaProvider = resolvePawaPayProviderCode(operatorRecord, operatorName, countryCode);
        pawaPayOperation = await resolvePawaPayOperationConfiguration(
          pawaProvider, "DEPOSIT", pawaPayCountry(countryCode), toPawaPayCurrency(countryCurrency),
        );
        if (pawaPayOperation?.authType === "PREAUTH" && !data.preAuthorisationCode) {
          return res.status(428).json({
            error: "pawa_preauthorisation_required",
            message: "Une préautorisation Mobile Money est requise avant le paiement.",
            pawaPayAuth: pawaPayAuthPayload(pawaPayOperation),
          });
        }
      }
      console.log(`[Deposit] operatorId=${data.operatorId} | name=${operatorName} | depositProvider=${(operatorRecord as any)?.depositPaymentProvider || "null"} | payoutProvider=${(operatorRecord as any)?.paymentProvider || "null"} | resolved=${paymentProvider} | afribapayCode=${(operatorRecord as any)?.afribapayOperatorCode || "null"}`);

      // Resolve fees from DB (includes afribapayFee + ashtechMargin)
      const resolvedFeeRecord = (data.operatorId || data.countryId)
        ? await storage.resolveFee("deposit", data.countryId, data.operatorId)
        : null;
      const ashtechMarginPct = (resolvedFeeRecord as any)?.ashtechMargin != null
        ? parseFloat((resolvedFeeRecord as any).ashtechMargin)
        : ASHTECH_MARGIN;

      // Calculate fees using the CORRECT provider's rates
      const totalAmount = amount;
      let creditedAmount = 0;
      let ashtechFeeAmount = 0;
      if (paymentProvider === "afribapay") {
        const afribapayFeeRate = (resolvedFeeRecord as any)?.afribapayFee
          ? parseFloat((resolvedFeeRecord as any).afribapayFee)
          : 3.0;
        const af = computeAfribaPayFees(totalAmount, afribapayFeeRate, ashtechMarginPct);
        creditedAmount = af.creditedAmount;
        ashtechFeeAmount = af.ashtechFeeAmount;
      } else if (paymentProvider === "pixpay") {
        const pixpayFeeRate = (resolvedFeeRecord as any)?.pixpayFee
          ? parseFloat((resolvedFeeRecord as any).pixpayFee)
          : 3.0;
        const pf = computePixPayFees(totalAmount, pixpayFeeRate, ashtechMarginPct);
        creditedAmount = pf.creditedAmount;
        ashtechFeeAmount = pf.ashtechFeeAmount;
      } else if (paymentProvider === "pawapay") {
        const rate = (resolvedFeeRecord as any)?.pawapayFee != null
          ? parseFloat((resolvedFeeRecord as any).pawapayFee) : 3.0;
        // Direct deposits have identical gross/credited semantics across MMO providers.
        const pf = computePixPayFees(totalAmount, rate, ashtechMarginPct);
        creditedAmount = pf.creditedAmount;
        ashtechFeeAmount = pf.ashtechFeeAmount;
      }

      const depositRef = generateTransactionReference("deposit");
        if (paymentProvider === "pawapay") {
          try {
            await assertPawaPayProviderActive(resolvePawaPayProviderCode(operatorRecord, operatorName, countryCode), "DEPOSIT", pawaPayCountry(countryCode));
          } catch (error: any) {
            console.error("[Deposit] PawaPay provider validation failed:", error);
            return res.status(503).json(buildProviderErrorPayload({
              error: "provider_unavailable",
              message: error?.message,
              fallback: "Le fournisseur de paiement n'est pas disponible pour cette opération.",
              provider: "pawapay",
            }));
          }
        }
      const pawaPayDepositId = paymentProvider === "pawapay" ? createPawaPayId() : undefined;

      // ─── PixPay OTP pre-check — must happen BEFORE creating the transaction ──
      // Orange CI/SN/ML/BF require the user to dial a USSD code to get an OTP
      // that must be included in the API call. If it's missing, return 400 early
      // so no failed transaction is created unnecessarily.
      if (paymentProvider === "pixpay" && data.paymentMethod === "mobile_money") {
        const earlyPxOpType = detectPixPayFlowType(operatorName, countryCode);
        if (earlyPxOpType === "otp" && !(data as any).pixpayOtp) {
          const ussdCode = PIXPAY_OTP_USSD_CODES[countryCode.toUpperCase()] || "#144*82#";
          return res.status(400).json({
            otpRequired: true,
            gateway: "pixpay",
            ussdCode,
            message: `Composez ${ussdCode} sur votre téléphone pour obtenir votre code OTP, puis saisissez-le.`,
          });
        }
      }

      // Create pending transaction with provider-correct amounts
      const transaction = await storage.createTransaction({
        userId,
        type: "deposit",
        amount: creditedAmount.toString(),
        currency: countryCurrency,
        status: "pending",
        description: `Recharge via ${data.paymentMethod === "mobile_money" ? "Mobile Money" : "Crypto"}`,
        paymentMethod: data.paymentMethod,
        reference: depositRef,
        operatorId: data.operatorId,
        feeAmount: ashtechFeeAmount.toFixed(2),
        totalAmount: totalAmount.toFixed(2),
        recipientPhone: data.phoneNumber || null,
        ...(pawaPayDepositId ? { externalReference: pawaPayDepositId } : {}),
         ...(pawaPayDepositId ? {
           metadata: {
             paymentProvider: "pawapay",
             pawaCountry: pawaPayCountry(countryCode),
             countryCode,
             walletCurrency: countryCurrency,
           },
         } : {}),
      });

      notifyNewDeposit({
        userName: user.fullName || user.username,
        userEmail: user.email || "",
        userPhone: user.phone || undefined,
        userCountry: user.country || undefined,
        amount: creditedAmount,
        grossAmount: totalAmount,
        currency: countryCurrency,
        method: data.paymentMethod === "mobile_money" ? `Mobile Money (${operatorName})` : data.paymentMethod,
        phone: data.phoneNumber || undefined,
        operator: operatorName || undefined,
        reference: depositRef,
        provider: paymentProvider,
        country: countryCode,
      }).catch(() => {});

      // Call payment gateway for mobile money deposits
      if (data.paymentMethod === "mobile_money" && data.phoneNumber) {
        try {
          // paymentProvider already determined above

          if (paymentProvider === "afribapay") {
            // ─── AfribaPay Payin ──────────────────────────────────────────────
            const afribapayOperatorCode = resolveAfribaPayOperatorCode(operatorRecord, operatorName);
            // Always use AfribaPay ISO currency (overrides DB value to avoid XOFC/XOFS/XAF mismatch)
            const afribapayCurrency = AFRIBAPAY_ISO_CURRENCY[countryCode.toUpperCase()] || countryCurrency;
            console.log(`[Deposit] AfribaPay | country=${countryCode} | currency=${afribapayCurrency} | operator=${afribapayOperatorCode}`);
            const callbackUrl = buildWebhookUrl("/api/afribapay/webhook");

            // Use already-resolved fee record from outer scope
            const afribapayFeeRate = (resolvedFeeRecord as any)?.afribapayFee
              ? parseFloat((resolvedFeeRecord as any).afribapayFee.toString())
              : 3.0;
            const afribaFees = computeAfribaPayFees(totalAmount, afribapayFeeRate, ashtechMarginPct);

            // Strip country prefix from phone number (AfribaPay wants local number)
            let localPhone = data.phoneNumber.replace(/\s/g, "");
            if (localPhone.startsWith("+")) localPhone = localPhone.slice(1);
            const prefixes: Record<string, string> = {
              CM: "237", SN: "221", CI: "225", BF: "226", ML: "223",
              GN: "224", BJ: "229", TG: "228", NE: "227", CD: "243",
              CG: "242", CF: "236", TD: "235", GA: "241", GQ: "240",
              MG: "261", RW: "250", KE: "254", TZ: "255", UG: "256",
              GH: "233", NG: "234",
            };
            const prefix = prefixes[countryCode.toUpperCase()];
            if (prefix && localPhone.startsWith(prefix)) {
              localPhone = localPhone.slice(prefix.length);
            }
            // Dev-only: phone numbers must not appear in production logs (GDPR Art. 5(1)(f))
            if (process.env.NODE_ENV !== "production") console.log(`[Deposit] AfribaPay phone formatted: raw="${data.phoneNumber}" → local="${localPhone}" country=${countryCode}`);

            // Build return/cancel URLs for Wave (redirect-based operators)
            const appBaseUrl = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;

            // ── Check OTP requirement BEFORE calling payin ────────────────────
            // For OTP operators (Orange CI/SN/BF/GN, LigdiCash BF), AfribaPay rejects
            // /v1/pay/payin with "This operation requires an OTP code." so we must call
            // /v1/pay/otp WITHOUT otp_code first to initiate, then confirm with code.
            const otpInfo = await getAfribaPayOtpInfo(countryCode, afribapayOperatorCode);

            if (otpInfo.required) {
              if (otpInfo.type === "api") {
                // ── API OTP: AfribaPay sends the code by SMS via /v1/pay/otp ──
                const otpInitResult = await initiateAfribaPayOtp({
                  operator: afribapayOperatorCode,
                  country: countryCode,
                  phone_number: localPhone,
                  amount: totalAmount,
                  currency: afribapayCurrency,
                  order_id: depositRef,
                  reference_id: depositRef,
                  notify_url: callbackUrl,
                });

                if (!otpInitResult.success) {
                  await storage.updateTransactionStatus(transaction.id, "failed");
                  return res.status(400).json({ message: otpInitResult.message || "Impossible d'envoyer le code OTP" });
                }
              }
              // ── USSD OTP: user dials the code themselves — no initiation call needed ──
              // Just store context so confirm-otp can process it later

              // Store OTP context for the confirm-otp endpoint
              await persistOtpContext(depositRef, {
                userId: (req as any).userId || undefined,
                operator: afribapayOperatorCode,
                country: countryCode,
                phone: localPhone,
                amount: totalAmount,
                currency: afribapayCurrency,
                afribaTransactionId: depositRef,
                expiresAt: Date.now() + 15 * 60 * 1000, // 15 min
                otpType: otpInfo.type === "none" ? undefined : otpInfo.type,
              });

              // Substitute "montant" placeholder with the actual amount (e.g. BF Orange: *144*4*6*5000#)
              const ussdCodeForDeposit = otpInfo.ussdCode?.includes("montant")
                ? otpInfo.ussdCode.replace(/montant/gi, String(Math.round(totalAmount)))
                : (otpInfo.ussdCode || "");
              const otpMessage = otpInfo.type === "ussd"
                ? `Composez ${ussdCodeForDeposit} sur votre téléphone pour obtenir votre code OTP, puis saisissez-le ci-dessous.`
                : "Entrez le code OTP que vous allez recevoir par SMS sur votre téléphone.";

              return res.json({
                transaction,
                gateway: "afribapay",
                otpRequired: true,
                otpType: otpInfo.type === "none" ? undefined : otpInfo.type,
                ussdCode: ussdCodeForDeposit,
                status: "otp_required",
                message: otpMessage,
                feeDetails: {
                  grossAmount: totalAmount,
                  feeAmount: afribaFees.totalFeeAmount,
                  creditedAmount: afribaFees.creditedAmount,
                  afribapayFee: afribaFees.afribapayFeeAmount,
                  ashtechFee: afribaFees.ashtechFeeAmount,
                }
              });
            }

            // ── Non-OTP: regular payin (USSD or Wave redirect) ────────────────
            const afribaResponse = await initiateAfribaPayin({
              operator: afribapayOperatorCode,
              country: countryCode,
              phone_number: localPhone,
              amount: totalAmount,
              currency: afribapayCurrency,
              order_id: depositRef,
              reference_id: depositRef,
              notify_url: callbackUrl,
              return_url: `${appBaseUrl}/dashboard/deposit?ref=${depositRef}&status=success`,
              cancel_url: `${appBaseUrl}/dashboard/deposit?ref=${depositRef}&status=cancelled`,
            });

            if (afribaResponse.success) {
              // Update transaction with AfribaPay reference
              const extRef = afribaResponse.transaction_id || depositRef;
              await storage.updateTransactionExternalReference(transaction.id, extRef);
              addPendingPayment({
                transactionId: transaction.id,
                reference: depositRef,
                externalReference: extRef,
                attempts: 0,
                userId: user.id,
                type: "deposit",
                amount: afribaFees.creditedAmount.toString(),
                provider: "afribapay",
              });

              // Wave/wallet: AfribaPay returns a provider_link the user must open
              if (afribaResponse.provider_link) {
                console.log(`[AfribaPay Payin] Wave link for ${depositRef}: ${afribaResponse.provider_link}`);
                res.json({
                  transaction,
                  gateway: "afribapay",
                  waveUrl: afribaResponse.provider_link,
                  otpRequired: false,
                  status: "pending_wave",
                  message: "Cliquez sur le bouton pour finaliser votre paiement sur Wave.",
                  feeDetails: {
                    grossAmount: totalAmount,
                    feeAmount: afribaFees.totalFeeAmount,
                    creditedAmount: afribaFees.creditedAmount,
                    afribapayFee: afribaFees.afribapayFeeAmount,
                    ashtechFee: afribaFees.ashtechFeeAmount,
                  }
                });
                return;
              }

              res.json({
                transaction,
                gateway: "afribapay",
                otpRequired: false,
                status: "pending_ussd",
                message: "Appuyez sur votre téléphone pour valider le paiement USSD.",
                feeDetails: {
                  grossAmount: totalAmount,
                  feeAmount: afribaFees.totalFeeAmount,
                  creditedAmount: afribaFees.creditedAmount,
                  afribapayFee: afribaFees.afribapayFeeAmount,
                  ashtechFee: afribaFees.ashtechFeeAmount,
                }
              });
            } else if (isAfribaPayOtpRequiredMessage(afribaResponse.message)) {
              // Safety net: our OTP-requirement detection missed this operator, but
              // AfribaPay's actual rejection says an OTP is needed — switch to the
              // OTP flow instead of showing the raw upstream error with no way forward.
              // NOTE: do NOT call initiateAfribaPayOtp here — the /v1/pay/payin call
              // above already triggered the OTP SMS on AfribaPay's side. A second
              // initiation call with the same order_id causes a 5xx on their end.
              console.warn(`[AfribaPay Payin] OTP required but not pre-detected for operator=${afribapayOperatorCode} country=${countryCode} — SMS already sent by payin, switching to OTP confirmation flow`);
              await persistOtpContext(depositRef, {
                userId: (req as any).userId || undefined,
                operator: afribapayOperatorCode,
                country: countryCode,
                phone: localPhone,
                amount: totalAmount,
                currency: afribapayCurrency,
                afribaTransactionId: depositRef,
                expiresAt: Date.now() + 15 * 60 * 1000,
                otpType: "api",
              });
              return res.json({
                transaction,
                gateway: "afribapay",
                otpRequired: true,
                otpType: "api",
                ussdCode: "",
                status: "otp_required",
                message: "Entrez le code OTP que vous allez recevoir par SMS sur votre téléphone.",
                feeDetails: {
                  grossAmount: totalAmount,
                  feeAmount: afribaFees.totalFeeAmount,
                  creditedAmount: afribaFees.creditedAmount,
                  afribapayFee: afribaFees.afribapayFeeAmount,
                  ashtechFee: afribaFees.ashtechFeeAmount,
                }
              });
            } else {
              // Redact phone in production logs (GDPR Art. 5(1)(f))
              const _phoneMasked = process.env.NODE_ENV !== "production" ? localPhone : `***${localPhone.slice(-3)}`;
              console.error(`[AfribaPay Payin FAILED] country=${countryCode} phone=${_phoneMasked} operator=${afribapayOperatorCode} response=`, JSON.stringify(afribaResponse));
              await storage.updateTransactionStatus(transaction.id, "failed");
              res.status(400).json({ message: sanitizeGatewayMessage(afribaResponse.message, "Échec de l'initiation du paiement Mobile Money.") });
            }

          } else if (paymentProvider === "pixpay") {
            // ─── PixPay Payin (USSD / OTP / Wave) ────────────────────────────
            const pixpayAutoServiceId = getPixPayServiceId((operatorRecord as any)?.name || "", countryCode, "cash_out");
            if (!pixpayAutoServiceId) {
              await storage.updateTransactionStatus(transaction.id, "failed");
              return res.status(400).json({ message: "Opérateur non supporté pour ce pays. Contactez l'administrateur." });
            }

            const pixpayOpType: string = detectPixPayFlowType((operatorRecord as any)?.name || "", countryCode);
            const ipnUrl = buildWebhookUrl("/api/pixpay/webhook");
            const pixpayFeeRate = (resolvedFeeRecord as any)?.pixpayFee
              ? parseFloat((resolvedFeeRecord as any).pixpayFee.toString()) : 3.0;
            const pxFees = computePixPayFees(totalAmount, pixpayFeeRate, ashtechMarginPct);
            const cleanPhone = data.phoneNumber.replace(/\s/g, "");

            console.log(`[Deposit] PixPay type=${pixpayOpType} | country=${countryCode} | service_id=${pixpayAutoServiceId} (auto)`);

            const baseParams = {
              serviceId: String(pixpayAutoServiceId),
              amount: totalAmount,
              phone: cleanPhone,
              countryCode,
              orderId: depositRef,
              ipnUrl,
              customData: depositRef,
            };

            let pixpayResponse;

            if (pixpayOpType === "otp") {
              // Orange CI/SN/ML/BF — user must provide OTP obtained by dialing USSD code
              // The OTP pre-check above should have caught missing OTP before transaction creation.
              // This is a safety net only — we do NOT fail the transaction here.
              const omOtp = data.pixpayOtp as string | undefined;
              if (!omOtp) {
                const ussdCode = PIXPAY_OTP_USSD_CODES[countryCode.toUpperCase()] || "#144*82#";
                return res.status(400).json({
                  otpRequired: true,
                  gateway: "pixpay",
                  ussdCode,
                  message: `Composez ${ussdCode} sur votre téléphone pour obtenir votre code OTP, puis saisissez-le.`,
                });
              }
              pixpayResponse = await initiatePixPayOtp({ ...baseParams, omOtp });

            } else if (pixpayOpType === "wave") {
              // Wave CI / Wave SN — returns Wave payment URL
              const appBase = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
              pixpayResponse = await initiatePixPayWave({
                ...baseParams,
                redirectUrl: `${appBase}/dashboard/deposit?ref=${depositRef}&status=success`,
                redirectErrorUrl: `${appBase}/dashboard/deposit?ref=${depositRef}&status=cancelled`,
              });

            } else {
              // USSD push (default, most operators)
              pixpayResponse = await initiatePixPayUssd(baseParams);
            }

            if (pixpayResponse.success) {
              const extRef = pixpayResponse.transactionId || depositRef;
              await storage.updateTransactionExternalReference(transaction.id, extRef);
              addPendingPayment({
                transactionId: transaction.id,
                reference: depositRef,
                externalReference: extRef,
                attempts: 0,
                userId: user.id,
                type: "deposit",
                amount: pxFees.creditedAmount.toString(),
                provider: "pixpay",
                countryCode,
              });

              // Wave → return redirect URL to frontend
              if (pixpayOpType === "wave" && pixpayResponse.waveUrl) {
                res.json({
                  transaction,
                  gateway: "pixpay",
                  otpRequired: false,
                  waveUrl: pixpayResponse.waveUrl,
                  status: "pending_wave",
                  message: "Cliquez sur le bouton pour finaliser votre paiement via Wave.",
                  feeDetails: {
                    grossAmount: totalAmount,
                    feeAmount: pxFees.totalFeeAmount,
                    creditedAmount: pxFees.creditedAmount,
                    pixpayFee: pxFees.pixpayFeeAmount,
                    ashtechFee: pxFees.ashtechFeeAmount,
                  },
                });
                return;
              }

              res.json({
                transaction,
                gateway: "pixpay",
                otpRequired: false,
                status: pixpayOpType === "otp" ? "pending_otp_confirmed" : "pending_ussd",
                message: pixpayOpType === "otp"
                  ? "Code OTP validé. Votre paiement est en cours de traitement."
                  : "Validez le paiement USSD sur votre téléphone.",
                feeDetails: {
                  grossAmount: totalAmount,
                  feeAmount: pxFees.totalFeeAmount,
                  creditedAmount: pxFees.creditedAmount,
                  pixpayFee: pxFees.pixpayFeeAmount,
                  ashtechFee: pxFees.ashtechFeeAmount,
                },
              });
            } else {
              await storage.updateTransactionStatus(transaction.id, "failed");
              res.status(400).json({ message: sanitizeGatewayMessage(pixpayResponse.message, "Échec de l'initiation du paiement Mobile Money.") });
            }

          } else if (paymentProvider === "pawapay") {
            const rate = (resolvedFeeRecord as any)?.pawapayFee != null
              ? parseFloat((resolvedFeeRecord as any).pawapayFee) : 3.0;
            const pawaFees = computePixPayFees(totalAmount, rate, ashtechMarginPct);
            const result = await createPawaPayDeposit({
              depositId: pawaPayDepositId,
              country: pawaPayCountry(countryCode),
              amount: totalAmount.toFixed(2),
              currency: toPawaPayCurrency(countryCurrency),
              payer: {
                provider: resolvePawaPayProviderCode(operatorRecord, operatorName, countryCode),
                phoneNumber: normalizePhone(data.phoneNumber) || "",
              },
              clientReferenceId: depositRef,
              customerMessage: PAWAPAY_CUSTOMER_MESSAGE,
              operationConfiguration: pawaPayOperation,
              preAuthorisationCode: data.preAuthorisationCode,
            });
            if (result.status === "failed") {
              await storage.claimTransactionStatus(transaction.id, "failed");
              return res.status(400).json(buildProviderErrorPayload({
                error: "payment_initiation_failed", message: result.providerMessage,
                fallback: "Impossible d'initier le paiement.", provider: "pawapay", raw: result.raw,
                providerCode: result.providerCode, providerStatus: result.providerStatus,
                sensitiveValues: [data.phoneNumber],
              }));
            }
            if (result.status === "completed") {
              await processPawaPayDepositCallback(transaction, "completed");
            } else {
              addPendingPayment({
                transactionId: transaction.id, reference: depositRef, externalReference: pawaPayDepositId!,
                attempts: 0, userId: user.id, type: "deposit", amount: pawaFees.creditedAmount.toString(),
                provider: "pawapay",
              });
            }
            return res.json({
              transaction, gateway: "pawapay", status: result.status === "completed" ? "completed" : "pending",
              authorizationUrl: result.authorizationUrl || null,
              redirectUrl: result.authorizationUrl || result.redirectUrl || null,
              nextStep: result.nextStep || null,
              pawaPayAuth: pawaPayAuthPayload(result) || pawaPayAuthPayload(pawaPayOperation),
              feeDetails: { grossAmount: totalAmount, feeAmount: pawaFees.totalFeeAmount, creditedAmount: pawaFees.creditedAmount, ashtechFee: pawaFees.ashtechFeeAmount },
            });
          }
        } catch (gatewayError) {
          console.error("Payment gateway API error:", gatewayError);
          if (paymentProvider === "pawapay") {
            return res.status(502).json(buildProviderErrorPayload({
              error: "gateway_error",
              message: gatewayError instanceof Error ? gatewayError.message : undefined,
              fallback: "Impossible de contacter le fournisseur de paiement.",
              provider: "pawapay",
              sensitiveValues: [data.phoneNumber],
            }));
          }
          res.json({ 
            transaction, 
            message: "Dépôt en attente de confirmation",
            feeDetails: {
              grossAmount: totalAmount,
              feeAmount: (totalAmount - creditedAmount),
              creditedAmount
            }
          });
        }
      } else {
        res.json({ 
          transaction, 
          message: "Dépôt en attente de confirmation",
          feeDetails: {
            grossAmount: totalAmount,
            feeAmount: (totalAmount - creditedAmount),
            creditedAmount
          }
        });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Deposit error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Request OTP for withdrawal
  app.post("/api/withdrawals/request-otp", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "Utilisateur non trouvé" });

      const lockRemaining = await getOtpOpLockRemaining(userId);
      if (lockRemaining > 0) {
        return res.status(429).json({
          message: `Une opération est déjà en cours. Réessayez dans ${Math.floor(lockRemaining / 60)}:${String(lockRemaining % 60).padStart(2, "0")}.`,
          code: "OTP_LOCKED",
          remainingSeconds: lockRemaining,
        });
      }

      // Cooldown 5min après rejet d'une opération précédente
      const wdCooldown = getFailedCooldown(userId);
      if (wdCooldown.active) {
        const rem = wdCooldown.remainingMs;
        const m = Math.floor(rem / 60000), s = Math.floor((rem % 60000) / 1000);
        return res.status(429).json({
          message: `Votre dernière opération a été rejetée. Veuillez attendre encore ${m}:${String(s).padStart(2, "0")} avant de réessayer.`,
          code: "COOLDOWN_ACTIVE",
          waitUntil: wdCooldown.waitUntilMs,
        });
      }

      const { method, country, operator, phone, amount, fee, net, currency } = req.body;

      if (!(await isOtpEmailEnabled())) {
        return res.json({ ref: "OTP_DISABLED", expiresIn: 0, disabled: true });
      }

      const code = String(Math.floor(100000 + Math.random() * 900000));
      const ref = crypto.randomUUID();
      txOtpStore.set(ref, { userId, otpHash: hashOtp(code), type: "withdrawal", expiresAt: Date.now() + TX_OTP_TTL_MS });

      await setOtpOpLock(userId);

      const { sendWithdrawalOtpEmail } = await import("./email");
      sendWithdrawalOtpEmail(user.email, user.fullName || user.username, code, {
        method, country, operator, phone,
        amount: String(amount), fee: String(fee), net: String(net), currency: String(currency || "XAF"),
      }).catch((err: Error) => console.error("[WithdrawalOTP] Email error:", err.message));

      res.json({ ref, expiresIn: 600 });
    } catch (error) {
      console.error("Withdrawal OTP request error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Withdraw money
  app.post("/api/withdrawals", requireAuth, withdrawalLimiter, otpConfirmLimiter, async (req, res) => {
    let payoutLockUntil: number | null = null;
    try {
      const data = withdrawSchema.parse(req.body);
      const userId = req.userId!;
      const amount = parseFloat(data.amount);

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "Utilisateur non trouvé" });
      }

      // ── OTP verification (skipped when admin disabled email OTP) ──
      if (await isOtpEmailEnabled()) {
        const { otpRef, otpCode: submittedOtpCode } = req.body as any;
        if (!otpRef || !submittedOtpCode) {
          return res.status(400).json({ message: "Code OTP requis", code: "OTP_REQUIRED" });
        }
        const otpEntry = txOtpStore.get(otpRef);
        if (!otpEntry || otpEntry.userId !== userId || otpEntry.type !== "withdrawal") {
          return res.status(400).json({ message: "Code OTP invalide ou expiré", code: "OTP_INVALID" });
        }
        if (otpEntry.expiresAt < Date.now()) {
          txOtpStore.delete(otpRef);
          return res.status(400).json({ message: "Code OTP expiré, veuillez en demander un nouveau", code: "OTP_EXPIRED" });
        }
        if (hashOtp(String(submittedOtpCode)) !== otpEntry.otpHash) {
          txOtpStore.delete(otpRef);
          clearOtpOpLock(userId);
          return res.status(400).json({ message: "Code OTP incorrect. Demandez un nouveau code.", code: "OTP_WRONG" });
        }
        txOtpStore.delete(otpRef);
        clearOtpOpLock(userId);
      }
      // ── End OTP ──

      if (user.withdrawalBlocked) {
        const reason = user.withdrawalBlockReason || "Votre compte a été restreint. Contactez le support.";
        return res.status(403).json({ message: reason, code: "WITHDRAWAL_BLOCKED" });
      }

      // Cooldown 5min après rejet d'une opération précédente
      const wdSubmitCooldown = getFailedCooldown(userId);
      if (wdSubmitCooldown.active) {
        const rem = wdSubmitCooldown.remainingMs;
        const m = Math.floor(rem / 60000), s = Math.floor((rem % 60000) / 1000);
        return res.status(429).json({
          message: `Votre dernière opération a été rejetée. Veuillez attendre encore ${m}:${String(s).padStart(2, "0")} avant de réessayer.`,
          code: "COOLDOWN_ACTIVE",
          waitUntil: wdSubmitCooldown.waitUntilMs,
        });
      }

      const userCurrency = user.preferredCurrency || "XAF";
      const fxRates = await loadFxRates();

      const minWithdrawalSetting = await storage.getSetting("min_withdrawal");
      const minWithdrawalXAF = minWithdrawalSetting ? parseFloat(minWithdrawalSetting.value) : 150;
      const minWithdrawal = Math.ceil(convertFromXAF(minWithdrawalXAF, userCurrency, fxRates));
      const maxWithdrawalSetting = await storage.getSetting("max_withdrawal");
      const maxWithdrawalXAF = maxWithdrawalSetting ? parseFloat(maxWithdrawalSetting.value) : 5000000;
      const maxWithdrawal = Math.floor(convertFromXAF(maxWithdrawalXAF, userCurrency, fxRates));

      if (amount < minWithdrawal) {
        return res.status(400).json({ message: `Le montant minimum de retrait est de ${minWithdrawal.toLocaleString()} ${userCurrency}` });
      }
      if (amount > maxWithdrawal) {
        return res.status(400).json({ message: `Le montant maximum de retrait est de ${maxWithdrawal.toLocaleString()} ${userCurrency}` });
      }

      // Resolve country info for currency and country code
      const withdrawalCountry = await storage.getCountry(data.countryId);
      if (!withdrawalCountry || withdrawalCountry.isActiveForWithdrawal === false) {
        return res.status(400).json({ message: "Ce pays n'est pas disponible pour les retraits." });
      }
      const withdrawalCountryCode = withdrawalCountry.code.toUpperCase();
      // Use CURRENCY_ZONE for the internal wallet code (XOFN for NE, XOFM for ML, XOFT for TG, etc.)
      // CURRENCY_ZONE holds Ashtech's per-country wallet codes; COUNTRY_CURRENCY holds external country codes.
      // For wallet debit we must use the internal code so we find the right secondary wallet.
      const withdrawalCurrency = CURRENCY_ZONE[withdrawalCountryCode] || withdrawalCountry?.currency || userCurrency;

      // Fetch operator early to determine provider before fee calculation
      const withdrawalOperator = await storage.getOperator(data.operatorId);
      if (!withdrawalOperator ||
          withdrawalOperator.countryId !== withdrawalCountry.id ||
          !withdrawalOperator.isActive ||
          withdrawalOperator.isInMaintenance) {
        return res.status(400).json({ message: "Opérateur invalide pour le pays sélectionné." });
      }
      const withdrawalProvider = withdrawalOperator?.paymentProvider;
      if (withdrawalProvider !== "afribapay" && withdrawalProvider !== "pixpay" && withdrawalProvider !== "pawapay") {
        return res.status(400).json({ message: "Aucun fournisseur de paiement configuré pour cet opérateur." });
      }

      // Calculate fee using fee resolution — provider-aware
      const fee = await storage.resolveFee("withdrawal", data.countryId, data.operatorId);
      let feeAmount = 0;
      let ashtechFeeAmount = 0;
      if (fee) {
        const marginRate = fee.ashtechMargin ? parseFloat(fee.ashtechMargin.toString()) : 0;

        let providerRate = 0;
        if (withdrawalProvider === "afribapay") {
          providerRate = fee.afribapayFee ? parseFloat(fee.afribapayFee.toString()) : 0;
        } else if (withdrawalProvider === "pixpay") {
          providerRate = fee.pixpayFee ? parseFloat(fee.pixpayFee.toString()) : 0;
        } else if (withdrawalProvider === "pawapay") {
          providerRate = (fee as any).pawapayFee ? parseFloat((fee as any).pawapayFee.toString()) : 0;
        }
        const totalRate = providerRate + marginRate;

        let calculatedFee = 0;
        if (fee.feeType === "percentage" || totalRate > 0) {
          const rateToUse = totalRate > 0 ? totalRate : parseFloat(fee.feeValue.toString());
          calculatedFee = (amount * rateToUse) / 100;
          
          if (totalRate > 0) {
            ashtechFeeAmount = (amount * marginRate) / 100;
          } else {
            ashtechFeeAmount = calculatedFee;
          }
        } else {
          calculatedFee = parseFloat(fee.feeValue.toString());
          ashtechFeeAmount = calculatedFee;
        }

        if (fee.maxFee && calculatedFee > parseFloat(fee.maxFee.toString())) {
          calculatedFee = parseFloat(fee.maxFee.toString());
        }
        
        feeAmount = calculatedFee;
      }
      const creditedAmount = amount - feeAmount;
      const totalAmount = amount;

      // Debit the wallet that matches the destination country currency.
      // Togo user (XOFT) withdrawing to Togo (XOFT) → primary wallet.
      // Togo user (XOFT) withdrawing to Bénin (XOFB) → secondary XOFB wallet.
      // Togo user (XOFT) withdrawing to Cameroun (XAF) → secondary XAF wallet.
      // If the user doesn't have enough in the destination wallet → error (must convert first).
      const isPrimaryWithdrawal = (withdrawalCurrency === userCurrency);
      if (withdrawalProvider === "pawapay") {
        try {
          await assertPawaPayProviderActive(resolvePawaPayProviderCode(withdrawalOperator, withdrawalOperator?.name || "", withdrawalCountryCode), "PAYOUT", pawaPayCountry(withdrawalCountryCode));
        } catch (error: any) {
          console.error("[Withdrawal] PawaPay provider validation failed:", error);
          return res.status(503).json(buildProviderErrorPayload({
            error: "provider_unavailable",
            message: error?.message,
            fallback: "Le service de paiement est temporairement indisponible.",
            provider: "pawapay",
          }));
        }
      }

      payoutLockUntil = await acquirePayoutOperationLock(userId);
      if (!payoutLockUntil) {
        return res.status(409).json({
          message: "Une opération de retrait ou de transfert est déjà en cours. Attendez sa confirmation avant de recommencer.",
          code: "PAYOUT_ALREADY_IN_PROGRESS",
        });
      }
      const duplicateWithdrawal = await findRecentActivePayoutDuplicate({
        userId,
        type: "withdrawal",
        recipientPhone: data.accountDetails,
        operatorId: String(data.operatorId),
        totalAmount,
      });
      if (duplicateWithdrawal) {
        await releasePayoutOperationLock(userId, payoutLockUntil);
        payoutLockUntil = null;
        return res.status(409).json({
          message: "Un retrait identique est déjà en cours de traitement.",
          code: "DUPLICATE_PAYOUT",
          reference: duplicateWithdrawal.reference,
        });
      }

      if (isPrimaryWithdrawal) {
        const isDecimalCurrency = userCurrency === "USD" || (userCurrency as string) === "EUR";
        const availableBalance = isDecimalCurrency
          ? Math.floor(parseFloat(user.balance) * 100) / 100
          : Math.round(parseFloat(user.balance));
        if (availableBalance < amount) {
          await releasePayoutOperationLock(userId, payoutLockUntil);
          payoutLockUntil = null;
          return res.status(400).json({
            message: `Solde insuffisant dans votre compte ${userCurrency}. Vous avez ${availableBalance.toLocaleString()} ${userCurrency} — besoin de ${amount.toLocaleString()} ${userCurrency}`,
          });
        }
        await storage.updateUserBalance(userId, -amount);
      } else {
        const secondaryWallet = await storage.getWallet(userId, withdrawalCurrency);
        const walletBalance = secondaryWallet ? parseFloat(secondaryWallet.balance) : 0;
        if (walletBalance < amount) {
          await releasePayoutOperationLock(userId, payoutLockUntil);
          payoutLockUntil = null;
          return res.status(400).json({
            message: `Solde insuffisant dans votre compte ${withdrawalCurrency}. Vous avez ${walletBalance.toLocaleString()} ${withdrawalCurrency} — besoin de ${amount.toLocaleString()} ${withdrawalCurrency}. Convertissez d'abord depuis votre compte ${userCurrency}.`,
          });
        }
        await storage.upsertWallet(userId, withdrawalCurrency, -amount);
      }

      console.log(`[Withdrawal] User=${userId}, RequestedAmount=${amount}, Fee=${feeAmount}, NetToUser=${creditedAmount} (${withdrawalCurrency})`);

      const withdrawalRef = generateTransactionReference("withdrawal");
      const pawaPayPayoutId = withdrawalProvider === "pawapay" ? createPawaPayId() : undefined;
      let pawaPayInitiationAmbiguous = false;
      const transaction = await storage.createTransaction({
        userId,
        type: "withdrawal",
        amount: creditedAmount.toFixed(2),
        currency: withdrawalCurrency,
        status: "pending",
        description: `Retrait vers ${data.accountDetails}`,
        paymentMethod: data.paymentMethod,
        reference: withdrawalRef,
        feeAmount: ashtechFeeAmount.toFixed(2),
        totalAmount: amount.toFixed(2),
        recipientName: user.fullName || user.username || "Client",
        recipientPhone: data.accountDetails,
        recipientCountry: withdrawalCountryCode,
        operatorId: data.operatorId ? String(data.operatorId) : undefined,
        ...(pawaPayPayoutId ? { externalReference: pawaPayPayoutId } : {}),
        ...(pawaPayPayoutId ? { metadata: { paymentProvider: "pawapay", pawaCountry: pawaPayCountry(withdrawalCountryCode), walletCurrency: withdrawalCurrency } } : {}),
      });

      console.log(`[Withdrawal] Created withdrawal ${withdrawalRef} for ${creditedAmount} — calling payout gateway`);


      // Call payout API immediately — choose provider based on operator config
      try {
        const operator = withdrawalOperator;
        const operatorName = (operator?.name || "").toUpperCase();
        const countryCode = withdrawalCountryCode.toUpperCase();
        const paymentProvider = withdrawalProvider;

      let payoutResult: {
        success: boolean;
        transaction_id?: string;
        message?: string;
        status?: string;
        providerCode?: string;
        providerStatus?: number;
      } = {
        success: false,
        message: "Aucun fournisseur de paiement configuré",
      };

        if (paymentProvider === "afribapay") {
          // ─── AfribaPay Payout ────────────────────────────────────────────────
          const afribapayOperatorCode = resolveAfribaPayOperatorCode(operator, operatorName);
          const afribapayCurrency = AFRIBAPAY_ISO_CURRENCY[countryCode.toUpperCase()] || withdrawalCurrency;
          console.log(`[Withdrawal] AfribaPay | country=${countryCode} | currency=${afribapayCurrency} | operator=${afribapayOperatorCode}`);
          const callbackUrl = buildWebhookUrl("/api/afribapay/webhook");

          // Strip country prefix from phone
          let localPhone = data.accountDetails.replace(/\s/g, "");
          if (localPhone.startsWith("+")) localPhone = localPhone.slice(1);
          const phonePrefixes: Record<string, string> = {
            CM: "237", SN: "221", CI: "225", BF: "226", ML: "223",
            GN: "224", BJ: "229", TG: "228", NE: "227", CD: "243",
            CG: "242", CF: "236", TD: "235", GA: "241", GQ: "240",
            MG: "261", RW: "250", KE: "254", TZ: "255", UG: "256",
            GH: "233", NG: "234",
          };
          const pfx = phonePrefixes[countryCode];
          if (pfx && localPhone.startsWith(pfx)) localPhone = localPhone.slice(pfx.length);

          const afribaResult = await initiateAfribaPayout({
            operator: afribapayOperatorCode,
            country: countryCode,
            phone_number: localPhone,
            amount: creditedAmount,
            currency: afribapayCurrency,
            order_id: withdrawalRef,
            reference_id: withdrawalRef,
            notify_url: callbackUrl,
          });
          if (afribaResult.success) {
            // Persist submitted order_id (= withdrawalRef) so restart recovery polls
            // the right AfribaPay reference (not transaction_id, which status API ignores).
            await storage.updateTransactionExternalReference(transaction.id, withdrawalRef);
          }
          payoutResult = afribaResult;

        } else if (paymentProvider === "pixpay") {
          // ─── PixPay Payout ──────────────────────────────────────────────────
          const cashOutServiceId = getPixPayServiceId(operator?.name || "", countryCode, "cash_in");
          if (!cashOutServiceId) {
            console.error(`[Withdrawal] PixPay: no cash_in service_id for ${operator?.name} in ${countryCode}`);
            await storage.updateTransactionStatus(transaction.id, "failed");
            await storage.refundToOriginalWallet(userId, "withdrawal", withdrawalCurrency, totalAmount);
            return res.status(400).json({
              message: `Retrait non supporté pour cet opérateur (${operator?.name}) dans ce pays`,
            });
          }
          console.log(`[Withdrawal] PixPay | country=${countryCode} | service_id=${cashOutServiceId} | operator=${operator?.name}`);
          const pixpayPayoutIpnUrl = buildWebhookUrl("/api/pixpay/webhook");
          const pixpayResult = await initiatePixPayPayout({
            serviceId: String(cashOutServiceId),
            amount: creditedAmount,
            phone: data.accountDetails.replace(/\s/g, ""),
            countryCode,
            orderId: withdrawalRef,
            ipnUrl: pixpayPayoutIpnUrl,
            customData: withdrawalRef,
          });
          if (pixpayResult.success && pixpayResult.transactionId) {
            await storage.updateTransactionExternalReference(transaction.id, pixpayResult.transactionId);
          }
          payoutResult = {
            success: pixpayResult.success,
            transaction_id: pixpayResult.transactionId,
            message: pixpayResult.message,
            providerStatus: pixpayResult.providerStatus,
          };

        } else if (paymentProvider === "pawapay") {
          const result = await createPawaPayPayout({
            payoutId: pawaPayPayoutId,
            country: pawaPayCountry(countryCode),
            amount: creditedAmount.toFixed(2),
            currency: toPawaPayCurrency(withdrawalCurrency),
            recipient: {
              provider: resolvePawaPayProviderCode(operator, operator?.name || "", countryCode),
              phoneNumber: normalizePhone(data.accountDetails) || "",
            },
            clientReferenceId: withdrawalRef,
            customerMessage: PAWAPAY_CUSTOMER_MESSAGE,
          });
          payoutResult = {
            success: result.success,
            transaction_id: pawaPayPayoutId,
            message: result.providerMessage,
            status: result.status,
            providerCode: result.providerCode,
            providerStatus: result.providerStatus,
          };
        }

        if (payoutResult.success) {
          console.log(`[Withdrawal] Payout submitted OK: ${withdrawalRef} (ext: ${payoutResult.transaction_id})`);
          const pollerRef = paymentProvider === "afribapay"
            ? withdrawalRef
            : paymentProvider === "pixpay"
              ? (payoutResult.transaction_id || withdrawalRef)
              : (payoutResult.transaction_id || withdrawalRef);
          addPendingPayout({
            transactionId: transaction.id,
            reference:     pollerRef,
            userId,
            amount:        creditedAmount.toFixed(2),
            totalDebited:  totalAmount.toFixed(2),
            provider:      paymentProvider as "afribapay" | "pixpay" | "pawapay",
            ...(paymentProvider === "pawapay" ? { externalReference: pawaPayPayoutId } : {}),
            countryCode,
            txType:        "withdrawal",
            txCurrency:    withdrawalCurrency,
          });
        } else if (isDefinitivePayoutRejection(payoutResult)) {
          console.error(`[Withdrawal] Payout rejected for ${withdrawalRef} (${paymentProvider}): ${payoutResult.message || payoutResult.status}`);
          await storage.updateTransactionStatus(transaction.id, "failed");
          await storage.refundToOriginalWallet(userId, "withdrawal", withdrawalCurrency, totalAmount);
          transaction.status = "failed";
          await storage.createUserNotification({
            userId,
            type: "withdrawal_failed",
            title: "Retrait rejeté",
            message: `Votre retrait de ${amount.toLocaleString()} ${withdrawalCurrency} a été rejeté. Aucun montant n'a été conservé.`,
            transactionId: transaction.id,
            isRead: false,
          });
          if (paymentProvider === "pawapay") {
            return res.status(400).json(buildProviderErrorPayload({
              error: "payment_initiation_failed",
              message: payoutResult.message
                ? `Le retrait a été rejeté : ${payoutResult.message}`
                : undefined,
              fallback: "Le retrait a été rejeté par le fournisseur de paiement.",
              provider: "pawapay",
              providerCode: payoutResult.providerCode,
              providerStatus: payoutResult.providerStatus,
            }));
          }
          return res.status(400).json({
            message: `Le retrait a été rejeté: ${sanitizeGatewayMessage(payoutResult.message, "numéro ou opération non supporté.")}`,
          });
        } else {
          // Provider balance shortages and every non-terminal/ambiguous error
          // remain manual. The amount stays reserved until an administrator
          // resolves the provider outcome.
          console.error(`[Withdrawal] Provider error — pending manual review for ${withdrawalRef} (${paymentProvider}): ${payoutResult.message}`);
          await storage.updateTransactionStatus(transaction.id, "pending_manual");
          transaction.status = "pending_manual";
          await storage.createUserNotification({
            userId,
            type: "withdrawal_pending",
            title: "Retrait en attente",
            message: `Votre retrait de ${amount.toLocaleString()} ${withdrawalCurrency} est en attente de vérification par l'équipe AshTech Pay.`,
            transactionId: transaction.id,
            isRead: false,
          });
          notifyWithdrawalPendingManual({
            userName: user.fullName || user.username,
            userEmail: user.email || "",
            userPhone: user.phone || undefined,
            amount: creditedAmount,
            grossAmount: totalAmount,
            currency: withdrawalCurrency,
            phone: data.accountDetails,
            operator: (withdrawalOperator as any)?.name || undefined,
            reference: withdrawalRef,
            provider: paymentProvider,
            walletCurrency: withdrawalCurrency,
            senderCountry: user.country || "",
            recipientCountry: withdrawalCountryCode || "",
            recipientName: user.fullName || user.username,
          }).catch(() => {});
        }
      } catch (payoutErr: any) {
        console.error(`[Withdrawal] Payout error for ${withdrawalRef}:`, payoutErr.message);
        if (withdrawalProvider === "pawapay" && pawaPayPayoutId) {
          pawaPayInitiationAmbiguous = true;
          await storage.updateTransactionStatus(transaction.id, "pending_manual");
          addPendingPayout({
            transactionId: transaction.id,
            reference: pawaPayPayoutId,
            externalReference: pawaPayPayoutId,
            userId,
            amount: creditedAmount.toFixed(2),
            totalDebited: totalAmount.toFixed(2),
            provider: "pawapay",
            countryCode: withdrawalCountryCode,
            txType: "withdrawal",
            txCurrency: withdrawalCurrency,
            walletCurrency: withdrawalCurrency,
          });
          notifyWithdrawalPendingManual({
            userName: user.fullName || user.username,
            userEmail: user.email || "",
            userPhone: user.phone || undefined,
            amount: creditedAmount,
            grossAmount: totalAmount,
            currency: withdrawalCurrency,
            phone: data.accountDetails,
            operator: (withdrawalOperator as any)?.name || undefined,
            reference: withdrawalRef,
            externalReference: pawaPayPayoutId,
            provider: "pawapay",
            walletCurrency: withdrawalCurrency,
            senderCountry: user.country || "",
            recipientCountry: withdrawalCountryCode || "",
            recipientName: user.fullName || user.username,
          }).catch(() => {});
        } else {
          await storage.updateTransactionStatus(transaction.id, "pending_manual");
          transaction.status = "pending_manual";
          await storage.createUserNotification({
            userId,
            type: "withdrawal_pending",
            title: "Retrait en attente",
            message: `Votre retrait de ${amount.toLocaleString()} ${withdrawalCurrency} est en attente de vérification par l'équipe Ashtech Pay.`,
            transactionId: transaction.id,
            isRead: false,
          });
        }
      }

      audit(req, AUDIT.WITHDRAWAL_CREATED, {
        userId,
        details: {
          amount,
          currency: withdrawalCurrency,
          reference: withdrawalRef,
          feeAmount,
          totalDebited: totalAmount,
        },
      });
      res.json({ 
        transaction: withdrawalProvider === "pawapay" && pawaPayPayoutId
          ? { ...transaction, status: pawaPayInitiationAmbiguous ? "pending_manual" : "processing" }
          : transaction,
        feeDetails: {
          requestedAmount: amount,
          feeAmount,
          totalDebited: totalAmount
        }
      });
      await releasePayoutOperationLock(userId, payoutLockUntil);
      payoutLockUntil = null;
    } catch (error) {
      await releasePayoutOperationLock(req.userId!, payoutLockUntil);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      console.error("Withdrawal error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Fee calculation endpoint
  app.post("/api/fees/calculate", requireAuth, async (req, res) => {
    try {
      const { transactionType, amount, countryId, operatorId } = req.body;
      const numAmount = parseFloat(amount) || 0;
      
      if (numAmount <= 0) {
        return res.json({ feeAmount: 0, netAmount: 0, totalAmount: 0, feePercentage: 0 });
      }

      const fee = await storage.resolveFee(transactionType, countryId, operatorId);
      let feeAmount = 0;
      let feePercentage = 0;
      
      if (fee) {
        const providerRecord = operatorId ? await storage.getOperator(operatorId) : null;
        const provider = (providerRecord as any)?.paymentProvider || (providerRecord as any)?.depositPaymentProvider;
        const providerRate = provider === "pixpay"
          ? (fee.pixpayFee ? parseFloat(fee.pixpayFee.toString()) : 0)
          : (fee.afribapayFee ? parseFloat(fee.afribapayFee.toString()) : 0);
        const marginRate = fee.ashtechMargin ? parseFloat(fee.ashtechMargin.toString()) : 0;
        const totalRate = providerRate + marginRate;

        if (fee.feeType === "percentage" || totalRate > 0) {
          feePercentage = totalRate > 0 ? totalRate : parseFloat(fee.feeValue.toString());
          feeAmount = (numAmount * feePercentage) / 100;
        } else {
          feeAmount = parseFloat(fee.feeValue.toString());
        }

        // Apply Min Charge Rule
        if (fee.maxFee && feeAmount > parseFloat(fee.maxFee.toString())) {
          feeAmount = parseFloat(fee.maxFee.toString());
        }
      }

      // For deposits: user pays 'amount', net = amount - fee
      // For withdrawals: user pays 'amount', net = amount - fee
      const netAmount = numAmount - feeAmount;
      const totalAmount = numAmount;

      res.json({
        feeAmount: Math.round(feeAmount * 100) / 100,
        netAmount: Math.round(netAmount * 100) / 100,
        totalAmount: Math.round(totalAmount * 100) / 100,
        feePercentage,
        feeType: fee?.feeType || "none",
        feeName: fee?.name || null,
      });
    } catch (error) {
      console.error("Fee calculation error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // ── Multi-currency wallets ─────────────────────────────────────────────────

  // GET /api/wallets — list all user wallets (XAF from user.balance + others from wallets table)
  app.get("/api/wallets", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "Utilisateur non trouvé" });

      const extraWallets = await storage.getUserWallets(userId);

      // Primary wallet uses the user's preferred currency (not hardcoded XAF)
      const primaryCurrency = (user.preferredCurrency || "XAF") as SupportedCurrency;
      const primaryWallet = {
        currency: primaryCurrency,
        balance: user.balance,
        symbol: CURRENCY_SYMBOLS[primaryCurrency] || primaryCurrency,
      };

      // Extra wallets: exclude the primary currency to avoid duplicates
      const result = [
        primaryWallet,
        ...extraWallets
          .filter(w => w.currency !== primaryCurrency)
          .map(w => ({
            currency: w.currency,
            balance: w.balance,
            symbol: CURRENCY_SYMBOLS[w.currency as SupportedCurrency] || w.currency,
          })),
      ];

      res.json(result);
    } catch (error) {
      console.error("Get wallets error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // POST /api/wallets/convert — soumet une conversion (débit immédiat, crédit après délai 15-70s)
  app.post("/api/wallets/convert", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      const { fromCurrency, toCurrency, amount } = req.body;

      if (!fromCurrency || !toCurrency || !amount) {
        return res.status(400).json({ message: "fromCurrency, toCurrency et amount sont requis" });
      }
      if (fromCurrency === toCurrency) {
        return res.status(400).json({ message: "Les deux devises doivent être différentes" });
      }

      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ message: "Montant invalide" });
      }

      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "Utilisateur non trouvé" });

      const userPrimary = user.preferredCurrency || "XAF";

      // Check source balance
      let sourceBalance: number;
      if (fromCurrency === userPrimary) {
        sourceBalance = parseFloat(user.balance);
      } else {
        const w = await storage.getWallet(userId, fromCurrency);
        sourceBalance = w ? parseFloat(w.balance) : 0;
      }
      if (sourceBalance < parsedAmount) {
        return res.status(400).json({ message: `Solde insuffisant en ${fromCurrency} (disponible: ${sourceBalance.toFixed(2)})` });
      }

      // Frais par paire de devises (XOF↔XAF, CDF↔CFA) — indépendant du fournisseur
      const pairKey = getConversionPairKey(fromCurrency, toCurrency);
      const PAIR_DEFAULTS: Record<string, [number, number]> = {
        xaf_xaf: [0, 0], xof_xof: [0, 0],
        xof_xaf: [1, 1], xaf_xof: [1, 1],
        cdf_cfa: [3, 2], cfa_cdf: [3, 2],
        cfa_usdt: [1, 1], usdt_cfa: [1, 1],
      };
      const [defProvider, defAshtech] = (pairKey && PAIR_DEFAULTS[pairKey]) ? PAIR_DEFAULTS[pairKey] : [1, 1];
      const [providerFeeSetting, ashtechFeeSetting] = pairKey
        ? await Promise.all([
            storage.getSetting(`conversion_provider_fee_${pairKey}`),
            storage.getSetting(`conversion_ashtech_fee_${pairKey}`),
          ])
        : [null, null];
      const providerFeePercent = providerFeeSetting ? parseFloat(providerFeeSetting.value) : defProvider;
      const ashtechFeePercent  = ashtechFeeSetting  ? parseFloat(ashtechFeeSetting.value)  : defAshtech;
      const conversionFeePercent = providerFeePercent + ashtechFeePercent;

      const providerFeeAmount = (parsedAmount * providerFeePercent) / 100;
      const ashtechFeeAmount = (parsedAmount * ashtechFeePercent) / 100;
      const totalFeeAmount = providerFeeAmount + ashtechFeeAmount;
      const amountAfterFee = parsedAmount - totalFeeAmount;

      const convFxRates = await loadFxRates();
      const amountInXAF = convertToXAF(amountAfterFee, fromCurrency, convFxRates);
      const receivedAmountRaw = convertFromXAF(amountInXAF, toCurrency, convFxRates);

      // Guard: receivedAmount must be a finite positive number — never NaN/Infinity
      if (!isFinite(receivedAmountRaw) || receivedAmountRaw <= 0) {
        return res.status(400).json({ message: `Impossible de calculer le montant reçu en ${toCurrency}. Vérifiez les taux de change.` });
      }
      const receivedAmount = receivedAmountRaw;

      // Délai aléatoire entre 5 et 15 secondes — persisté en base pour survie aux redémarrages
      const delaySeconds = Math.floor(Math.random() * (15 - 5 + 1)) + 5;
      const executeAt = Date.now() + delaySeconds * 1000;

      // Créer d'abord la transaction et la demande de conversion (avant tout débit)
      // Si la création échoue, aucun argent n'est débité.
      const transaction = await storage.createTransaction({
        userId,
        type: "conversion",
        amount: parsedAmount.toFixed(2),
        currency: fromCurrency,
        status: "pending",
        description: `Conversion ${parsedAmount.toFixed(2)} ${fromCurrency} → ${receivedAmount.toFixed(2)} ${toCurrency} (Frais: ${providerFeePercent}% opérateurs + ${ashtechFeePercent}% Ashtech = ${conversionFeePercent}%)`,
        reference: generateTransactionReference("CONV"),
        feeAmount: totalFeeAmount.toFixed(2),
        ashtechFeeAmount: ashtechFeeAmount.toFixed(2),
        totalAmount: receivedAmount.toFixed(2),
        recipientCountry: toCurrency,
      });

      // Conversion request persistée AVANT le débit — le conversionPoller crédite le wallet cible
      const convReq = await storage.createConversionRequest({
        userId,
        fromCurrency,
        toCurrency,
        fromAmount: parsedAmount.toFixed(2),
        toAmount: receivedAmount.toFixed(2),
        status: "pending",
        notes: JSON.stringify({
          executeAt,
          txId: transaction.id,
          feeAmount: totalFeeAmount.toFixed(2),
          feePercent: `${providerFeePercent}% opérateurs + ${ashtechFeePercent}% Ashtech = ${conversionFeePercent}`,
          fromAmount: parsedAmount.toFixed(2),
          toAmount: receivedAmount.toFixed(2),
        }),
      });

      // Débit de la source APRÈS que la demande est sauvegardée en base
      // Ainsi, si le débit échoue, la demande peut être annulée sans perte d'argent
      try {
        if (fromCurrency === userPrimary) {
          await storage.updateUserBalance(userId, -parsedAmount);
        } else {
          await storage.upsertWallet(userId, fromCurrency, -parsedAmount);
        }
      } catch (debitErr: any) {
        // Rollback: annuler la demande et la transaction si le débit échoue
        await storage.updateConversionRequest(convReq.id, { status: "cancelled" }).catch(() => {});
        await storage.updateTransactionStatus(transaction.id, "failed").catch(() => {});
        console.error(`[Conversion] Debit failed for user ${userId}, rolled back conversion ${convReq.id}:`, debitErr.message);
        return res.status(500).json({ message: "Erreur lors du débit de votre compte. Aucun argent n'a été prélevé." });
      }

      // Notification "en cours"
      await storage.createUserNotification({
        userId,
        title: "Conversion en cours...",
        message: `Votre conversion de ${parsedAmount.toFixed(2)} ${fromCurrency} → ${receivedAmount.toFixed(2)} ${toCurrency} est en cours de traitement.`,
        transactionId: transaction.id,
        type: "info",
      });

      console.log(`[Conversion] ${transaction.reference} — débit ${parsedAmount} ${fromCurrency}, crédit ${receivedAmount.toFixed(2)} ${toCurrency} dans ${delaySeconds}s (job=${convReq.id})`);

      // Telegram #1 — conversion démarrée (avec boutons Forcer / Annuler)
      notifyConversionStarted({
        userName: user.fullName || user.username,
        userEmail: user.email || "",
        fromAmount: parsedAmount.toFixed(2),
        fromCurrency,
        toAmount: receivedAmount.toFixed(2),
        toCurrency,
        feeAmount: totalFeeAmount.toFixed(2),
        feePercent: `${providerFeePercent}% opérateurs + ${ashtechFeePercent}% Ashtech = ${conversionFeePercent}`,
        reference: transaction.reference || "",
        userCountry: user.country || "",
        estimatedSeconds: delaySeconds,
        conversionId: convReq.id,
      }).catch(() => {})

      return res.json({
        pending: true,
        conversionId: convReq.id,
        fromAmount: parsedAmount,
        fromCurrency,
        toAmount: receivedAmount,
        toCurrency,
        feeAmount: totalFeeAmount,
        estimatedSeconds: delaySeconds,
      });
    } catch (error) {
      console.error("Convert wallet error:", error);
      res.status(500).json({ message: "Erreur serveur lors de la conversion" });
    }
  });

  // GET /api/wallets/conversion-status/:id — statut d'une conversion en attente
  app.get("/api/wallets/conversion-status/:id", requireAuth, async (req, res) => {
    try {
      const convReq = await storage.getConversionRequest(req.params.id);
      if (!convReq || convReq.userId !== req.userId) {
        return res.status(404).json({ message: "Conversion introuvable" });
      }
      return res.json({ status: convReq.status, conversionId: convReq.id });
    } catch (error) {
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // ── Auto-conversion rules ───────────────────────────────────────────────────
  // GET /api/auto-conversion — list the user's auto-conversion rules
  app.get("/api/auto-conversion", requireAuth, async (req, res) => {
    try {
      const rules = await storage.getAutoConversionRules(req.userId!);
      res.json(rules);
    } catch (error) {
      console.error("Get auto-conversion rules error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // POST /api/auto-conversion — create a new rule (one active rule per source currency)
  app.post("/api/auto-conversion", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      const parsed = insertAutoConversionRuleSchema.safeParse({ ...req.body, userId });
      if (!parsed.success) {
        return res.status(400).json({ message: "fromCurrency et toCurrency sont requis" });
      }
      const { fromCurrency, toCurrency } = parsed.data;

      if (fromCurrency === toCurrency) {
        return res.status(400).json({ message: "Les deux devises doivent être différentes" });
      }

      const existing = await storage.getAutoConversionRuleByCurrency(userId, fromCurrency);
      if (existing) {
        return res.status(400).json({ message: `Une conversion automatique existe déjà pour ${fromCurrency}. Supprimez-la avant d'en créer une nouvelle.` });
      }

      // Constraint 1: fromCurrency must not already be used as a target in any rule
      const allRules = await storage.getAutoConversionRules(userId);
      const usedAsTarget = allRules.some((r) => r.toCurrency === fromCurrency);
      if (usedAsTarget) {
        return res.status(400).json({ message: `${fromCurrency} est déjà utilisé comme wallet cible dans une règle. Il ne peut pas être utilisé comme source.` });
      }

      // Constraint 2: toCurrency must not already be used as a source in any rule
      const usedAsSource = allRules.some((r) => r.fromCurrency === toCurrency);
      if (usedAsSource) {
        return res.status(400).json({ message: `${toCurrency} est déjà utilisé comme wallet source dans une règle. Il ne peut pas être utilisé comme destination.` });
      }

      const rule = await storage.createAutoConversionRule({ userId, fromCurrency, toCurrency });
      res.json(rule);

      // After saving, immediately check if there's a balance to convert right now
      const user = await storage.getUser(userId);
      if (user) {
        // Notify Telegram — rule activated
        notifyAutoConversionRuleCreated({
          userName: user.username,
          userEmail: user.email,
          fromCurrency,
          toCurrency,
          userCountry: user.country ?? undefined,
        }).catch((err) => console.error("[Telegram] notifyAutoConversionRuleCreated failed:", err?.message ?? err));

        const primary = user.preferredCurrency || "XAF";
        let currentBalance = 0;
        if (fromCurrency === primary) {
          currentBalance = parseFloat(user.balance);
        } else {
          const w = await storage.getWallet(userId, fromCurrency);
          currentBalance = w ? parseFloat(w.balance) : 0;
        }
        if (currentBalance > 0) {
          maybeAutoConvert(userId, fromCurrency, currentBalance).catch((err) => {
            console.error(`[AutoConversion] Immediate trigger error for user ${userId}:`, err?.message || err);
          });
        }
      }
    } catch (error: any) {
      if (error?.code === "23505") {
        return res.status(400).json({ message: "Une conversion automatique existe déjà pour cette devise." });
      }
      console.error("Create auto-conversion rule error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // POST /api/auto-conversion/bulk — create multiple rules at once, single Telegram notification
  app.post("/api/auto-conversion/bulk", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      const { fromCurrencies, toCurrency } = req.body;
      if (!Array.isArray(fromCurrencies) || fromCurrencies.length === 0 || !toCurrency) {
        return res.status(400).json({ message: "fromCurrencies (array) et toCurrency sont requis" });
      }

      const allRules = await storage.getAutoConversionRules(userId);
      const user = await storage.getUser(userId);
      const created: { fromCurrency: string; toCurrency: string }[] = [];
      const skipped: string[] = [];

      for (const fromCurrency of fromCurrencies) {
        if (fromCurrency === toCurrency) continue;

        // Skip duplicates or constraint violations
        const existing = allRules.find((r) => r.fromCurrency === fromCurrency);
        if (existing) { skipped.push(fromCurrency); continue; }
        const usedAsTarget = allRules.some((r) => r.toCurrency === fromCurrency);
        if (usedAsTarget) { skipped.push(fromCurrency); continue; }
        const usedAsSource = allRules.some((r) => r.fromCurrency === toCurrency);
        if (usedAsSource) { skipped.push(fromCurrency); continue; }

        try {
          await storage.createAutoConversionRule({ userId, fromCurrency, toCurrency });
          created.push({ fromCurrency, toCurrency });
          // Also add to allRules so subsequent iterations see correct state
          allRules.push({ id: "", userId, fromCurrency, toCurrency, isActive: true, createdAt: new Date() });
        } catch {
          skipped.push(fromCurrency);
        }
      }

      res.json({ created: created.length, skipped: skipped.length });

      // Single grouped Telegram notification for all created rules
      if (user && created.length > 0) {
        notifyAutoConversionRulesBulkCreated({
          userName: user.username,
          userEmail: user.email,
          userCountry: user.country ?? undefined,
          rules: created,
        }).catch((err) => console.error("[Telegram] notifyAutoConversionRulesBulkCreated failed:", err?.message ?? err));

        // Trigger immediate conversion for each rule if balance exists
        for (const { fromCurrency } of created) {
          const primary = user.preferredCurrency || "XAF";
          let currentBalance = 0;
          if (fromCurrency === primary) {
            currentBalance = parseFloat(user.balance);
          } else {
            const w = await storage.getWallet(userId, fromCurrency);
            currentBalance = w ? parseFloat(w.balance) : 0;
          }
          if (currentBalance > 0) {
            maybeAutoConvert(userId, fromCurrency, currentBalance).catch((err) => {
              console.error(`[AutoConversion] Bulk immediate trigger error for user ${userId}:`, err?.message || err);
            });
          }
        }
      }
    } catch (error: any) {
      console.error("Bulk create auto-conversion rules error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // PATCH /api/auto-conversion/:id — update the target currency of a rule
  app.patch("/api/auto-conversion/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      const { toCurrency } = req.body;
      if (!toCurrency || typeof toCurrency !== "string") {
        return res.status(400).json({ message: "toCurrency est requis" });
      }

      // Constraint: new toCurrency must not already be used as a fromCurrency in any rule
      // (a source wallet cannot become a destination)
      const allRulesForPatch = await storage.getAutoConversionRules(userId);
      const newTargetUsedAsSource = allRulesForPatch.some((r) => r.fromCurrency === toCurrency);
      if (newTargetUsedAsSource) {
        return res.status(400).json({ message: `${toCurrency} est déjà utilisé comme wallet source. Il ne peut pas être utilisé comme destination.` });
      }
      // Note: "toCurrency already used as target in another group" is not blocked here because
      // group-target migrations are done rule-by-rule from the frontend (sequential PATCHes for
      // every rule in the same group), and blocking it would reject the 2nd+ call in the batch.
      // The frontend already prevents the user from selecting a locked target via availableTargets.

      const updated = await storage.updateAutoConversionRule(req.params.id, userId, toCurrency);
      if (!updated) return res.status(404).json({ message: "Règle introuvable" });
      res.json(updated);

      // Immediately trigger conversion with current balance after update
      const user = await storage.getUser(userId);
      if (user) {
        const primary = user.preferredCurrency || "XAF";
        let currentBalance = 0;
        if (updated.fromCurrency === primary) {
          currentBalance = parseFloat(user.balance);
        } else {
          const w = await storage.getWallet(userId, updated.fromCurrency);
          currentBalance = w ? parseFloat(w.balance) : 0;
        }
        if (currentBalance > 0) {
          maybeAutoConvert(userId, updated.fromCurrency, currentBalance).catch((err) => {
            console.error(`[AutoConversion] Immediate trigger (update) error for user ${userId}:`, err?.message || err);
          });
        }
      }
    } catch (error) {
      console.error("Update auto-conversion rule error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // DELETE /api/auto-conversion/:id — remove a rule
  app.delete("/api/auto-conversion/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteAutoConversionRule(req.params.id, req.userId!);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete auto-conversion rule error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Convert a user's balance between currencies
  app.post("/api/admin/users/:id/convert", requireAuth, requireAdmin, async (req, res) => {
    try {
      const userId = req.params.id;
      const { fromCurrency, toCurrency, amount } = req.body;
      if (!fromCurrency || !toCurrency || !amount) {
        return res.status(400).json({ message: "fromCurrency, toCurrency et amount sont requis" });
      }
      if (fromCurrency === toCurrency) {
        return res.status(400).json({ message: "Les deux devises doivent être différentes" });
      }
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ message: "Montant invalide" });
      }

      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "Utilisateur non trouvé" });

      const primaryCurrency = user.preferredCurrency || "XAF";

      // Check & verify source balance
      let sourceBalance: number;
      if (fromCurrency === primaryCurrency) {
        sourceBalance = parseFloat(user.balance);
      } else {
        const w = await storage.getWallet(userId, fromCurrency);
        sourceBalance = w ? parseFloat(w.balance) : 0;
      }
      if (sourceBalance < parsedAmount) {
        return res.status(400).json({ message: `Solde insuffisant en ${fromCurrency} (disponible: ${sourceBalance.toFixed(2)})` });
      }

      // Frais par paire de devises — même logique que la route user
      const adminPairKey = getConversionPairKey(fromCurrency, toCurrency);
      const ADMIN_PAIR_DEFAULTS: Record<string, [number, number]> = {
        xof_xaf: [1, 1], xaf_xof: [1, 1],
        cdf_cfa: [3, 2], cfa_cdf: [3, 2],
      };
      const [adminDefProvider, adminDefAshtech] = (adminPairKey && ADMIN_PAIR_DEFAULTS[adminPairKey]) ? ADMIN_PAIR_DEFAULTS[adminPairKey] : [1, 1];
      const [adminProviderFeeSetting, adminAshtechFeeSetting] = adminPairKey
        ? await Promise.all([
            storage.getSetting(`conversion_provider_fee_${adminPairKey}`),
            storage.getSetting(`conversion_ashtech_fee_${adminPairKey}`),
          ])
        : [null, null];
      const adminProviderFeePercent = adminProviderFeeSetting ? parseFloat(adminProviderFeeSetting.value) : adminDefProvider;
      const adminAshtechFeePercent  = adminAshtechFeeSetting  ? parseFloat(adminAshtechFeeSetting.value)  : adminDefAshtech;
      const conversionFeePercent = adminProviderFeePercent + adminAshtechFeePercent;
      const adminProviderFeeAmount = (parsedAmount * adminProviderFeePercent) / 100;
      const adminAshtechFeeAmount = (parsedAmount * adminAshtechFeePercent) / 100;
      const feeAmount = adminProviderFeeAmount + adminAshtechFeeAmount;
      const amountAfterFee = parsedAmount - feeAmount;

      const convFxRates = await loadFxRates();
      const amountInXAF = convertToXAF(amountAfterFee, fromCurrency, convFxRates);
      const receivedAmount = convertFromXAF(amountInXAF, toCurrency, convFxRates);

      // Record transaction BEFORE moving money
      const transaction = await storage.createTransaction({
        userId,
        type: "conversion",
        amount: parsedAmount.toFixed(2),
        currency: fromCurrency,
        status: "completed",
        description: `Conversion admin: ${parsedAmount.toFixed(2)} ${fromCurrency} → ${receivedAmount.toFixed(2)} ${toCurrency} (Frais: ${adminProviderFeePercent}% opérateurs + ${adminAshtechFeePercent}% Ashtech = ${conversionFeePercent}%)`,
        reference: generateTransactionReference("CONV"),
        feeAmount: feeAmount.toFixed(2),
        ashtechFeeAmount: adminAshtechFeeAmount.toFixed(2),
        totalAmount: receivedAmount.toFixed(2),
        recipientCountry: toCurrency,
      });

      // Debit source and credit target after transaction is created
      if (fromCurrency === primaryCurrency) {
        await storage.updateUserBalance(userId, -parsedAmount);
      } else {
        await storage.upsertWallet(userId, fromCurrency, -parsedAmount);
      }
      if (toCurrency === primaryCurrency) {
        await storage.updateUserBalance(userId, receivedAmount);
      } else {
        await storage.upsertWallet(userId, toCurrency, receivedAmount);
      }

      await storage.createConversionRequest({
        userId,
        fromCurrency,
        toCurrency,
        fromAmount: parsedAmount.toFixed(2),
        toAmount: receivedAmount.toFixed(2),
        status: "completed",
        notes: `Conversion exécutée par admin. Frais: ${feeAmount.toFixed(2)} ${fromCurrency} (${conversionFeePercent}%)`,
        executedAt: new Date(),
        executedById: req.userId!,
      });

      await storage.createUserNotification({
        userId,
        title: "Conversion effectuée par l'admin",
        message: `Une conversion a été effectuée sur votre compte : ${parsedAmount.toFixed(2)} ${fromCurrency} → ${receivedAmount.toFixed(2)} ${toCurrency}. Frais: ${feeAmount.toFixed(2)} ${fromCurrency}.`,
        transactionId: transaction.id,
        type: "success",
      });

      // Notify admin via Telegram
      const adminUser = await storage.getUser(req.userId!).catch(() => null);
      notifyConversion({
        userName: user.fullName || user.username,
        userEmail: user.email || "",
        fromAmount: parsedAmount.toFixed(2),
        fromCurrency,
        toAmount: receivedAmount.toFixed(2),
        toCurrency,
        feeAmount: feeAmount.toFixed(2),
        feePercent: `${adminProviderFeePercent}% opérateurs + ${adminAshtechFeePercent}% Ashtech = ${conversionFeePercent}`,
        reference: transaction.reference || "",
        byAdmin: true,
        adminName: adminUser?.fullName || adminUser?.username || "Admin",
        userCountry: user.country || "",
      }).catch(() => {});

      return res.json({
        success: true,
        fromAmount: parsedAmount,
        fromCurrency,
        toAmount: receivedAmount,
        toCurrency,
        feeAmount,
        conversionFeePercent,
        message: `Conversion effectuée avec succès.`,
      });
    } catch (error) {
      console.error("Admin convert error:", error);
      res.status(500).json({ message: "Erreur serveur lors de la conversion" });
    }
  });

  // Public settings — FIX-8: seules les clés explicitement autorisées sont lisibles sans auth.
  // Toute autre clé (fx_rate_*, botban:*, sk_live, clés internes...) nécessite requireAdmin.
  const PUBLIC_SETTINGS_ALLOWLIST = new Set([
    "app_name", "app_logo", "app_favicon", "contact_email", "contact_phone",
    "support_whatsapp", "support_telegram", "maintenance_enabled", "maintenance_message",
    "public_announcement", "public_notice", "terms_url", "privacy_url",
    "min_deposit", "max_deposit", "min_withdrawal", "max_withdrawal",
    "registration_enabled", "kyc_required",
  ]);
  app.get("/api/settings/:key", publicInfoLimiter, async (req, res) => {
    try {
      const key = req.params.key;
      if (!PUBLIC_SETTINGS_ALLOWLIST.has(key)) {
        return res.status(403).json({ message: "Accès refusé" });
      }
      const setting = await storage.getSetting(key);
      res.json(setting || { value: "" });
    } catch (error) {
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Dedicated PawaPay production credentials. Secrets are intentionally kept
  // out of the generic settings API and out of every response/log/audit detail.
  app.get("/api/admin/pawapay/settings", requireAuth, requireAdmin, async (_req, res) => {
    try {
      res.json(await getPawaPaySettingsView());
    } catch (error) {
      console.error("[Admin PawaPay] settings read failed:", (error as Error)?.message || "unknown error");
      res.status(500).json({ message: "Impossible de lire la configuration PawaPay" });
    }
  });

  app.put("/api/admin/pawapay/settings", requireAuth, requireAdmin, adminActionLimiter, async (req, res) => {
    try {
      const body = req.body && typeof req.body === "object" ? req.body : {};
      const apiToken = body.apiToken;
      const webhookSecret = body.webhookSecret;
      if ((apiToken !== undefined && typeof apiToken !== "string") ||
          (webhookSecret !== undefined && typeof webhookSecret !== "string")) {
        return res.status(400).json({ message: "Identifiants PawaPay invalides" });
      }
      await replacePawaPayCredentials({ apiToken, webhookSecret });
      audit(req, AUDIT.SETTINGS_UPDATED, {
        actorType: "admin",
        targetType: "platform_setting",
        targetId: "pawapay",
        details: {
          fields: [
            ...(apiToken?.trim() ? ["api_token"] : []),
            ...(webhookSecret?.trim() ? ["webhook_secret"] : []),
          ],
          replaced: true,
        },
      });
      res.json(await getPawaPaySettingsView());
    } catch (error: any) {
      const message = String(error?.message || "");
      if (message.includes("credential encryption") || message.includes("FIELD_ENCRYPTION_KEY")) {
        return res.status(503).json({ message: "Le chiffrement sécurisé du serveur n'est pas configuré" });
      }
      if (message.includes("invalid length") || message.includes("At least one")) {
        return res.status(400).json({ message: "Au moins une clé valide est requise" });
      }
      console.error("[Admin PawaPay] settings write failed:", message || "unknown error");
      res.status(500).json({ message: "Impossible d'enregistrer la configuration PawaPay" });
    }
  });

  // Admin: settings
  app.get("/api/admin/settings/:key", requireAuth, requireAdmin, async (req, res) => {
    try {
      if (req.params.key.startsWith("pawapay_")) {
        return res.status(404).json({ message: "Paramètre introuvable" });
      }
      const setting = await storage.getSetting(req.params.key);
      res.json(setting || { value: "" });
    } catch (error) {
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.post("/api/admin/settings", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { key, value, description } = req.body;
      // Validate key format: lowercase alphanumeric + underscore + colon + hyphen + dot
      // Prevents injection of arbitrary internal keys (session secrets, botban:* patterns, etc.)
      if (!key || typeof key !== "string" || !/^[a-z0-9_:.\-]{1,100}$/.test(key)) {
        return res.status(400).json({ message: "Clé invalide — format non autorisé" });
      }
      if (key.startsWith("pawapay_")) {
        return res.status(400).json({ message: "Utilisez la page dédiée PawaPay" });
      }
      const setting = await storage.upsertSetting(key, value, description);
      res.json(setting);
    } catch (error) {
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Bulk-save multiple settings in one request (used by conversion fees page)
  app.post("/api/admin/settings/bulk", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { settings } = req.body as { settings: Array<{ key: string; value: string; description?: string }> };
      if (!Array.isArray(settings) || settings.length === 0) {
        return res.status(400).json({ message: "settings[] requis" });
      }
      // Validate all keys before writing any
      const badKey = settings.find(s => !s.key || typeof s.key !== "string" || !/^[a-z0-9_:.\-]{1,100}$/.test(s.key));
      if (badKey) {
        return res.status(400).json({ message: `Clé invalide: ${badKey.key}` });
      }
      if (settings.some(s => s.key.startsWith("pawapay_"))) {
        return res.status(400).json({ message: "Utilisez la page dédiée PawaPay" });
      }
      const results = await Promise.all(
        settings.map(({ key, value, description }) =>
          storage.upsertSetting(key, String(value), description)
        )
      );
      await storage.createAdminLog({
        adminId: req.userId!,
        action: "update_settings_bulk",
        targetType: "setting",
        targetId: settings.map(s => s.key).join(","),
        details: JSON.stringify(settings),
        ipAddress: req.ip || null,
      });
      res.json(results);
    } catch (error) {
      console.error("Admin bulk settings error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // GET /api/admin/conversion-requests — list all conversion requests
  app.get("/api/admin/conversion-requests", requireAuth, requireAdmin, async (req, res) => {
    try {
      const filter = req.query.status as string | undefined;
      let requests;
      if (filter === "pending") {
        requests = await storage.getPendingConversionRequests();
      } else {
        requests = await storage.getAllConversionRequests();
      }
      res.json(requests);
    } catch (error) {
      console.error("Admin get conversion requests error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // GET /api/admin/conversion-requests/count — pending count for sidebar badge
  app.get("/api/admin/conversion-requests/count", requireAuth, requireAdmin, async (req, res) => {
    try {
      const count = await storage.countPendingConversions();
      res.json({ count });
    } catch (error) {
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // POST /api/admin/conversion-requests/:id/execute — execute a pending conversion
  app.post("/api/admin/conversion-requests/:id/execute", requireAuth, requireAdmin, async (req, res) => {
    try {
      const adminId = req.userId!;
      const { id } = req.params;
      const request = await storage.getConversionRequest(id);
      if (!request) return res.status(404).json({ message: "Demande non trouvée" });
      if (request.status !== "pending") return res.status(400).json({ message: `Statut invalide: ${request.status}` });

      const fromAmount = parseFloat(request.fromAmount);

      // Use the stored toAmount (calculated at creation time with admin FX rates) — no external API needed
      const receivedAmount = request.toAmount
        ? parseFloat(request.toAmount)
        : await (async () => {
            // Fallback: recalculate using admin-configured FX rates
            const execFxRates = await loadFxRates();
            return convertCurrency(fromAmount, request.fromCurrency, request.toCurrency, execFxRates);
          })();
      if (!receivedAmount || !isFinite(receivedAmount) || receivedAmount <= 0) {
        return res.status(400).json({ message: "Impossible de calculer le montant reçu. Vérifiez les taux de change admin." });
      }

      // Credit target wallet — each country currency has its own wallet
      const requestUser = await storage.getUser(request.userId);
      const requestUserPrimary = requestUser?.preferredCurrency || "XAF";
      if (request.toCurrency === requestUserPrimary) {
        await storage.updateUserBalance(request.userId, receivedAmount);
      } else {
        await storage.upsertWallet(request.userId, request.toCurrency, receivedAmount);
      }

      // Update request
      await storage.updateConversionRequest(id, {
        status: "completed",
        toAmount: receivedAmount.toFixed(2),
        executedAt: new Date(),
        executedById: adminId,
      });

      // Mark the original transaction as completed (created when user initiated the conversion)
      const execNotes = (() => { try { return JSON.parse(request.notes || "{}"); } catch { return {}; } })();
      if (execNotes.txId) {
        await storage.updateTransactionStatus(execNotes.txId, "completed").catch(() => {});
      }

      // Notify user
      const execTxId = execNotes.txId || null;
      await storage.createUserNotification({
        userId: request.userId,
        title: "Conversion effectuée",
        message: `Votre conversion de ${fromAmount.toFixed(2)} ${request.fromCurrency} → ${receivedAmount.toFixed(2)} ${request.toCurrency} a été effectuée avec succès.`,
        type: "success",
        transactionId: execTxId,
        isRead: false,
      });

      res.json({
        success: true,
        fromAmount,
        fromCurrency: request.fromCurrency,
        toAmount: receivedAmount,
        toCurrency: request.toCurrency,
        message: `Conversion exécutée : ${fromAmount.toFixed(2)} ${request.fromCurrency} → ${receivedAmount.toFixed(2)} ${request.toCurrency}`,
      });
    } catch (error: any) {
      console.error("Admin execute conversion error:", error?.message || error);
      res.status(500).json({ message: `Erreur serveur lors de l'exécution: ${error?.message || "erreur inconnue"}` });
    }
  });

  // POST /api/admin/conversion-requests/:id/cancel — cancel & refund
  app.post("/api/admin/conversion-requests/:id/cancel", requireAuth, requireAdmin, async (req, res) => {
    try {
      const adminId = req.userId!;
      const { id } = req.params;
      const { reason } = req.body;
      const request = await storage.getConversionRequest(id);
      if (!request) return res.status(404).json({ message: "Demande non trouvée" });
      if (request.status !== "pending") return res.status(400).json({ message: `Statut invalide: ${request.status}` });

      const fromAmount = parseFloat(request.fromAmount);

      // Refund source wallet — check user's primary currency, not hardcoded XAF
      const cancelUser = await storage.getUser(request.userId);
      const cancelUserPrimary = cancelUser?.preferredCurrency || "XAF";
      if (request.fromCurrency === cancelUserPrimary) {
        await storage.updateUserBalance(request.userId, fromAmount);
      } else {
        await storage.upsertWallet(request.userId, request.fromCurrency, fromAmount);
      }

      // Mark the original transaction as failed (preserve original notes, store cancel reason separately)
      const cancelNotes = (() => { try { return JSON.parse(request.notes || "{}"); } catch { return {}; } })();
      if (cancelNotes.txId) {
        await storage.updateTransactionStatus(cancelNotes.txId, "failed").catch(() => {});
      }

      // Update request status — preserve original notes, append cancel reason
      const updatedNotes = JSON.stringify({ ...cancelNotes, cancelReason: reason || "Annulé par l'administration" });
      await storage.updateConversionRequest(id, {
        status: "cancelled",
        notes: updatedNotes,
        executedAt: new Date(),
        executedById: adminId,
      });

      // Notify user
      const cancelTxId = cancelNotes.txId || null;
      await storage.createUserNotification({
        userId: request.userId,
        title: "Conversion annulée",
        message: `Votre demande de conversion de ${fromAmount.toFixed(2)} ${request.fromCurrency} → ${request.toCurrency} a été annulée. Le montant a été remboursé sur votre compte.`,
        type: "warning",
        transactionId: cancelTxId,
        isRead: false,
      });

      res.json({ success: true, message: "Demande annulée et remboursée" });
    } catch (error) {
      console.error("Admin cancel conversion error:", error);
      res.status(500).json({ message: "Erreur serveur lors de l'annulation" });
    }
  });

  // POST /api/wallets/create — open a new empty wallet for a currency
  app.post("/api/wallets/create", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      const { currency } = req.body;
      const validCurrencyCodes = new Set(ALL_FX_CURRENCIES.map((c: { code: string }) => c.code));
      if (!currency || !validCurrencyCodes.has(currency)) {
        return res.status(400).json({ message: "Devise non supportée" });
      }
      const walletUser = await storage.getUser(userId);
      const primaryCurr = walletUser?.preferredCurrency || "XAF";
      if (currency === primaryCurr) {
        return res.status(400).json({ message: `Le compte ${primaryCurr} est votre compte principal` });
      }
      const existing = await storage.getWallet(userId, currency);
      if (existing) {
        return res.status(400).json({ message: `Un compte ${currency} existe déjà` });
      }
      const wallet = await storage.setWalletBalance(userId, currency, 0);
      res.json({ success: true, wallet });
    } catch (error) {
      console.error("Create wallet error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // DELETE /api/wallets/:currency — désactiver un wallet secondaire (la somme est perdue)
  app.delete('/api/wallets/:currency', requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      const { currency } = req.params;
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' });
      const primaryCurr = user.preferredCurrency || 'XAF';
      if (currency === primaryCurr) {
        return res.status(400).json({ message: 'Impossible de désactiver le compte principal' });
      }
      const wallet = await storage.getWallet(userId, currency);
      if (!wallet) return res.status(404).json({ message: 'Compte non trouvé' });
      await storage.deleteWallet(wallet.id);
      res.json({ success: true });
    } catch (error) {
      console.error('Delete wallet error:', error);
      res.status(500).json({ message: 'Erreur serveur' });
    }
  });

  // POST /api/wallets/convert-preview — preview conversion rate without provider balance access
  app.post("/api/wallets/convert-preview", requireAuth, async (req, res) => {
    try {
      const { fromCurrency, toCurrency, amount } = req.body;
      const parsedAmount = parseFloat(amount || "0");
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ message: "Montant invalide" });
      }

      const previewFxRates = await loadFxRates();
      const toAmount = convertCurrency(parsedAmount, fromCurrency, toCurrency, previewFxRates);
      if (!isFinite(toAmount) || toAmount <= 0) {
        return res.status(400).json({ message: `Taux non disponible pour ${fromCurrency} → ${toCurrency}. Configurez les taux de change dans l'admin.` });
      }
      const rate = toAmount / parsedAmount;

      res.json({
        fromAmount: parsedAmount,
        fromCurrency,
        toAmount,
        toCurrency,
        rate,
      });
    } catch (error) {
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Withdrawal numbers routes (user can register max 2 numbers)
  app.get("/api/withdrawal-numbers", requireAuth, async (req, res) => {
    try {
      const numbers = await storage.getWithdrawalNumbersByUserId(req.userId!);
      res.json(numbers);
    } catch (error) {
      console.error("Get withdrawal numbers error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.post("/api/withdrawal-numbers", requireAuth, async (req, res) => {
    try {
      const { phoneNumber, operatorName, label } = req.body;
      const userId = req.userId!;

      if (!phoneNumber || phoneNumber.length < 8) {
        return res.status(400).json({ message: "Numéro de téléphone invalide (min 8 caractères)" });
      }
      if (!operatorName || operatorName.length < 1) {
        return res.status(400).json({ message: "Opérateur requis" });
      }

      // Check limit of 2 numbers per user
      const count = await storage.countUserWithdrawalNumbers(userId);
      if (count >= 2) {
        return res.status(400).json({ message: "Vous pouvez enregistrer maximum 2 numéros de retrait" });
      }

      // Check for duplicate phone number
      const existingNumbers = await storage.getWithdrawalNumbersByUserId(userId);
      if (existingNumbers.some(n => n.phoneNumber === phoneNumber)) {
        return res.status(400).json({ message: "Ce numéro est déjà enregistré" });
      }

      const number = await storage.createWithdrawalNumber({
        userId,
        phoneNumber,
        operatorName,
        label: label || null,
        isActive: true,
      });

      res.json(number);
    } catch (error) {
      console.error("Create withdrawal number error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Request modification of a withdrawal number (needs admin approval)
  app.post("/api/withdrawal-numbers/:id/request-change", requireAuth, async (req, res) => {
    try {
      const numberId = req.params.id;
      const userId = req.userId!;
      const { phoneNumber, operatorName, label } = req.body;

      // Validate input
      if (!phoneNumber || phoneNumber.length < 8) {
        return res.status(400).json({ message: "Numéro de téléphone invalide (min 8 caractères)" });
      }
      if (!operatorName || operatorName.length < 1) {
        return res.status(400).json({ message: "Opérateur requis" });
      }

      const existingNumber = await storage.getWithdrawalNumber(numberId);
      if (!existingNumber || existingNumber.userId !== userId) {
        return res.status(404).json({ message: "Numéro de retrait non trouvé" });
      }

      // Check for pending requests on this number
      const pendingChanges = await storage.getWithdrawalNumberChangesByUserId(userId);
      const hasPendingChange = pendingChanges.some(
        c => c.withdrawalNumberId === numberId && c.status === "pending"
      );
      if (hasPendingChange) {
        return res.status(400).json({ message: "Une demande de modification est déjà en attente pour ce numéro" });
      }

      // Create change request
      const changeRequest = await storage.createWithdrawalNumberChange({
        userId,
        withdrawalNumberId: numberId,
        action: "update",
        newPhoneNumber: phoneNumber,
        newOperatorName: operatorName,
        newLabel: label,
        status: "pending",
      });

      // Notify admin via Telegram
      storage.getUser(userId).then(user => {
        if (!user) return;
        notifyWithdrawalNumberChangeRequest({
          changeId: changeRequest.id,
          userId,
          userName: user.fullName || user.username,
          userEmail: user.email || "",
          userPhone: user.phone || undefined,
          userCountry: user.country || undefined,
          userBalance: user.balance ?? undefined,
          userCurrency: user.preferredCurrency || "XAF",
          userKyc: user.kycStatus || undefined,
          action: "update",
          newPhoneNumber: phoneNumber,
          newOperatorName: operatorName,
          newLabel: label || undefined,
          oldPhoneNumber: existingNumber.phoneNumber,
          oldOperatorName: existingNumber.operatorName || undefined,
        }).catch(() => {});
      }).catch(() => {});

      res.json({ 
        changeRequest, 
        message: "Demande de modification envoyée. Un administrateur doit approuver le changement." 
      });
    } catch (error) {
      console.error("Request change error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Request deletion of a withdrawal number (needs admin approval)
  app.post("/api/withdrawal-numbers/:id/request-delete", requireAuth, async (req, res) => {
    try {
      const numberId = req.params.id;
      const userId = req.userId!;

      const existingNumber = await storage.getWithdrawalNumber(numberId);
      if (!existingNumber || existingNumber.userId !== userId) {
        return res.status(404).json({ message: "Numéro de retrait non trouvé" });
      }

      // Check for pending requests on this number
      const pendingChanges = await storage.getWithdrawalNumberChangesByUserId(userId);
      const hasPendingChange = pendingChanges.some(
        c => c.withdrawalNumberId === numberId && c.status === "pending"
      );
      if (hasPendingChange) {
        return res.status(400).json({ message: "Une demande est déjà en attente pour ce numéro" });
      }

      // Create delete request
      const changeRequest = await storage.createWithdrawalNumberChange({
        userId,
        withdrawalNumberId: numberId,
        action: "delete",
        status: "pending",
        oldPhoneNumber: existingNumber.phoneNumber,
        oldOperatorName: existingNumber.operatorName || null,
      });

      // Notify admin via Telegram
      storage.getUser(userId).then(user => {
        if (!user) return;
        notifyWithdrawalNumberChangeRequest({
          changeId: changeRequest.id,
          userId,
          userName: user.fullName || user.username,
          userEmail: user.email || "",
          userPhone: user.phone || undefined,
          userCountry: user.country || undefined,
          userBalance: user.balance ?? undefined,
          userCurrency: user.preferredCurrency || "XAF",
          userKyc: user.kycStatus || undefined,
          action: "delete",
          oldPhoneNumber: existingNumber.phoneNumber,
          oldOperatorName: existingNumber.operatorName || undefined,
        }).catch(() => {});
      }).catch(() => {});

      res.json({ 
        changeRequest, 
        message: "Demande de suppression envoyée. Un administrateur doit approuver." 
      });
    } catch (error) {
      console.error("Request delete error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Get user's pending change requests
  app.get("/api/withdrawal-number-changes", requireAuth, async (req, res) => {
    try {
      const changes = await storage.getWithdrawalNumberChangesByUserId(req.userId!);
      res.json(changes);
    } catch (error) {
      console.error("Get change requests error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Payment link routes
  app.get("/api/payment-links", requireAuth, async (req, res) => {
    try {
      const paymentLinks = await storage.getPaymentLinksByUserId(req.userId!);
      res.json(paymentLinks);
    } catch (error) {
      console.error("Get payment links error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.get("/api/payment-links/:id", requireAuth, async (req, res) => {
    try {
      const link = await storage.getPaymentLinkById(req.params.id);
      if (!link) return res.status(404).json({ message: "Lien introuvable" });
      if (link.userId !== req.userId!) return res.status(403).json({ message: "Non autorisé" });
      res.json(link);
    } catch (error) {
      console.error("Get payment link by id error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.post("/api/payment-links", requireAuth, async (req, res) => {
    try {
      const data = createPaymentLinkSchema.parse(req.body);
      const userId = req.userId!;

      // Use custom slug if provided, otherwise generate one
      let slug = data.customSlug?.trim() || generateSlug();
      
      // Check if slug is already taken
      const existingLink = await storage.getPaymentLinkBySlug(slug);
      if (existingLink) {
        if (data.customSlug) {
          return res.status(400).json({ message: "Cette URL personnalisée est déjà utilisée" });
        }
        // Generate a new slug if auto-generated one is taken
        while (await storage.getPaymentLinkBySlug(slug)) {
          slug = generateSlug();
        }
      }

      const paymentLink = await storage.createPaymentLink({
        userId,
        title: data.title,
        description: data.description || null,
        amount: data.isFixedAmount ? data.amount : "0",
        currency: "XAF",
        slug,
        isFixedAmount: data.isFixedAmount,
        imagePath: data.imagePath || null,
        pdfPath: data.pdfPath || null,
        hasPdfDelivery: data.hasPdfDelivery || false,
        redirectUrl: data.redirectUrl || null,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        allowedCountries: (data.allowedCountries && data.allowedCountries.length > 0) ? data.allowedCountries : null,
      });

      res.json(paymentLink);

      // Notify admin via Telegram (fire & forget)
      Promise.all([
        storage.getUser(userId),
        (data.allowedCountries && data.allowedCountries.length > 0) ? storage.getAllCountries() : Promise.resolve([] as any[]),
      ]).then(([linkUser, allCountries]) => {
        const host = req.get("host") || "ashtechpay.top";
        const proto = ((req.headers["x-forwarded-proto"] as string) || req.protocol || "https").split(",")[0].trim();
        const linkUrl = `${proto}://${host}/pay/${slug}`;
        // Resolve country UUIDs → ISO codes for display
        const resolvedCountryCodes = (data.allowedCountries && data.allowedCountries.length > 0)
          ? data.allowedCountries.map((id: string) => {
              const found = (allCountries as any[]).find((c: any) => c.id === id);
              return found?.code || id;
            })
          : null;
        notifyPaymentLinkCreated({
          userName: linkUser?.fullName || linkUser?.username || "Utilisateur",
          userEmail: linkUser?.email || "",
          title: data.title,
          description: data.description || null,
          amount: data.isFixedAmount ? (data.amount || "0") : "0",
          currency: "XAF",
          isFixedAmount: data.isFixedAmount ?? false,
          slug,
          linkUrl,
          expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
          allowedCountries: resolvedCountryCodes,
          hasPdfDelivery: data.hasPdfDelivery || false,
          redirectUrl: data.redirectUrl || null,
        }).catch(() => {});
      }).catch(() => {});
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Create payment link error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Update payment link (edit or deactivate)
  app.patch("/api/payment-links/:id", requireAuth, async (req, res) => {
    try {
      const linkId = req.params.id;
      const userId = req.userId!;

      const existingLink = await storage.getPaymentLinkById(linkId);
      if (!existingLink) {
        return res.status(404).json({ message: "Lien de paiement non trouvé" });
      }
      if (existingLink.userId !== userId) {
        return res.status(403).json({ message: "Non autorisé" });
      }

      // Whitelist: only allow fields the owner is permitted to change.
      // Prevents mass-assignment of protected fields like userId, clickCount, id.
      const ALLOWED_PAYMENT_LINK_FIELDS = [
        "title", "description", "amount", "currency", "isFixedAmount",
        "imagePath", "pdfPath", "hasPdfDelivery", "redirectUrl", "expiresAt",
        "notifyUrl", "allowedCountries", "isActive", "customSlug",
      ] as const;
      const updates: Record<string, any> = {};
      for (const field of ALLOWED_PAYMENT_LINK_FIELDS) {
        if (Object.prototype.hasOwnProperty.call(req.body, field)) {
          updates[field] = req.body[field];
        }
      }

      // Handle slug update - check uniqueness if slug is being changed
      if (updates.customSlug !== undefined) {
        let newSlug = updates.customSlug?.trim() || "";
        if (newSlug) {
          // User provided a custom slug, check if it's different and unique
          if (newSlug !== existingLink.slug) {
            const existingSlug = await storage.getPaymentLinkBySlug(newSlug);
            if (existingSlug && existingSlug.id !== linkId) {
              return res.status(400).json({ message: "Ce slug est déjà utilisé" });
            }
            updates.slug = newSlug;
          }
        } else {
          // Empty slug - generate a new unique one
          updates.slug = generateSlug();
        }
        delete updates.customSlug;
      }

      // Handle amount based on isFixedAmount
      if (updates.isFixedAmount !== undefined) {
        if (!updates.isFixedAmount) {
          updates.amount = "0";
        }
      }

      const updatedLink = await storage.updatePaymentLink(linkId, updates);
      res.json(updatedLink);
    } catch (error) {
      console.error("Update payment link error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Delete payment link
  app.delete("/api/payment-links/:id", requireAuth, async (req, res) => {
    try {
      const linkId = req.params.id;
      const userId = req.userId!;

      const existingLink = await storage.getPaymentLinkById(linkId);
      if (!existingLink) {
        return res.status(404).json({ message: "Lien de paiement non trouvé" });
      }
      if (existingLink.userId !== userId) {
        return res.status(403).json({ message: "Non autorisé" });
      }

      await storage.deletePaymentLink(linkId);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete payment link error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Public contact info route
  app.get("/api/contact-info", publicInfoLimiter, async (_req, res) => {
    try {
      const settings = await storage.getAllSettings();
      const contactEmail = settings.find(s => s.key === "contact_email")?.value || "";
      const contactWhatsapp = settings.find(s => s.key === "contact_whatsapp")?.value || "";
      const contactTelegram = settings.find(s => s.key === "contact_telegram")?.value || "";
      
      res.json({
        email: contactEmail,
        whatsapp: contactWhatsapp,
        telegram: contactTelegram
      });
    } catch (error) {
      console.error("Get contact info error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Cache middleware for public (non-auth) endpoints — reduces server load
  app.use("/api/public", (req, res, next) => {
    // Don't cache hosted-session (dynamic per-session data)
    if (req.path.startsWith("/hosted-session")) return next();
    res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=60");
    next();
  });

  app.get("/api/public/fees", publicInfoLimiter, async (_req, res) => {
    try {
      const fees = await storage.getAllFees();
      res.json(fees.filter(f => f.isActive));
    } catch (error) {
      console.error("Public get fees error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.get("/api/public/limits", publicInfoLimiter, async (_req, res) => {
    try {
      const allSettings = await storage.getAllSettings();
      const get = (key: string, def: number) => {
        const s = allSettings.find(s => s.key === key);
        return s ? parseFloat(s.value) : def;
      };
      res.json({
        minTransfer: get("min_transfer", 150),
        maxTransfer: get("max_transfer", 5000000),
        minWithdrawal: get("min_withdrawal", 150),
        maxWithdrawal: get("max_withdrawal", 5000000),
      });
    } catch (error) {
      console.error("Public get limits error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Public countries route for registration/login
  app.get("/api/public/countries", publicInfoLimiter, async (_req, res) => {
    try {
      const allCountries = await storage.getAllCountries();
      const activeCountries = await Promise.all(
        allCountries
          .filter(c => c.isActive && c.isActiveForRegistration !== false && c.name && c.code)
          .map(async c => {
            const ops = await storage.getOperatorsByCountry(c.id);
            const activeOperators = ops
              .filter(o =>
                o.isActive &&
                !o.isInMaintenance &&
                ((o.depositPaymentProvider || o.paymentProvider) === "afribapay" ||
                 (o.depositPaymentProvider || o.paymentProvider) === "pixpay" ||
                 (o.depositPaymentProvider || o.paymentProvider) === "pawapay")
              )
              .map(o => ({ id: o.id, name: o.name }));
            if (activeOperators.length === 0) return null;
            return {
              id: c.id,
              name: c.name,
              code: c.code,
              flag: c.flag,
              dialCode: c.dialCode,
              currency: CURRENCY_ZONE[c.code.toUpperCase()] || c.currency,
              operators: activeOperators,
            };
          })
      );
      res.json(activeCountries.filter(Boolean));
    } catch (error) {
      console.error("Public get countries error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Public operators route — for fee-details page
  app.get("/api/public/operators", publicInfoLimiter, async (_req, res) => {
    try {
      const all = await storage.getAllOperators();
      const active = all
        .filter(op => op.isActive)
        .map(op => ({
          id: op.id,
          name: op.name,
          type: op.type,
          countryId: op.countryId,
          logoUrl: op.logoUrl,
        }));
      res.json(active);
    } catch (error) {
      console.error("Public get operators error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Public exchange rates — XAF-direct format (how many XAF = 1 unit of currency)
  // Source: countries.exchange_rate field (set in /admin/countries)
  app.get("/api/public/exchange-rates", publicInfoLimiter, async (_req, res) => {
    try {
      const fxRates = await loadFxRates();
      res.json(fxRates);
    } catch (error) {
      console.error("Get exchange rates error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Public maintenance status — no auth required so frontend can check before rendering dashboard
  app.get("/api/public/turnstile-key", publicInfoLimiter, (_req, res) => {
    const siteKey = process.env.TURNSTILE_SITE_KEY?.trim() || "";
    const required = process.env.NODE_ENV === "production" || Boolean(process.env.TURNSTILE_SECRET_KEY?.trim());
    res.setHeader("Cache-Control", "no-store");
    res.json({ siteKey, required });
  });

  app.get("/api/public/maintenance", publicInfoLimiter, async (_req, res) => {
    try {
      const setting = await storage.getSetting("maintenance_mode");
      const active = setting?.value === "true";
      res.setHeader("Cache-Control", "no-store");
      res.json({ active });
    } catch {
      res.json({ active: false });
    }
  });

  // Public support contact info route
  app.get("/api/public/support-contact", publicInfoLimiter, async (_req, res) => {
    try {
      const settings = await storage.getAllSettings();
      const supportEmail = settings.find(s => s.key === "support_email")?.value || "support@ashtechpay.com";
      const supportPhone = settings.find(s => s.key === "support_phone")?.value || "+237 6XX XXX XXX";
      
      res.json({
        email: supportEmail,
        phone: supportPhone,
      });
    } catch (error) {
      console.error("Get support contact error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // GET /api/public/otp-email-status — whether email OTP is required for withdrawals & transfers
  app.get("/api/public/otp-email-status", publicInfoLimiter, async (_req, res) => {
    try {
      const enabled = await isOtpEmailEnabled();
      res.json({ enabled });
    } catch {
      res.json({ enabled: true }); // fail-safe: default to enabled
    }
  });

  app.get("/api/public/fee-settings", publicInfoLimiter, async (_req, res) => {
    try {
      const settings = await storage.getAllSettings();
      const conversionFeePercent = parseFloat(settings.find(s => s.key === "conversion_fee_percent")?.value || "6");
      const depositFeePercent = parseFloat(settings.find(s => s.key === "deposit_fee_percent")?.value || "0");
      const paymentLinkFeePercent = parseFloat(settings.find(s => s.key === "payment_link_fee_percent")?.value || "2");
      // Frais par paire de devises
      // Intra-famille
      const convProviderFeeXafXaf = parseFloat(settings.find(s => s.key === "conversion_provider_fee_xaf_xaf")?.value || "0");
      const convAshtechFeeXafXaf  = parseFloat(settings.find(s => s.key === "conversion_ashtech_fee_xaf_xaf")?.value || "0");
      const convProviderFeeXofXof = parseFloat(settings.find(s => s.key === "conversion_provider_fee_xof_xof")?.value || "0");
      const convAshtechFeeXofXof  = parseFloat(settings.find(s => s.key === "conversion_ashtech_fee_xof_xof")?.value || "0");
      const convProviderFeeXofXaf = parseFloat(settings.find(s => s.key === "conversion_provider_fee_xof_xaf")?.value || "1");
      const convAshtechFeeXofXaf  = parseFloat(settings.find(s => s.key === "conversion_ashtech_fee_xof_xaf")?.value || "1");
      const convProviderFeeXafXof = parseFloat(settings.find(s => s.key === "conversion_provider_fee_xaf_xof")?.value || "1");
      const convAshtechFeeXafXof  = parseFloat(settings.find(s => s.key === "conversion_ashtech_fee_xaf_xof")?.value || "1");
      const convProviderFeeCdfCfa = parseFloat(settings.find(s => s.key === "conversion_provider_fee_cdf_cfa")?.value || "3");
      const convAshtechFeeCdfCfa  = parseFloat(settings.find(s => s.key === "conversion_ashtech_fee_cdf_cfa")?.value || "2");
      const convProviderFeeCfaCdf  = parseFloat(settings.find(s => s.key === "conversion_provider_fee_cfa_cdf")?.value || "3");
      const convAshtechFeeCfaCdf   = parseFloat(settings.find(s => s.key === "conversion_ashtech_fee_cfa_cdf")?.value || "2");
      // Paires USDT ↔ CFA
      const convProviderFeeCfaUsdt = parseFloat(settings.find(s => s.key === "conversion_provider_fee_cfa_usdt")?.value || "1");
      const convAshtechFeeCfaUsdt  = parseFloat(settings.find(s => s.key === "conversion_ashtech_fee_cfa_usdt")?.value || "1");
      const convProviderFeeUsdtCfa = parseFloat(settings.find(s => s.key === "conversion_provider_fee_usdt_cfa")?.value || "1");
      const convAshtechFeeUsdtCfa  = parseFloat(settings.find(s => s.key === "conversion_ashtech_fee_usdt_cfa")?.value || "1");
      const cryptoPreview = await resolveCryptoFeeBreakdown(1);
      const cryptoAshtechFeePercent = cryptoPreview.ashtechFeePercent;
      const cryptoProviderFeePercent = cryptoPreview.providerFeePercent;
      const cryptoFeePercent = cryptoPreview.totalFeePercent;
      const cryptoMinDeposit = parseFloat(settings.find(s => s.key === "izichange_min_deposit_usd")?.value || "5");
      res.json({
        conversionFeePercent,
        // Intra-famille
        convProviderFeeXafXaf, convAshtechFeeXafXaf,
        convTotalXafXaf: convProviderFeeXafXaf + convAshtechFeeXafXaf,
        convProviderFeeXofXof, convAshtechFeeXofXof,
        convTotalXofXof: convProviderFeeXofXof + convAshtechFeeXofXof,
        // Paires XOF ↔ XAF
        convProviderFeeXofXaf, convAshtechFeeXofXaf,
        convTotalXofXaf: convProviderFeeXofXaf + convAshtechFeeXofXaf,
        convProviderFeeXafXof, convAshtechFeeXafXof,
        convTotalXafXof: convProviderFeeXafXof + convAshtechFeeXafXof,
        // Paires CDF ↔ CFA
        convProviderFeeCdfCfa, convAshtechFeeCdfCfa,
        convTotalCdfCfa: convProviderFeeCdfCfa + convAshtechFeeCdfCfa,
        convProviderFeeCfaCdf, convAshtechFeeCfaCdf,
        convTotalCfaCdf: convProviderFeeCfaCdf + convAshtechFeeCfaCdf,
        // Paires USDT ↔ CFA
        convProviderFeeCfaUsdt, convAshtechFeeCfaUsdt,
        convTotalCfaUsdt: convProviderFeeCfaUsdt + convAshtechFeeCfaUsdt,
        convProviderFeeUsdtCfa, convAshtechFeeUsdtCfa,
        convTotalUsdtCfa: convProviderFeeUsdtCfa + convAshtechFeeUsdtCfa,
        depositFeePercent,
        paymentLinkFeePercent,
        // Crypto: frais détaillés
        cryptoAshtechFeePercent,
        cryptoProviderFeePercent,
        cryptoFeePercent,           // total déduit = AshtechPay + fournisseur
        cryptoMinDeposit,
      });
    } catch (error) {
      console.error("Get fee settings error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // ── IziChange crypto asset catalogue ────────────────────────────────────────
  // The public response is filtered by the admin's disabled asset list. This
  // makes the same activation rule apply to both deposits and payment links.
  app.get("/api/crypto/assets", publicInfoLimiter, async (_req, res) => {
    try {
      const disabledSetting = await storage.getSetting("crypto_disabled_assets");
      const disabled = parseDisabledCryptoAssets(disabledSetting?.value);
      const allAssets = isIziPayConfigured()
        ? await fetchCryptoAssets().catch((error: any) => {
            console.warn("[crypto/assets] live catalogue unavailable, using fallback:", error.message);
            return getStaticCryptoAssets();
          })
        : getStaticCryptoAssets();
      return res.json(filterCryptoAssets(allAssets, disabled));
    } catch (err: any) {
      console.error("[crypto/assets]", err.message);
      // A failed/unconfigured provider must allow the client to use its static fallback.
      return res.status(503).json({});
    }
  });

  app.get("/api/crypto/disabled-assets", publicInfoLimiter, async (_req, res) => {
    try {
      const setting = await storage.getSetting("crypto_disabled_assets");
      let disabled: string[] = [];
      try {
        const parsed = JSON.parse(setting?.value || "[]");
        if (Array.isArray(parsed)) disabled = parsed.filter((code): code is string => typeof code === "string");
      } catch {
        disabled = [];
      }
      return res.json({ disabled });
    } catch (err: any) {
      console.error("[crypto/disabled-assets]", err.message);
      return res.json({ disabled: [] });
    }
  });

  // Admin catalogue: returns all provider assets plus the disabled asset codes.
  app.get("/api/admin/crypto/assets", requireAuth, requireAdmin, async (_req, res) => {
    try {
      const allAssets = await fetchCryptoAssets();
      const disabledSetting = await storage.getSetting("crypto_disabled_assets");
      let disabled: string[] = [];
      try {
        const parsed = JSON.parse(disabledSetting?.value || "[]");
        if (Array.isArray(parsed)) disabled = parsed.filter((code): code is string => typeof code === "string");
      } catch {
        disabled = [];
      }
      return res.json({ coins: allAssets, disabled });
    } catch (err: any) {
      console.error("[admin/crypto/assets]", err.message);
      const setting = await storage.getSetting("crypto_disabled_assets").catch(() => undefined);
      const disabled = parseDisabledCryptoAssets(setting?.value);
      return res.json({ coins: getStaticCryptoAssets(), disabled: Array.from(disabled).sort(), fallback: true });
    }
  });

  app.post("/api/admin/crypto/assets/toggle", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { assetCode, enabled } = req.body as { assetCode?: unknown; enabled?: unknown };
      if (typeof assetCode !== "string" || !assetCode.trim() || typeof enabled !== "boolean") {
        return res.status(400).json({ message: "assetCode et enabled sont requis" });
      }

      const setting = await storage.getSetting("crypto_disabled_assets");
      let disabled = new Set<string>();
      try {
        const parsed = JSON.parse(setting?.value || "[]");
        if (Array.isArray(parsed)) disabled = new Set(parsed.filter((code): code is string => typeof code === "string"));
      } catch {
        disabled = new Set();
      }

      if (enabled) disabled.delete(assetCode);
      else disabled.add(assetCode);

      const value = JSON.stringify(Array.from(disabled).sort());
      await storage.upsertSetting(
        "crypto_disabled_assets",
        value,
        "Réseaux crypto désactivés par l'administrateur pour les dépôts et liens de paiement"
      );
      return res.json({ assetCode, enabled, disabled: Array.from(disabled).sort() });
    } catch (err: any) {
      console.error("[admin/crypto/assets/toggle]", err.message);
      return res.status(500).json({ message: "Impossible de modifier le réseau crypto" });
    }
  });

  // ── Shared Binance spot-price helper (5-min cache, reused by all charge handlers) ──
  const _cryptoPriceCache: Record<string, { p: number; ts: number }> = {};
  const _STABLE_COINS = new Set(["USDT","USDC","BUSD","TUSD","DAI","USDP","FRAX","USDD"]);
  async function getCryptoPriceUsd(symbol: string): Promise<number> {
    const sym = symbol.toUpperCase();
    if (_STABLE_COINS.has(sym)) return 1;
    const now = Date.now();
    if (_cryptoPriceCache[sym] && now - _cryptoPriceCache[sym].ts < 5 * 60_000)
      return _cryptoPriceCache[sym].p;
    try {
      const binResp = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${sym}USDT`);
      if (!binResp.ok) return _cryptoPriceCache[sym]?.p ?? 0;
      const { price } = await binResp.json() as { price: string };
      const priceUsd = parseFloat(price);
      _cryptoPriceCache[sym] = { p: priceUsd, ts: now };
      return priceUsd;
    } catch {
      return _cryptoPriceCache[sym]?.p ?? 0;
    }
  }

  // ── Crypto spot price in USDT (Binance public API, 5-min cache) ────────────
  {
    app.get("/api/crypto/price/:symbol", publicInfoLimiter, async (req, res) => {
      try {
        const sym = (req.params.symbol as string).toUpperCase();
        if (_STABLE_COINS.has(sym)) return res.json({ symbol: sym, priceUsd: 1 });
        const now = Date.now();
        if (_cryptoPriceCache[sym] && now - _cryptoPriceCache[sym].ts < 5 * 60_000)
          return res.json({ symbol: sym, priceUsd: _cryptoPriceCache[sym].p });
        const binResp = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${sym}USDT`);
        if (!binResp.ok) {
          const cached = _cryptoPriceCache[sym]?.p;
          if (cached) return res.json({ symbol: sym, priceUsd: cached });
          return res.status(404).json({ message: `Prix introuvable pour ${sym}` });
        }
        const { price } = await binResp.json() as { price: string };
        const priceUsd = parseFloat(price);
        _cryptoPriceCache[sym] = { p: priceUsd, ts: now };
        return res.json({ symbol: sym, priceUsd });
      } catch (err: any) {
        console.error("[crypto/price]", err.message);
        return res.status(502).json({ message: "Erreur lors de la récupération du prix" });
      }
    });
  }

  // Public deposit config for payment links (uses deposit fees)
  app.get("/api/public/deposit-config", publicInfoLimiter, async (_req, res) => {
    try {
      const countries = (await storage.getActiveCountries()).filter(c => c.isActiveForDeposit !== false);
      const allOperators = await storage.getAllOperators();
      const allFees = await storage.getAllFees();
      
      const config = countries.map(country => {
        const countryOperators = allOperators
          .filter(op => op.countryId === country.id && op.isActive && !op.isInMaintenance)
          .map(op => {
            let operatorFee = allFees.find(
              f => f.operatorId === op.id && f.transactionType === "deposit" && f.isActive
            );
            if (!operatorFee) {
              operatorFee = allFees.find(
                f => !f.operatorId && f.countryId === country.id && f.transactionType === "deposit" && f.isActive
              );
            }
            if (!operatorFee) {
              operatorFee = allFees.find(
                f => !f.operatorId && !f.countryId && f.transactionType === "deposit" && f.isActive
              );
            }
        const provider = (op as any).depositPaymentProvider || (op as any).paymentProvider;
            const afribaRate = operatorFee ? parseFloat((operatorFee as any).afribapayFee || "0") : 0;
            const pixpayRate = operatorFee ? parseFloat((operatorFee as any).pixpayFee || "0") : 0;
            const pawapayRate = operatorFee ? parseFloat((operatorFee as any).pawapayFee || "0") : 0;
            const marginRate = operatorFee ? parseFloat((operatorFee as any).ashtechMargin || "0") : 0;
            let feePercentage = 0;
            if (provider === "afribapay") {
              feePercentage = afribaRate + marginRate;
            } else if (provider === "pixpay") {
              feePercentage = pixpayRate + marginRate;
            } else if (provider === "pawapay") {
              feePercentage = pawapayRate + marginRate;
            } else {
              feePercentage = 0;
            }
            const pxFlowType = provider === "pixpay"
              ? detectPixPayFlowType((op as any).name || "", country.code)
              : "ussd";
            const otpUssdCode = pxFlowType === "otp"
              ? (PIXPAY_OTP_USSD_CODES[country.code?.toUpperCase()] || "#144*82#")
              : null;
            return {
              id: op.id,
              name: op.name,
              gateway: provider,
              paymentProvider: provider,
              pixpayOperatorType: pxFlowType,
              otpUssdCode,
              feePercentage,
              feeFixed: operatorFee?.feeType === "fixed" ? parseFloat(operatorFee.feeValue) : 0,
              afribapayFee: afribaRate,
              pixpayFee: pixpayRate,
              pawapayFee: pawapayRate,
              ashtechMargin: marginRate,
            };
          });
        return {
          id: country.id,
          name: country.name,
          code: country.code,
          flag: country.flag,
          currency: countryWalletCurrency(country),
          exchangeRate: parseFloat(country.exchangeRate as string) || 1,
          operators: countryOperators,
        };
      }).filter(country => country.operators.length > 0);
      
      // Build fx rates for the payment page.
      // Semantic: exchangeRates[currency] = "how many XAF = 1 unit of that currency"
      //   e.g.  CDF → 0.2  means  1 CDF = 0.2 XAF
      //         USDT → 620 means  1 USDT = 620 XAF
      // Payment page uses MULTIPLICATION: amountInXAF = displayAmount * rate
      //
      // Priority (lowest → highest):
      //   1. fx_rate_* admin settings (fallback for crypto/USDT without a country)
      //   2. ALL_FX_CURRENCIES hardcoded defaults (non-zero only)
      //   3. Country exchangeRate field — WINS for any currency that has a country record
      const allSettings = await storage.getAllSettings();
      const exchangeRates: Record<string, number> = {};

      // 1. fx_rate_* settings (lowest priority — mainly for USDT)
      allSettings.forEach((s: any) => {
        if (s.key.startsWith("fx_rate_")) {
          const code = s.key.replace("fx_rate_", "");
          const val = parseFloat(s.value);
          if (!isNaN(val) && val > 0) exchangeRates[code] = val;
        }
      });

      // 2. Hardcoded defaults for currencies not covered by a country (e.g. USDT)
      ALL_FX_CURRENCIES.forEach(c => {
        if (!exchangeRates[c.code] && c.defaultRate > 0) {
          // USDT's ALL_FX default is a USD-pivot value (1), not XAF per USDT.
          // Keep the public preview aligned with the server crypto conversion:
          // the admin fx_rate_USDT wins, otherwise use the XAF/USD fallback.
          exchangeRates[c.code] = c.code === "USDT" ? 585 : c.defaultRate;
        }
      });

      // 3. Country records override everything — direct rate (XAF per unit, no inversion)
      config.forEach((c: any) => {
        const rate = parseFloat(c.exchangeRate);
        if (!isNaN(rate) && rate > 0 && c.currency && c.currency !== "XAF") {
          exchangeRates[c.currency] = rate; // direct: 1 CDF = rate XAF
        }
      });

      // 4. XAF and all XAF/XOF sub-codes must always be 1 (not the USD-based 585 default).
      // Semantic: "how many XAF = 1 unit of that currency" → XAF = 1 by definition.
      // The ALL_FX_CURRENCIES defaultRate of 585 for XAF/XOF is a USD-pivot rate and
      // must never bleed into this exchange-rate table, or link-currency conversion
      // divides the amount by 585 instead of 1.
      const XAF_FAMILY = ["XAF", "XAFC", "XAFG", "XOF", "XOFC", "XOFF", "XOFN", "XOFB", "XOFT", "XOFS", "XOFM"];
      XAF_FAMILY.forEach(code => { exchangeRates[code] = 1; });

      res.json({ countries: config, exchangeRates });
    } catch (error) {
      console.error("Get public deposit config error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Public withdrawal operators config (for withdrawal number registration)
  // Authenticated endpoint: returns operators for the current user's country directly
  // No client-side matching needed — server resolves by user.country
  app.get("/api/user/withdrawal-operators", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.userId!);
      if (!user) return res.status(404).json({ message: "Utilisateur non trouvé" });

       const allCountries = (await storage.getActiveCountries()).filter(c => c.isActiveForWithdrawal !== false);
      const allOperators = await storage.getAllOperators();
      const allFees = await storage.getAllFees();

      const userCountryLower = (user.country || "").toLowerCase().trim();
      if (!userCountryLower) return res.json([]);
      const country = allCountries.find(c => {
        const n = c.name.toLowerCase().trim();
        if (!n) return false;
        return n === userCountryLower || n.includes(userCountryLower) || userCountryLower.includes(n);
      });

      if (!country) return res.json([]);

      const operators = allOperators
        .filter(op => op.countryId === country.id && op.isActive && !op.isInMaintenance)
        .filter(op => {
          const hasOperatorFee = allFees.some(f => f.operatorId === op.id && f.transactionType === "withdrawal" && f.isActive);
          const hasCountryFee = allFees.some(f => !f.operatorId && f.countryId === country.id && f.transactionType === "withdrawal" && f.isActive);
          const hasGlobalFee = allFees.some(f => !f.operatorId && !f.countryId && f.transactionType === "withdrawal" && f.isActive);
          return hasOperatorFee || hasCountryFee || hasGlobalFee;
        })
        .map(op => ({ id: op.id, name: op.name }));

      res.json(operators);
    } catch (error) {
      console.error("Get user withdrawal operators error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.get("/api/public/withdrawal-operators-for-country/:country", publicInfoLimiter, async (req, res) => {
    try {
      const countryParam = (req.params.country || "").toLowerCase().trim();
      if (!countryParam) return res.json([]);

       const allCountries = (await storage.getActiveCountries()).filter(c => c.isActiveForWithdrawal !== false);
      const allOperators = await storage.getAllOperators();
      const allFees = await storage.getAllFees();

      const country = allCountries.find(c => {
        const n = c.name.toLowerCase().trim();
        if (!n) return false;
        return n === countryParam || n.includes(countryParam) || countryParam.includes(n);
      });

      if (!country) return res.json([]);

      const operators = allOperators
        .filter(op => op.countryId === country.id && op.isActive && !op.isInMaintenance)
        .filter(op => {
          const hasOperatorFee = allFees.some(f => f.operatorId === op.id && f.transactionType === "withdrawal" && f.isActive);
          const hasCountryFee = allFees.some(f => !f.operatorId && f.countryId === country.id && f.transactionType === "withdrawal" && f.isActive);
          const hasGlobalFee = allFees.some(f => !f.operatorId && !f.countryId && f.transactionType === "withdrawal" && f.isActive);
          return hasOperatorFee || hasCountryFee || hasGlobalFee;
        })
        .map(op => ({ id: op.id, name: op.name }));

      res.json(operators);
    } catch (error) {
      console.error("Get operators for country error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.get("/api/public/withdrawal-operators", publicInfoLimiter, async (_req, res) => {
    try {
       const countries = (await storage.getActiveCountries()).filter(c => c.isActiveForWithdrawal !== false);
      const allOperators = await storage.getAllOperators();
      const allFees = await storage.getAllFees();
      
      const config = countries.map(country => {
        // Get operators with withdrawal fees configured
        const countryOperators = allOperators
          .filter(op => op.countryId === country.id && op.isActive && !op.isInMaintenance)
          .filter(op => {
            // Check if this operator has a withdrawal fee
            const hasOperatorFee = allFees.some(
              f => f.operatorId === op.id && f.transactionType === "withdrawal" && f.isActive
            );
            const hasCountryFee = allFees.some(
              f => !f.operatorId && f.countryId === country.id && f.transactionType === "withdrawal" && f.isActive
            );
            const hasGlobalFee = allFees.some(
              f => !f.operatorId && !f.countryId && f.transactionType === "withdrawal" && f.isActive
            );
            return hasOperatorFee || hasCountryFee || hasGlobalFee;
          })
          .map(op => ({
            id: op.id,
            name: op.name,
          }));
        
        return {
          id: country.id,
          name: country.name,
          code: country.code,
          flag: country.flag,
          currency: countryWalletCurrency(country),
          operators: countryOperators,
        };
      }).filter(country => country.operators.length > 0);
      
      res.json(config);
    } catch (error) {
      console.error("Get public withdrawal operators error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Public payment link route
  app.get("/api/payment-links/public/:slug", publicPayLimiter, async (req, res) => {
    try {
      const link = await storage.getPaymentLinkBySlug(req.params.slug);
      if (!link || !link.isActive) {
        return res.status(404).json({ message: "Lien de paiement non trouvé ou inactif" });
      }
      
      const user = await storage.getUser(link.userId);
      if (user?.isBanned) {
        return res.status(403).json({ message: "Ce lien de paiement est suspendu." });
      }
      
      // Increment clicks
      await storage.incrementPaymentLinkClicks(link.slug);

      // Resolve redirect URLs:
      //  - Hosted Page links (slug starts with "hp-") → use merchant's hosted_page_configs (successUrl / cancelUrl)
      //  - Standard payment links → fall back to link.redirectUrl for both success & cancel
      let successUrl: string | null = null;
      let cancelUrl: string | null = null;
      const isHostedPageLink = typeof link.slug === "string" && link.slug.startsWith("hp-");
      if (isHostedPageLink) {
        try {
          const cfg = await storage.getHostedPageConfig(link.userId);
          successUrl = (cfg as any)?.successUrl || null;
          cancelUrl = (cfg as any)?.cancelUrl || null;
        } catch (_) {}
      } else {
        successUrl = (link as any).redirectUrl || null;
        cancelUrl = (link as any).redirectUrl || null;
      }

      res.json({
        link: {
          id: link.id,
          title: link.title,
          description: link.description,
          amount: link.amount,
          currency: link.currency,
          isFixedAmount: link.isFixedAmount,
          imagePath: link.imagePath,
          hasPdfDelivery: link.hasPdfDelivery,
          allowedCountries: link.allowedCountries || null,
          successUrl,
          cancelUrl,
          isHostedPage: isHostedPageLink,
        },
        merchant: {
          fullName: user?.fullName,
          isVerified: user?.isVerified,
        }
      });
    } catch (error) {
      console.error("Get public payment link error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.get("/api/payment-links/:slug/download-pdf/:reference", publicPayLimiter, async (req, res) => {
    try {
      const { slug, reference } = req.params;
      
      const paymentLink = await storage.getPaymentLinkBySlug(slug);
      if (!paymentLink) {
        return res.status(404).json({ message: "Lien de paiement non trouvé" });
      }
      
      if (!paymentLink.pdfPath || !paymentLink.hasPdfDelivery) {
        return res.status(404).json({ message: "Aucun PDF disponible pour ce lien" });
      }
      
      const intent = await storage.getPaymentIntentByReference(reference);
      if (!intent) {
        return res.status(404).json({ message: "Référence de paiement introuvable" });
      }
      
      if (intent.paymentLinkId !== paymentLink.id) {
        return res.status(403).json({ message: "Cette référence ne correspond pas à ce lien" });
      }
      
      if (intent.status !== "completed") {
        return res.status(403).json({ message: "Le paiement doit être confirmé pour télécharger le PDF" });
      }
      
      res.json({ pdfPath: paymentLink.pdfPath });
    } catch (error) {
      console.error("Download PDF error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // ── Direct crypto charge for a payment link (PUBLIC) ─────────────────────
  // Customer picks coin/network → IziChange Direct Charge API returns a unique address.
  app.post("/api/payment-links/:slug/crypto/address", publicPayLimiter, async (req, res) => {
    try {
      const { slug } = req.params;
      const { assetCode, email, firstName, lastName, amountUsdt: clientAmountUsdt, refundAddress, country: payerCountry } = req.body;

      const link = await storage.getPaymentLinkBySlug(slug);
      if (!link || !link.isActive) {
        return res.status(404).json({ message: "Lien de paiement introuvable ou inactif" });
      }

      if (!isIziPayConfigured()) {
        return res.status(503).json({ message: "Paiement crypto non configuré. Contactez l'administrateur." });
      }

      if (!assetCode) {
        return res.status(400).json({ message: "Veuillez sélectionner un réseau crypto" });
      }
      if (!payerCountry) {
        return res.status(400).json({ message: "Veuillez sélectionner un pays" });
      }
      const payerCountryRecord = await storage.getCountry(String(payerCountry));
      if (!payerCountryRecord) {
        return res.status(400).json({ message: "Pays invalide" });
      }
      const disabledCryptoAssets = parseDisabledCryptoAssets(
        (await storage.getSetting("crypto_disabled_assets"))?.value
      );
      if (disabledCryptoAssets.has(assetCode)) {
        return res.status(400).json({ message: "Ce réseau crypto n'est pas disponible actuellement" });
      }

      const merchantId = link.userId;

      // Determine USDT amount:
      // - Fixed-amount link  → convert fiat amount to USDT via FX rates
      // - Open-amount link   → use the USDT amount the payer entered directly
      let amountUSDT: number;
      let fiatAmount: number | null = null;
      let fiatCurrency: string | null = null;
      if (link.isFixedAmount) {
        fiatAmount = parseFloat(link.amount || "0");
        fiatCurrency = link.currency || "XOF";
        const fxRates = await loadFxRates();
        const amountXAF = convertToXAF(fiatAmount, fiatCurrency, fxRates);
        const adminRateSetting = await storage.getSetting("fx_rate_USDT");
        const usdtPerXaf = adminRateSetting ? parseFloat(adminRateSetting.value) : (fxRates["USDT"] ?? 585);
        amountUSDT = amountXAF / usdtPerXaf;
      } else {
        amountUSDT = parseFloat(clientAmountUsdt || "0");
        if (!amountUSDT || amountUSDT <= 0) {
          return res.status(400).json({ message: "Montant USDT invalide ou manquant" });
        }
      }

       if (amountUSDT < MIN_DIRECT_CRYPTO_USDT) {
         return res.status(422).json({
           error: "minimum_amount",
           message: `Le montant minimum est de ${MIN_DIRECT_CRYPTO_USDT} USDT (montant brut, avant frais).`,
           minimumAmountUsdt: MIN_DIRECT_CRYPTO_USDT,
         });
       }

       const amounts = await resolveCryptoFeeBreakdown(amountUSDT);

      const reference = generateTransactionReference("payment_link");

      // Call IziChange Direct Charge API — returns unique address immediately
      // IziChange requires non-empty firstName & lastName — derive from email if absent.
      const emailPrefix = (email || "").split("@")[0] || "Client";
      const safeFirst = (firstName as string | undefined)?.trim() || emailPrefix;
      const safeLast  = (lastName  as string | undefined)?.trim() || "Pay";

      let charge: any;
      try {
        charge = await createDirectCharge({
          requestedCoin: assetCode,
          amount: amountUSDT.toFixed(4),
          customer: {
            firstName: safeFirst,
            lastName:  safeLast,
            email: email || undefined,
            refundAddress: refundAddress || undefined,
          },
          merchantReference: reference,
          metadata: { paymentLinkId: link.id, merchantId, payerCountry: payerCountry || null },
        });
      } catch (chargeErr: any) {
        console.error("[PayLink/Crypto] createDirectCharge failed:", chargeErr.message);
        return res.status(422).json({ message: chargeErr.message || "Erreur lors de la génération de l'adresse crypto" });
      }

      await storage.createTransaction({
        userId: merchantId,
        type: "payment_link",
         amount: amounts.creditedUsdt.toFixed(6),
        totalAmount: amountUSDT.toFixed(6),
         feeAmount: amounts.feeUsdt.toFixed(6),
         ashtechFeeAmount: amounts.ashtechFeeUsdt.toFixed(6),
        currency: "USDT",
        status: "pending",
        description: `Paiement crypto ${assetCode} — Lien: ${link.title}${email ? ` (${email})` : ""}`,
        paymentMethod: "crypto",
        reference,
        paymentLinkId: link.id,
        payerEmail: email || null,
        payerName: firstName && lastName ? `${firstName} ${lastName}` : (email || null),
        externalReference: charge.id || undefined,   // IziChange transaction ID
         metadata: await (async () => {
           const _coin = assetCode.split('.')[0].toUpperCase();
           const _price = await getCryptoPriceUsd(_coin).catch(() => 0);
           const _grossCoin = _price > 0 ? amounts.grossUsdt / _price : null;
           const _creditedCoin = _price > 0 ? amounts.creditedUsdt / _price : null;
           return {
             assetCode, address: charge.address, memo: charge.memo, memoType: charge.memoType ?? null,
             payerEmail: email, payerCountry: payerCountry || null, izichangeId: charge.id || null,
             grossAmountUsdt: amounts.grossUsdt, providerFeePercent: amounts.providerFeePercent,
             providerFeeAmountUsdt: amounts.providerFeeUsdt, ashtechFeePercent: amounts.ashtechFeePercent,
             ashtechFeeAmountUsdt: amounts.ashtechFeeUsdt, totalFeePercent: amounts.totalFeePercent,
             totalFeeAmountUsdt: amounts.feeUsdt, creditedAmountUsdt: amounts.creditedUsdt,
             ...(_grossCoin !== null ? { grossAmountCoin: parseFloat(_grossCoin.toFixed(8)), coinPriceUsdt: _price } : {}),
             ...(_creditedCoin !== null ? { creditedAmountCoin: parseFloat(_creditedCoin.toFixed(8)) } : {}),
           };
         })(),
      });

      console.log(`[PayLink/Crypto] Direct charge: addr=${charge.address} asset=${assetCode} ref=${reference} merchant=${merchantId} expiresAt=${charge.expiresAt ?? "n/a"}`);
      return res.json({
        address:    charge.address,
        memo:       charge.memo ?? null,
        memoType:   charge.memoType ?? null,
        assetCode,
        reference,
         amountUsdt: amounts.grossUsdt.toFixed(4),
         grossAmountUsdt: amounts.grossUsdt.toFixed(6),
         providerFeePercent: amounts.providerFeePercent,
         providerFeeAmountUsdt: amounts.providerFeeUsdt.toFixed(6),
         ashtechFeePercent: amounts.ashtechFeePercent,
         ashtechFeeAmountUsdt: amounts.ashtechFeeUsdt.toFixed(6),
         totalFeePercent: amounts.totalFeePercent,
         totalFeeAmountUsdt: amounts.feeUsdt.toFixed(6),
         creditedAmountUsdt: amounts.creditedUsdt.toFixed(6),
        fiatAmount,
        fiatCurrency,
        expiresAt:  charge.expiresAt ?? null,
      });
    } catch (error: any) {
      console.error("[PayLink/Crypto] Error:", error.message, error.stack?.split("\n")[1]);
      return res.status(422).json({ message: error.message || "Erreur lors de la génération de l'adresse crypto" });
    }
  });

  // Pay via payment link - PUBLIC endpoint, creates pending payment intent
  app.post("/api/payment-links/:slug/pay", publicPayLimiter, async (req, res) => {
    try {
      const { slug } = req.params;
      const {
        fullName, email, country, phone, amount: providedAmount, currency: providedCurrency,
        paymentMethod, operator, preAuthorisationCode,
      } = req.body;
      
      const link = await storage.getPaymentLinkBySlug(slug);
      if (!link || !link.isActive) {
        return res.status(404).json({ message: "Lien de paiement non trouvé ou inactif" });
      }

      const merchant = await storage.getUser(link.userId);
      if (merchant?.isBanned) {
        return res.status(403).json({ message: "Ce lien de paiement est suspendu car le compte du marchand est inactif." });
      }

      // Validate required fields
      if (!fullName || !paymentMethod) {
        return res.status(400).json({ message: "Tous les champs requis doivent être remplis" });
      }
      if (paymentMethod !== "crypto" && (!country || !phone)) {
        return res.status(400).json({ message: "Pays et numéro de téléphone requis pour Mobile Money" });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (email && !emailRegex.test(email)) {
        return res.status(400).json({ message: "Email invalide" });
      }

      // Validate payment method
      if (!["mobile_money", "card", "paypal", "crypto"].includes(paymentMethod)) {
        return res.status(400).json({ message: "Méthode de paiement invalide" });
      }

      // PayPal not yet available
      if (paymentMethod === "paypal" || paymentMethod === "card") {
        return res.status(400).json({ message: "Cette méthode de paiement n'est pas encore disponible" });
      }

      // For Mobile Money, operator is required
      if (paymentMethod === "mobile_money" && !operator) {
        return res.status(400).json({ message: "Veuillez sélectionner un opérateur Mobile Money" });
      }

      const paymentLink = await storage.getPaymentLinkBySlug(req.params.slug);
      if (!paymentLink) {
        return res.status(404).json({ message: "Lien de paiement non trouvé" });
      }

      if (!paymentLink.isActive) {
        return res.status(400).json({ message: "Ce lien de paiement n'est plus actif" });
      }

      // Check expiration
      if (paymentLink.expiresAt && new Date(paymentLink.expiresAt) < new Date()) {
        return res.status(400).json({ message: "Ce lien de paiement a expiré" });
      }

      // Resolve country ID (UUID) → country name for display
      let resolvedCountryName = country || "International";
      if (country && /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(country)) {
        try {
          const countryObj = await storage.getCountry(country);
          if (countryObj) resolvedCountryName = `${countryObj.flag || ""} ${countryObj.name}`.trim();
        } catch {}
      }

      // ── Crypto (IziChange) branch ─────────────────────────────────────────────
      if (paymentMethod === "crypto") {
        if (!isIziPayConfigured()) {
          return res.status(503).json({ message: "Paiement crypto non configuré. Contactez l'administrateur." });
        }

        const numAmount = parseFloat(providedAmount || String(paymentLink.amount) || "0");
        if (numAmount <= 0) return res.status(400).json({ message: "Montant invalide" });

        // Determine fiat currency for the IziChange intent
        const linkCurrency = (providedCurrency || paymentLink.currency || "XOF").toUpperCase();
        const izipayCurrency = toIziPayCurrency(linkCurrency);

        // Convert to USDT using admin-configured rate (fx_rate_USDT) or fallback to live FX
        const fxRatesCrypto = await loadFxRates();
        const amountInXAF = convertToXAF(numAmount, linkCurrency, fxRatesCrypto);
        const adminRateSetting = await storage.getSetting("fx_rate_USDT");
        const usdtPerXaf = adminRateSetting ? parseFloat(adminRateSetting.value) : (fxRatesCrypto["USDT"] ?? 585);
        const amountInUSD = amountInXAF / usdtPerXaf;
        const amounts = await resolveCryptoFeeBreakdown(amountInUSD);

        const reference = generateTransactionReference("payment_link");
        const appBase = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;

        // Create payment intent record
        const cryptoIntent = await storage.createPaymentIntent({
          paymentLinkId: paymentLink.id,
          merchantId: paymentLink.userId,
          payerName: fullName,
          payerEmail: email || null,
          payerPhone: phone || "",
          payerCountry: resolvedCountryName,
          amount: amounts.creditedUsdt.toFixed(6),
          feeAmount: amounts.feeUsdt.toFixed(6),
          currency: "USDT",
          paymentMethod: "crypto",
          operator: null,
          reference,
        });

        // Create transaction record
        await storage.createTransaction({
          userId: paymentLink.userId,
          type: "payment_link",
          amount: amounts.creditedUsdt.toFixed(6),
          totalAmount: amountInUSD.toFixed(6),
          feeAmount: amounts.feeUsdt.toFixed(6),
          ashtechFeeAmount: amounts.ashtechFeeUsdt.toFixed(6),
          currency: "USDT",
          status: "pending",
          description: `Paiement crypto IziChange de ${fullName}${email ? ` (${email})` : ""} via ${paymentLink.title}`,
          paymentMethod: "crypto",
          reference,
          paymentLinkId: paymentLink.id,
          paymentIntentId: cryptoIntent.id,
          payerName: fullName,
          payerEmail: email || null,
          recipientCountry: country || "International",
          metadata: {
            grossAmountUsdt: amounts.grossUsdt,
            providerFeePercent: amounts.providerFeePercent,
            providerFeeAmountUsdt: amounts.providerFeeUsdt,
            ashtechFeePercent: amounts.ashtechFeePercent,
            ashtechFeeAmountUsdt: amounts.ashtechFeeUsdt,
            totalFeePercent: amounts.totalFeePercent,
            totalFeeAmountUsdt: amounts.feeUsdt,
            creditedAmountUsdt: amounts.creditedUsdt,
          },
        });

        // Create IziChange payment intent
        let iziIntent: any;
        try {
          iziIntent = await createPaymentIntent({
            requestedCurrencyType: "fiat",
            currencyRequested: izipayCurrency,
            amountRequested: String(numAmount), // must be string per IziChange API spec
            merchantReference: reference,
            metadata: { paymentLinkId: paymentLink.id, intentId: cryptoIntent.id },
          });
        } catch (err: any) {
          console.error("[PaymentLink Crypto] IziChange error:", err.message);
          return res.status(400).json({ message: "Une erreur est survenue lors de la création du paiement. Veuillez réessayer." });
        }

        // Store IziChange intent ID on the transaction
        try {
          const tx = await storage.getTransactionByReference(reference);
          if (tx?.id && iziIntent?.id) await storage.updateTransaction(tx.id, { paymentIntentId: iziIntent.id });
        } catch {}

        console.log(`[PaymentLink Crypto] IziChange intent created: id=${iziIntent.id} ${izipayCurrency}${numAmount} ≈ ${amounts.creditedUsdt.toFixed(4)} USDT net ref=${reference}`);
        return res.json({
          paymentUrl: iziIntent.paymentUrl,
          intentId: iziIntent.id,
          reference,
          message: "Intent de paiement IziChange créé",
        });
      }

      // Get country and operator IDs for fee calculation
       const allCountries = await storage.getAllCountries();
       const countryData = allCountries.find((c: { id: string; code: string; name: string }) =>
         c.id === country ||
         c.code.toUpperCase() === String(country).toUpperCase() ||
         c.name.toLowerCase() === String(country).toLowerCase()
       );
       if (!countryData || !countryData.isActive) {
         return res.status(400).json({ message: "Pays non supporté ou inactif." });
       }
       const allowedCodes = paymentLink.allowedCountries || [];
       if (allowedCodes.length > 0 && !allowedCodes.some((allowed: string) =>
         allowed.toUpperCase() === countryData.code.toUpperCase() || allowed === countryData.id
       )) {
         return res.status(400).json({ message: "Ce pays n'est pas autorisé pour ce lien de paiement." });
       }
       const countryId = countryData.id;
       const paymentCountryCode = countryData.code;
      const paymentCurrency = countryData?.currency || providedCurrency || paymentLink.currency || "XAF";

      // The amount provided by the frontend is in providedCurrency (or paymentCurrency)
      const numAmount = parseFloat(providedAmount || "0");
      if (numAmount <= 0) {
        return res.status(400).json({ message: "Le montant doit être positif" });
      }

      // We need to calculate what the merchant gets in THEIR link currency
      const fxRates = await loadFxRates();
      const amountInLinkCurrency = convertCurrency(numAmount, paymentCurrency, paymentLink.currency, fxRates);

      // Fetch operator early to determine payment provider before fee calculation
      let resolvedOperatorId: string | undefined = undefined;
      let operatorName = "Mobile Money";
      let operatorRecord: any = null;
      if (operator && countryId) {
        const operatorsList = await storage.getOperatorsByCountry(countryId);
         operatorRecord = operatorsList.find((o: any) =>
           (o.name === operator || o.id === operator) &&
           o.isActive &&
           !o.isInMaintenance
         );
        resolvedOperatorId = operatorRecord?.id || undefined;
        operatorName = operatorRecord?.name || operator;
      }
       if (paymentMethod === "mobile_money" && !operatorRecord) {
         return res.status(400).json({ message: "Opérateur non disponible pour ce pays." });
       }

      // Determine provider BEFORE fee calculation — dépôt utilise depositPaymentProvider si défini
      const paymentProvider = (operatorRecord as any)?.depositPaymentProvider || operatorRecord?.paymentProvider;
      if (paymentProvider !== "afribapay" && paymentProvider !== "pixpay" && paymentProvider !== "pawapay") {
        return res.status(400).json({ message: "Aucun fournisseur de paiement configuré pour cet opérateur." });
      }
       if (paymentProvider === "pixpay" &&
           !PIXPAY_SUPPORTED_COUNTRIES.some((supported: any) => supported.code === paymentCountryCode.toUpperCase())) {
         return res.status(400).json({ message: "Ce pays n'est pas pris en charge pour cet opérateur." });
       }
       if (paymentProvider === "afribapay" &&
           !AFRIBAPAY_CONFIRMED_COUNTRIES.has(paymentCountryCode.toUpperCase())) {
         return res.status(400).json({ message: "Ce pays n'est pas encore pris en charge pour cet opérateur." });
       }
      console.log(`[PaymentLink] operatorId=${resolvedOperatorId} | name=${operatorName} | provider=${paymentProvider}`);

      // Resolve fees from DB (includes afribapayFee + ashtechMargin)
      const fee = await storage.resolveFee("deposit", countryId, resolvedOperatorId);
      const ashtechMarginPct = (fee as any)?.ashtechMargin != null
        ? parseFloat((fee as any).ashtechMargin)
        : ASHTECH_MARGIN;

      // Compute fees using the CORRECT provider's rates
      let netAmount = "0";
      let totalFeeAmount = "0";
      let ashtechFeeAmountStr = "0";
      const totalAmount = numAmount.toFixed(2);

      if (paymentProvider === "afribapay") {
        const afribapayFeeRate = (fee as any)?.afribapayFee
          ? parseFloat((fee as any).afribapayFee.toString()) : 3.0;
        const af = computeAfribaPayFees(numAmount, afribapayFeeRate, ashtechMarginPct);
        netAmount = af.creditedAmount.toFixed(2);
        totalFeeAmount = af.totalFeeAmount.toFixed(2);
        ashtechFeeAmountStr = af.ashtechFeeAmount.toFixed(2);
        console.log(`[PaymentLink] AfribaPay fees: rate=${afribapayFeeRate}%+margin=${ashtechMarginPct}% → totalFee=${af.totalFeeAmount}, ashtechFee=${af.ashtechFeeAmount}, credited=${af.creditedAmount}`);
      } else if (paymentProvider === "pixpay") {
        const pixpayFeeRate = (fee as any)?.pixpayFee
          ? parseFloat((fee as any).pixpayFee.toString()) : 3.0;
        const pf = computePixPayFees(numAmount, pixpayFeeRate, ashtechMarginPct);
        netAmount = pf.creditedAmount.toFixed(2);
        totalFeeAmount = pf.totalFeeAmount.toFixed(2);
        ashtechFeeAmountStr = pf.ashtechFeeAmount.toFixed(2);
        console.log(`[PaymentLink] PixPay fees: rate=${pixpayFeeRate}%+margin=${ashtechMarginPct}% → totalFee=${pf.totalFeeAmount}, ashtechFee=${pf.ashtechFeeAmount}, credited=${pf.creditedAmount}`);
      } else if (paymentProvider === "pawapay") {
        const rate = (fee as any)?.pawapayFee != null ? parseFloat((fee as any).pawapayFee.toString()) : 3.0;
        const pf = computePixPayFees(numAmount, rate, ashtechMarginPct);
        netAmount = pf.creditedAmount.toFixed(2);
        totalFeeAmount = pf.totalFeeAmount.toFixed(2);
        ashtechFeeAmountStr = pf.ashtechFeeAmount.toFixed(2);
      } else {
        return res.status(400).json({ message: "Fournisseur de paiement non supporté." });
      }

      // Generate unique ASHPAY reference
      const reference = generateTransactionReference("payment_link");
      let pawaPayOperation: Awaited<ReturnType<typeof resolvePawaPayOperationConfiguration>> | undefined;
      if (paymentProvider === "pawapay") {
        try {
          const pawaProvider = resolvePawaPayProviderCode(operatorRecord, operatorName, paymentCountryCode);
          pawaPayOperation = await resolvePawaPayOperationConfiguration(
            pawaProvider, "DEPOSIT", pawaPayCountry(paymentCountryCode), toPawaPayCurrency(paymentCurrency),
          );
          if (pawaPayOperation?.authType === "PREAUTH" && !preAuthorisationCode) {
            return res.status(428).json({
              error: "pawa_preauthorisation_required",
              message: "Une préautorisation Mobile Money est requise avant le paiement.",
              pawaPayAuth: pawaPayAuthPayload(pawaPayOperation),
            });
          }
          await assertPawaPayProviderActive(
            pawaProvider, "DEPOSIT", pawaPayCountry(paymentCountryCode), toPawaPayCurrency(paymentCurrency),
            pawaPayOperation ?? undefined,
          );
         } catch (error: any) {
           console.error("[PaymentLink] PawaPay provider validation failed:", error);
           return res.status(503).json(buildProviderErrorPayload({
             error: "provider_unavailable",
             message: error?.message,
             fallback: "Le fournisseur de paiement n'est pas disponible pour cette opération.",
             provider: "pawapay",
           }));
        }
      }
      const pawaPayDepositId = paymentProvider === "pawapay" ? createPawaPayId() : undefined;

      // ─── PixPay OTP pre-check — must happen BEFORE creating the payment intent ─
      // Orange CI/SN/ML/BF require the user to provide an OTP obtained via USSD.
      // Return 400 early so no orphaned payment intent/transaction is created.
      if (paymentProvider === "pixpay" && paymentMethod === "mobile_money") {
        const earlyPxOpType = detectPixPayFlowType(operatorName, paymentCountryCode);
        if (earlyPxOpType === "otp" && !req.body?.pixpayOtp) {
          const ussdCode = PIXPAY_OTP_USSD_CODES[paymentCountryCode.toUpperCase()] || "#144*82#";
          return res.status(400).json({
            otpRequired: true,
            gateway: "pixpay",
            ussdCode,
            message: `Composez ${ussdCode} sur votre téléphone pour obtenir votre code OTP, puis saisissez-le.`,
          });
        }
      }

      // Create payment intent — amount & currency in payer's currency so wallet crediting is correct
      const countryDisplay = countryData ? `${countryData.flag || ''} ${countryData.name}`.trim() : country;
      const intent = await storage.createPaymentIntent({
        paymentLinkId: paymentLink.id,
        merchantId: paymentLink.userId,
        payerName: fullName,
        // The public form makes email optional, while payment_intents.payer_email
        // remains NOT NULL for compatibility with existing records.
        payerEmail: typeof email === "string" ? email.trim() : "",
        payerPhone: phone,
        payerCountry: countryDisplay,
        amount: netAmount,
        feeAmount: totalFeeAmount,
        currency: paymentCurrency,
        paymentMethod,
        operator: operator || null,
        reference,
      });

      // Create pending transaction for the merchant to track in history
      // feeAmount = Ashtech margin only (consistent with deposit/withdrawal/transfer)
      const paymentTransaction = await storage.createTransaction({
        userId: paymentLink.userId,
        type: "payment_link",
        amount: netAmount,
        totalAmount: totalAmount,
        feeAmount: ashtechFeeAmountStr,
        currency: paymentCurrency,
        status: "pending",
        description: `Paiement en attente de ${fullName} (${email}) via ${paymentLink.title}`,
        paymentMethod,
        reference,
        paymentLinkId: paymentLink.id,
        paymentIntentId: intent.id,
        payerName: fullName,
        payerEmail: typeof email === "string" ? email.trim() : "",
        recipientCountry: countryDisplay,
        operatorId: resolvedOperatorId || null,
        ...(pawaPayDepositId ? { externalReference: pawaPayDepositId } : {}),
        ...(pawaPayDepositId ? { metadata: { paymentProvider: "pawapay", pawaCountry: pawaPayCountry(paymentCountryCode) } } : {}),
      });

      // paymentProvider, operatorRecord, operatorName already resolved above (before fee calc)

      // Call payment gateway for Mobile Money payments
      if (paymentMethod === "mobile_money") {
        try {
          // ─── AfribaPay branch ─────────────────────────────────────────────
          if (paymentProvider === "afribapay") {
            const afribapayFeeRate = (fee as any)?.afribapayFee
              ? parseFloat((fee as any).afribapayFee.toString()) : 3.0;
            const afribaMarginPct = ashtechMarginPct;
            const afribaFees = computeAfribaPayFees(numAmount, afribapayFeeRate, afribaMarginPct);
            const afribapayOperatorCode = resolveAfribaPayOperatorCode(operatorRecord, operatorName);
            // Always use AfribaPay ISO currency (overrides any legacy country code)
            const afribapayCurrency = AFRIBAPAY_ISO_CURRENCY[paymentCountryCode.toUpperCase()] || paymentCurrency;
            console.log(`[PaymentLink] AfribaPay | country=${paymentCountryCode} | currency=${afribapayCurrency} | operator=${afribapayOperatorCode}`);
            const callbackUrl = buildWebhookUrl("/api/afribapay/webhook");
            // Strip country dialing prefix (AfribaPay needs local number without prefix)
            const prefixMap: Record<string, string> = {
              CM: "237", SN: "221", CI: "225", BF: "226", ML: "223",
              GN: "224", BJ: "229", TG: "228", NE: "227", CD: "243",
              CG: "242", CF: "236", TD: "235", GA: "241", GQ: "240",
              MG: "261", RW: "250", KE: "254", TZ: "255", UG: "256",
              GH: "233", NG: "234",
            };
            let localPhone = phone.replace(/\s/g, "");
            if (localPhone.startsWith("+")) localPhone = localPhone.slice(1);
            const dialPrefix = prefixMap[paymentCountryCode.toUpperCase()];
            if (dialPrefix && localPhone.startsWith(dialPrefix)) {
              localPhone = localPhone.slice(dialPrefix.length);
            }
            // Build return/cancel URLs for Wave
            const linkAppBase = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;

            // ── Check OTP requirement BEFORE calling payin ────────────────────
            const otpInfo = await getAfribaPayOtpInfo(paymentCountryCode, afribapayOperatorCode);

            if (otpInfo.required) {
              if (otpInfo.type === "api") {
                // ── API OTP: AfribaPay sends the code by SMS via /v1/pay/otp ──
                const otpInitResult = await initiateAfribaPayOtp({
                  operator: afribapayOperatorCode,
                  country: paymentCountryCode,
                  phone_number: localPhone,
                  amount: numAmount,
                  currency: afribapayCurrency,
                  order_id: reference,
                  reference_id: reference,
                  notify_url: callbackUrl,
                });

                if (!otpInitResult.success) {
                  await storage.updatePaymentIntentStatus(intent.id, "failed");
                  return res.status(400).json({ message: otpInitResult.message || "Impossible d'envoyer le code OTP" });
                }
              }
              // ── USSD OTP: user dials the code themselves — no initiation call needed ──

              // Store OTP context for confirm-otp endpoint
              await persistOtpContext(reference, {
                userId: intent.merchantId,
                operator: afribapayOperatorCode,
                country: paymentCountryCode,
                phone: localPhone,
                amount: numAmount,
                currency: afribapayCurrency,
                afribaTransactionId: reference,
                expiresAt: Date.now() + 15 * 60 * 1000,
                otpType: otpInfo.type === "none" ? undefined : otpInfo.type,
              });

              // Substitute "montant" placeholder with the actual amount (e.g. BF Orange: *144*4*6*5000#)
              const ussdCodeForLink = otpInfo.ussdCode?.includes("montant")
                ? otpInfo.ussdCode.replace(/montant/gi, String(Math.round(numAmount)))
                : (otpInfo.ussdCode || "");
              const otpMessage = otpInfo.type === "ussd"
                ? `Composez ${ussdCodeForLink} sur votre téléphone pour obtenir votre code OTP, puis saisissez-le ci-dessous.`
                : "Entrez le code OTP que vous allez recevoir par SMS sur votre téléphone.";

              return res.json({
                message: otpMessage,
                reference: intent.reference,
                gateway: "afribapay",
                otpRequired: true,
                otpType: otpInfo.type,
                ussdCode: ussdCodeForLink,
                redirectUrl: paymentLink.redirectUrl || null,
                amount: numAmount,
                feeAmount: afribaFees.totalFeeAmount,
                totalAmount: numAmount,
              });
            }

            // ── Non-OTP: regular payin (USSD or Wave redirect) ────────────────
            const afribaResponse = await initiateAfribaPayin({
              operator: afribapayOperatorCode,
              country: paymentCountryCode,
              phone_number: localPhone,
              amount: numAmount,
              currency: afribapayCurrency,
              order_id: reference,
              reference_id: reference,
              notify_url: callbackUrl,
              return_url: `${linkAppBase}/pay/${paymentLink.slug}?ref=${reference}&status=success`,
              cancel_url: `${linkAppBase}/pay/${paymentLink.slug}?ref=${reference}&status=cancelled`,
            });
            if (afribaResponse.success) {
              const linkTransaction = await storage.getTransactionByReference(reference);
              if (linkTransaction) {
                const extRef = afribaResponse.transaction_id || reference;
                await storage.updateTransactionExternalReference(linkTransaction.id, extRef);
                addPendingPayment({
                  transactionId: linkTransaction.id,
                  reference,
                  externalReference: extRef,
                  attempts: 0,
                  userId: paymentLink.userId,
                  type: "payment_link",
                  amount: afribaFees.creditedAmount.toFixed(2),
                  provider: "afribapay",
                  paymentIntentId: intent.id,
                  payerName: fullName,
                });
              }

              // Wave/wallet: AfribaPay returns a provider_link the user must open
              if (afribaResponse.provider_link) {
                console.log(`[AfribaPay PaymentLink] Wave link for ${reference}: ${afribaResponse.provider_link}`);
                return res.json({
                  message: "Cliquez sur le bouton pour finaliser votre paiement sur Wave.",
                  reference: intent.reference,
                  gateway: "afribapay",
                  waveUrl: afribaResponse.provider_link,
                  otpRequired: false,
                  redirectUrl: paymentLink.redirectUrl || null,
                  amount: numAmount,
                  feeAmount: afribaFees.totalFeeAmount,
                  totalAmount: numAmount,
                });
              }

              return res.json({
                message: "Veuillez confirmer le paiement sur votre téléphone via USSD.",
                reference: intent.reference,
                gateway: "afribapay",
                otpRequired: false,
                redirectUrl: paymentLink.redirectUrl || null,
                amount: numAmount,
                feeAmount: afribaFees.totalFeeAmount,
                totalAmount: numAmount,
              });
            } else if (isAfribaPayOtpRequiredMessage(afribaResponse.message)) {
              // Safety net: our OTP-requirement detection missed this operator, but
              // AfribaPay's actual rejection says an OTP is needed — switch to the
              // OTP flow instead of showing the raw upstream error with no way forward.
              // NOTE: do NOT call initiateAfribaPayOtp here — the /v1/pay/payin call
              // above already triggered the OTP SMS on AfribaPay's side. A second
              // initiation call with the same order_id causes a 5xx on their end.
              console.warn(`[AfribaPay PaymentLink] OTP required but not pre-detected for operator=${afribapayOperatorCode} country=${paymentCountryCode} — SMS already sent by payin, switching to OTP confirmation flow`);
              await persistOtpContext(reference, {
                userId: intent.merchantId,
                operator: afribapayOperatorCode,
                country: paymentCountryCode,
                phone: localPhone,
                amount: numAmount,
                currency: afribapayCurrency,
                afribaTransactionId: reference,
                expiresAt: Date.now() + 15 * 60 * 1000,
                otpType: "api",
              });
              return res.json({
                message: "Entrez le code OTP que vous allez recevoir par SMS sur votre téléphone.",
                reference: intent.reference,
                gateway: "afribapay",
                otpRequired: true,
                otpType: "api",
                ussdCode: "",
                redirectUrl: paymentLink.redirectUrl || null,
                amount: numAmount,
                feeAmount: afribaFees.totalFeeAmount,
                totalAmount: numAmount,
              });
            } else {
              await storage.updatePaymentIntentStatus(intent.id, "failed");
              const failedTx = await storage.getTransactionByReference(reference);
              if (failedTx) await storage.updateTransactionStatus(failedTx.id, "failed");
              return res.status(400).json({ message: sanitizeGatewayMessage(afribaResponse.message, "Échec du paiement Mobile Money.") });
            }
          }

          if (paymentProvider === "pawapay") {
            let pawaPayTimeoutHandle: ReturnType<typeof setTimeout> | undefined;
            const result = await Promise.race([
              createPawaPayDeposit({
                depositId: pawaPayDepositId,
                country: pawaPayCountry(paymentCountryCode),
                amount: numAmount.toFixed(2),
                currency: toPawaPayCurrency(paymentCurrency),
                payer: {
                  provider: resolvePawaPayProviderCode(operatorRecord, operatorName, paymentCountryCode),
                  phoneNumber: normalizePhone(phone) || "",
                },
                clientReferenceId: reference,
                customerMessage: PAWAPAY_CUSTOMER_MESSAGE,
                operationConfiguration: pawaPayOperation,
                preAuthorisationCode,
              }),
              new Promise<never>((_, reject) => {
                pawaPayTimeoutHandle = setTimeout(() => {
                  reject(new Error(
                    `PawaPay POST /deposits timed out at the public checkout boundary after ${PAWAPAY_PUBLIC_INITIATION_TIMEOUT_MS}ms`,
                  ));
                }, PAWAPAY_PUBLIC_INITIATION_TIMEOUT_MS);
              }),
            ]).finally(() => {
              if (pawaPayTimeoutHandle) clearTimeout(pawaPayTimeoutHandle);
            });
            if (result.status === "failed") {
              await storage.updatePaymentIntentStatus(intent.id, "failed");
              await storage.claimTransactionStatus(paymentTransaction.id, "failed");
              const safeFailure = buildProviderErrorPayload({
                error: "payment_initiation_failed",
                message: result.providerMessage,
                fallback: "Impossible d'initier le paiement.",
                provider: "pawapay",
                raw: result.raw,
                providerCode: result.providerCode,
                providerStatus: result.providerStatus,
                sensitiveValues: [phone],
              });
              await storage.updateTransaction(paymentTransaction.id, {
                description: String(safeFailure.message),
                metadata: {
                  ...((paymentTransaction as any).metadata || {}),
                  paymentProvider: "pawapay",
                  pawaCountry: pawaPayCountry(paymentCountryCode),
                  countryCode: paymentCountryCode,
                  failureReason: {
                    failureCode: safeFailure.provider_code || null,
                    failureMessage: String(safeFailure.message),
                  },
                },
              });
              return res.status(400).json(buildProviderErrorPayload({
                error: "payment_initiation_failed", message: result.providerMessage,
                fallback: "Impossible d'initier le paiement.", provider: "pawapay", raw: result.raw,
                providerCode: result.providerCode, providerStatus: result.providerStatus, sensitiveValues: [phone],
              }));
            }
            if (result.status === "completed") {
              await processPawaPayDepositCallback(paymentTransaction, "completed");
            } else {
              await storage.updateTransactionMetadata(paymentTransaction.id, {
                ...((paymentTransaction as any).metadata || {}),
                paymentProvider: "pawapay",
                pawaCountry: pawaPayCountry(paymentCountryCode),
                countryCode: paymentCountryCode,
                ...(result.authorizationUrl ? { authorizationUrl: result.authorizationUrl } : {}),
                ...(result.nextStep ? { nextStep: result.nextStep } : {}),
                ...(result.authType ? { authType: result.authType } : {}),
              });
              addPendingPayment({
                transactionId: paymentTransaction.id, reference, externalReference: pawaPayDepositId!,
                attempts: 0, userId: paymentLink!.userId, type: "payment_link", amount: netAmount,
                provider: "pawapay", paymentIntentId: intent.id, payerName: fullName,
              });
            }
            return res.json({
              message: result.status === "completed" ? "Paiement confirmé." : "Validez le paiement sur votre téléphone.",
              reference: intent.reference, gateway: "mobile_money",
              status: result.status === "completed" ? "completed" : "pending",
              authorizationUrl: result.authorizationUrl || null,
              redirectUrl: result.authorizationUrl || result.redirectUrl || null,
              nextStep: result.nextStep || null,
              pawaPayAuth: pawaPayAuthPayload(result) || pawaPayAuthPayload(pawaPayOperation),
              amount: numAmount,
              feeAmount: parseFloat(totalFeeAmount), totalAmount: numAmount,
            });
          }

          // ─── PixPay branch (USSD / OTP / Wave) ────────────────────────────
          if (paymentProvider === "pixpay") {
            const pxAutoServiceId = getPixPayServiceId((operatorRecord as any)?.name || "", paymentCountryCode, "cash_out");
            if (!pxAutoServiceId) {
              await storage.updatePaymentIntentStatus(intent.id, "failed");
              const failedTxPx = await storage.getTransactionByReference(reference);
              if (failedTxPx) await storage.updateTransactionStatus(failedTxPx!.id, "failed");
              return res.status(400).json({ message: "Opérateur non supporté pour ce pays." });
            }

            const pxOpType: string = detectPixPayFlowType((operatorRecord as any)?.name || "", paymentCountryCode);
            const pixpayFeeRate = (fee as any)?.pixpayFee
              ? parseFloat((fee as any).pixpayFee.toString()) : 3.0;
            const pxFees = computePixPayFees(numAmount, pixpayFeeRate, ashtechMarginPct);
            const pxIpnUrl = buildWebhookUrl("/api/pixpay/webhook");
            const cleanPxPhone = phone.replace(/\s/g, "");

            console.log(`[PaymentLink] PixPay type=${pxOpType} | country=${paymentCountryCode} | service_id=${pxAutoServiceId} (auto)`);

            const pxBaseParams = {
              serviceId: String(pxAutoServiceId),
              amount: numAmount,
              phone: cleanPxPhone,
              countryCode: paymentCountryCode,
              orderId: reference,
              ipnUrl: pxIpnUrl,
              customData: reference,
            };

            let pxResponse;

            if (pxOpType === "otp") {
              // Orange CI/SN/ML/BF — user must provide OTP obtained by dialing USSD code
              // The OTP pre-check above should have caught missing OTP before payment intent creation.
              // This is a safety net only — we do NOT fail the payment intent/transaction here.
              const omOtp = req.body?.pixpayOtp as string | undefined;
              if (!omOtp) {
                const ussdCode = PIXPAY_OTP_USSD_CODES[paymentCountryCode.toUpperCase()] || "#144*82#";
                return res.status(400).json({
                  otpRequired: true,
                  gateway: "pixpay",
                  ussdCode,
                  message: `Composez ${ussdCode} sur votre téléphone pour obtenir votre code OTP, puis saisissez-le.`,
                });
              }
              pxResponse = await initiatePixPayOtp({ ...pxBaseParams, omOtp: omOtp! });

            } else if (pxOpType === "wave") {
              const appBase = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
              pxResponse = await initiatePixPayWave({
                ...pxBaseParams,
                redirectUrl: paymentLink!.redirectUrl || `${appBase}/pay/${paymentLink!.slug}?ref=${reference}&status=success`,
                redirectErrorUrl: `${appBase}/pay/${paymentLink!.slug}?ref=${reference}&status=cancelled`,
              });

            } else {
              pxResponse = await initiatePixPayUssd(pxBaseParams);
            }

            if (pxResponse.success) {
              const pxLinkTx = await storage.getTransactionByReference(reference);
              if (pxLinkTx) {
                const pxExtRef = pxResponse.transactionId || reference;
                await storage.updateTransactionExternalReference(pxLinkTx!.id, pxExtRef);
                addPendingPayment({
                  transactionId: pxLinkTx!.id,
                  reference,
                  externalReference: pxExtRef,
                  attempts: 0,
                  userId: paymentLink!.userId,
                  type: "payment_link",
                  amount: pxFees.creditedAmount.toFixed(2),
                  provider: "pixpay",
                  paymentIntentId: intent.id,
                  payerName: fullName,
                  countryCode: paymentCountryCode,
                });
              }

              if (pxOpType === "wave" && pxResponse.waveUrl) {
                return res.json({
                  message: "Cliquez sur le bouton pour finaliser votre paiement via Wave.",
                  reference: intent.reference,
                  gateway: "pixpay",
                  waveUrl: pxResponse.waveUrl,
                  status: "pending_wave",
                  amount: numAmount,
                  feeAmount: pxFees.totalFeeAmount,
                  totalAmount: numAmount,
                });
              }

              return res.json({
                message: pxOpType === "otp"
                  ? "Code OTP validé. Paiement en cours de traitement."
                  : "Validez le paiement USSD sur votre téléphone.",
                reference: intent.reference,
                gateway: "pixpay",
                otpRequired: false,
                status: pxOpType === "otp" ? "pending_otp_confirmed" : "pending_ussd",
                redirectUrl: paymentLink!.redirectUrl || null,
                amount: numAmount,
                feeAmount: pxFees.totalFeeAmount,
                totalAmount: numAmount,
              });

            } else {
              await storage.updatePaymentIntentStatus(intent.id, "failed");
              const failedTxPx2 = await storage.getTransactionByReference(reference);
              if (failedTxPx2) await storage.updateTransactionStatus(failedTxPx2!.id, "failed");
              return res.status(400).json({ message: sanitizeGatewayMessage(pxResponse.message, "Échec du paiement Mobile Money.") });
            }
          }

        } catch (gatewayError) {
          console.error("Gateway API error:", gatewayError);
          if (paymentProvider === "pawapay") {
             const providerMessage = gatewayError instanceof Error ? gatewayError.message : "";
             const providerTimedOut = /PawaPay\s+POST\s+\/deposits\s+timed out/i.test(providerMessage);
             if (providerTimedOut && pawaPayDepositId) {
               // A PawaPay timeout is ambiguous: the provider may have accepted
               // the deposit before the response body was available. Keep the
               // local records pending and let the poller resolve the UUID.
               // Marking it failed here would invite a duplicate payment retry.
               addPendingPayment({
                 transactionId: paymentTransaction.id,
                 reference,
                 externalReference: pawaPayDepositId,
                 attempts: 0,
                 userId: paymentLink.userId,
                 type: "payment_link",
                 amount: netAmount,
                 provider: "pawapay",
                 paymentIntentId: intent.id,
                 payerName: fullName,
                 countryCode: paymentCountryCode,
               });
               return res.status(202).json({
                 message: "Votre demande est enregistrée. Le statut du paiement sera vérifié automatiquement.",
                 reference: intent.reference,
                 gateway: "mobile_money",
                 status: "pending",
                 amount: numAmount,
                 feeAmount: parseFloat(totalFeeAmount),
                 totalAmount: numAmount,
               });
             }
             await storage.updatePaymentIntentStatus(intent.id, "failed");
             const failedTransaction = await storage.getTransactionByReference(reference);
             if (failedTransaction) {
               await storage.updateTransactionStatus(failedTransaction.id, "failed");
             }
            return res.status(502).json(buildProviderErrorPayload({
               error: "gateway_error",
               message: providerMessage || undefined,
              fallback: "Impossible de contacter le fournisseur de paiement.",
              provider: "pawapay",
              sensitiveValues: [phone],
            }));
          }
           await storage.updatePaymentIntentStatus(intent.id, "failed");
           const failedTransaction = await storage.getTransactionByReference(reference);
           if (failedTransaction) {
             await storage.updateTransactionStatus(failedTransaction.id, "failed");
           }
          res.status(500).json({ message: "Erreur lors de l'initiation du paiement. Veuillez réessayer." });
        }
      } else {
        res.json({ 
          message: "Paiement initié avec succès.",
          reference: intent.reference,
          redirectUrl: paymentLink.redirectUrl || null,
          amount: numAmount,
          feeAmount: parseFloat(totalFeeAmount),
          totalAmount: parseFloat(totalAmount),
        });
      }
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      console.error("Pay via link error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Get payment intents for current user (merchant)
  app.get("/api/payment-intents", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      const intents = await storage.getPaymentIntentsByMerchantId(userId);
      res.json(intents);
    } catch (error) {
      console.error("Get payment intents error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Get payment intents for a specific link
  app.get("/api/payment-links/:id/intents", requireAuth, async (req, res) => {
    try {
      const link = await storage.getPaymentLinkById(req.params.id);
      if (!link) return res.status(404).json({ message: "Lien introuvable" });
      if (link.userId !== req.userId!) return res.status(403).json({ message: "Accès refusé" });
      const intents = await storage.getPaymentIntentsByLinkId(req.params.id);
      res.json(intents);
    } catch (error) {
      console.error("Get payment intents for link error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Get analytics for a specific payment link
  app.get("/api/payment-links/:id/analytics", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      const paymentLink = await storage.getPaymentLinkById(req.params.id);
      
      if (!paymentLink) {
        return res.status(404).json({ message: "Lien de paiement non trouvé" });
      }
      
      // Verify ownership
      if (paymentLink.userId !== userId) {
        return res.status(403).json({ message: "Accès non autorisé" });
      }
      
      // Get all transactions for this link
      const transactions = await storage.getTransactionsByPaymentLinkId(paymentLink.id);
      
      // Calculate analytics
      const completedTransactions = transactions.filter(t => t.status === "completed");
      const pendingTransactions = transactions.filter(t => t.status === "pending");
      const failedTransactions = transactions.filter(t => t.status === "failed");
      
      const totalCollected = completedTransactions.reduce((sum, t) => sum + parseFloat(t.amount), 0);
      const totalPending = pendingTransactions.reduce((sum, t) => sum + parseFloat(t.amount), 0);
      
      res.json({
        paymentLink,
        analytics: {
          totalTransactions: transactions.length,
          completedCount: completedTransactions.length,
          pendingCount: pendingTransactions.length,
          failedCount: failedTransactions.length,
          totalCollected: totalCollected.toFixed(2),
          totalPending: totalPending.toFixed(2),
          clickCount: paymentLink.clickCount,
          conversionRate: paymentLink.clickCount > 0 
            ? ((completedTransactions.length / paymentLink.clickCount) * 100).toFixed(1)
            : "0",
        },
        transactions,
      });
    } catch (error) {
      console.error("Get payment link analytics error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Complete a payment (simulate webhook from payment gateway)
  // FIX-4: cet endpoint crédite le wallet d'un marchand — il doit être admin-only.
  // Avant le fix, n'importe qui connaissant une référence pouvait créditer un compte gratuitement.
  app.post("/api/payment-intents/:reference/complete", requireAuth, requireAdmin, async (req, res) => {
    try {
      const intent = await storage.getPaymentIntentByReference(req.params.reference);
      if (!intent) {
        return res.status(404).json({ message: "Paiement non trouvé" });
      }

      if (intent.status === "completed") {
        return res.status(400).json({ message: "Ce paiement a déjà été traité" });
      }

      if (intent.status === "failed") {
        return res.status(400).json({ message: "Ce paiement a échoué" });
      }

      // Update intent status to completed first
      const updatedIntent = await storage.updatePaymentIntentStatus(intent.id, "completed");
      if (!updatedIntent) {
        return res.status(500).json({ message: "Erreur lors de la mise à jour du statut" });
      }

      // Credit the merchant's wallet using admin exchange rates
      const intentAmount = parseFloat(intent.amount);
      const intentCurrency = intent.currency || "XAF";
      await creditUserWallet(intent.merchantId, intentAmount, intentCurrency);

      // Update existing transaction to completed status
      const existingTx = await storage.getTransactionByPaymentIntentId(intent.id);
      if (existingTx) {
        await storage.updateTransactionStatus(existingTx.id, "completed");
      }

      res.json({ 
        message: "Paiement confirmé et crédité avec succès",
        amount: intentAmount.toFixed(2),
        currency: intentCurrency,
        originalAmount: intent.amount,
        originalCurrency: intent.currency
      });
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      console.error("Complete payment error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // ============= ADMIN ROUTES =============

  // ─── Admin OTP Routes ─────────────────────────────────────────────────────────

  // GET /api/admin/otp-status — check if current session has verified the admin OTP
  app.get("/api/admin/otp-status", requireAuth, async (req, res) => {
    const user = await storage.getUser(req.userId!).catch(() => null);
    if (!user || !["admin"].includes(user.role)) {
      return res.status(403).json({ message: "Accès refusé" });
    }
    const now = Date.now();
    // Keyed by sessionID — each browser login is independently verified
    const memEntry = adminVerifiedSessions.get(req.sessionID);
    const memValid = !!(memEntry && memEntry.userId === req.userId && memEntry.expiresAt > now);
    const avsExp = req.session._avs;
    const sessionValid = typeof avsExp === "number" && avsExp > now;
    const currentIp = getClientIp(req);
    const normalizeLoopback = (ip: string) =>
      ip === "::1" || ip === "::ffff:127.0.0.1" ? "127.0.0.1" : ip;
    const sessionIp = req.session._avsIp || memEntry?.ip;
    const ipBound = typeof sessionIp === "string" &&
      normalizeLoopback(sessionIp) === normalizeLoopback(currentIp);
    let verified = (memValid || sessionValid) && ipBound;

    // Tier 3: ONE single DB query fetching the session row — extract both _avs and _pav
    // at once to avoid 2 sequential round-trips to the remote DB (was the main perf bottleneck).
    // Tries sessionPool first then falls back to main pool if sessionPool is exhausted.
    let dbSessData: Record<string, any> | null = null;
    if (!verified && req.sessionID) {
      const poolsToTry = [sessionPool, pool];
      dbFetch: for (const queryPool of poolsToTry) {
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const dbRow = await queryPool.query(
              `SELECT sess FROM session WHERE sid = $1 AND expire > NOW()`,
              [req.sessionID]
            );
            if (dbRow.rows.length > 0) {
              dbSessData = typeof dbRow.rows[0].sess === "string"
                ? JSON.parse(dbRow.rows[0].sess)
                : dbRow.rows[0].sess;
              const dbAvs = dbSessData?._avs;
              const dbAvsIp = typeof dbSessData?._avsIp === "string" ? dbSessData._avsIp : undefined;
              if (typeof dbAvs === "number" && dbAvs > now && dbAvsIp &&
                  normalizeLoopback(dbAvsIp) === normalizeLoopback(currentIp)) {
                verified = true;
                req.session._avsIp = dbAvsIp;
                adminVerifiedSessions.set(req.sessionID, { userId: req.userId!, expiresAt: dbAvs, ip: dbAvsIp });
              }
            }
            break dbFetch;
          } catch {
            if (attempt === 0) {
              await new Promise(r => setTimeout(r, 200));
            }
          }
        }
      }
    }

  // Check _pav (panel TOTP verified) — 24h inactivity window, refreshed by
  // successful panel activity. If _avs is valid but _pav is missing/expired,
  // the panel TOTP must be entered again.
  const pavExp = req.session._pav;
  const panelValid = typeof pavExp === "number" && pavExp > now;

  // Re-use the DB row already fetched above — no second round-trip needed.
  let panelValidDb = false;
  if (!panelValid) {
    if (dbSessData) {
      const dbPav = dbSessData._pav;
      if (typeof dbPav === "number" && dbPav > now) panelValidDb = true;
    } else if (!verified && req.sessionID) {
      // dbSessData is null only when Tier 3 was skipped (verified in memory/session already).
      // In that case we still need _pav from DB if not in req.session.
      try {
        const dbRow = await pool.query(
          `SELECT sess FROM session WHERE sid = $1 AND expire > NOW()`,
          [req.sessionID]
        );
        if (dbRow.rows.length > 0) {
          const sd = typeof dbRow.rows[0].sess === "string"
            ? JSON.parse(dbRow.rows[0].sess)
            : dbRow.rows[0].sess;
          if (typeof sd?._pav === "number" && sd._pav > now) panelValidDb = true;
        }
      } catch { /* ignore */ }
    }
  }

  const needsPanelVerify = verified && !panelValid && !panelValidDb;
  const panelPinExp = req.session._ppv;
  const panelPinIp = req.session._ppvIp;
  const panelPinValid = typeof panelPinExp === "number" && panelPinExp > now &&
    typeof panelPinIp === "string" &&
    normalizeLoopback(panelPinIp) === normalizeLoopback(currentIp);
  const needsPanelPin = verified && !panelPinValid;

    res.json({
      verified,
      needsPanelVerify: needsPanelVerify || undefined,
      needsPanelPin: needsPanelPin || undefined,
      totpEnabled: !!user.totpEnabled,
      enforcementEnabled: true,
    });
  });

  // GET /api/admin/debug-storage — tests Supabase Storage connection (admin only)
  // SECURITY: disabled in production to prevent infrastructure enumeration.
  app.get("/api/admin/debug-storage", requireAuth, requireAdmin, async (req, res) => {
    if (process.env.NODE_ENV === "production") return res.status(404).end();
    const { supabase: sbClient, STORAGE_BUCKET: bucket, listSupabaseBuckets, testDownload } = await import("./supabase");
    const result: Record<string, any> = {
      env: {
        SUPABASE_URL: process.env.SUPABASE_URL ? `${process.env.SUPABASE_URL.slice(0, 30)}...` : "NOT SET",
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? "SET (hidden)" : "NOT SET",
        SUPABASE_STORAGE_BUCKET: process.env.SUPABASE_STORAGE_BUCKET || "(default: uploads)",
        clientInitialized: !!sbClient,
        configuredBucket: bucket,
      },
      buckets: null as any,
      bucketTest: null as any,
      sampleFileTest: null as any,
    };

    if (sbClient) {
      // List all buckets
      result.buckets = await listSupabaseBuckets();

      // Try listing files in the configured bucket
      try {
        const { data: files, error: listErr } = await sbClient.storage.from(bucket).list("kyc", { limit: 3 });
        result.bucketTest = listErr
          ? { ok: false, error: listErr.message }
          : { ok: true, fileCount: files?.length ?? 0, sampleFiles: files?.map(f => f.name) };
      } catch (e: any) {
        result.bucketTest = { ok: false, error: e.message };
      }

      // Test download of first real KYC file from DB
      try {
        const kycRows = await db.execute(sql`SELECT document_front_path FROM kyc_submissions WHERE document_front_path NOT LIKE '/uploads/%' LIMIT 1`);
        const firstPath = (kycRows as any).rows?.[0]?.document_front_path;
        if (firstPath) {
          result.sampleFileTest = { path: firstPath, ...(await testDownload(bucket, firstPath)) };
        } else {
          result.sampleFileTest = { note: "No non-local KYC paths in DB" };
        }
      } catch (e: any) {
        result.sampleFileTest = { error: e.message };
      }
    }

    res.json(result);
  });

  // GET /api/admin/debug-db — diagnostic endpoint (admin only)
  // SECURITY: disabled in production to prevent infrastructure enumeration.
  app.get("/api/admin/debug-db", requireAuth, requireAdmin, async (req, res) => {
    if (process.env.NODE_ENV === "production") return res.status(404).end();
    const results: Record<string, any> = {
      env: {
        hasSupabaseUrl: !!process.env.SUPABASE_DATABASE_URL,
        hasDatabaseUrl: !!process.env.DATABASE_URL,
        hasSessionSecret: !!process.env.SESSION_SECRET,
        hasTrustProxy: !!process.env.TRUST_PROXY,
        hasCookieSecure: !!process.env.COOKIE_SECURE,
        pm2InstanceId: process.env.NODE_APP_INSTANCE || process.env.PM2_INSTANCE_ID || "not set",
        nodeEnv: process.env.NODE_ENV || "not set",
      },
      db: { ok: false, error: null as string | null, userCount: null as number | null },
      session: {
        sessionId: req.sessionID ? req.sessionID.slice(0, 8) + "..." : "none",
        hasUserId: !!req.session?.userId,
        hasAvs: typeof req.session?._avs === "number",
        avsValid: typeof req.session?._avs === "number" && (req.session._avs as number) > Date.now(),
        memMapHit: !!adminVerifiedSessions.get(String(req.userId)),
      },
    };

    try {
      const { pool: dbPool } = await import("./db");
      const r = await dbPool.query("SELECT COUNT(*) as cnt FROM users");
      results.db.ok = true;
      results.db.userCount = parseInt(r.rows[0].cnt, 10);
    } catch (e: any) {
      results.db.error = e.message;
    }

    res.json(results);
  });

  // GET /api/admin/pool-status — live DB pool diagnostics (admin only)
  // SECURITY: disabled in production to prevent DB infrastructure enumeration.
  app.get("/api/admin/pool-status", requireAuth, requireAdmin, async (req, res) => {
    if (process.env.NODE_ENV === "production") return res.status(404).end();
    const workerIndex = process.env.NODE_APP_INSTANCE ?? process.env.PM2_INSTANCE_ID ?? "0";
    const pm2Instances = parseInt(process.env.PM2_INSTANCES || "1", 10) || 1;
    const hasSessionSecret = !!process.env.SESSION_SECRET;

    // Run a quick latency probe on each pool
    const probePool = async (p: typeof pool): Promise<{ ok: boolean; latencyMs: number; error?: string }> => {
      const start = Date.now();
      try {
        await p.query("SELECT 1");
        return { ok: true, latencyMs: Date.now() - start };
      } catch (e: any) {
        return { ok: false, latencyMs: Date.now() - start, error: e.message };
      }
    };

    const [mainProbe, sessionProbe] = await Promise.all([
      probePool(pool),
      probePool(sessionPool),
    ]);

    const totalMax = (poolStats.main.max + poolStats.session.max) * pm2Instances;
    const health = mainProbe.ok && sessionProbe.ok && hasSessionSecret ? "ok" : "degraded";
    const warnings: string[] = [];
    if (!hasSessionSecret) warnings.push("SESSION_SECRET manquant — tokens différents par worker → déconnexions immédiates avec PM2 multi-worker");
    if (pm2Instances > 1 && !hasSessionSecret) warnings.push("CRITIQUE: multi-worker PM2 sans SESSION_SECRET");
    if (poolStats.session.fallbackToMain > 0) warnings.push(`SessionPool épuisé ${poolStats.session.fallbackToMain}× depuis démarrage — fallback sur pool principal activé`);
    if (!mainProbe.ok) warnings.push(`Pool principal inaccessible: ${mainProbe.error}`);
    if (!sessionProbe.ok) warnings.push(`SessionPool inaccessible: ${sessionProbe.error}`);
    if (mainProbe.latencyMs > 1000) warnings.push(`Latence pool principal élevée: ${mainProbe.latencyMs}ms`);

    res.json({
      health,
      worker: { index: workerIndex, pm2Instances, pid: process.pid },
      config: {
        sessionSecretSet: hasSessionSecret,
        trustProxy: process.env.TRUST_PROXY || "not set",
        nodeEnv: process.env.NODE_ENV || "not set",
        pm2Instances,
      },
      pools: {
        main: {
          max: poolStats.main.max,
          total: pool.totalCount,
          active: pool.totalCount - pool.idleCount,
          idle: pool.idleCount,
          waiting: pool.waitingCount,
          probe: mainProbe,
          errors: poolStats.main.errors,
          lastError: poolStats.main.lastError,
          lastErrorAt: poolStats.main.lastErrorAt
            ? new Date(poolStats.main.lastErrorAt).toISOString()
            : null,
        },
        session: {
          max: poolStats.session.max,
          total: sessionPool.totalCount,
          active: sessionPool.totalCount - sessionPool.idleCount,
          idle: sessionPool.idleCount,
          waiting: sessionPool.waitingCount,
          probe: sessionProbe,
          errors: poolStats.session.errors,
          lastError: poolStats.session.lastError,
          lastErrorAt: poolStats.session.lastErrorAt
            ? new Date(poolStats.session.lastErrorAt).toISOString()
            : null,
          fallbackToMain: poolStats.session.fallbackToMain,
        },
      },
      totalMaxAllWorkers: totalMax,
      warnings,
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  });

  // GET /api/admin/session-errors — diagnostic en temps réel des erreurs de sessions
  // SECURITY: disabled in production — exposes all active user sessions with emails/IPs.
  app.get("/api/admin/session-errors", requireAuth, requireAdmin, async (req, res) => {
    if (process.env.NODE_ENV === "production") return res.status(404).end();
    const workerIndex = process.env.NODE_APP_INSTANCE ?? "0";

    // Probe live des deux pools
    const probePool = async (p: typeof pool, name: string) => {
      const t = Date.now();
      try { await p.query("SELECT 1"); return { name, ok: true, latencyMs: Date.now() - t }; }
      catch (e: any) { return { name, ok: false, latencyMs: Date.now() - t, error: e.message }; }
    };
    const [mainProbe, sessionProbe] = await Promise.all([
      probePool(pool, "main"),
      probePool(sessionPool, "session"),
    ]);

    // Compte total des sessions en DB (optionnel, pour vérifier le volume)
    let totalSessionsInDb: number | null = null;
    let recentSessionsInDb: any[] | null = null;
    let allActiveSessions: any[] = [];
    const targetUserId = req.query.userId as string | undefined;
    try {
      const countRes = await pool.query(`SELECT COUNT(*) AS cnt FROM session`);
      totalSessionsInDb = parseInt(countRes.rows[0]?.cnt ?? "0", 10);

      // Toutes les sessions actives (non expirées) avec infos utilisateur
      try {
        const allRes = await pool.query(
          `SELECT s.sid,
                  s.sess->>'userId'        AS user_id,
                  u.email,
                  u.full_name,
                  s.sess->>'loginAt'       AS login_at,
                  s.sess->>'clientIp'      AS client_ip,
                  s.sess->>'userAgent'     AS user_agent,
                  s.sess->>'tokenIssuedAt' AS token_ts,
                  s.expire
           FROM session s
           LEFT JOIN users u ON u.id::text = s.sess->>'userId'
           WHERE s.expire > NOW()
           ORDER BY s.expire ASC
           LIMIT 200`
        );
        allActiveSessions = allRes.rows;
      } catch (e: any) {
        allActiveSessions = [{ error: (e as Error).message }];
      }

      if (targetUserId) {
        // Sessions brutes pour un userId donné (pour debug ciblé)
        const rawRes = await pool.query(
          `SELECT s.sid,
                  s.sess->>'userId'        AS user_id,
                  u.email,
                  u.full_name,
                  s.sess->>'loginAt'       AS login_at,
                  s.sess->>'clientIp'      AS client_ip,
                  s.sess->>'userAgent'     AS user_agent,
                  s.sess->>'tokenIssuedAt' AS token_ts,
                  s.expire
           FROM session s
           LEFT JOIN users u ON u.id::text = s.sess->>'userId'
           WHERE s.sess->>'userId' = $1
           ORDER BY s.expire DESC
           LIMIT 20`,
          [targetUserId]
        );
        recentSessionsInDb = rawRes.rows;
      }
    } catch (e: any) {
      recentSessionsInDb = [{ error: e.message }];
    }

    res.json({
      worker: { index: workerIndex, pid: process.pid },
      pools: { main: mainProbe, session: sessionProbe },
      poolStats: {
        main: { errors: poolStats.main.errors, lastError: poolStats.main.lastError, lastErrorAt: poolStats.main.lastErrorAt ? new Date(poolStats.main.lastErrorAt).toISOString() : null },
        session: { errors: poolStats.session.errors, lastError: poolStats.session.lastError, lastErrorAt: poolStats.session.lastErrorAt ? new Date(poolStats.session.lastErrorAt).toISOString() : null, fallbackToMain: poolStats.session.fallbackToMain },
      },
      sessionOpErrors: sessionOpErrors.slice().reverse(),
      totalSessionOpErrors: sessionOpErrors.length,
      totalSessionsInDb,
      allActiveSessions,
      recentSessionsInDb,
      tip: recentSessionsInDb === null ? "Entrez un ID utilisateur pour filtrer ses sessions" : undefined,
      timestamp: new Date().toISOString(),
    });
  });

  // GET /api/admin/check-access — diagnostic without OTP; shows role, session, OTP state
  // SECURITY: disabled in production to prevent session state enumeration.
  app.get("/api/admin/check-access", requireAuth, requireAdmin, async (req, res) => {
    if (process.env.NODE_ENV === "production") return res.status(404).end();
    try {
      const user = await storage.getUser(req.userId!).catch(() => null);
      const now = Date.now();
      const memEntry = adminVerifiedSessions.get(String(req.userId));
      const memValid = !!(memEntry && memEntry.userId === req.userId && memEntry.expiresAt > now);
      const avsExp = req.session._avs;
      const sessionValid = typeof avsExp === "number" && (avsExp as number) > now;

      let dbSessionData: any = null;
      let tier3Valid = false;
      try {
        const dbRow = await sessionPool.query(
          `SELECT sess FROM session WHERE expire > NOW()
           AND (sess::jsonb->>'userId')::text = $1
           AND (sess::jsonb->>'_avs') IS NOT NULL
           ORDER BY expire DESC LIMIT 1`,
          [String(req.userId)]
        );
        if (dbRow.rows.length > 0) {
          dbSessionData = typeof dbRow.rows[0].sess === "string"
            ? JSON.parse(dbRow.rows[0].sess)
            : dbRow.rows[0].sess;
          const dbAvs = dbSessionData?._avs;
          tier3Valid = typeof dbAvs === "number" && dbAvs > now;
        }
      } catch (e: any) {
        dbSessionData = { error: e.message };
      }

      res.json({
        userId: req.userId,
        userFound: !!user,
        userRole: user?.role || null,
        isAdminRole: user ? ["admin"].includes(user.role) : false,
        otp: {
          memValid,
          sessionValid,
          tier3Valid,
          sessionAvsExpiry: avsExp ? new Date(avsExp as number).toISOString() : null,
          tier3AvsExpiry: dbSessionData?._avs ? new Date(dbSessionData._avs).toISOString() : null,
          overallValid: memValid || sessionValid || tier3Valid,
        },
        session: {
          sid: req.sessionID ? req.sessionID.slice(0, 8) + "..." : "none",
          hasOtpCode: !!(req.session._otpCodeH),
          dbRowFound: dbSessionData !== null && !dbSessionData?.error,
          dbError: dbSessionData?.error || null,
        },
        env: {
          nodeEnv: process.env.NODE_ENV,
          trustProxy: process.env.TRUST_PROXY || "not set",
          cookieSameSite: process.env.COOKIE_SAMESITE || "not set (auto)",
          cookieSecure: process.env.COOKIE_SECURE || "not set (auto=true)",
          hasResendKey: !!process.env.RESEND_API_KEY,
          hasTelegramToken: !!process.env.TELEGRAM_BOT_TOKEN,
        },
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/admin/telegram/webhook-info — diagnose why bot commands may not respond
  app.get("/api/admin/telegram/webhook-info", requireAuth, requireAdmin, async (req, res) => {
    try {
      const info = await getWebhookInfo();
      res.json({
        hasTelegramToken: !!process.env.TELEGRAM_BOT_TOKEN,
        hasTelegramChatId: !!process.env.TELEGRAM_CHAT_ID,
        expectedSecretPrefix: getTelegramWebhookSecret().slice(0, 8) + "...",
        telegram: info,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/admin/request-otp — generate & send 4-digit code to admin email
  app.post("/api/admin/request-otp", async (req, res) => {
    return res.status(410).json({ message: "Ce mécanisme OTP a été retiré. Utilisez Google Authenticator." });
    /*
    try {
      const user = await storage.getUser(req.userId!);
      if (!user || !["admin"].includes(user.role)) {
        return res.status(403).json({ message: "Accès refusé" });
      }
      // VULN-A2: userId-keyed throttle (after role check) — IP-keyed middleware
      // would let any NAT-sharing user block the admin's OTP channel.
      const requestLimit = checkAdminOtpRequestLimit(req.userId!);
      if (!requestLimit.allowed) {
        return res.status(429).json({
          message: `Trop de demandes. Réessayez dans ${Math.ceil((requestLimit.retryAfter ?? 900) / 60)} minute(s).`,
          retryAfter: requestLimit.retryAfter,
        });
      }
      recordAdminOtpRequest(req.userId!);
      if (!user.email) {
        return res.status(400).json({ message: "Aucun email configuré pour ce compte admin" });
      }
      // Invalidate any previous pending email OTP code before issuing a new one
      // VULN-A5: keyed by sessionID — each login session is independent
      adminOtpStore.delete(req.sessionID);
      // Clear only the email OTP stores — do NOT touch _avs (TOTP panel verification).
      // Previously this cleared _avs too, which would force TOTP re-verification just
      // for requesting an email OTP code — that was unnecessary and disruptive.
      delete req.session._otpCode;   // clear any legacy plaintext
      delete req.session._otpCodeH;  // clear previous hash
      delete req.session._otpExpiry;

      const code = generateAdminOtp(); // 6 digits (1 000 000 combinations)
      const otpExpiry = Date.now() + 15 * 60 * 1000; // 15 min — enough time to check server logs
      // Store in-memory (fast, same-process, plaintext safe — never written to DB)
      // VULN-A5: key = sessionID; VULN-A1: DB session stores hash only
      adminOtpStore.set(req.sessionID, { code, expiresAt: otpExpiry });
      delete req.session._otpCode;                  // VULN-A1: never store plaintext in DB session
      req.session._otpCodeH = hashOtp(code);        // VULN-A1: store HMAC-SHA256 hash
      req.session._otpExpiry = otpExpiry;
      await new Promise<void>((resolve) => { req.session.save((err) => { if (err) console.error("[AdminOTP] session save warning:", err?.message); resolve(); }); });
      // Send via email (silently skipped if RESEND_API_KEY not set)
      await sendAdminOtpEmail(user.email, user.fullName || user.username, code);

      // Send code via Telegram as backup channel
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      const chatId = process.env.TELEGRAM_CHAT_ID;
      if (botToken && chatId) {
        fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: `🔐 <b>Code Admin Panel</b>\n\nCode : <code>${code}</code>\n⏱ Expire dans 5 minutes`,
            parse_mode: "HTML",
          }),
        }).catch(() => {});
      }

      const hasEmail = !!process.env.RESEND_API_KEY;
      const hasTelegram = !!(botToken && chatId);
      const noChannel = !hasEmail && !hasTelegram;
      if (noChannel) {
        // SECURITY: Never log OTP codes — configure RESEND_API_KEY or TELEGRAM_BOT_TOKEN+TELEGRAM_CHAT_ID
        console.warn(`[AdminOTP] ⚠ AUCUN CANAL DE LIVRAISON configuré. Ajoutez RESEND_API_KEY ou TELEGRAM_BOT_TOKEN+TELEGRAM_CHAT_ID.`);
      }

      // Log to admin_logs — do NOT log the OTP code itself
      const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
      storage.createAdminLog({ adminId: req.userId!, action: "otp_requested", details: `OTP demandé depuis IP ${ip}` }).catch(() => {});
      if (process.env.NODE_ENV !== "production") {
        console.log(`[AdminOTP] Code généré pour ${user.email.replace(/(.{2}).+(@.+)/, "$1***$2")} — email=${hasEmail} telegram=${hasTelegram}`);
      }
      res.json({ sent: true, email: user.email.replace(/(.{2}).+(@.+)/, "$1***$2"), noChannel });
    } catch (error: any) {
      console.error("Admin OTP request error:", error.message);
      res.status(500).json({ message: "Erreur lors de l'envoi du code" });
    }
    */
  });

  // POST /api/admin/verify-otp — verify 6-digit code and register session in-memory
  app.post("/api/admin/verify-otp", requireAuth, adminActionLimiter, async (req, res) => {
    return res.status(410).json({ message: "Ce mécanisme OTP a été retiré. Utilisez Google Authenticator." });
    /*
    try {
      const user = await storage.getUser(req.userId!);
      if (!user || !["admin"].includes(user.role)) {
        return res.status(403).json({ message: "Accès refusé" });
      }

      // ── Brute-force protection (CWE-287 fix: 10 000 combinations → locked after 5 fails)
      const rateCheck = checkOtpRateLimit(req.userId!);
      if (!rateCheck.allowed) {
        const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
        storage.createAdminLog({
          adminId: req.userId!,
          action: "otp_locked",
          details: `Trop de tentatives OTP depuis IP ${ip} — compte verrouillé ${Math.ceil((rateCheck.retryAfter ?? 0) / 60)} min`,
        }).catch(() => {});
        return res.status(429).json({
          message: `Trop de tentatives. Réessayez dans ${Math.ceil((rateCheck.retryAfter ?? 900) / 60)} minute(s).`,
          retryAfter: rateCheck.retryAfter,
        });
      }

      const { code } = req.body as { code: string };
      if (!code || typeof code !== "string") {
        return res.status(400).json({ message: "Code requis" });
      }

      // Resolve stored OTP: in-memory first (same-process, fast), then session (DB-backed, PM2 multi-worker)
      // VULN-A1: session/DB tiers store HMAC hash — compare hash(submitted) vs stored hash
      // VULN-A5: in-memory store keyed by sessionID
      let storedCode: string | undefined;
      let storedExpiry: number | undefined;
      let storedIsHashed = false; // true when storedCode is a HMAC hash (session tiers)

      const memStored = adminOtpStore.get(req.sessionID);
      if (memStored) {
        storedCode = memStored.code;
        storedExpiry = memStored.expiresAt;
        storedIsHashed = false; // in-memory: plaintext, never written to DB
      } else if (req.session._otpCodeH && req.session._otpExpiry) {
        // Fallback: hash from session (handles PM2 worker routing mismatch)
        storedCode = req.session._otpCodeH;
        storedExpiry = req.session._otpExpiry;
        storedIsHashed = true;
        console.log(`[AdminOTP] Code (hash) trouvé en session DB (fallback PM2) pour userId=${req.userId}`);
      } else {
        // Try reading directly from DB session table (extreme fallback: session middleware not yet hydrated)
        try {
          const dbRow = await sessionPool.query(
            `SELECT sess FROM session WHERE sid = $1 AND expire > NOW() LIMIT 1`,
            [req.sessionID]
          );
          if (dbRow.rows.length > 0) {
            const sessData = typeof dbRow.rows[0].sess === "string"
              ? JSON.parse(dbRow.rows[0].sess)
              : dbRow.rows[0].sess;
            if (sessData?._otpCodeH && sessData?._otpExpiry) {
              storedCode = sessData._otpCodeH;
              storedExpiry = sessData._otpExpiry;
              storedIsHashed = true;
              console.log(`[AdminOTP] Code (hash) trouvé en session DB directe (fallback tier-3) pour userId=${req.userId}`);
            }
          }
        } catch {
          // Continue without the optional legacy session fallback.
        }
      }

      if (!storedCode || !storedExpiry) {
        return res.status(400).json({ message: "Aucun code demandé. Veuillez demander un nouveau code." });
      }
      if (Date.now() > storedExpiry) {
        adminOtpStore.delete(req.sessionID);
        delete req.session._otpCode;
        delete req.session._otpCodeH;
        delete req.session._otpExpiry;
        return res.status(400).json({ message: "Code expiré. Veuillez demander un nouveau code." });
      }

      // Constant-time comparison to prevent timing attacks
      // VULN-A1: if stored as hash, compare hash(submitted) vs stored hash
      const submittedCode = code.trim();
      const compareA = storedIsHashed ? hashOtp(submittedCode) : submittedCode;
      const compareB = storedCode;
      const codesMatch = compareA.length === compareB.length &&
        crypto.timingSafeEqual(Buffer.from(compareA), Buffer.from(compareB));

      if (!codesMatch) {
        recordOtpFailure(req.userId!);
        const remaining = OTP_MAX_ATTEMPTS - (otpAttempts.get(req.userId!)?.count ?? OTP_MAX_ATTEMPTS);
        return res.status(400).json({
          message: remaining > 0
            ? `Code incorrect. ${remaining} tentative(s) restante(s).`
            : "Code incorrect. Compte temporairement verrouillé.",
        });
      }

      // ── OTP valid — cleanup both stores
      adminOtpStore.delete(req.sessionID);
      delete req.session._otpCode;
      delete req.session._otpCodeH;
      delete req.session._otpExpiry;
      clearOtpFailures(req.userId!);

      const expiresAt = Date.now() + ADMIN_OTP_SESSION_TTL_MS;

      await new Promise<void>((resolve) => {
        req.session.save((err) => {
          if (err) console.error("[AdminOTP] Session save warning (non-fatal):", err?.message);
          resolve();
        });
      });

      const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";

      // Log successful verification to admin_logs (traceable audit trail)
      storage.createAdminLog({
        adminId: req.userId!,
        action: "otp_verified",
        details: `Vérification OTP réussie depuis IP ${ip} — session valide 24h d'inactivité`,
      }).catch(() => {});

      console.log(`[AdminOTP] Admin ${user.email?.replace(/(.{2}).+(@.+)/, "$1***$2")} vérifié depuis ${ip}`);
      notifyAdminLoginSuccess({ adminName: user.fullName || user.username, adminEmail: user.email || "", ip }).catch(() => {});

      res.json({ success: true });
    } catch (error: any) {
      console.error("Admin OTP verify error:", error.message);
      res.status(500).json({ message: "Erreur serveur" });
    }
    */
  });

  // ─── Admin TOTP (Google Authenticator) Routes ────────────────────────────────

  // GET /api/admin/totp/status — check if TOTP is configured for this admin
  app.get("/api/admin/totp/status", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.userId!);
      if (!user || !["admin"].includes(user.role)) {
        return res.status(403).json({ message: "Accès refusé" });
      }
      res.json({ enabled: !!user.totpEnabled });
    } catch (err: any) {
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // POST /api/admin/totp/setup — generate a TOTP secret & return OTP URI for QR
  // Does NOT enable TOTP yet — admin must confirm with a valid code first.
  // SECURITY: if TOTP is already enabled, the current TOTP code MUST be provided
  // to prevent an attacker from overwriting an existing secret without possession proof.
  app.post("/api/admin/totp/setup", requireAuth, adminActionLimiter, async (req, res) => {
    try {
      const user = await storage.getUser(req.userId!);
      if (!user || !["admin"].includes(user.role)) {
        return res.status(403).json({ message: "Accès refusé" });
      }

      // ── SECURITY: an active TOTP secret can only be replaced after proof ────
      // The current code is required even if the server is misconfigured. The
      // enforcement decision is not delegated to an environment variable.
      if (user.totpEnabled && user.totpSecret) {
        const { currentCode } = req.body as { currentCode?: string };
        const submittedCurrentCode = typeof currentCode === "string"
          ? currentCode.replace(/\s/g, "")
          : "";
        if (!/^\d{6}$/.test(submittedCurrentCode)) {
          return res.status(403).json({
            message: "Un code Google Authenticator actuel est requis pour modifier le secret TOTP.",
            requireCurrentCode: true,
          });
        }
        const currentRateCheck = checkOtpRateLimit(req.userId!);
        if (!currentRateCheck.allowed) {
          return res.status(429).json({
            message: `Trop de tentatives. Réessayez dans ${Math.ceil((currentRateCheck.retryAfter ?? 900) / 60)} minute(s).`,
            retryAfter: currentRateCheck.retryAfter,
          });
        }
        const { decryptField } = await import("./fieldEncryption");
        const { TOTP: TOTPv, Secret: Secretv } = await import("otpauth");
        const rawSecret = decryptField(user.totpSecret);
        if (!rawSecret) return res.status(400).json({ message: "Erreur de configuration TOTP actuelle." });
        const totpCheck = new TOTPv({ issuer: "AshTech Pay Admin", label: user.email || user.username, algorithm: "SHA1", digits: 6, period: 30, secret: Secretv.fromBase32(rawSecret) });
        if (totpCheck.validate({ token: submittedCurrentCode, window: 1 }) === null) {
          recordOtpFailure(req.userId!);
          return res.status(403).json({ message: "Code Google Authenticator actuel incorrect. Impossible de modifier le secret." });
        }
        clearOtpFailures(req.userId!);
      }

      const { TOTP, Secret } = await import("otpauth");
      const secret = new Secret({ size: 20 });
      const totp = new TOTP({
        issuer: "AshTech Pay Admin",
        label: user.email || user.username,
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        secret,
      });
      const uri = totp.toString();
      // Store the pending secret encrypted in this session. The active user
      // record is not changed until confirmation succeeds.
      const { encryptField } = await import("./fieldEncryption");
      const encryptedPending = encryptField(secret.base32);
      if (!encryptedPending) {
        return res.status(503).json({ message: "Chiffrement TOTP indisponible. Réessayez plus tard." });
      }
      // Keep the currently active secret in the user record until confirmation.
      // The pending replacement is encrypted and bound to this authenticated
      // session, so another session cannot confirm or overwrite it.
      req.session._totpPendingSecret = encryptedPending;
      await new Promise<void>((resolve, reject) => req.session.save((err) => err ? reject(err) : resolve()));
      res.json({ uri, secret: secret.base32 });
    } catch (err: any) {
      console.error("[AdminTOTP] Setup error:", err?.message);
      res.status(500).json({ message: "Erreur lors de la génération du secret TOTP" });
    }
  });

  // POST /api/admin/totp/confirm — verify first code and permanently enable TOTP
  app.post("/api/admin/totp/confirm", requireAuth, adminActionLimiter, async (req, res) => {
    try {
      const user = await storage.getUser(req.userId!);
      if (!user || !["admin"].includes(user.role)) {
        return res.status(403).json({ message: "Accès refusé" });
      }
      const { code } = req.body as { code: string };
      if (!code || typeof code !== "string" || !/^\d{6}$/.test(code.trim())) {
        return res.status(400).json({ message: "Code à 6 chiffres requis" });
      }
      // Read the encrypted pending secret from this session. For compatibility
      // with a configuration started before this hardening, accept the legacy
      // disabled-account value once, then migrate it into the active record.
      const { decryptField } = await import("./fieldEncryption");
      const pendingEncrypted = req.session._totpPendingSecret || (!user.totpEnabled ? user.totpSecret : null);
      if (!pendingEncrypted) {
        return res.status(400).json({ message: "Aucune configuration en cours. Recommencez la configuration." });
      }
      const pendingSecret = decryptField(pendingEncrypted);
      if (!pendingSecret) {
        return res.status(400).json({ message: "Aucune configuration en cours. Recommencez la configuration." });
      }
      const rateCheck = checkOtpRateLimit(req.userId!);
      if (!rateCheck.allowed) {
        return res.status(429).json({
          message: `Trop de tentatives. Réessayez dans ${Math.ceil((rateCheck.retryAfter ?? 900) / 60)} minute(s).`,
          retryAfter: rateCheck.retryAfter,
        });
      }
      const { TOTP, Secret } = await import("otpauth");
      const totp = new TOTP({
        issuer: "AshTech Pay Admin",
        label: user.email || user.username,
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        secret: Secret.fromBase32(pendingSecret),
      });
      const delta = totp.validate({ token: code.trim(), window: 1 });
      if (delta === null) {
        recordOtpFailure(req.userId!);
        return res.status(400).json({ message: "Code incorrect. Vérifiez l'heure de votre appareil et réessayez." });
      }
      clearOtpFailures(req.userId!);
      // Activate only after the new secret has produced a valid TOTP code.
      const encryptedSecret = pendingEncrypted;
      await storage.updateUser(req.userId!, { totpSecret: encryptedSecret, totpEnabled: true });
      delete req.session._totpPendingSecret;
      await new Promise<void>((resolve, reject) => req.session.save((err) => err ? reject(err) : resolve()));
      storage.createAdminLog({
        adminId: req.userId!,
        action: "totp_enabled",
        targetType: "user",
        targetId: req.userId!,
        details: "TOTP (Google Authenticator) activé",
        ipAddress: req.ip || null,
      }).catch(() => {});
      console.log(`[AdminTOTP] TOTP activé pour ${user.email}`);
      res.json({ success: true, requiresRelogin: true });
      // Changing the authenticator invalidates every previous admin session and
      // bearer token. The next login must prove possession of the new secret.
      destroyUserSessions(req.userId!, Date.now()).catch(() => {});
    } catch (err: any) {
      console.error("[AdminTOTP] Confirm error:", err?.message);
      res.status(500).json({ message: "Erreur lors de l'activation du TOTP" });
    }
  });

  // POST /api/admin/totp/verify — verify TOTP code during login (sets admin session)
  app.post("/api/admin/totp/verify", requireAuth, adminActionLimiter, async (req, res) => {
    try {
      const user = await storage.getUser(req.userId!);
      if (!user || !["admin"].includes(user.role)) {
        return res.status(403).json({ message: "Accès refusé" });
      }
      if (!user.totpEnabled || !user.totpSecret) {
        return res.status(400).json({ message: "TOTP non configuré pour ce compte" });
      }
      const rateCheck = checkOtpRateLimit(req.userId!);
      if (!rateCheck.allowed) {
        return res.status(429).json({
          message: `Trop de tentatives. Réessayez dans ${Math.ceil((rateCheck.retryAfter ?? 900) / 60)} minute(s).`,
          retryAfter: rateCheck.retryAfter,
        });
      }
      const { code } = req.body as { code: string };
      if (!code || typeof code !== "string" || !/^\d{6}$/.test(code.trim())) {
        return res.status(400).json({ message: "Code à 6 chiffres requis" });
      }
      const { TOTP, Secret } = await import("otpauth");
      const { decryptField } = await import("./fieldEncryption");
      const plainSecret = decryptField(user.totpSecret);
      if (!plainSecret) {
        return res.status(500).json({ message: "Erreur de configuration TOTP. Contactez le support." });
      }
      const totp = new TOTP({
        issuer: "AshTech Pay Admin",
        label: user.email || user.username,
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        secret: Secret.fromBase32(plainSecret),
      });
      const delta = totp.validate({ token: code.trim(), window: 1 });
      if (delta === null) {
        recordOtpFailure(req.userId!);
        const remaining = OTP_MAX_ATTEMPTS - (otpAttempts.get(req.userId!)?.count ?? OTP_MAX_ATTEMPTS);
        return res.status(400).json({
          message: remaining > 0
            ? `Code incorrect. ${remaining} tentative(s) restante(s).`
            : "Code incorrect. Compte temporairement verrouillé.",
        });
      }
      clearOtpFailures(req.userId!);
      const expiresAt = Date.now() + ADMIN_OTP_SESSION_TTL_MS;
      const totpVerifyIp = getClientIp(req);
      adminVerifiedSessions.set(req.sessionID, { userId: req.userId!, expiresAt, ip: totpVerifyIp });
      req.session._avs = expiresAt;
      req.session._avsIp = totpVerifyIp;
      delete req.session._pav;
      delete req.session._ppv;
      delete req.session._ppvIp;
      await new Promise<void>((resolve) => req.session.save((err) => {
        if (err) console.error("[AdminTOTP] Session save warning:", err?.message);
        resolve();
      }));
      const ip = totpVerifyIp;
      storage.createAdminLog({
        adminId: req.userId!,
        action: "totp_verified",
        targetType: "user",
        targetId: req.userId!,
        details: `Authentification TOTP réussie depuis IP ${ip}`,
        ipAddress: req.ip || null,
      }).catch(() => {});
      notifyAdminLoginSuccess({ adminName: user.fullName || user.username, adminEmail: user.email || "", ip }).catch(() => {});
      console.log(`[AdminTOTP] Admin ${user.email?.replace(/(.{2}).+(@.+)/, "$1***$2")} vérifié (TOTP) depuis ${ip}`);
      res.json({ success: true });
    } catch (err: any) {
      console.error("[AdminTOTP] Verify error:", err?.message);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // POST /api/admin/totp/disable — disable TOTP (requires current valid TOTP code)
  // Note: requireAdmin is intentionally NOT used here — the TOTP code itself is the proof of ownership.
  // requireAdmin would block on PM2 multi-worker when session isn't found on the current worker.
  app.post("/api/admin/totp/disable", requireAuth, adminActionLimiter, async (req, res) => {
    try {
      const user = await storage.getUser(req.userId!);
      if (!user || !["admin"].includes(user.role)) {
        return res.status(403).json({ message: "Accès refusé" });
      }
      if (!user.totpEnabled || !user.totpSecret) {
        return res.status(400).json({ message: "TOTP non activé" });
      }
      const { code } = req.body as { code: string };
      if (!code || !/^\d{6}$/.test(code.trim())) {
        return res.status(400).json({ message: "Code TOTP requis pour désactiver" });
      }
      const rateCheck = checkOtpRateLimit(req.userId!);
      if (!rateCheck.allowed) {
        return res.status(429).json({
          message: `Trop de tentatives. Réessayez dans ${Math.ceil((rateCheck.retryAfter ?? 900) / 60)} minute(s).`,
          retryAfter: rateCheck.retryAfter,
        });
      }
      const { TOTP, Secret } = await import("otpauth");
      const { decryptField } = await import("./fieldEncryption");
      const plainSecret = decryptField(user.totpSecret);
      if (!plainSecret) return res.status(500).json({ message: "Erreur de configuration TOTP" });
      const totp = new TOTP({
        issuer: "AshTech Pay Admin",
        label: user.email || user.username,
        algorithm: "SHA1", digits: 6, period: 30,
        secret: Secret.fromBase32(plainSecret),
      });
      if (totp.validate({ token: code.trim(), window: 1 }) === null) {
        recordOtpFailure(req.userId!);
        return res.status(400).json({ message: "Code TOTP incorrect" });
      }
      clearOtpFailures(req.userId!);
      await storage.updateUser(req.userId!, { totpSecret: null, totpEnabled: false });
      delete req.session._totpPendingSecret;
      delete req.session._avs;
      delete req.session._avsIp;
      delete req.session._pav;
      delete req.session._ppv;
      delete req.session._ppvIp;
      adminVerifiedSessions.delete(req.sessionID);
      await new Promise<void>((resolve, reject) => req.session.save((err) => err ? reject(err) : resolve()));
      storage.createAdminLog({
        adminId: req.userId!,
        action: "totp_disabled",
        targetType: "user",
        targetId: req.userId!,
        details: "TOTP désactivé",
        ipAddress: req.ip || null,
      }).catch(() => {});
      res.json({ success: true, requiresRelogin: true });
      // Disabling TOTP invalidates all existing admin sessions and bearer
      // tokens; an account without an active authenticator cannot enter admin.
      destroyUserSessions(req.userId!, Date.now()).catch(() => {});
    } catch (err: any) {
      console.error("[AdminTOTP] Disable error:", err?.message);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Get dashboard stats
  app.get("/api/admin/stats", requireAuth, requireAdmin, async (req, res) => {
    try {
      const period = (req.query.period as string) || "this_month";
      const validPeriods = ["last_year", "this_year", "last_month", "this_month", "last_week", "this_week", "yesterday", "today"];
      const validPeriod = validPeriods.includes(period) ? period : "this_month";
      const stats = await storage.getAdminStats(validPeriod);
      res.json(stats);
    } catch (error) {
      console.error("Admin stats error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Volume par pays
  app.get("/api/admin/stats/by-country", requireAuth, requireAdmin, async (req, res) => {
    try {
      const period = typeof req.query.period === "string" ? req.query.period : "this_month";
      const result = await storage.getStatsByCountry(period);
      res.json(result);
    } catch (error) {
      console.error("Stats by country error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Activité récente (30 derniers jours)
  app.get("/api/admin/stats/activity", requireAuth, requireAdmin, async (req, res) => {
    try {
      const period = typeof req.query.period === "string" ? req.query.period : "this_month";
      const result = await storage.getStatsActivity(period);
      res.json(result);
    } catch (error) {
      console.error("Stats activity error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Reset stats (store current timestamp as reset baseline)
  app.post("/api/admin/reset-stats", requireAuth, requireAdmin, async (req, res) => {
    try {
      await storage.resetStats();
      res.json({ message: "Statistiques réinitialisées avec succès" });
    } catch (error) {
      console.error("Reset stats error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Total balances across all user wallets
  app.get("/api/admin/stats/total-balances", requireAuth, requireAdmin, async (req, res) => {
    try {
      const fxRates = await loadFxRates();

      // 1. Sum primary wallets (users.balance grouped by preferredCurrency)
      const primaryRows = await db
        .select({
          currency: usersTable.preferredCurrency,
          total: drizzleSql<string>`COALESCE(SUM(${usersTable.balance}::numeric), 0)`,
        })
        .from(usersTable)
        .where(drizzleSql`${usersTable.balance}::numeric > 0`)
        .groupBy(usersTable.preferredCurrency);

      // 2. Sum secondary wallets (wallets table grouped by currency)
      const secondaryRows = await db
        .select({
          currency: walletsTable.currency,
          total: drizzleSql<string>`COALESCE(SUM(${walletsTable.balance}::numeric), 0)`,
        })
        .from(walletsTable)
        .where(drizzleSql`${walletsTable.balance}::numeric > 0`)
        .groupBy(walletsTable.currency);

      // 3. Merge into a single map: currency → total
      const byCurrency: Record<string, number> = {};
      for (const row of [...primaryRows, ...secondaryRows]) {
        const amt = parseFloat(row.total) || 0;
        if (amt > 0) byCurrency[row.currency] = (byCurrency[row.currency] || 0) + amt;
      }

      // 4. Convert each currency total to XAF
      let totalXAF = 0;
      const breakdown = Object.entries(byCurrency).map(([currency, amount]) => {
        const inXAF = convertToXAF(amount, currency, fxRates);
        totalXAF += inXAF;
        return { currency, amount: amount.toFixed(2), amountXAF: Math.round(inXAF) };
      }).sort((a, b) => b.amountXAF - a.amountXAF);

      res.json({ totalXAF: Math.round(totalXAF), breakdown });
    } catch (error) {
      console.error("Total balances error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Combined layout stats (replaces 7 separate polling requests)
  app.get("/api/admin/layout-stats", requireAuth, requireAdmin, async (req, res) => {
    try {
      const stats = await (storage as any).getAdminLayoutStats();
      res.json(stats);
    } catch (error) {
      console.error("Admin layout stats error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Get pending notifications
  app.get("/api/admin/notifications", requireAuth, requireAdmin, async (req, res) => {
    try {
      const notifications = await storage.getPendingNotifications();
      res.json(notifications);
    } catch (error) {
      console.error("Admin notifications error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Fix user currencies based on country
  app.post("/api/admin/fix-currencies", requireAuth, requireAdmin, async (req, res) => {
    try {
      const usersResult = await storage.getAllUsers();
      let updatedCount = 0;

      for (const user of usersResult) {
        const country = user.country?.trim();
        if (country && COUNTRY_CURRENCIES[country]) {
          const localCurrency = COUNTRY_CURRENCIES[country];
          if (user.preferredCurrency !== localCurrency) {
            await storage.updateUserCurrency(user.id, localCurrency as any);
            // Also notify the user about the currency synchronization
            try {
              const notificationData = {
                userId: user.id,
                type: "admin_message" as const,
                title: "Devise synchronisée",
                message: `Votre devise principale a été synchronisée avec votre devise locale (${localCurrency}).`,
                isRead: false
              };

              const storageAny = storage as any;
              if (typeof storageAny.createUserNotification === 'function') {
                await storageAny.createUserNotification(notificationData);
              } else if (typeof storageAny.createNotification === 'function') {
                await storageAny.createNotification(notificationData);
              }
            } catch (e) {
              console.warn("Could not send notification to user", user.id);
            }
            updatedCount++;
          }
        }
      }

      res.json({ message: `Mise à jour de ${updatedCount} utilisateurs terminée.`, count: updatedCount });
    } catch (error: any) {
      console.error("Fix currencies error:", error);
      res.status(500).json({ message: error.message || "Erreur serveur" });
    }
  });

  app.get("/api/admin/users/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const user = await storage.getUser(id);
      if (!user) return res.status(404).json({ message: "Utilisateur introuvable" });
      const fxRates = await loadFxRates();
      const wallets = await storage.getWalletsByUserIds([id]);
      const { password, ...safeUser } = user as any;
      const primaryCurrency = safeUser.preferredCurrency || "XAF";
      const primaryXAF = convertToXAF(parseFloat(safeUser.balance) || 0, primaryCurrency, fxRates);
      const secondaryWallets = wallets.filter((w: any) => w.currency !== primaryCurrency);
      const secondaryXAF = secondaryWallets.reduce((sum: number, w: any) => sum + convertToXAF(parseFloat(w.balance) || 0, w.currency, fxRates), 0);
      return res.json({ ...safeUser, totalBalanceXAF: Math.round(primaryXAF + secondaryXAF) });
    } catch (error) {
      console.error("Admin get user by id error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.get("/api/admin/users", requireAuth, requireAdmin, async (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, parseInt(req.query.limit as string) || 50);
      const search = (req.query.search as string) || "";
      const offset = (page - 1) * limit;

      const filter = (req.query.filter as string) || "";
      const fxRates = await loadFxRates();

      // Special case: "has_balance" — fetch all users, compute total XAF (all wallets), filter & sort in memory
      if (filter === "has_balance") {
        const { data: allData } = await storage.getAdminUsersPaginated({ limit: 9999, offset: 0, search: search || undefined });
        const allIds = allData.map(u => u.id);
        const allWallets2 = allIds.length > 0 ? await storage.getWalletsByUserIds(allIds) : [];
        const walletsByUser2 = new Map<string, { currency: string; balance: string }[]>();
        for (const w of allWallets2) {
          if (!walletsByUser2.has(w.userId)) walletsByUser2.set(w.userId, []);
          walletsByUser2.get(w.userId)!.push({ currency: w.currency, balance: w.balance });
        }
        const withTotals = allData
          .map(({ password, ...u }) => {
            const pc = u.preferredCurrency || "XAF";
            const pXAF = convertToXAF(parseFloat(u.balance) || 0, pc, fxRates);
            const sXAF = (walletsByUser2.get(u.id) || [])
              .filter(w => w.currency !== pc)
              .reduce((s, w) => s + convertToXAF(parseFloat(w.balance) || 0, w.currency, fxRates), 0);
            return { ...u, totalBalanceXAF: Math.round(pXAF + sXAF) };
          })
          .filter(u => u.totalBalanceXAF > 0)
          .sort((a, b) => b.totalBalanceXAF - a.totalBalanceXAF);

        const pagedData = withTotals.slice(offset, offset + limit);
        const total2 = withTotals.length;
        return res.json({ data: pagedData, total: total2, page, limit, pages: Math.ceil(total2 / limit) });
      }

      const { data, total } = await storage.getAdminUsersPaginated({ limit, offset, search: search || undefined, filter: filter || undefined });

      // Batch-fetch all secondary wallets for these users in one query
      const userIds = data.map(u => u.id);
      const allWallets = userIds.length > 0 ? await storage.getWalletsByUserIds(userIds) : [];

      // Group wallets by userId
      const walletsByUser = new Map<string, { currency: string; balance: string }[]>();
      for (const w of allWallets) {
        if (!walletsByUser.has(w.userId)) walletsByUser.set(w.userId, []);
        walletsByUser.get(w.userId)!.push({ currency: w.currency, balance: w.balance });
      }

      const safeUsers = data.map(({ password, ...u }) => {
        const primaryCurrency = u.preferredCurrency || "XAF";
        const primaryXAF = convertToXAF(parseFloat(u.balance) || 0, primaryCurrency, fxRates);
        const secondaryWallets = (walletsByUser.get(u.id) || []).filter(w => w.currency !== primaryCurrency);
        const secondaryXAF = secondaryWallets.reduce((sum, w) => sum + convertToXAF(parseFloat(w.balance) || 0, w.currency, fxRates), 0);
        return { ...u, totalBalanceXAF: Math.round(primaryXAF + secondaryXAF) };
      });

      res.json({ data: safeUsers, total, page, limit, pages: Math.ceil(total / limit) });
    } catch (error) {
      console.error("Admin get users error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Update user balance
  // Security: every mutation is fully audited (before/after), creates a compensating
  // transaction record, and requires a mandatory justification reason.
  app.patch("/api/admin/users/:id/balance", requireAuth, requireAdmin, adminActionLimiter, async (req, res) => {
    try {
      const { amount, currency, type, reason } = req.body; // type: 'set' | 'add'
      const userId = req.params.id;


      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "Utilisateur non trouvé" });

      const amountNum = parseFloat(amount);
      if (isNaN(amountNum)) return res.status(400).json({ message: "Montant invalide" });

      // ── Sanity bounds: no negative balance set, cap per-operation at 50 000 000 (50M)
      const MAX_BALANCE_OP = 50_000_000;
      if (type === "set" && amountNum < 0) {
        return res.status(400).json({ message: "Le solde ne peut pas être négatif." });
      }
      if (Math.abs(amountNum) > MAX_BALANCE_OP) {
        return res.status(400).json({ message: `Montant dépasse la limite par opération (${MAX_BALANCE_OP.toLocaleString()}).` });
      }

      const effectiveCurrency = currency || user.preferredCurrency || "XAF";
      const isPrimary = effectiveCurrency === (user.preferredCurrency || "XAF");

      // ── Capture BEFORE values for audit trail
      const balanceBefore = isPrimary
        ? parseFloat(user.balance ?? "0")
        : parseFloat((await storage.getUserWallets(userId)).find(w => w.currency === effectiveCurrency)?.balance ?? "0");

      let balanceAfter: number;

      if (isPrimary) {
        let updated: any;
        if (type === "set") {
          updated = await storage.updateUser(userId, { balance: amountNum.toFixed(2) });
          balanceAfter = amountNum;
        } else {
          updated = await storage.updateUserBalance(userId, amountNum);
          balanceAfter = balanceBefore + amountNum;
        }
        if (!updated) return res.status(500).json({ message: "Mise à jour échouée" });
        const safeUser = (({ password: _pw, ...rest }) => rest)(updated as any);

        // ── Compensating transaction record — full audit trail in transactions table
        const delta = type === "set" ? (amountNum - balanceBefore) : amountNum;
        await storage.createTransaction({
          userId,
          type: delta >= 0 ? "admin_credit" : "admin_debit",
          amount: Math.abs(delta).toFixed(2),
          currency: effectiveCurrency,
          status: "completed",
          description: `[Admin] ${(reason || "").trim()} (${type === "set" ? "Solde défini" : "Ajustement"}: ${balanceBefore.toFixed(2)} → ${Math.max(0, balanceAfter).toFixed(2)} ${effectiveCurrency})`,
          reference: `ADMIN-${Date.now()}`,
          confirmedAt: new Date(),
        });

        // ── Admin log with before/after
        const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
        try {
          await storage.createAdminLog({
            adminId: req.userId!,
            action: "balance_update",
            targetType: "user",
            targetId: userId,
            details: JSON.stringify({
              currency: effectiveCurrency,
              type,
              before: balanceBefore,
              after: Math.max(0, balanceAfter),
              delta: parseFloat(delta.toFixed(2)),
              reason: (reason || "").trim(),
              ip,
            }),
            ipAddress: ip,
          });
        } catch (logErr: any) {
          console.error("[BalanceUpdate] Admin log failed (non-fatal):", logErr?.message);
        }

        return res.json({ success: true, user: safeUser });
      } else {
        let wallet: any;
        if (type === "set") {
          wallet = await storage.setWalletBalance(userId, effectiveCurrency, amountNum);
          balanceAfter = amountNum;
        } else {
          wallet = await storage.upsertWallet(userId, effectiveCurrency, amountNum);
          balanceAfter = balanceBefore + amountNum;
        }

        const delta = type === "set" ? (amountNum - balanceBefore) : amountNum;
        await storage.createTransaction({
          userId,
          type: delta >= 0 ? "admin_credit" : "admin_debit",
          amount: Math.abs(delta).toFixed(2),
          currency: effectiveCurrency,
          status: "completed",
          description: `[Admin] ${(reason || "").trim()} (${type === "set" ? "Solde défini" : "Ajustement"}: ${balanceBefore.toFixed(2)} → ${Math.max(0, balanceAfter).toFixed(2)} ${effectiveCurrency})`,
          reference: `ADMIN-${Date.now()}`,
          confirmedAt: new Date(),
        });

        const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
        try {
          await storage.createAdminLog({
            adminId: req.userId!,
            action: "balance_update",
            targetType: "wallet",
            targetId: userId,
            details: JSON.stringify({
              currency: effectiveCurrency,
              type,
              before: balanceBefore,
              after: Math.max(0, balanceAfter),
              delta: parseFloat(delta.toFixed(2)),
              reason: (reason || "").trim(),
              ip,
            }),
            ipAddress: ip,
          });
        } catch (logErr: any) {
          console.error("[BalanceUpdate] Admin log failed (non-fatal):", logErr?.message);
        }

        return res.json({ success: true, wallet });
      }
    } catch (error) {
      console.error("Update balance error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Get all wallets for a user
  app.get("/api/admin/users/:id/wallets", requireAuth, requireAdmin, async (req, res) => {
    try {
      const rawWallets = await storage.getUserWallets(req.params.id);
      // Deduplicate by currency — merge duplicates by summing balances
      const merged = new Map<string, typeof rawWallets[0]>();
      for (const w of rawWallets) {
        if (merged.has(w.currency)) {
          const existing = merged.get(w.currency)!;
          merged.set(w.currency, {
            ...existing,
            balance: (parseFloat(existing.balance) + parseFloat(w.balance)).toFixed(2),
          });
        } else {
          merged.set(w.currency, { ...w });
        }
      }
      res.json(Array.from(merged.values()));
    } catch (error) {
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Update user (profile/metadata fields only)
  // Security: financial fields (balance) and security-critical fields (role, password)
  // are explicitly stripped — they have dedicated hardened endpoints.
  app.patch("/api/admin/users/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;

      // ── STRICT WHITELIST (CWE-20): only these fields can be updated via this endpoint.
      // Any field not listed here is silently ignored, regardless of what is sent.
      // Sensitive fields have their own dedicated, audited endpoints:
      //   balance           → PATCH /api/admin/users/:id/balance
      //   role              → PATCH /api/admin/users/:id/role
      //   isBanned          → POST  /api/admin/users/:id/ban|unban
      //   withdrawalBlocked → POST  /api/admin/users/:id/block-withdrawal|unblock-withdrawal
      //   password/totp*    → never via generic patch
      //   apiKey/apiKeyHash  → never via generic patch
      const ALLOWED_USER_FIELDS = [
        "fullName", "email", "phone", "country", "preferredCurrency",
        "isVerified", "kycStatus", "banReason", "withdrawalBlockReason",
        "apiEnabled",
      ] as const;

      const updates: Record<string, unknown> = {};
      for (const field of ALLOWED_USER_FIELDS) {
        if (req.body[field] !== undefined) updates[field] = req.body[field];
      }
      // Sanitize text fields to strip HTML tags (XSS prevention)
      for (const textField of ["fullName", "banReason", "withdrawalBlockReason"] as const) {
        if (typeof updates[textField] === "string") {
          updates[textField] = (updates[textField] as string).replace(/<[^>]*>/g, "").trim();
        }
      }
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: "Aucun champ modifiable fourni." });
      }

      const user = await storage.updateUser(id, updates);
      if (!user) {
        return res.status(404).json({ message: "Utilisateur non trouvé" });
      }
      const { password, ...safeUser } = user;

      await storage.createAdminLog({
        adminId: req.userId!,
        action: "update_user",
        targetType: "user",
        targetId: id,
        details: JSON.stringify(updates),
        ipAddress: req.ip || null,
      });

      res.json(safeUser);
    } catch (error) {
      console.error("Admin update user error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Change user role
  app.patch("/api/admin/users/:id/role", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { role } = req.body;
      const allowedRoles = ["user", "admin"];
      if (!role || !allowedRoles.includes(role)) {
        return res.status(400).json({ message: `Rôle invalide. Valeurs acceptées : ${allowedRoles.join(", ")}` });
      }
      // Only ashtechpay@gmail.com can promote someone to admin
      if (role === "admin") {
        const requestingAdmin = await storage.getUser(req.userId!).catch(() => null);
        const SUPER_ADMIN_EMAIL = "ashtechpay@gmail.com";
        if (!requestingAdmin || requestingAdmin.email?.toLowerCase() !== SUPER_ADMIN_EMAIL) {
          console.warn(`[AdminAccess] ROLE PROMOTION BLOCKED — ${requestingAdmin?.email} tried to promote user ${id} to admin`);
          await storage.createAdminLog({
            adminId: req.userId!,
            action: "role_promotion_blocked",
            targetType: "user",
            targetId: id,
            details: JSON.stringify({ attemptedRole: "admin", blockedEmail: requestingAdmin?.email }),
            ipAddress: req.ip || null,
          }).catch(() => {});
          return res.status(403).json({ message: "Seul le super-administrateur peut promouvoir un utilisateur au rang d'admin." });
        }
      }
      const user = await storage.updateUser(id, { role });
      if (!user) {
        return res.status(404).json({ message: "Utilisateur non trouvé" });
      }
      await storage.createAdminLog({
        adminId: req.userId!,
        action: "change_role",
        targetType: "user",
        targetId: id,
        details: JSON.stringify({ role }),
        ipAddress: req.ip || null,
      });
      // Récupérer info admin + utilisateur cible pour la notif
      const roleAdmin = await storage.getUser(req.userId!).catch(() => null);
      audit(req, AUDIT.ROLE_CHANGED, {
        userId: req.userId!,
        userName: roleAdmin ? (roleAdmin.fullName || roleAdmin.username) : undefined,
        userEmail: roleAdmin?.email || undefined,
        actorType: "admin",
        targetType: "user",
        targetId: id,
        details: {
          newRole: role,
          targetUserId: id,
          targetUserEmail: user.email || undefined,
          targetUserName: user.fullName || user.username,
        },
      });
      const { password, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      console.error("Admin change role error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Ban user
  app.post("/api/admin/users/:id/ban", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const user = await storage.banUser(id, reason || "Violation des conditions d'utilisation");
      if (!user) {
        return res.status(404).json({ message: "Utilisateur non trouvé" });
      }
      
      await storage.createAdminLog({
        adminId: req.userId!,
        action: "ban_user",
        targetType: "user",
        targetId: id,
        details: JSON.stringify({ reason }),
        ipAddress: req.ip || null,
      });
      const banAdmin = await storage.getUser(req.userId!).catch(() => null);
      audit(req, AUDIT.USER_BANNED, {
        userId: req.userId!,
        userName: banAdmin ? (banAdmin.fullName || banAdmin.username) : undefined,
        userEmail: banAdmin?.email || undefined,
        actorType: "admin",
        targetType: "user",
        targetId: id,
        details: {
          reason,
          targetUserId: id,
          targetUserEmail: user.email || undefined,
          targetUserName: user.fullName || user.username,
        },
      });
      const { password, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      console.error("Admin ban user error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Unban user
  app.post("/api/admin/users/:id/unban", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const user = await storage.unbanUser(id);
      if (!user) {
        return res.status(404).json({ message: "Utilisateur non trouvé" });
      }
      
      await storage.createAdminLog({
        adminId: req.userId!,
        action: "unban_user",
        targetType: "user",
        targetId: id,
        ipAddress: req.ip || null,
      });
      const unbanAdmin = await storage.getUser(req.userId!).catch(() => null);
      audit(req, AUDIT.USER_UNBANNED, {
        userId: req.userId!,
        userName: unbanAdmin ? (unbanAdmin.fullName || unbanAdmin.username) : undefined,
        userEmail: unbanAdmin?.email || undefined,
        actorType: "admin",
        targetType: "user",
        targetId: id,
        details: {
          targetUserId: id,
          targetUserEmail: user.email || undefined,
          targetUserName: user.fullName || user.username,
        },
      });
      const { password, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      console.error("Admin unban user error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Block user withdrawals & transfers
  app.post("/api/admin/users/:id/block-withdrawal", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const user = await storage.updateUser(id, {
        withdrawalBlocked: true,
        withdrawalBlockReason: reason || "Retrait et envoi bloqués par l'administration.",
      });
      if (!user) return res.status(404).json({ message: "Utilisateur non trouvé" });
      await storage.createAdminLog({
        adminId: req.userId!,
        action: "block_withdrawal",
        targetType: "user",
        targetId: id,
        details: JSON.stringify({ reason }),
        ipAddress: req.ip || null,
      });
      const { password, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      console.error("Admin block withdrawal error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Unblock user withdrawals & transfers
  app.post("/api/admin/users/:id/unblock-withdrawal", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const user = await storage.updateUser(id, {
        withdrawalBlocked: false,
        withdrawalBlockReason: null,
      });
      if (!user) return res.status(404).json({ message: "Utilisateur non trouvé" });
      await storage.createAdminLog({
        adminId: req.userId!,
        action: "unblock_withdrawal",
        targetType: "user",
        targetId: id,
        ipAddress: req.ip || null,
      });
      const { password, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      console.error("Admin unblock withdrawal error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Impersonate user — se connecter en tant qu'utilisateur
  app.post("/api/admin/users/:id/impersonate", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const adminId = req.userId!;

      if (id === adminId) {
        return res.status(400).json({ message: "Vous êtes déjà connecté avec ce compte." });
      }

      const targetUser = await storage.getUser(id);
      if (!targetUser) return res.status(404).json({ message: "Utilisateur non trouvé" });

      await storage.createAdminLog({
        adminId,
        action: "impersonate",
        targetType: "user",
        targetId: id,
        details: JSON.stringify({ targetUsername: targetUser.username }),
        ipAddress: req.ip || null,
      });

      req.session.impersonatedBy = adminId;
      req.session.userId = id;

      req.session.save((err) => {
        if (err) console.error("[Impersonate] Session save error:", err);
        res.json({ ok: true, userId: id, adminId, username: targetUser.username });
      });
    } catch (error) {
      console.error("Admin impersonate error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Exit impersonation — revenir à son propre compte admin
  app.post("/api/admin/impersonate/exit", requireAuth, async (req, res) => {
    try {
      const originalAdminId = req.session.impersonatedBy;
      // SECURITY: impersonatedBy must be set in session (only set by /api/admin/users/:id/impersonate
      // which itself requires requireAdmin). A regular user can never have this set.
      if (!originalAdminId) {
        return res.status(403).json({ message: "Vous n'êtes pas en mode impersonation." });
      }

      // SECURITY: verify the original admin still exists and STILL has admin role
      // (role could have been downgraded while impersonation was active)
      const admin = await storage.getUser(originalAdminId);
      if (!admin) {
        req.session.destroy(() => {});
        return res.status(404).json({ message: "Compte admin introuvable — session fermée." });
      }
      if (!["admin"].includes(admin.role)) {
        req.session.destroy(() => {});
        return res.status(403).json({ message: "Accès refusé — droits admin révoqués. Session fermée." });
      }
      if (admin.isBanned) {
        req.session.destroy(() => {});
        return res.status(403).json({ message: "Compte admin banni. Session fermée." });
      }

      req.session.userId = originalAdminId;
      req.session.impersonatedBy = undefined;

      // Generate a new token for the admin so Bearer auth is restored
      const adminToken = storeAuthToken(originalAdminId);

      req.session.save((err) => {
        if (err) console.error("[ExitImpersonate] Session save error:", err);
        res.json({ ok: true, adminId: originalAdminId, username: admin.username, token: adminToken });
      });
    } catch (error) {
      console.error("Exit impersonation error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Force-logout a specific user (terminate all their sessions immediately)
  app.post("/api/admin/users/:id/force-logout", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const adminId = req.userId!;

      const targetUser = await storage.getUser(id);
      if (!targetUser) return res.status(404).json({ message: "Utilisateur non trouvé" });

      if (id === adminId) {
        return res.status(400).json({ message: "Vous ne pouvez pas vous déconnecter vous-même depuis ici." });
      }

      await destroyUserSessions(id, Date.now() + 30 * 60 * 1000);

      await storage.createAdminLog({
        adminId,
        action: "force_logout_user",
        targetType: "user",
        targetId: id,
        details: JSON.stringify({ targetEmail: targetUser.email, targetUsername: targetUser.username, reason: "admin_security_action" }),
        ipAddress: req.ip || null,
      });

      console.log(`[Security] Admin ${adminId} a forcé la déconnexion de l'utilisateur ${id} (${targetUser.email || targetUser.username})`);

      res.json({ ok: true, message: `${targetUser.fullName || targetUser.username} a été déconnecté de tous ses appareils.` });
    } catch (error) {
      console.error("Admin force-logout error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Find user by email (for security actions)
  app.get("/api/admin/users/by-email", requireAuth, requireAdmin, async (req, res) => {
    try {
      const email = String(req.query.email || "").trim().toLowerCase();
      if (!email) return res.status(400).json({ message: "Email requis" });
      const user = await storage.getUserByEmailOrPhone(email);
      if (!user) return res.status(404).json({ message: "Aucun utilisateur trouvé avec cet email" });
      res.json({ id: user.id, username: user.username, fullName: user.fullName, email: user.email, role: user.role, isBanned: user.isBanned });
    } catch (error) {
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Delete user
  app.delete("/api/admin/users/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ message: "Utilisateur non trouvé" });
      }
      
      await storage.deleteUser(id);
      
      await storage.createAdminLog({
        adminId: req.userId!,
        action: "delete_user",
        targetType: "user",
        targetId: id,
        details: JSON.stringify({ username: user.username, email: user.email }),
        ipAddress: req.ip || null,
      });
      
      res.json({ message: "Utilisateur supprimé avec succès" });
    } catch (error) {
      console.error("Admin delete user error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Get all transactions with user info
  app.get("/api/admin/transactions", requireAuth, requireAdmin, async (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, parseInt(req.query.limit as string) || 50);
      const type = (req.query.type as string) || "all";
      const status = (req.query.status as string) || "all";
      const userId = (req.query.userId as string) || undefined;
      const offset = (page - 1) * limit;

      const search = (req.query.search as string) || undefined;
      const typeList = type !== "all" ? type.split(",").map(t => t.trim()).filter(Boolean) : [];
      const { data: txList, total } = await (storage as any).getAdminTransactionsPaginated({
        limit, offset,
        types: typeList.length > 0 ? typeList : undefined,
        status: status !== "all" ? status : undefined,
        userId,
        search,
      });

      // Batch user lookup — one query for all unique user IDs (no N+1)
      const userIds = [...new Set(txList.map((tx: any) => tx.userId))];
      const userMap = await (storage as any).getUsersByIds(userIds);

      // Batch paymentIntent lookup for payment_link transactions to get payer phone
      const intentIds = txList
        .filter((tx: any) => tx.paymentIntentId)
        .map((tx: any) => tx.paymentIntentId as string);
      const intentMap = await (storage as any).getPaymentIntentsByIds(intentIds);

      const enriched = txList.map((tx: any) => {
        const u = userMap.get(tx.userId);
        const intent = tx.paymentIntentId ? intentMap.get(tx.paymentIntentId) : null;
        return {
          ...tx,
          user: u ? { fullName: u.fullName, email: u.email, username: u.username, phone: u.phone } : null,
          payerPhone: intent?.payerPhone ?? null,
        };
      });

      res.json({ data: enriched, total, page, limit, pages: Math.ceil(total / limit) });
    } catch (error) {
      console.error("Admin get transactions error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Get transaction details by ID
  app.get("/api/admin/transactions/:id/details", requireAuth, requireAdmin, async (req, res) => {
    try {
      const transaction = await storage.getTransactionById(req.params.id);
      if (!transaction) {
        return res.status(404).json({ message: "Transaction non trouvée" });
      }
      
      // Get user info
      const user = await storage.getUser(transaction.userId);
      
      // Get additional context
      let paymentLink = null;
      let paymentIntent = null;
      let recipient = null;
      let operator = null;
      
      if (transaction.paymentLinkId) {
        paymentLink = await storage.getPaymentLinkById(transaction.paymentLinkId);
      }
      
      if (transaction.paymentIntentId) {
        paymentIntent = await storage.getPaymentIntentById(transaction.paymentIntentId);
      }
      
      if (transaction.recipientId) {
        const recipientUser = await storage.getUser(transaction.recipientId);
        recipient = recipientUser ? { 
          fullName: recipientUser.fullName, 
          email: recipientUser.email,
          username: recipientUser.username,
          country: recipientUser.country
        } : null;
      }

      if (transaction.operatorId) {
        const operatorData = await storage.getOperator(transaction.operatorId);
        operator = operatorData ? { 
          id: operatorData.id,
          name: operatorData.name,
          type: operatorData.type,
          paymentProvider: operatorData.paymentProvider,
          depositPaymentProvider: (operatorData as any).depositPaymentProvider || null,
        } : null;
      }

      const userWallets = await storage.getUserWallets(transaction.userId);
      const snapshots = user
        ? buildTransactionBalanceSnapshots(
            await storage.getTransactionsByUserId(transaction.userId),
            user.preferredCurrency || "XAF",
            parseFloat(user.balance || "0"),
            userWallets,
          )
        : new Map();
      
      res.json({
        ...transaction,
        ...(snapshots.get(transaction.id) || {}),
        user: user ? { 
          fullName: user.fullName, 
          email: user.email, 
          username: user.username,
          country: user.country,
          phone: user.phone
        } : null,
        paymentLink: paymentLink ? { title: paymentLink.title, slug: paymentLink.slug } : null,
        paymentIntent,
        recipient,
        operator,
      });
    } catch (error) {
      console.error("Admin get transaction details error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Search transaction by reference
  app.get("/api/admin/transactions/reference/:reference", requireAuth, requireAdmin, async (req, res) => {
    try {
      const transaction = await storage.getTransactionByReference(req.params.reference);
      if (!transaction) {
        return res.status(404).json({ message: "Transaction non trouvée" });
      }
      
      const user = await storage.getUser(transaction.userId);
      res.json({
        ...transaction,
        user: user ? { fullName: user.fullName, email: user.email, username: user.username } : null,
      });
    } catch (error) {
      console.error("Admin get transaction by reference error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Update transaction status
  app.patch("/api/admin/transactions/:id", requireAuth, requireAdmin, adminActionLimiter, async (req, res) => {
    try {
      const { id } = req.params;
      const { status, forceComplete, reason } = req.body;


      // Get the current transaction to check previous status
      const existingTx = await storage.getTransactionById(id);
      if (!existingTx) {
        return res.status(404).json({ message: "Transaction non trouvée" });
      }
      const isPayout = ["withdrawal", "transfer_out"].includes(existingTx.type);
      const isReopeningRejectedPayout = isPayout
        && status === "pending"
        && ["failed", "cancelled"].includes(existingTx.status);
      const pawaControl = classifyPawaPayControlledTransaction(existingTx.type, existingTx.externalReference);
      // An admin rejection/cancellation of an incoming deposit is an explicit
      // local decision. It must not be blocked by an unavailable or still-
      // pending provider status check. Outgoing payouts keep provider control
      // so a local rejection cannot hide an already-submitted payout.
      const isIncomingDeposit = existingTx.type === "deposit" || existingTx.type === "payment_link";
      const isManualDepositRejection = isIncomingDeposit &&
        (status === "failed" || status === "cancelled");
      if (pawaControl && !isManualDepositRejection && !isReopeningRejectedPayout) {
        const reconciled = pawaControl === "payout"
          ? await reconcilePawaPayPayoutAttempt(existingTx)
          : await reconcilePawaPayIncomingAttempt(existingTx);
        if (reconciled === "unresolved") {
          return res.status(409).json({ message: "Paiement encore en cours de rapprochement; modification manuelle interdite." });
        }
        return res.json({ message: "Paiement rapproché avec le fournisseur.", status: reconciled });
      }
      if (status === "completed" && !forceComplete && isPayout && !existingTx.externalReference) {
        const approvalOperator = existingTx.operatorId ? await storage.getOperator(existingTx.operatorId) : null;
        const approvalProvider = (approvalOperator as any)?.paymentProvider || (approvalOperator as any)?.depositPaymentProvider;
        if (approvalProvider === "pawapay") {
          let approvalCountry = (existingTx.recipientCountry || "CM").toUpperCase();
          if (approvalCountry.length !== 2 && approvalOperator?.countryId) {
            const configuredCountry = await storage.getCountry(approvalOperator.countryId);
            if (configuredCountry?.code) approvalCountry = configuredCountry.code.toUpperCase();
          }
          try {
            await assertPawaPayProviderActive(
              resolvePawaPayProviderCode(approvalOperator, approvalOperator?.name || "", approvalCountry),
              "PAYOUT", pawaPayCountry(approvalCountry),
            );
          } catch {
            return res.status(503).json({ message: "Le service de paiement est temporairement indisponible." });
          }
          const claimed = await storage.claimTransactionStatus(existingTx.id, "processing", ["pending", "pending_manual"]);
          if (!claimed) return res.status(409).json({ message: "Transaction déjà modifiée ou en cours." });
          const payoutId = createPawaPayId();
          await storage.updateTransactionMetadata(existingTx.id, {
            ...((existingTx.metadata || {}) as Record<string, unknown>),
            paymentProvider: "pawapay",
            pawaCountry: pawaPayCountry(approvalCountry),
            walletCurrency: (existingTx.metadata as any)?.walletCurrency || existingTx.currency || "XAF",
          });
          await storage.updateTransactionExternalReference(existingTx.id, payoutId);
          const queue = () => addPendingPayout({
            transactionId: existingTx.id, reference: payoutId, externalReference: payoutId,
            userId: existingTx.userId, amount: existingTx.amount,
            totalDebited: existingTx.totalAmount || existingTx.amount, provider: "pawapay",
            countryCode: approvalCountry, txType: existingTx.type, txCurrency: existingTx.currency || "XAF",
          });
          try {
            const result = await createPawaPayPayout({
              payoutId,
              country: pawaPayCountry(approvalCountry),
              amount: parseFloat(existingTx.amount).toFixed(2),
              currency: toPawaPayCurrency(existingTx.currency || "XAF"),
              recipient: {
                provider: resolvePawaPayProviderCode(approvalOperator, approvalOperator?.name || "", approvalCountry),
                phoneNumber: normalizePhone(existingTx.recipientPhone) || "",
              },
              clientReferenceId: existingTx.reference || existingTx.id,
              customerMessage: PAWAPAY_CUSTOMER_MESSAGE,
            });
            // Only an explicit terminal provider rejection is safe to refund.
            // Non-2xx/transport outcomes are ambiguous and must keep this UUID
            // in reconciliation to prevent a duplicate payout and refund.
            if (result.status === "failed") {
              await processPawaPayPayoutCallback(existingTx, "failed");
              return res.status(400).json({ message: "Le paiement a été rejeté.", status: "failed" });
            }
            if (result.status === "completed") {
              await processPawaPayPayoutCallback(existingTx, "success");
              return res.json({ message: "Paiement traité.", status: "completed" });
            }
            queue();
            return res.status(202).json({ message: "Paiement en cours.", reference: payoutId });
          } catch {
            queue();
            return res.status(202).json({ message: "Paiement en cours de rapprochement.", reference: payoutId });
          }
        }
      }

      // ── Terminal state immutability — only "refunded" is truly immutable.
      // "completed" can be reverted by admin (with balance correction).
      const TERMINAL_STATES = ["refunded"] as const;
      const isCurrentlyTerminal = TERMINAL_STATES.includes(existingTx.status as any);

      if (isCurrentlyTerminal) {
        return res.status(409).json({
          message: `Impossible de modifier une transaction en état "${existingTx.status}". Les états terminaux sont immuables.`,
          currentStatus: existingTx.status,
        });
      }

      // ── Valid state machine transitions
      const VALID_TRANSITIONS: Record<string, string[]> = {
        pending:         ["completed", "failed", "cancelled"],
        pending_manual:  ["completed", "failed", "cancelled"],
        processing:      ["completed", "failed", "pending"],
        failed:          ["pending"],
        cancelled:       ["pending"],
        completed:       ["pending", "failed", "cancelled"],
      };

      const allowed = VALID_TRANSITIONS[existingTx.status] ?? [];
      if (!allowed.includes(status)) {
        return res.status(400).json({
          message: `Transition "${existingTx.status}" → "${status}" non autorisée. Transitions valides : ${allowed.join(", ") || "aucune"}.`,
          currentStatus: existingTx.status,
          requestedStatus: status,
        });
      }

      // Prevent double-crediting: only credit if moving from pending/processing to completed
      const wasNotCompleted = existingTx.status !== "completed";
      const isNowCompleted = status === "completed";

      let transaction: Transaction | undefined;
      if (isReopeningRejectedPayout) {
        const metadata = (existingTx.metadata || {}) as Record<string, unknown>;
        const walletCurrency = typeof metadata.walletCurrency === "string"
          ? metadata.walletCurrency
          : (existingTx.currency || "XAF");
        const debitAmount = parseFloat(existingTx.totalAmount || existingTx.amount);
        try {
          transaction = await storage.reopenRejectedPayoutAndDebit(
            id,
            debitAmount,
            walletCurrency,
            ["failed", "cancelled"],
          );
        } catch (error: any) {
          if (error?.message === "INSUFFICIENT_WALLET_BALANCE") {
            return res.status(400).json({
              message: `Solde insuffisant sur le wallet ${walletCurrency}. Le statut n'a pas été modifié.`,
            });
          }
          throw error;
        }
      } else {
        transaction = await storage.updateTransactionStatus(id, status);
      }
      if (!transaction) {
        return res.status(409).json({ message: "Transaction déjà modifiée ou solde indisponible." });
      }
      
      // Credit user wallet when transaction is approved (payment_link type)
      // Uses admin "Devises & Taux de change" rates; auto-creates wallet if currency not found
      if (wasNotCompleted && isNowCompleted && transaction.type === "payment_link") {
        const txAmount = parseFloat(transaction.amount);
        const txCurrency = transaction.currency || "XAF";
        await creditUserWallet(transaction.userId, txAmount, txCurrency);

        // Also update the payment intent status if exists
        if (transaction.paymentIntentId) {
          await storage.updatePaymentIntentStatus(transaction.paymentIntentId, "completed");
        }
      }

      // For deposits, credit the right wallet and create notification
      // Uses admin "Devises & Taux de change" rates; auto-creates wallet if currency not found
      if (wasNotCompleted && isNowCompleted && transaction.type === "deposit") {
        const txAmount = parseFloat(transaction.amount);
        const txCurrency = transaction.currency || "XAF";
        await creditUserWallet(transaction.userId, txAmount, txCurrency);

        // Create notification for user
        await storage.createUserNotification({
          userId: transaction.userId,
          type: "deposit_confirmed",
          title: "Dépôt confirmé",
          message: `Votre dépôt de ${transaction.amount} ${txCurrency} a été confirmé et crédité sur votre compte.`,
          transactionId: transaction.id,
          isRead: false,
        });
      }
      
      // For withdrawals/transfer_out: trigger payout when admin approves (unless forceComplete=true)
      // Routes only to an explicitly configured AfribaPay or PixPay provider.
      if (wasNotCompleted && isNowCompleted && (transaction.type === "withdrawal" || transaction.type === "transfer_out") && !forceComplete) {
        try {
          let countryCode = "CM";
          if (transaction.recipientCountry) {
            const rc = transaction.recipientCountry.trim();
            if (rc.length === 2) {
              countryCode = rc.toUpperCase();
            } else {
              const countries = await storage.getAllCountries();
              const c = countries.find(c => c.name.toLowerCase() === rc.toLowerCase());
              if (c?.code) countryCode = c.code;
            }
          }

          const txAmount = parseFloat(transaction.amount);
          const payoutRef = transaction.reference || generateTransactionReference("payout");

          const operatorId = transaction.operatorId;
          const operator = operatorId ? await storage.getOperator(operatorId) : null;
          const operatorName = (operator?.name || "").toUpperCase();
          const adminPaymentProvider = ((operator as any)?.paymentProvider || (operator as any)?.depositPaymentProvider) as string | undefined;
          if (adminPaymentProvider !== "afribapay" && adminPaymentProvider !== "pixpay" && adminPaymentProvider !== "pawapay") {
            await storage.updateTransactionStatus(id, "pending");
            return res.status(400).json({ message: "Aucun fournisseur de paiement valide n'est configuré pour cet opérateur." });
          }

          console.log(`[Admin] Payout params: country=${countryCode}, operatorId=${operatorId}, operatorName=${operatorName}, provider=${adminPaymentProvider}, txPaymentMethod=${transaction.paymentMethod}`);

          let payoutResult: { success: boolean; transaction_id?: string; message?: string } = {
            success: false,
            message: "Fournisseur de paiement non supporté",
          };
          let pollerProvider: "afribapay" | "pixpay" | "pawapay" = adminPaymentProvider;
          let pollerRef = payoutRef;

          if (adminPaymentProvider === "pawapay") {
            throw new Error("PawaPay approval must use the atomic early submission path");
          } else if (adminPaymentProvider === "afribapay") {
            // ─── AfribaPay Payout ─────────────────────────────────────────────
            const afribapayOperatorCode = resolveAfribaPayOperatorCode(operator, operatorName);
            const afribapayCurrency = AFRIBAPAY_ISO_CURRENCY[countryCode] || (transaction.currency || "XAF");
            console.log(`[Admin] AfribaPay payout | country=${countryCode} | currency=${afribapayCurrency} | operator=${afribapayOperatorCode}`);
            const callbackUrl = buildWebhookUrl("/api/afribapay/webhook");

            let localPhone = (transaction.recipientPhone || "").replace(/\s/g, "");
            if (localPhone.startsWith("+")) localPhone = localPhone.slice(1);
            const phonePrefixes: Record<string, string> = {
              CM: "237", SN: "221", CI: "225", BF: "226", ML: "223",
              GN: "224", BJ: "229", TG: "228", NE: "227", CD: "243",
              CG: "242", CF: "236", TD: "235", GA: "241", GQ: "240",
              MG: "261", RW: "250", KE: "254", TZ: "255", UG: "256",
              GH: "233", NG: "234",
            };
            const pfx = phonePrefixes[countryCode];
            if (pfx && localPhone.startsWith(pfx)) localPhone = localPhone.slice(pfx.length);

            const afribaResult = await initiateAfribaPayout({
              operator:     afribapayOperatorCode,
              country:      countryCode,
              phone_number: localPhone,
              amount:       txAmount,
              currency:     afribapayCurrency,
              order_id:     payoutRef,
              reference_id: payoutRef,
              notify_url:   callbackUrl,
            });
            if (afribaResult.success) {
              // Persist submitted order_id (= payoutRef) so restart recovery polls
              // the right AfribaPay reference (not transaction_id, which status API ignores).
              await storage.updateTransactionExternalReference(transaction.id, payoutRef);
            }
            payoutResult  = afribaResult;
            pollerProvider = "afribapay";
            pollerRef      = payoutRef; // AfribaPay is queried by order_id

          }

          if (payoutResult.success) {
            console.log(`[Admin] Payout submitted OK for ${payoutRef} via ${pollerProvider} (ext: ${payoutResult.transaction_id})`);
            addPendingPayout({
              transactionId: transaction.id,
              reference:     pollerRef,
              userId:        transaction.userId,
              amount:        transaction.amount,
              totalDebited:  transaction.totalAmount || transaction.amount,
              provider:      pollerProvider,
              ...(pollerProvider === "pawapay" ? { externalReference: pollerRef } : {}),
              countryCode:   countryCode,
              txType:        transaction.type,
              txCurrency:    transaction.currency || "XAF",
            });
            const txUser = await storage.getUser(transaction.userId).catch(() => null);
            if (txUser?.email) {
              sendWithdrawalApprovedEmail(
                txUser.email,
                txUser.fullName || txUser.username,
                transaction.amount,
                transaction.currency || "XAF",
                transaction.reference || undefined,
                operatorName || (transaction as any).operator || undefined
              ).catch(() => {});
            }
            await storage.createUserNotification({
              userId:        transaction.userId,
              type:          "withdrawal_confirmed",
              title:         transaction.type === "withdrawal" ? "Retrait approuvé" : "Transfert approuvé",
              message:       `Votre ${transaction.type === "withdrawal" ? "retrait" : "transfert"} de ${transaction.amount} ${transaction.currency} a été validé.`,
              transactionId: transaction.id,
              isRead:        false,
            });
          } else {
            console.error(`[Admin] Payout failed for ${payoutRef} via ${pollerProvider}: ${payoutResult.message}`);
            await storage.updateTransactionStatus(id, "pending");
            const msg = (payoutResult.message || "").toLowerCase();
            const isInsufficientBalance = msg.includes("insuffi") || msg.includes("solde") || msg.includes("balance");
            if (isInsufficientBalance) {
              return res.status(400).json({
                message: `Solde insuffisant sur le wallet ${pollerProvider === "afribapay" ? "AfribaPay" : "PixPay"}. Rechargez puis réessayez.`,
              });
            }
            return res.status(400).json({
              message: `Paiement ${pollerProvider === "afribapay" ? "AfribaPay" : "PixPay"} échoué: ${payoutResult.message}`,
            });
          }
        } catch (payoutErr: any) {
          console.error("[Admin] Payout error:", payoutErr.message);
          await storage.updateTransactionStatus(id, "pending");
          return res.status(500).json({ message: `Erreur lors du paiement: ${payoutErr.message}` });
        }
      }
      
      // Manual confirm (forceComplete=true): send notification without a provider
      if (wasNotCompleted && isNowCompleted && (transaction.type === "withdrawal" || transaction.type === "transfer_out") && forceComplete) {
        const txUser = await storage.getUser(transaction.userId).catch(() => null);
        if (txUser?.email) {
          sendWithdrawalApprovedEmail(
            txUser.email,
            txUser.fullName || txUser.username,
            transaction.amount,
            transaction.currency || "XAF",
            transaction.reference || undefined,
            (transaction as any).operator || undefined
          ).catch(() => {});
        }
        await storage.createUserNotification({
          userId:        transaction.userId,
          type:          "withdrawal_confirmed",
          title:         transaction.type === "withdrawal" ? "Retrait approuvé" : "Transfert approuvé",
          message:       `Votre ${transaction.type === "withdrawal" ? "retrait" : "transfert"} de ${transaction.amount} ${transaction.currency} a été validé manuellement.`,
          transactionId: transaction.id,
          isRead:        false,
        });
      }

      // Refund user when transfer_out or withdrawal is rejected (only if previously pending/processing)
      const wasNotRejected = existingTx.status !== "failed" && existingTx.status !== "cancelled";
      const isNowRejected = status === "failed" || status === "cancelled";
      
      if (wasNotRejected && isNowRejected && (transaction.type === "transfer_out" || transaction.type === "withdrawal") && existingTx.status !== "completed") {
        // Cooldown 5min — l'utilisateur doit attendre avant de relancer
        setFailedCooldown(transaction.userId);
        // Refund total amount (amount + fee) to the wallet that was originally debited
        const refundAmount = transaction.totalAmount 
          ? parseFloat(transaction.totalAmount) 
          : parseFloat(transaction.amount);
        await storage.refundToOriginalWallet(transaction.userId, transaction.type, transaction.currency || "XAF", refundAmount);

        if (transaction.type === "withdrawal") {
          await storage.createUserNotification({
            userId:        transaction.userId,
            type:          "withdrawal_failed",
            title:         "Retrait annulé",
            message:       `Votre retrait de ${transaction.amount} ${transaction.currency || "XAF"} a été annulé. Le montant de ${refundAmount.toFixed(0)} ${transaction.currency || "XAF"} a été recrédité.`,
            transactionId: transaction.id,
            isRead:        false,
          });
        }
      }

      // ── Reverse credit when a COMPLETED deposit/payment_link is reverted to failed/cancelled
      // The wallet was already credited when the deposit was approved — we must deduct it back.
      if (existingTx.status === "completed" && isNowRejected && (transaction.type === "deposit" || transaction.type === "payment_link")) {
        const debitAmount = parseFloat(transaction.amount);
        const txCurrency = transaction.currency || "XAF";
        const user = await storage.getUser(transaction.userId);
        const userPrimary = user?.preferredCurrency || "XAF";
        if (txCurrency === userPrimary) {
          await storage.updateUserBalance(transaction.userId, -debitAmount);
        } else {
          // Deduct from secondary wallet (negative upsert)
          await storage.upsertWallet(transaction.userId, txCurrency, -debitAmount);
        }
        await storage.createUserNotification({
          userId:        transaction.userId,
          type:          "deposit_failed",
          title:         "Dépôt annulé",
          message:       `Votre dépôt de ${transaction.amount} ${txCurrency} a été annulé par l'administration. Le montant a été débité de votre compte.`,
          transactionId: transaction.id,
          isRead:        false,
        });
        console.log(`[Admin] Reversed deposit credit: -${debitAmount} ${txCurrency} for user ${transaction.userId}`);
      }
      
      try {
        await storage.createAdminLog({
          adminId: req.userId!,
          action: "update_transaction",
          targetType: "transaction",
          targetId: id,
          details: JSON.stringify({
            from: existingTx.status,
            to: status,
            balanceUpdated: wasNotCompleted && isNowCompleted,
            walletDebited: isReopeningRejectedPayout,
            reason: reason.trim(),
            forceComplete: !!forceComplete,
          }),
          ipAddress: req.ip || null,
        });
      } catch (logErr: any) {
        console.error("[Admin] Failed to write admin log (non-fatal):", logErr?.message);
      }
      
      res.json(transaction);
    } catch (error) {
      console.error("Admin update transaction error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Countries CRUD
  app.post("/api/admin/pawapay/sync-catalog", requireAuth, requireAdmin, adminActionLimiter, async (req, res) => {
    try {
      // The local seed guarantees the UI remains usable; this explicit action
      // reconciles operator codes with the connected account's live config.
      await seedPawaPayCountries();
      const result = await syncPawaPayCatalog();
      await storage.createAdminLog({
        adminId: req.userId!,
        action: "sync_pawapay_catalog",
        targetType: "provider",
        targetId: "pawapay",
        details: JSON.stringify(result),
        ipAddress: req.ip || null,
      });
      res.json({ success: true, ...result });
    } catch (error: any) {
      // Do not expose provider response bodies or credentials. The admin gets
      // a safe actionable message while the server keeps the precise error.
      console.error("[PawaPayCatalog] Sync failed:", error?.message || "unknown error");
      res.status(503).json({ message: "La synchronisation PawaPay est indisponible. Vérifiez les identifiants configurés." });
    }
  });

  app.get("/api/admin/countries", requireAuth, requireAdmin, async (req, res) => {
    try {
      const countries = await storage.getAllCountries();
      res.json(countries);
    } catch (error) {
      console.error("Admin get countries error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.post("/api/admin/countries", requireAuth, requireAdmin, async (req, res) => {
    try {
      console.log("Creating country with data:", JSON.stringify(req.body));
      const country = await storage.createCountry(req.body);
      
      await storage.createAdminLog({
        adminId: req.userId!,
        action: "create_country",
        targetType: "country",
        targetId: country.id,
        details: JSON.stringify(req.body),
        ipAddress: req.ip || null,
      });
      
      res.json(country);
    } catch (error: any) {
      console.error("Admin create country error:", error);
      res.status(500).json({ message: error.message || "Erreur serveur" });
    }
  });

  app.patch("/api/admin/countries/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      // Log exchange rate updates explicitly so we can confirm they reach the DB
      if (req.body.exchangeRate !== undefined) {
        console.log(`[Admin] Updating country ${req.params.id} exchangeRate → ${req.body.exchangeRate}`);
      }
      const country = await storage.updateCountry(req.params.id, req.body);
      if (!country) {
        return res.status(404).json({ message: "Pays non trouvé" });
      }
      if (req.body.exchangeRate !== undefined) {
        console.log(`[Admin] Country ${country.code} (${country.currency}) exchangeRate saved as ${country.exchangeRate}`);
      }
      
      await storage.createAdminLog({
        adminId: req.userId!,
        action: "update_country",
        targetType: "country",
        targetId: req.params.id,
        details: JSON.stringify(req.body),
        ipAddress: req.ip || null,
      });
      
      res.json(country);
    } catch (error) {
      console.error("Admin update country error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.delete("/api/admin/countries/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      await storage.deleteCountry(req.params.id);
      
      await storage.createAdminLog({
        adminId: req.userId!,
        action: "delete_country",
        targetType: "country",
        targetId: req.params.id,
        ipAddress: req.ip || null,
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Admin delete country error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Toggle all operators for a country
  app.post("/api/admin/countries/:id/toggle-operators", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { isActive } = req.body;
      const operators = await storage.getOperatorsByCountry(req.params.id);
      
      for (const op of operators) {
        await storage.updateOperator(op.id, { isActive });
      }
      
      await storage.createAdminLog({
        adminId: req.userId!,
        action: isActive ? "activate_all_operators" : "deactivate_all_operators",
        targetType: "country",
        targetId: req.params.id,
        details: JSON.stringify({ operatorCount: operators.length }),
        ipAddress: req.ip || null,
      });
      
      res.json({ success: true, count: operators.length });
    } catch (error) {
      console.error("Admin toggle operators error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Operators CRUD
  app.get("/api/admin/operators", requireAuth, requireAdmin, async (req, res) => {
    try {
      const operators = await storage.getAllOperators();
      res.json(operators);
    } catch (error) {
      console.error("Admin get operators error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.post("/api/admin/operators", requireAuth, requireAdmin, async (req, res) => {
    try {
      const operator = await storage.createOperator(req.body);
      
      await storage.createAdminLog({
        adminId: req.userId!,
        action: "create_operator",
        targetType: "operator",
        targetId: operator.id,
        details: JSON.stringify(req.body),
        ipAddress: req.ip || null,
      });
      
      res.json(operator);
    } catch (error: any) {
      console.error("Admin create operator error:", error);
      if (error?.message?.includes("existe déjà")) {
        return res.status(409).json({ message: error.message });
      }
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.patch("/api/admin/operators/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const operator = await storage.updateOperator(req.params.id, req.body);
      if (!operator) {
        return res.status(404).json({ message: "Opérateur non trouvé" });
      }
      
      await storage.createAdminLog({
        adminId: req.userId!,
        action: "update_operator",
        targetType: "operator",
        targetId: req.params.id,
        details: JSON.stringify(req.body),
        ipAddress: req.ip || null,
      });
      
      res.json(operator);
    } catch (error) {
      console.error("Admin update operator error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.delete("/api/admin/operators/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      await storage.deleteOperator(req.params.id);
      
      await storage.createAdminLog({
        adminId: req.userId!,
        action: "delete_operator",
        targetType: "operator",
        targetId: req.params.id,
        ipAddress: req.ip || null,
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Admin delete operator error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Copier tous les frais retrait → envoi (transfer)
  app.post("/api/admin/fees/sync-withdrawals-to-transfers", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { operatorId } = req.body || {};
      const allFees = await storage.getAllFees();
      let withdrawalFees = allFees.filter(f => f.transactionType === 'withdrawal');
      if (operatorId) withdrawalFees = withdrawalFees.filter(f => f.operatorId === operatorId);
      let synced = 0;
      let created = 0;

      for (const wFee of withdrawalFees) {
        let tFee: typeof allFees[number] | undefined;
        if (wFee.operatorId) {
          tFee = allFees.find(f => f.operatorId === wFee.operatorId && f.transactionType === 'transfer');
        } else if (wFee.countryId) {
          tFee = allFees.find(f => f.countryId === wFee.countryId && !f.operatorId && f.transactionType === 'transfer');
        } else {
          tFee = allFees.find(f => !f.operatorId && !f.countryId && f.transactionType === 'transfer');
        }

        const syncValues = {
          feeValue: wFee.feeValue,
          ashtechMargin: wFee.ashtechMargin,
          afribapayFee: wFee.afribapayFee,
          pixpayFee: wFee.pixpayFee,
          minFee: wFee.minFee,
          isActive: wFee.isActive,
        };

        if (tFee) {
          await storage.updateFee(tFee.id, syncValues);
          synced++;
        } else {
          const newName = wFee.name.replace(/retrait/gi, 'Envoi').replace(/withdrawal/gi, 'Transfer');
          await storage.createFee({
            ...syncValues,
            name: newName !== wFee.name ? newName : `Envoi - ${wFee.name}`,
            feeType: wFee.feeType,
            transactionType: 'transfer',
            operatorId: wFee.operatorId || null,
            countryId: wFee.countryId || null,
          } as any);
          created++;
        }
      }

      await storage.createAdminLog({
        adminId: req.userId!,
        action: "sync_fees_withdrawal_to_transfer",
        targetType: "fee",
        targetId: null,
        details: JSON.stringify({ synced, created }),
        ipAddress: req.ip || null,
      });

      res.json({ success: true, synced, created });
    } catch (error) {
      console.error("Sync withdrawal to transfer fees error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Copier tous les frais envoi → retrait (sens inverse)
  app.post("/api/admin/fees/sync-transfers-to-withdrawals", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { operatorId } = req.body || {};
      const allFees = await storage.getAllFees();
      let transferFees = allFees.filter(f => f.transactionType === 'transfer');
      if (operatorId) transferFees = transferFees.filter(f => f.operatorId === operatorId);
      let synced = 0;
      let created = 0;

      for (const tFee of transferFees) {
        let wFee: typeof allFees[number] | undefined;
        if (tFee.operatorId) {
          wFee = allFees.find(f => f.operatorId === tFee.operatorId && f.transactionType === 'withdrawal');
        } else if (tFee.countryId) {
          wFee = allFees.find(f => f.countryId === tFee.countryId && !f.operatorId && f.transactionType === 'withdrawal');
        }
        const syncValues = {
          feeValue: tFee.feeValue,
          ashtechMargin: tFee.ashtechMargin,
          afribapayFee: tFee.afribapayFee,
          pixpayFee: tFee.pixpayFee,
          minFee: tFee.minFee,
          isActive: tFee.isActive,
        };
        if (wFee) {
          await storage.updateFee(wFee.id, syncValues);
          synced++;
        } else {
          const newName = tFee.name.replace(/envoi/gi, 'Retrait').replace(/transfer/gi, 'Withdrawal');
          await storage.createFee({
            ...syncValues,
            name: newName !== tFee.name ? newName : `Retrait - ${tFee.name}`,
            feeType: tFee.feeType,
            transactionType: 'withdrawal',
            operatorId: tFee.operatorId || null,
            countryId: tFee.countryId || null,
          } as any);
          created++;
        }
      }
      res.json({ success: true, synced, created });
    } catch (error) {
      console.error("Sync transfer to withdrawal fees error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Fees CRUD
  app.get("/api/admin/fees", requireAuth, requireAdmin, async (req, res) => {
    try {
      const fees = await storage.getAllFees();
      res.json(fees);
    } catch (error) {
      console.error("Admin get fees error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.post("/api/admin/fees", requireAuth, requireAdmin, async (req, res) => {
    try {
      const fee = await storage.createFee(req.body);
      
      await storage.createAdminLog({
        adminId: req.userId!,
        action: "create_fee",
        targetType: "fee",
        targetId: fee.id,
        details: JSON.stringify(req.body),
        ipAddress: req.ip || null,
      });
      
      res.json(fee);
    } catch (error) {
      console.error("Admin create fee error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.patch("/api/admin/fees/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { ashtechMargin, feeValue, isActive, minFee } = req.body;
      const fee = await storage.getFee(req.params.id);
      if (!fee) {
        return res.status(404).json({ message: "Frais non trouvé" });
      }

      const updates: any = {
        ashtechMargin,
        feeValue,
        isActive,
        minFee
      };

      const updatedFee = await storage.updateFee(req.params.id, updates);

      // Synchroniser l'autre type (transfer <-> withdrawal) pour le même opérateur ou pays
      if (fee.transactionType === 'transfer' || fee.transactionType === 'withdrawal') {
        const otherType = fee.transactionType === 'transfer' ? 'withdrawal' : 'transfer';
        const allFees = await storage.getAllFees();
        let otherFee: typeof allFees[number] | undefined;
        if (fee.operatorId) {
          otherFee = allFees.find(f => f.operatorId === fee.operatorId && f.transactionType === otherType);
        } else if (fee.countryId) {
          otherFee = allFees.find(f => f.countryId === fee.countryId && !f.operatorId && f.transactionType === otherType);
        }
        if (otherFee) {
          await storage.updateFee(otherFee.id, {
            ashtechMargin: updates.ashtechMargin,
            feeValue: updates.feeValue,
            isActive: updates.isActive,
            minFee: updates.minFee
          });
        }
      }

      await storage.createAdminLog({
        adminId: req.userId!,
        action: "update_fee",
        targetType: "fee",
        targetId: req.params.id,
        details: JSON.stringify(req.body),
        ipAddress: req.ip || null,
      });

      res.json(updatedFee);
    } catch (error) {
      console.error("Admin update fee error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.delete("/api/admin/fees/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      await storage.deleteFee(req.params.id);
      
      await storage.createAdminLog({
        adminId: req.userId!,
        action: "delete_fee",
        targetType: "fee",
        targetId: req.params.id,
        ipAddress: req.ip || null,
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Admin delete fee error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Support ticket stats
  app.get("/api/admin/tickets/stats", requireAuth, requireAdmin, async (req, res) => {
    try {
      const tickets = await storage.getAllTickets();
      const openCount = tickets.filter(t => t.status === "open" || t.status === "in_progress").length;
      res.json({ openCount, totalCount: tickets.length });
    } catch (error) {
      console.error("Admin ticket stats error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Support tickets
  app.get("/api/admin/tickets", requireAuth, requireAdmin, async (req, res) => {
    try {
      const tickets = await storage.getAllTickets();
      res.json(tickets);
    } catch (error) {
      console.error("Admin get tickets error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.get("/api/admin/tickets/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const ticket = await storage.getTicket(req.params.id);
      if (!ticket) {
        return res.status(404).json({ message: "Ticket non trouvé" });
      }
      const messages = await storage.getTicketMessages(req.params.id);
      const user = await storage.getUser(ticket.userId);
      res.json({ 
        ticket, 
        messages,
        user: user ? { id: user.id, fullName: user.fullName, email: user.email, phone: user.phone, lastSeenAt: user.lastSeenAt } : null,
        userOnline: isUserOnline(ticket.userId),
      });
    } catch (error) {
      console.error("Admin get ticket error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Delete all tickets
  app.delete("/api/admin/tickets", requireAuth, requireAdmin, async (req, res) => {
    try {
      await storage.deleteAllTickets();
      
      await storage.createAdminLog({
        adminId: req.userId!,
        action: "delete_all_tickets",
        targetType: "ticket",
        targetId: null,
        details: null,
        ipAddress: req.ip || null,
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Admin delete all tickets error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Delete ticket
  app.delete("/api/admin/tickets/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      await storage.deleteTicket(req.params.id);
      
      await storage.createAdminLog({
        adminId: req.userId!,
        action: "delete_ticket",
        targetType: "ticket",
        targetId: req.params.id,
        details: null,
        ipAddress: req.ip || null,
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Admin delete ticket error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.patch("/api/admin/tickets/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const ticket = await storage.updateTicket(req.params.id, req.body);
      if (!ticket) {
        return res.status(404).json({ message: "Ticket non trouvé" });
      }
      
      await storage.createAdminLog({
        adminId: req.userId!,
        action: "update_ticket",
        targetType: "ticket",
        targetId: req.params.id,
        details: JSON.stringify(req.body),
        ipAddress: req.ip || null,
      });
      
      res.json(ticket);
    } catch (error) {
      console.error("Admin update ticket error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.post("/api/admin/tickets/:id/messages", requireAuth, requireAdmin, async (req, res) => {
    try {
      const ticket = await storage.getTicket(req.params.id);
      if (!ticket) return res.status(404).json({ message: "Ticket non trouvé" });

      const isUserViewing = getUserViewingTicket(ticket.userId, req.params.id);
      const message = await storage.createTicketMessage({
        ticketId: req.params.id,
        senderId: req.userId!,
        message: req.body.message,
        isAdmin: true,
        readByAdmin: true,
        readByUser: isUserViewing,
      });

      // Update ticket updatedAt
      await storage.updateTicket(req.params.id, { status: ticket.status === "open" ? "in_progress" : ticket.status });

      // Push new message via SSE to user
      notifyUser(ticket.userId, "new_message", {
        ticketId: req.params.id,
        message,
      });

      // Create notification for user
      await storage.createUserNotification({
        userId: ticket.userId,
        type: "admin_message",
        title: "Nouveau message du support",
        message: `Réponse à votre ticket : ${ticket.subject}`,
        transactionId: null,
        isRead: false,
      });

      res.json(message);
    } catch (error) {
      console.error("Admin create ticket message error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // User: Create support ticket
  app.post("/api/tickets", requireAuth, async (req, res) => {
    try {
      const ticket = await storage.createTicket({
        userId: req.userId!,
        subject: req.body.subject,
        priority: req.body.priority || "medium",
      });
      
      if (req.body.message) {
        await storage.createTicketMessage({
          ticketId: ticket.id,
          senderId: req.userId!,
          message: req.body.message,
          isAdmin: false,
        });
      }

      // Notify Telegram
      storage.getUser(req.userId!).then(u => {
        if (!u) return;
        notifyNewTicket({
          ticketId: ticket.id,
          userName: u.fullName || u.username,
          userEmail: u.email || "",
          subject: ticket.subject,
          firstMessage: req.body.message,
          priority: ticket.priority,
        }).catch(() => {});
      }).catch(() => {});
      
      res.json(ticket);
    } catch (error) {
      console.error("Create ticket error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // User: Get ticket stats (unread count based on open tickets with admin responses)
  app.get("/api/tickets/stats", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      const result = await db.execute(drizzleSql`
        SELECT
          COUNT(*)::int AS total_count,
          COUNT(*) FILTER (
            WHERE st.status IN ('open', 'in_progress')
            AND EXISTS (
              SELECT 1 FROM ticket_messages tm
              WHERE tm.ticket_id = st.id AND tm.is_admin = true
              AND tm.created_at = (
                SELECT MAX(tm2.created_at) FROM ticket_messages tm2 WHERE tm2.ticket_id = st.id
              )
            )
          )::int AS unread_count
        FROM support_tickets st
        WHERE st.user_id = ${userId}
      `);
      const row = (result.rows?.[0] || {}) as any;
      res.json({ unreadCount: Number(row.unread_count || 0), totalCount: Number(row.total_count || 0) });
    } catch (error) {
      console.error("Get ticket stats error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // User: Get own tickets
  app.get("/api/tickets", requireAuth, async (req, res) => {
    try {
      const tickets = await storage.getTicketsByUser(req.userId!);
      res.json(tickets);
    } catch (error) {
      console.error("Get user tickets error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // User: Get ticket messages
  app.get("/api/tickets/:id/messages", requireAuth, async (req, res) => {
    try {
      const ticket = await storage.getTicket(req.params.id);
      if (!ticket || ticket.userId !== req.userId) {
        return res.status(404).json({ message: "Ticket non trouvé" });
      }
      const messages = await storage.getTicketMessages(req.params.id);
      // Check if any admin is currently online
      const adminsOnline = getOnlineUserIds().length > 1; // simplification: if more than 1 user online, admin might be
      res.json({ ticket, messages, adminsOnline });
    } catch (error) {
      console.error("Get ticket messages error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // User: Add message to ticket
  app.post("/api/tickets/:id/messages", requireAuth, async (req, res) => {
    try {
      const ticket = await storage.getTicket(req.params.id);
      if (!ticket || ticket.userId !== req.userId) {
        return res.status(404).json({ message: "Ticket non trouvé" });
      }

      const isAdminViewing = getAdminViewingTicket(req.params.id);
      const message = await storage.createTicketMessage({
        ticketId: req.params.id,
        senderId: req.userId!,
        message: req.body.message,
        isAdmin: false,
        readByUser: true,
        readByAdmin: isAdminViewing,
      });
      
      // Reopen ticket if closed
      if (ticket.status === "closed" || ticket.status === "resolved") {
        await storage.updateTicket(req.params.id, { status: "open" });
      }

      // Push new message via SSE to admins
      const msgSender = await storage.getUser(req.userId!);
      notifyAdmins("new_message", {
        ticketId: req.params.id,
        message,
        userFullName: msgSender?.fullName || "Utilisateur",
        subject: ticket.subject,
      });

      // Notify Telegram (fire and forget)
      if (msgSender) {
        notifySupportMessage({
          ticketId: req.params.id,
          userName: msgSender.fullName || msgSender.username,
          userEmail: msgSender.email || "",
          subject: ticket.subject,
          message: req.body.message,
        }).catch(() => {});
      }
      
      res.json(message);
    } catch (error) {
      console.error("Create ticket message error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // User: Close own ticket
  app.post("/api/tickets/:id/close", requireAuth, async (req, res) => {
    try {
      const ticket = await storage.getTicket(req.params.id);
      if (!ticket || ticket.userId !== req.userId) {
        return res.status(404).json({ message: "Ticket non trouvé" });
      }
      
      const updatedTicket = await storage.updateTicket(req.params.id, { status: "closed" });
      res.json(updatedTicket);
    } catch (error) {
      console.error("Close ticket error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // ─── Real-time SSE ────────────────────────────────────────────────────────

  // User SSE connection
  app.get("/api/sse", requireAuth, async (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const user = await storage.getUser(req.userId!);
    const isAdmin = user?.role === "admin";
    const connId = addSSEClient(req.userId!, !!isAdmin, res, req.sessionID);

    // Update last seen
    await storage.updateUserLastSeen(req.userId!);

    // Broadcast updated online list to all
    broadcastOnlineStatus();

    // Ping every 25s to keep connection alive
    const pingInterval = setInterval(() => {
      try {
        res.write(":ping\n\n");
        (res as any).flush?.();
      } catch {}
    }, 25000);

    req.on("close", async () => {
      clearInterval(pingInterval);
      removeSSEClient(connId);
      await storage.updateUserLastSeen(req.userId!);
      broadcastOnlineStatus();
    });
  });

  // User: Mark ticket messages as read (user side)
  app.post("/api/tickets/:id/read", requireAuth, async (req, res) => {
    try {
      const ticket = await storage.getTicket(req.params.id);
      if (!ticket || ticket.userId !== req.userId) {
        return res.status(404).json({ message: "Ticket non trouvé" });
      }
      await storage.markTicketMessagesReadByUser(req.params.id);
      // Notify admin that user read the messages
      notifyAdmins("messages_read", { ticketId: req.params.id, by: "user" });
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Mark ticket messages as read (admin side)
  app.post("/api/admin/tickets/:id/read", requireAuth, requireAdmin, async (req, res) => {
    try {
      await storage.markTicketMessagesReadByAdmin(req.params.id);
      const ticket = await storage.getTicket(req.params.id);
      if (ticket) {
        notifyUser(ticket.userId, "messages_read", { ticketId: req.params.id, by: "admin" });
      }
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // User: Send typing indicator
  app.post("/api/tickets/:id/typing", requireAuth, async (req, res) => {
    try {
      const ticket = await storage.getTicket(req.params.id);
      if (!ticket || ticket.userId !== req.userId) {
        return res.status(404).json({ message: "Ticket non trouvé" });
      }
      const { isTyping } = req.body;
      notifyAdmins("typing", { ticketId: req.params.id, from: "user", isTyping: !!isTyping });
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Send typing indicator
  app.post("/api/admin/tickets/:id/typing", requireAuth, requireAdmin, async (req, res) => {
    try {
      const ticket = await storage.getTicket(req.params.id);
      if (!ticket) return res.status(404).json({ message: "Ticket non trouvé" });
      const { isTyping } = req.body;
      notifyUser(ticket.userId, "typing", { ticketId: req.params.id, from: "admin", isTyping: !!isTyping });
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Set active ticket for SSE client (for online-in-ticket tracking)
  app.post("/api/sse/active-ticket", requireAuth, async (req, res) => {
    // This is handled client-side via the SSE connection id; here we just acknowledge
    res.json({ ok: true });
  });

  // Get online status
  app.get("/api/online-status", requireAuth, async (_req, res) => {
    res.json({ onlineIds: getOnlineUserIds() });
  });

  // Admin: Unread ticket messages count
  app.get("/api/admin/tickets/unread-count", requireAuth, requireAdmin, async (_req, res) => {
    try {
      const count = await storage.countUnreadUserMessagesForAdmin();
      res.json({ count });
    } catch (error) {
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Activity logs
  app.get("/api/admin/logs", requireAuth, requireAdmin, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const logs = await storage.getAdminLogs(limit);
      res.json(logs);
    } catch (error) {
      console.error("Admin get logs error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Audit logs (connexion, retrait, rôle, KYC…)
  app.get("/api/admin/audit-logs", requireAuth, requireAdmin, async (req, res) => {
    try {
      const limit  = Math.min(parseInt(req.query.limit  as string) || 50, 200);
      const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);
      const filters: Parameters<typeof storage.getAuditLogs>[0] = { limit, offset };

      if (req.query.userId)    filters.userId    = req.query.userId    as string;
      if (req.query.action)    filters.action    = req.query.action    as string;
      if (req.query.actorType) filters.actorType = req.query.actorType as string;
      if (req.query.dateFrom)  filters.dateFrom  = new Date(req.query.dateFrom as string);
      if (req.query.dateTo)    filters.dateTo    = new Date(req.query.dateTo   as string);
      if (req.query.success !== undefined)
        filters.success = req.query.success === "true";

      const result = await storage.getAuditLogs(filters);
      res.json(result);
    } catch (error) {
      console.error("Admin audit logs error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Supprimer tous les logs d'audit
  app.delete("/api/admin/audit-logs", requireAuth, requireAdmin, async (req, res) => {
    try {
      const result = await db.execute(sql`DELETE FROM audit_logs`);
      const deleted = (result as any).rowCount ?? 0;
      const ip = getClientIp(req);
      storage.createAdminLog({ adminId: req.userId!, action: "audit_logs_cleared", details: `${deleted} entrées supprimées depuis IP ${ip}` }).catch(() => {});
      console.log(`[AuditClear] ${deleted} entrée(s) supprimée(s) par admin ${req.userId}`);
      res.json({ ok: true, deleted });
    } catch (error: any) {
      console.error("Clear audit logs error:", error.message);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Déconnecter TOUS les utilisateurs
  app.delete("/api/admin/sessions/all", requireAuth, requireAdmin, async (req, res) => {
    try {
      const adminId = req.userId!;

      let count = 0;

      // Count ALL sessions before deletion (including admin's own)
      // Tries sessionPool first, falls back to main pool if exhausted (PM2 multi-worker)
      try {
        const poolsToTry = [sessionPool, pool];
        let sessQueryPool = sessionPool;
        for (const p of poolsToTry) {
          try {
            await p.query("SELECT 1");
            sessQueryPool = p;
            break;
          } catch { /* try next */ }
        }

        const countResult = await sessQueryPool.query(`SELECT COUNT(*) as cnt FROM session`);
        count = parseInt(countResult.rows[0]?.cnt || "0", 10);

        // Mark ALL sessions as kicked (including admin's)
        const allSessions = await sessQueryPool.query(`SELECT sid FROM session`);
        for (const row of allSessions.rows as { sid: string }[]) {
          singleDeviceKicks.add(row.sid);
        }

        // SSE force_logout to ALL connected clients (including admin)
        notifyAllUsersForceLogout("admin_disconnect");

        // Delete ALL sessions — including the admin's own
        await sessQueryPool.query(`DELETE FROM session`);
      } catch (sessErr: any) {
        console.error("[Admin] Erreur opérations session:", sessErr?.message);
        notifyAllUsersForceLogout("admin_disconnect");
      }

      // Revoke ALL bearer tokens — including admin's
      const revokedAt = Date.now();
      try {
        await db.execute(sql`UPDATE users SET token_revoked_before = ${revokedAt}`);
        const allUsers = await db.execute(sql`SELECT id FROM users`);
        for (const row of allUsers.rows as { id: string }[]) {
          revokedTokensBefore.set(row.id, revokedAt);
        }
      } catch (tokenErr) {
        console.warn("[Admin] token_revoked_before update skipped:", (tokenErr as Error).message);
      }

      try {
        await storage.createAdminLog({
          adminId,
          action: "disconnect_all_sessions",
          targetType: "system",
          targetId: null,
          details: JSON.stringify({ sessionsRevoked: count }),
          ipAddress: req.ip || null,
        });
      } catch (logErr) {
        console.warn("[Admin] createAdminLog skipped:", (logErr as Error).message);
      }

      // Send response BEFORE destroying the admin's own session,
      // so the HTTP response reaches the client successfully.
      res.json({ ok: true, count });

      // Destroy the admin's own session after the response is sent.
      // The SSE force_logout event already sent above will redirect the admin to /login.
      setImmediate(() => {
        req.session.destroy(() => {});
      });
    } catch (error) {
      console.error("Admin disconnect all sessions error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Platform settings
  app.get("/api/admin/settings", requireAuth, requireAdmin, async (req, res) => {
    try {
      const settings = (await storage.getAllSettings()).filter(setting => !setting.key.startsWith("pawapay_"));
      res.json(settings);
    } catch (error) {
      console.error("Admin get settings error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.post("/api/admin/settings", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { key, value, description } = req.body;
      
      if (!key || value === undefined) {
        return res.status(400).json({ message: "Clé et valeur requises" });
      }
      if (typeof key !== "string" || key.startsWith("pawapay_")) {
        return res.status(400).json({ message: "Utilisez la page dédiée PawaPay" });
      }
      
      const setting = await storage.upsertSetting(key, String(value), description || undefined);
      
      await storage.createAdminLog({
        adminId: req.userId!,
        action: "update_setting",
        targetType: "setting",
        targetId: key,
        details: JSON.stringify({ value }),
        ipAddress: req.ip || null,
      });
      
      res.json(setting);
    } catch (error) {
      console.error("Admin update setting error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Bulk save all settings
  app.post("/api/admin/settings/bulk", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { settings } = req.body;
      
      if (!settings || typeof settings !== "object") {
        return res.status(400).json({ message: "Paramètres invalides" });
      }
      
      const results = [];
      for (const [key, value] of Object.entries(settings)) {
        if (key && key.startsWith("pawapay_")) {
          return res.status(400).json({ message: "Utilisez la page dédiée PawaPay" });
        }
        if (key && value !== undefined) {
          const setting = await storage.upsertSetting(key, String(value));
          results.push(setting);
        }
      }
      
      await storage.createAdminLog({
        adminId: req.userId!,
        action: "update_settings_bulk",
        targetType: "setting",
        targetId: "all",
        details: JSON.stringify({ count: results.length }),
        ipAddress: req.ip || null,
      });
      
      res.json({ success: true, count: results.length });
    } catch (error) {
      console.error("Admin bulk update settings error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Get all payment links
  app.get("/api/admin/payment-links", requireAuth, requireAdmin, async (req, res) => {
    try {
      const links = await storage.getAllPaymentLinks();
      const userIds = [...new Set(links.map(l => l.userId))];
      const userMap = await storage.getUsersByIds(userIds);
      const linksWithUsers = links.map((link) => {
        const user = userMap.get(link.userId);
        return {
          ...link,
          user: user ? { id: user.id, fullName: user.fullName, email: user.email, phone: user.phone } : null,
        };
      });
      res.json(linksWithUsers);
    } catch (error) {
      console.error("Admin get payment links error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Update payment link
  app.patch("/api/admin/payment-links/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const ADMIN_ALLOWED_PAYMENT_LINK_FIELDS = [
        "title", "description", "amount", "currency", "isFixedAmount",
        "imagePath", "pdfPath", "hasPdfDelivery", "redirectUrl", "expiresAt",
        "notifyUrl", "allowedCountries", "isActive", "slug",
      ] as const;
      const adminUpdates: Record<string, any> = {};
      for (const field of ADMIN_ALLOWED_PAYMENT_LINK_FIELDS) {
        if (Object.prototype.hasOwnProperty.call(req.body, field)) {
          adminUpdates[field] = req.body[field];
        }
      }
      const link = await storage.updatePaymentLink(req.params.id, adminUpdates);
      if (!link) {
        return res.status(404).json({ message: "Lien non trouvé" });
      }
      
      await storage.createAdminLog({
        adminId: req.userId!,
        action: "update_payment_link",
        targetType: "payment_link",
        targetId: req.params.id,
        details: JSON.stringify(req.body),
        ipAddress: req.ip || null,
      });
      
      res.json(link);
    } catch (error) {
      console.error("Admin update payment link error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Count pending withdrawal number changes (for sidebar badge)
  app.get("/api/admin/withdrawal-number-changes/count", requireAuth, requireAdmin, async (req, res) => {
    try {
      const changes = await storage.getPendingWithdrawalNumberChanges();
      res.json({ count: changes.length });
    } catch (error) {
      console.error("Admin withdrawal number changes count error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Get pending withdrawal number changes
  app.get("/api/admin/withdrawal-number-changes", requireAuth, requireAdmin, async (req, res) => {
    try {
      const changes = await storage.getPendingWithdrawalNumberChanges();
      const changesWithDetails = await Promise.all(
        changes.map(async (change) => {
          const user = await storage.getUser(change.userId);
          const existingNumber = change.withdrawalNumberId 
            ? await storage.getWithdrawalNumber(change.withdrawalNumberId)
            : null;
          return {
            ...change,
            user: user ? {
              id: user.id,
              fullName: user.fullName,
              email: user.email,
              phone: user.phone,
            } : null,
            existingNumber,
          };
        })
      );
      res.json(changesWithDetails);
    } catch (error) {
      console.error("Admin get withdrawal changes error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Approve withdrawal number change
  app.post("/api/admin/withdrawal-number-changes/:id/approve", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { note } = req.body;
      const change = await storage.approveWithdrawalNumberChange(
        req.params.id, 
        req.userId!, 
        note
      );
      
      if (!change) {
        return res.status(404).json({ message: "Demande non trouvée" });
      }

      // Send withdrawal number approved email
      const wnUser = await storage.getUser(change.userId).catch(() => null);
      if (wnUser?.email) {
        const wNumbers = await storage.getWithdrawalNumbersByUserId(change.userId).catch(() => []);
        const wn = wNumbers.find((n: any) => n.id === change.withdrawalNumberId);
        sendWithdrawalNumberApprovedEmail(
          wnUser.email,
          wnUser.fullName || wnUser.username,
          wn?.phoneNumber || change.newPhoneNumber || "",
          wn?.operatorName || change.newOperatorName || undefined
        ).catch(() => {});
      }

      await storage.createAdminLog({
        adminId: req.userId!,
        action: "approve_withdrawal_number_change",
        targetType: "withdrawal_number_change",
        targetId: req.params.id,
        details: JSON.stringify({ note }),
        ipAddress: req.ip || null,
      });
      
      res.json({ change, message: "Changement approuvé" });
    } catch (error) {
      console.error("Admin approve change error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Reject withdrawal number change
  app.post("/api/admin/withdrawal-number-changes/:id/reject", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { note } = req.body;
      const change = await storage.rejectWithdrawalNumberChange(
        req.params.id, 
        req.userId!, 
        note
      );
      
      if (!change) {
        return res.status(404).json({ message: "Demande non trouvée" });
      }
      
      await storage.createAdminLog({
        adminId: req.userId!,
        action: "reject_withdrawal_number_change",
        targetType: "withdrawal_number_change",
        targetId: req.params.id,
        details: JSON.stringify({ note }),
        ipAddress: req.ip || null,
      });
      
      res.json({ change, message: "Changement rejeté" });
    } catch (error) {
      console.error("Admin reject change error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // ============= ADMIN: PENDING MANUAL PAYOUTS =============

  // ─── In-flight guard — one Set per process ───────────────────────────────
  // Blocks concurrent admin clicks on the same transaction before the DB lock
  // (Solution 1) even has a chance to fire.
  const executingPayouts = new Set<string>();

  // GET /api/admin/pending-payouts — list all pending_manual withdrawals & transfers
  app.get("/api/admin/pending-payouts", requireAuth, requireAdmin, async (_req, res) => {
    try {
      const txs = await storage.getPendingManualPayouts();
      const enriched = await Promise.all(txs.map(async (t) => {
        const user = await storage.getUser(t.userId).catch(() => null);
        const operator = t.operatorId ? await storage.getOperator(t.operatorId).catch(() => null) : null;
        return {
          ...t,
          userFullName: (user as any)?.fullName || (user as any)?.username || "Inconnu",
          userEmail: (user as any)?.email || "",
          operatorName: (operator as any)?.name || null,
          originalProvider: (operator as any)?.paymentProvider || (operator as any)?.depositPaymentProvider || null,
        };
      }));
      res.json(enriched);
    } catch (error) {
      console.error("Admin pending-payouts error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // POST /api/admin/pending-payouts/:id/execute — execute with chosen provider
  app.post("/api/admin/pending-payouts/:id/execute", requireAuth, requireAdmin, async (req, res) => {
    const txId = req.params.id;

    // ── Solution 1: in-memory guard (fast-path, same process) ─────────────
    if (executingPayouts.has(txId)) {
      return res.status(409).json({ message: "Exécution déjà en cours pour cette transaction" });
    }
    executingPayouts.add(txId);

    // Both flags declared outside try so catch can read them.
    // lockAcquired: the atomic UPDATE succeeded — transaction is now "processing".
    //               Only revert on error when this is true.
    // providerSubmitted: provider accepted the call — money is in-flight.
    //                    Never revert to pending_manual when this is true.
    let lockAcquired = false;
    let providerSubmitted = false;

    try {
      const { provider } = req.body as { provider: "afribapay" | "pixpay" | "pawapay" };
      if (!provider || !["afribapay","pixpay","pawapay"].includes(provider)) {
        return res.status(400).json({ message: "Fournisseur invalide" });
      }

      const tx = await storage.getTransactionById(txId);
      if (!tx) return res.status(404).json({ message: "Transaction non trouvée" });
      if (!["withdrawal","transfer_out"].includes(tx.type)) {
        return res.status(400).json({ message: "Type de transaction non supporté" });
      }
      if (tx.externalReference && isPawaPayUuidV4(tx.externalReference)) {
        const reconciled = await reconcilePawaPayPayoutAttempt(tx);
        if (reconciled === "unresolved") {
          return res.status(409).json({ message: "Un paiement mobile est déjà en cours de rapprochement; changement ou nouvelle soumission interdit." });
        }
        return res.status(409).json({ message: "La tentative existante a été rapprochée; aucune nouvelle soumission autorisée.", status: reconciled });
      }

      // ── Solution 2: atomic DB lock — pending_manual → processing ──────────
      // A single SQL UPDATE with a WHERE on status ensures only one request
      // can proceed, even across multiple server instances (PM2, etc.).
      // Any concurrent request gets 0 rows back and is rejected immediately.
      const locked = await db
        .update(transactionsTable)
        .set({ status: "processing" })
        .where(and(eq(transactionsTable.id, txId), eq(transactionsTable.status, "pending_manual")))
        .returning({ id: transactionsTable.id });

      if (locked.length === 0) {
        return res.status(409).json({ message: "Transaction déjà en cours d'exécution ou statut incorrect" });
      }
      lockAcquired = true; // status is now "processing" — catch must revert on pre-submit errors

      // From here the transaction is in "processing" — no other request can enter.
      // Pre-submit error paths revert to "pending_manual" so the admin can retry.
      // Post-submit errors must NOT revert (see providerSubmitted in catch).

      const txUser = await storage.getUser(tx.userId);
      if (!txUser) {
        await storage.updateTransactionStatus(txId, "pending_manual");
        return res.status(404).json({ message: "Utilisateur non trouvé" });
      }

      const operator = tx.operatorId ? await storage.getOperator(tx.operatorId).catch(() => null) : null;
      // recipientCountry may be a code ("CM") for withdrawals or a name ("Cameroun") for transfers.
      // If longer than 2 chars, resolve the code from the operator's country.
      let countryCode = (tx.recipientCountry || "CM").toUpperCase();
      if (countryCode.length > 2 && operator?.countryId) {
        const opCountry = await storage.getCountry(operator.countryId).catch(() => null);
        if (opCountry?.code) countryCode = opCountry.code.toUpperCase();
      }
      const phone = tx.recipientPhone || "";
      const creditedAmount = parseFloat(tx.amount);
      const totalAmount = parseFloat(tx.totalAmount || tx.amount);
      const recipientName = tx.recipientName || txUser.fullName || txUser.username || "Client";
      const txRef = tx.reference || "";

      let payoutResult: { success: boolean; transaction_id?: string; transactionId?: string; message?: string } = {
        success: false,
        message: "Fournisseur de paiement non supporté",
      };
      // pollerRef = the reference the poller uses to check status with the provider.
      let pollerRef = txRef;

      if (provider === "pawapay") {
        if (tx.externalReference && isPawaPayUuidV4(tx.externalReference)) {
          const existingId = tx.externalReference;
          let status: "pending" | "completed" | "failed" = "pending";
          try { status = (await getPawaPayPayout(existingId)).status; } catch { status = "pending"; }
          if (status === "completed" || status === "failed") {
            await processPawaPayPayoutCallback(tx, status === "completed" ? "success" : "failed");
            return res.status(409).json({ message: status === "completed" ? "Paiement déjà traité." : "Paiement précédemment rejeté; créez une nouvelle transaction." });
          }
          await storage.updateTransactionStatus(txId, "processing");
          addPendingPayout({
            transactionId: txId, reference: existingId, externalReference: existingId, userId: tx.userId,
            amount: tx.amount, totalDebited: totalAmount.toFixed(2), provider: "pawapay", countryCode,
            txType: tx.type, txCurrency: tx.currency || "XAF",
          });
          providerSubmitted = true;
          return res.status(202).json({ message: "Paiement en cours de rapprochement.", reference: existingId });
        }
        await assertPawaPayProviderActive(resolvePawaPayProviderCode(operator, operator?.name || "", countryCode), "PAYOUT", pawaPayCountry(countryCode));
        const pawaPayRetryId = createPawaPayId();
        await storage.updateTransactionMetadata(txId, {
          ...((tx.metadata || {}) as Record<string, unknown>),
          paymentProvider: "pawapay", pawaCountry: pawaPayCountry(countryCode),
          walletCurrency: (tx.metadata as any)?.walletCurrency || tx.currency || "XAF",
        });
        // Store the recovery key before the request. If the network outcome is
        // ambiguous, the processing transaction is recoverable by this UUID.
        await storage.updateTransactionExternalReference(txId, pawaPayRetryId);
        const result = await createPawaPayPayout({
          payoutId: pawaPayRetryId,
          country: pawaPayCountry(countryCode),
          amount: creditedAmount.toFixed(2),
          currency: toPawaPayCurrency(tx.currency || "XAF"),
          recipient: {
            provider: resolvePawaPayProviderCode(operator, operator?.name || "", countryCode),
            phoneNumber: normalizePhone(phone) || "",
          },
          clientReferenceId: txRef,
          customerMessage: PAWAPAY_CUSTOMER_MESSAGE,
        });
        payoutResult = { success: result.success, transaction_id: pawaPayRetryId, message: result.providerMessage };
        if (result.success) pollerRef = pawaPayRetryId;
      } else if (provider === "afribapay") {
        const operatorName = (operator?.name || "").toUpperCase();
        const afribapayOperatorCode = resolveAfribaPayOperatorCode(operator, operatorName);
        const afribapayCurrency = AFRIBAPAY_ISO_CURRENCY[countryCode] || tx.currency || "XAF";
        let localPhone = phone.replace(/\s/g, "");
        if (localPhone.startsWith("+")) localPhone = localPhone.slice(1);
        const phonePrefixes: Record<string, string> = {
          CM:"237",SN:"221",CI:"225",BF:"226",ML:"223",GN:"224",BJ:"229",TG:"228",NE:"227",
          CD:"243",CG:"242",CF:"236",TD:"235",GA:"241",GQ:"240",MG:"261",RW:"250",KE:"254",TZ:"255",UG:"256",GH:"233",NG:"234",
        };
        const pfx = phonePrefixes[countryCode];
        if (pfx && localPhone.startsWith(pfx)) localPhone = localPhone.slice(pfx.length);
        const callbackUrl = buildWebhookUrl("/api/afribapay/webhook");
        const afribaAdminRetryRef = `${txRef}-R${Date.now().toString(36)}`;

        // ── Solution 3: persist ref BEFORE calling provider ─────────────────
        // If the server crashes after a successful provider call but before
        // updateTransactionStatus, recoverPendingPayouts() finds "processing"
        // + externalReference and polls the provider instead of re-executing.
        await storage.updateTransactionExternalReference(txId, afribaAdminRetryRef);

        const result = await initiateAfribaPayout({
          operator: afribapayOperatorCode,
          country: countryCode,
          phone_number: localPhone,
          amount: creditedAmount,
          currency: afribapayCurrency,
          order_id: afribaAdminRetryRef,
          reference_id: afribaAdminRetryRef,
          notify_url: callbackUrl,
        });
        if (result.success) {
          // AfribaPay status API uses order_id for lookup.
          pollerRef = afribaAdminRetryRef;
        }
        payoutResult = result;

      } else if (provider === "pixpay") {
        const serviceId = getPixPayServiceId(operator?.name || "", countryCode, "cash_in");
        if (!serviceId) {
          await storage.updateTransactionStatus(txId, "pending_manual");
          return res.status(400).json({ message: `PixPay non supporté pour cet opérateur (${operator?.name}) dans ${countryCode}` });
        }
        const pixpayIpnUrl = buildWebhookUrl("/api/pixpay/webhook");
        const pixpayAdminRetryRef = `${txRef}-R${Date.now().toString(36)}`;

        // ── Solution 3: persist ref BEFORE calling provider ─────────────────
        await storage.updateTransactionExternalReference(txId, pixpayAdminRetryRef);

        const result = await initiatePixPayPayout({
          serviceId: String(serviceId),
          amount: creditedAmount,
          phone: phone.replace(/\s/g, ""),
          countryCode,
          orderId: pixpayAdminRetryRef,
          ipnUrl: pixpayIpnUrl,
          customData: txRef,
        });
        if (result.success) {
          // PixPay returns its own transactionId — use it for status polling.
          pollerRef = result.transactionId || pixpayAdminRetryRef;
          await storage.updateTransactionExternalReference(txId, pollerRef);
        }
        payoutResult = result;

      }

      if (payoutResult.success) {
        // Provider accepted — mark this BEFORE any DB write so the catch block
        // knows not to revert to pending_manual if a subsequent step throws.
        providerSubmitted = true;
        await storage.updateTransactionStatus(txId, "pending");
        addPendingPayout({
          transactionId: txId,
          reference:     pollerRef,
          userId:        tx.userId,
          amount:        tx.amount,
          totalDebited:  totalAmount.toFixed(2),
          provider,
          ...(provider === "pawapay" ? { externalReference: pollerRef } : {}),
          countryCode,
          txType:        tx.type,
          txCurrency:    tx.currency || "XAF",
        });
        // Bookkeeping is non-fatal: a failure here must not roll back the
        // transaction to pending_manual (the payment is already dispatched).
        storage.createAdminLog({
          adminId: req.userId!,
          action: "execute_pending_payout",
          targetType: "transaction",
          targetId: txId,
          details: JSON.stringify({ provider, reference: pollerRef }),
          ipAddress: req.ip || null,
        }).catch((e: any) => console.error("[Admin] AdminLog error (non-fatal):", e.message));
        console.log(`[Admin] Executed pending_manual payout ${txRef} via ${provider} → poller ref: ${pollerRef}`);
        res.json({ message: `Payout soumis via ${provider} avec succès`, reference: pollerRef });
      } else {
        // Insufficient balance / whitelist errors are NOT definitive failures:
        // revert to pending_manual so the admin can retry after topping up.
        const errMsg = (payoutResult.message || "").toLowerCase();
        const requiresManualReview =
          errMsg.includes("forbidden") ||
          errMsg.includes("whitelist") ||
          errMsg.includes("insuffi") ||
          errMsg.includes("solde") ||
          errMsg.includes("balance");

        await storage.updateTransactionStatus(txId, "pending_manual");
        await storage.createAdminLog({
          adminId: req.userId!,
          action: "execute_pending_payout_retry_failed",
          targetType: "transaction",
          targetId: txId,
          details: JSON.stringify({ provider, message: payoutResult.message }),
          ipAddress: req.ip || null,
        });

        if (requiresManualReview) {
          console.log(`[Admin] Execute pending_manual — still insufficient via ${provider} for ${txRef}: ${payoutResult.message}`);
          res.status(409).json({
            pendingManual: true,
            message: `Solde ${provider === "afribapay" ? "AfribaPay" : "PixPay"} toujours insuffisant. La transaction reste en attente — rechargez le wallet fournisseur puis réessayez (ou essayez l’autre fournisseur).`,
          });
        } else {
          console.error(`[Admin] Execute pending_manual failed (${provider}): ${payoutResult.message}`);
          res.status(400).json({ message: `Échec via ${provider}: ${payoutResult.message}` });
        }
      }
    } catch (error: any) {
      // lockAcquired=false → status was never changed, no revert needed.
      // lockAcquired=true, providerSubmitted=false → pre-submit error, revert to pending_manual.
      // lockAcquired=true, providerSubmitted=true → money already dispatched; keep
      //   "processing" so recoverPendingPayouts() polls instead of re-executing.
      if (lockAcquired && !providerSubmitted) {
        await storage.updateTransactionStatus(txId, "pending_manual").catch(() => {});
      } else if (providerSubmitted) {
        console.warn(`[Admin] Post-submit error (payout already dispatched, keeping processing): ${error.message}`);
      }
      console.error("Admin execute pending-payout error:", error.message);
      res.status(500).json({ message: "Erreur serveur" });
    } finally {
      // Always release the in-memory guard, even on error.
      executingPayouts.delete(txId);
    }
  });

  // POST /api/admin/pending-payouts/:id/confirm — mark as completed without calling any provider
  app.post("/api/admin/pending-payouts/:id/confirm", requireAuth, requireAdmin, async (req, res) => {
    try {
      const tx = await storage.getTransactionById(req.params.id);
      if (!tx || tx.status !== "pending_manual") {
        return res.status(404).json({ message: "Transaction non trouvée ou statut incorrect" });
      }
      if (tx.externalReference && isPawaPayUuidV4(tx.externalReference)) {
        const reconciled = await reconcilePawaPayPayoutAttempt(tx);
        if (reconciled === "unresolved") {
          return res.status(409).json({ message: "Paiement encore en cours de rapprochement; confirmation manuelle interdite." });
        }
        return res.json({ message: "Paiement rapproché avec le fournisseur.", status: reconciled });
      }
      await storage.updateTransactionStatus(tx.id, "completed");
      const txUser = await storage.getUser(tx.userId).catch(() => null);
      if (txUser?.email) {
        sendWithdrawalApprovedEmail(
          txUser.email,
          (txUser as any).fullName || (txUser as any).username,
          tx.amount,
          tx.currency || "XAF",
          tx.reference || undefined,
          (tx as any).operator || undefined
        ).catch(() => {});
      }
      await storage.createUserNotification({
        userId: tx.userId,
        type: tx.type === "withdrawal" ? "withdrawal_confirmed" : "transfer_confirmed",
        title: tx.type === "withdrawal" ? "Retrait confirmé" : "Transfert confirmé",
        message: `Votre ${tx.type === "withdrawal" ? "retrait" : "transfert"} de ${parseFloat(tx.amount).toLocaleString("fr-FR")} ${tx.currency} a été traité avec succès.`,
        transactionId: tx.id,
        isRead: false,
      });
      const adminUser = await storage.getUser(req.userId!).catch(() => null);
      notifyWithdrawalManuallyValidated({
        adminName: (adminUser as any)?.fullName || (adminUser as any)?.username || "Admin",
        userName: (txUser as any)?.fullName || (txUser as any)?.username || "Inconnu",
        userEmail: (txUser as any)?.email || "",
        userPhone: (txUser as any)?.phone || undefined,
        senderCountry: (txUser as any)?.country || undefined,
        amount: tx.amount,
        grossAmount: (tx as any).totalAmount || tx.amount,
        currency: tx.currency || "XAF",
        walletCurrency: (tx.metadata as any)?.walletCurrency || tx.currency || "XAF",
        reference: tx.reference || tx.id,
        externalReference: (tx as any).externalReference || undefined,
        recipientName: tx.recipientName || undefined,
        recipientPhone: tx.recipientPhone || undefined,
        recipientCountry: tx.recipientCountry || undefined,
      }).catch(() => {});
      await storage.createAdminLog({
        adminId: req.userId!,
        action: "confirm_pending_payout",
        targetType: "transaction",
        targetId: tx.id,
        details: JSON.stringify({ amount: tx.amount, currency: tx.currency }),
        ipAddress: req.ip || null,
      });
      console.log(`[Admin] Manually confirmed pending_manual ${tx.reference} as completed`);
      res.json({ message: "Transaction confirmée comme effectuée" });
    } catch (error: any) {
      console.error("Admin confirm pending-payout error:", error.message);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // POST /api/admin/pending-payouts/:id/refund — cancel and refund user
  app.post("/api/admin/pending-payouts/:id/refund", requireAuth, requireAdmin, async (req, res) => {
    try {
      const tx = await storage.getTransactionById(req.params.id);
      if (!tx || tx.status !== "pending_manual") {
        return res.status(404).json({ message: "Transaction non trouvée ou statut incorrect" });
      }
      const totalAmount = parseFloat(tx.totalAmount || tx.amount);
      // Refund FIRST — if this throws, status stays pending_manual and money is safe
      await storage.refundToOriginalWallet(tx.userId, tx.type, tx.currency || "XAF", totalAmount);
      await storage.updateTransactionStatus(tx.id, "failed");
      setFailedCooldown(tx.userId); // Cooldown 5min avant la prochaine tentative
      await storage.createUserNotification({
        userId: tx.userId,
        type: tx.type === "withdrawal" ? "withdrawal_failed" : "transfer_failed",
        title: tx.type === "withdrawal" ? "Retrait annulé" : "Transfert annulé",
        message: `Votre ${tx.type === "withdrawal" ? "retrait" : "transfert"} de ${parseFloat(tx.amount).toLocaleString("fr-FR")} ${tx.currency} a été annulé et remboursé sur votre compte.`,
        transactionId: tx.id,
        isRead: false,
      });
      await storage.createAdminLog({
        adminId: req.userId!,
        action: "refund_pending_payout",
        targetType: "transaction",
        targetId: tx.id,
        details: JSON.stringify({ totalAmount, currency: tx.currency }),
        ipAddress: req.ip || null,
      });
      console.log(`[Admin] Refunded pending_manual ${tx.reference} — ${totalAmount} ${tx.currency} to user ${tx.userId}`);
      res.json({ message: "Transaction annulée et remboursée" });
    } catch (error: any) {
      console.error("Admin refund pending-payout error:", error.message);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // ============= USER NOTIFICATIONS =============

  // Browser Web Push
  app.get("/api/push/public-key", requireAuth, (_req, res) => {
    const publicKey = getVapidPublicKey();
    if (!publicKey) {
      return res.status(503).json({ message: "Les notifications push ne sont pas configurées sur ce serveur." });
    }
    res.json({ publicKey });
  });

  app.post("/api/push-subscriptions", requireAuth, async (req, res) => {
    try {
      const endpoint = typeof req.body?.endpoint === "string" ? req.body.endpoint.trim() : "";
      const p256dh = typeof req.body?.p256dh === "string" ? req.body.p256dh.trim() : "";
      const auth = typeof req.body?.auth === "string" ? req.body.auth.trim() : "";
      if (!endpoint.startsWith("https://") || endpoint.length > 4096 || !p256dh || !auth || p256dh.length > 512 || auth.length > 512) {
        return res.status(400).json({ message: "Abonnement push invalide." });
      }

      await storage.savePushSubscription(req.userId!, { endpoint, p256dh, auth }, req.get("user-agent"));
      res.json({ success: true });
    } catch (error: any) {
      console.error("[Push] Subscription save error:", error?.message || error);
      res.status(500).json({ message: "Impossible d'enregistrer cet appareil." });
    }
  });

  app.delete("/api/push-subscriptions", requireAuth, async (req, res) => {
    try {
      const endpoint = typeof req.body?.endpoint === "string" ? req.body.endpoint.trim() : "";
      if (!endpoint.startsWith("https://") || endpoint.length > 4096) {
        return res.status(400).json({ message: "Abonnement push invalide." });
      }
      await storage.deletePushSubscription(req.userId!, endpoint);
      res.json({ success: true });
    } catch (error: any) {
      console.error("[Push] Subscription delete error:", error?.message || error);
      res.status(500).json({ message: "Impossible de désactiver cet appareil." });
    }
  });

  // Get user notifications
  app.get("/api/notifications", requireAuth, async (req, res) => {
    try {
      const notifications = await storage.getUserNotifications(req.userId!);
      const unreadCount = await storage.getUnreadNotificationCount(req.userId!);
      
      // Also include active global messages as notifications (excluding dismissed ones)
      const globalMessages = await storage.getActiveGlobalMessagesForUser(req.userId!);
      const globalNotifications = globalMessages.map(msg => ({
        id: `global-${msg.id}`,
        userId: req.userId!,
        type: "global_message",
        title: msg.title,
        message: msg.message,
        transactionId: null,
        isRead: false,
        createdAt: msg.createdAt,
      }));
      
      res.json({ 
        notifications: [...globalNotifications, ...notifications],
        unreadCount: unreadCount + globalMessages.length
      });
    } catch (error) {
      console.error("Get notifications error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Mark notification as read (handles global messages too)
  app.post("/api/notifications/:id/read", requireAuth, async (req, res) => {
    try {
      const notificationId = req.params.id;
      
      // Check if it's a global message - dismiss it instead of marking as read
      if (notificationId.startsWith("global-")) {
        const globalMessageId = notificationId.replace("global-", "");
        await storage.dismissGlobalMessage(req.userId!, globalMessageId);
      } else {
        await storage.markNotificationAsRead(notificationId, req.userId!);
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Mark notification read error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Mark all notifications as read
  app.post("/api/notifications/read-all", requireAuth, async (req, res) => {
    try {
      // Mark regular notifications as read
      await storage.markAllNotificationsAsRead(req.userId!);
      
      // Also dismiss all active global messages for this user
      const globalMessages = await storage.getActiveGlobalMessagesForUser(req.userId!);
      for (const msg of globalMessages) {
        await storage.dismissGlobalMessage(req.userId!, msg.id);
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Mark all notifications read error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Delete notification (handles global messages too)
  app.delete("/api/notifications", requireAuth, async (req, res) => {
    try {
      await storage.deleteAllUserNotifications(req.userId!);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete all notifications error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.delete("/api/notifications/:id", requireAuth, async (req, res) => {
    try {
      const notificationId = req.params.id;
      
      // Check if it's a global message - dismiss it
      if (notificationId.startsWith("global-")) {
        const globalMessageId = notificationId.replace("global-", "");
        await storage.dismissGlobalMessage(req.userId!, globalMessageId);
      } else {
        await storage.deleteUserNotification(notificationId, req.userId!);
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Delete notification error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Get active global messages for current user (regardless of dismissal)
  app.get("/api/global-messages/active", requireAuth, async (req, res) => {
    try {
      const all = await storage.getActiveGlobalMessages();
      const now = new Date();
      const active = all.filter(m => !m.expiresAt || new Date(m.expiresAt) > now);
      res.json(active);
    } catch (error) {
      console.error("Get active global messages error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // ============= ADMIN GLOBAL MESSAGES =============

  // Get all global messages (admin)
  app.get("/api/admin/global-messages", requireAuth, requireAdmin, async (req, res) => {
    try {
      const messages = await storage.getAllGlobalMessages();
      res.json(messages);
    } catch (error) {
      console.error("Get global messages error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Create global message
  app.post("/api/admin/global-messages", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { title, message, expiresAt } = req.body;
      
      if (!title || !message) {
        return res.status(400).json({ message: "Titre et message requis" });
      }
      
      const globalMessage = await storage.createGlobalMessage({
        adminId: req.userId!,
        title,
        message,
        isActive: true,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      });

      // Global messages are also delivered to every currently subscribed
      // browser. The persisted global message remains the source of truth
      // for users who are offline or subscribe after publication.
      void sendPushNotificationToAll({
        title,
        body: message,
        type: "global_message",
        url: "/dashboard/notifications",
      }).catch((error) => {
        console.error("[Push] Global message broadcast failed:", error?.message || error);
      });
      
      await storage.createAdminLog({
        adminId: req.userId!,
        action: "create_global_message",
        targetType: "global_message",
        targetId: globalMessage.id,
        details: JSON.stringify({ title }),
        ipAddress: req.ip || null,
      });
      
      res.json(globalMessage);
    } catch (error) {
      console.error("Create global message error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Update global message
  app.patch("/api/admin/global-messages/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { title, message, isActive, expiresAt } = req.body;
      
      const updates: Record<string, any> = {};
      if (title !== undefined) updates.title = title;
      if (message !== undefined) updates.message = message;
      if (isActive !== undefined) updates.isActive = isActive;
      if (expiresAt !== undefined) updates.expiresAt = expiresAt ? new Date(expiresAt) : null;
      
      const globalMessage = await storage.updateGlobalMessage(req.params.id, updates);
      
      if (!globalMessage) {
        return res.status(404).json({ message: "Message non trouvé" });
      }
      
      await storage.createAdminLog({
        adminId: req.userId!,
        action: "update_global_message",
        targetType: "global_message",
        targetId: req.params.id,
        details: JSON.stringify(updates),
        ipAddress: req.ip || null,
      });
      
      res.json(globalMessage);
    } catch (error) {
      console.error("Update global message error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Delete global message
  app.delete("/api/admin/global-messages/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      await storage.deleteGlobalMessage(req.params.id);
      
      await storage.createAdminLog({
        adminId: req.userId!,
        action: "delete_global_message",
        targetType: "global_message",
        targetId: req.params.id,
        details: null,
        ipAddress: req.ip || null,
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Delete global message error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // ============ KYC Routes ============

  // User: Get own KYC submission
  app.get("/api/kyc", requireAuth, async (req, res) => {
    try {
      const submission = await storage.getKycSubmissionByUserId(req.userId!);
      res.json(submission || null);
    } catch (error) {
      console.error("Get KYC error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // User: Submit KYC
  app.post("/api/kyc", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      
      // Check if user already has a pending KYC submission
      const existingSubmission = await storage.getKycSubmissionByUserId(userId);
      if (existingSubmission && existingSubmission.status === "pending") {
        return res.status(400).json({ message: "Vous avez déjà une demande KYC en attente" });
      }
      if (existingSubmission && existingSubmission.status === "approved") {
        return res.status(400).json({ message: "Votre compte est déjà vérifié" });
      }
      
      const { 
        documentType, 
        documentNumber, 
        documentFrontPath, 
        documentBackPath, 
        selfiePath,
        country,
        city,
        postalCode,
        latitude,
        longitude,
        businessType,
        businessCategory,
        businessDescription 
      } = req.body;
      
      // Validate required fields
      if (!documentType || !documentNumber || !documentFrontPath || !documentBackPath || !selfiePath || !businessType || !businessCategory || !businessDescription) {
        return res.status(400).json({ message: "Tous les champs sont requis" });
      }
      
      const submission = await storage.createKycSubmission({
        userId,
        documentType,
        documentNumber,
        documentFrontPath,
        documentBackPath,
        selfiePath,
        country: country || null,
        city: city || null,
        postalCode: postalCode || null,
        latitude: latitude || null,
        longitude: longitude || null,
        businessType,
        businessCategory,
        businessDescription,
      });

      // Notify via Telegram (with photos + inline buttons)
      const kycSubmitter = await storage.getUser(userId).catch(() => null);
      if (kycSubmitter) {
        Promise.all([
          resolveFileUrl(documentFrontPath),
          resolveFileUrl(documentBackPath),
          resolveFileUrl(selfiePath),
        ]).then(([frontUrl, backUrl, selfieUrl]) => {
          notifyKycSubmittedFull({
            submissionId: submission.id,
            userName: kycSubmitter.fullName || kycSubmitter.username,
            userEmail: kycSubmitter.email || "",
            userId: kycSubmitter.id,
            documentType,
            documentNumber,
            country: country || undefined,
            city: city || undefined,
            businessType,
            businessCategory,
            businessDescription,
            photoUrls: { front: frontUrl, back: backUrl, selfie: selfieUrl },
          });
        }).catch(() => {});
      }

      res.json(submission);
    } catch (error) {
      console.error("Submit KYC error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Get all KYC submissions
  app.get("/api/admin/kyc", requireAuth, requireAdmin, async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const submissions = await storage.getAllKycSubmissions(status);

      // Build a map: documentNumber -> list of submissions with that document
      const docMap = new Map<string, typeof submissions>();
      for (const sub of submissions) {
        if (!sub.documentNumber) continue;
        const key = sub.documentNumber.trim().toLowerCase();
        if (!docMap.has(key)) docMap.set(key, []);
        docMap.get(key)!.push(sub);
      }
      // Also get ALL submissions (not just filtered) to detect cross-status duplicates
      const allSubmissions = status ? await storage.getAllKycSubmissions() : submissions;
      const allDocMap = new Map<string, typeof allSubmissions>();
      for (const sub of allSubmissions) {
        if (!sub.documentNumber) continue;
        const key = sub.documentNumber.trim().toLowerCase();
        if (!allDocMap.has(key)) allDocMap.set(key, []);
        allDocMap.get(key)!.push(sub);
      }

      // Batch-fetch all users needed (submissions + duplicates) in one query
      const allNeededIds = new Set<string>();
      for (const sub of submissions) allNeededIds.add(sub.userId);
      for (const sub of allSubmissions) allNeededIds.add(sub.userId);
      const userMap = await storage.getUsersByIds([...allNeededIds]);

      const enrichedSubmissions = submissions.map((sub) => {
        const user = userMap.get(sub.userId);
        const key = sub.documentNumber?.trim().toLowerCase() || "";
        const duplicates = (allDocMap.get(key) || []).filter(d => d.id !== sub.id);
        const duplicateAccounts = duplicates.map((dup) => {
          const dupUser = userMap.get(dup.userId);
          return {
            submissionId: dup.id,
            userId: dup.userId,
            status: dup.status,
            fullName: dupUser?.fullName || "N/A",
            email: dupUser?.email || "N/A",
            username: dupUser?.username || "N/A",
          };
        });
        return {
          ...sub,
          user: user ? {
            id: user.id,
            fullName: user.fullName,
            email: user.email,
            phone: user.phone,
            username: user.username,
            createdAt: user.createdAt,
          } : null,
          duplicateAccounts,
        };
      });

      res.json(enrichedSubmissions);
    } catch (error) {
      console.error("Get admin KYC error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Get KYC stats
  app.get("/api/admin/kyc/stats", requireAuth, requireAdmin, async (req, res) => {
    try {
      const pending = await storage.countKycByStatus("pending");
      const approved = await storage.countKycByStatus("approved");
      const rejected = await storage.countKycByStatus("rejected");
      
      res.json({ pending, approved, rejected });
    } catch (error) {
      console.error("Get KYC stats error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Get single KYC submission
  app.get("/api/admin/kyc/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const submission = await storage.getKycSubmissionById(req.params.id);
      if (!submission) {
        return res.status(404).json({ message: "Soumission KYC non trouvée" });
      }
      
      const user = await storage.getUser(submission.userId);
      
      res.json({
        ...submission,
        user: user ? {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          phone: user.phone,
          username: user.username,
          country: user.country,
          createdAt: user.createdAt,
        } : null,
      });
    } catch (error) {
      console.error("Get KYC detail error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Approve KYC submission
  app.post("/api/admin/kyc/:id/approve", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { note } = req.body;
      const submission = await storage.approveKycSubmission(
        req.params.id, 
        req.userId!, 
        note
      );
      
      if (!submission) {
        return res.status(404).json({ message: "Soumission KYC non trouvée" });
      }
      
      // Send KYC approved email + Telegram
      const kycUser = await storage.getUser(submission.userId).catch(() => null);
      if (kycUser?.email) {
        sendKycApprovedEmail(kycUser.email, kycUser.fullName || kycUser.username).catch(() => {});
      }
      if (kycUser) {
        const adminUser = await storage.getUser(req.userId!).catch(() => null);
        notifyKycApproved({
          adminName: adminUser?.fullName || adminUser?.username || "Admin",
          userName: kycUser.fullName || kycUser.username,
          userEmail: kycUser.email || "",
          userId: kycUser.id,
        }).catch(() => {});
      }

      // Répondre immédiatement — l'approbation DB est déjà effectuée
      res.json(submission);

      // Effets secondaires en fire-and-forget (ne bloquent pas la réponse)
      storage.createUserNotification({
        userId: submission.userId,
        type: "kyc_approved",
        title: "Compte vérifié",
        message: "Félicitations ! Votre vérification KYC a été approuvée. Vous avez maintenant accès à toutes les fonctionnalités.",
        transactionId: null,
      }).catch((e) => console.error("[KYC approve] createUserNotification failed:", e));

      storage.createAdminLog({
        adminId: req.userId!,
        action: "approve_kyc",
        targetType: "kyc_submission",
        targetId: req.params.id,
        details: JSON.stringify({ note }),
        ipAddress: req.ip || null,
      }).catch((e) => console.error("[KYC approve] createAdminLog failed:", e));

      audit(req, AUDIT.KYC_APPROVED, {
        userId: req.userId!,
        actorType: "admin",
        targetType: "kyc_submission",
        targetId: req.params.id,
        details: { affectedUserId: submission.userId, note: note || null },
      });
    } catch (error) {
      console.error("Approve KYC error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Reject KYC submission
  app.post("/api/admin/kyc/:id/reject", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { note } = req.body;
      
      if (!note) {
        return res.status(400).json({ message: "La raison du rejet est requise" });
      }
      
      const submission = await storage.rejectKycSubmission(
        req.params.id, 
        req.userId!, 
        note
      );
      
      if (!submission) {
        return res.status(404).json({ message: "Soumission KYC non trouvée" });
      }

      // Notify via Telegram
      const rejectedUser = await storage.getUser(submission.userId).catch(() => null);
      if (rejectedUser) {
        const rejectAdmin = await storage.getUser(req.userId!).catch(() => null);
        notifyKycRejected({
          adminName: rejectAdmin?.fullName || rejectAdmin?.username || "Admin",
          userName: rejectedUser.fullName || rejectedUser.username,
          userEmail: rejectedUser.email || "",
          userId: rejectedUser.id,
          reason: note,
        }).catch(() => {});
      }

      // Répondre immédiatement — le rejet DB est déjà effectué
      res.json(submission);

      // Effets secondaires en fire-and-forget
      storage.createUserNotification({
        userId: submission.userId,
        type: "kyc_rejected",
        title: "Vérification rejetée",
        message: `Votre vérification KYC a été rejetée. Raison: ${note}. Veuillez soumettre de nouveaux documents.`,
        transactionId: null,
      }).catch((e) => console.error("[KYC reject] createUserNotification failed:", e));

      storage.createAdminLog({
        adminId: req.userId!,
        action: "reject_kyc",
        targetType: "kyc_submission",
        targetId: req.params.id,
        details: JSON.stringify({ note }),
        ipAddress: req.ip || null,
      }).catch((e) => console.error("[KYC reject] createAdminLog failed:", e));

      audit(req, AUDIT.KYC_REJECTED, {
        userId: req.userId!,
        actorType: "admin",
        targetType: "kyc_submission",
        targetId: req.params.id,
        details: { affectedUserId: submission.userId, reason: note },
      });
    } catch (error) {
      console.error("Reject KYC error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  async function forwardMerchantWebhook(
    transaction: Transaction,
    finalStatus: "completed" | "failed"
  ): Promise<void> {
    await enqueueMerchantWebhook(transaction, finalStatus);
  }

  // ── IziChange webhook ───────────────────────────────────────────────────────
  app.post("/api/izichange/webhook", webhookLimiter, async (req, res) => {
    try {
      // Validate signature
      if (getIziPayWebhookSecret()) {
        const rawBody = (req as any).rawBody as Buffer | undefined;
        const signature = req.headers["x-izipay-signature"] as string | undefined;
        if (!rawBody || !signature) {
          console.error("[IziChange Webhook] Missing rawBody or signature header");
          return res.status(400).json({ message: "Missing signature" });
        }
        try {
          validateWebhook(rawBody, signature, getIziPayWebhookSecret());
        } catch (sigErr: any) {
          console.error("[IziChange Webhook] Signature validation failed:", sigErr.message);
          return res.status(401).json({ message: "Invalid signature" });
        }
      } else {
        console.error("[IziChange Webhook] IZIPAY_WEBHOOK_SECRET non configuré — requête rejetée");
        return res.status(503).json({ message: "Webhook endpoint not configured" });
      }

      // ── Log full payload so we can verify the real field names ──────────────
      const body = req.body || {};
      console.log("[IziChange Webhook] FULL PAYLOAD:", JSON.stringify(body));

      // IziChange may use { event } or { type } for the event name
      const eventType: string = body.event ?? body.type ?? "";
      // data may live under { data } or { object } or { paymentIntent } or flat at root
      const eventData: any = body.data ?? body.object ?? body.paymentIntent ?? body;

      console.log(`[IziChange Webhook] event=${eventType}`);

      // ── Process payment confirmation and failure events ──────────────────────
      // payment_intent.completed = Direct Charge fully confirmed
      // payin.confirmed           = on-chain payin confirmed (alternative event)
      const CREDIT_EVENTS = ["payment_intent.completed", "payin.confirmed"];
      const FAILURE_EVENTS = [
        "payment_intent.failed",
        "payment_intent.expired",
        "payin.failed",
        "payin.expired",
      ];
      if (!CREDIT_EVENTS.includes(eventType) && !FAILURE_EVENTS.includes(eventType)) {
        return res.json({ received: true });
      }

      // ── Defensive multi-path lookup for merchantReference ───────────────────
      // IziChange field may be camelCase, snake_case, or nested inside an object
      // under eventData. Try every known variant.
      const merchantReference: string =
        eventData?.merchantReference      ??
        eventData?.merchant_reference     ??
        eventData?.paymentIntent?.merchantReference ??
        eventData?.paymentIntent?.merchant_reference ??
        eventData?.payment_intent?.merchantReference ??
        eventData?.payment_intent?.merchant_reference ??
        eventData?.object?.merchantReference ??
        eventData?.object?.merchant_reference ??
        // Sometimes the reference is top-level in the root body
        body.merchantReference            ??
        body.merchant_reference           ??
        "";

      if (!merchantReference) {
        // Log everything we got so we can fix the path; return 200 to stop retries.
        console.error("[IziChange Webhook] ⚠️  merchantReference not found in payload. Keys at root:", Object.keys(body), "Keys in data:", Object.keys(eventData ?? {}));
        return res.status(200).json({ received: true, warning: "merchantReference not found — check server logs" });
      }

      console.log(`[IziChange Webhook] ref=${merchantReference}`);

      const transaction = await storage.getTransactionByReference(merchantReference);
      if (!transaction) {
        console.warn(`[IziChange Webhook] Transaction not found for ref=${merchantReference}`);
        return res.status(200).json({ message: "ok" });
      }

      if (transaction.status !== "pending") {
        console.log(`[IziChange Webhook] Already processed ref=${merchantReference} status=${transaction.status}`);
        return res.status(200).json({ message: "already processed" });
      }

      if (FAILURE_EVENTS.includes(eventType)) {
        const failedTransaction = await storage.claimTransactionStatus(transaction.id, "failed");
        if (failedTransaction) {
          forwardMerchantWebhook(failedTransaction, "failed").catch(() => {});
        }
        console.log(`[IziChange Webhook] ✗ Failed ref=${merchantReference} event=${eventType}`);
        return res.json({ received: true });
      }

      const creditAmount = parseFloat(transaction.amount);
      const claimedTransaction = await storage.claimTransactionStatus(transaction.id, "completed");
      if (!claimedTransaction) {
        return res.status(200).json({ received: true, message: "already processed" });
      }
      await creditUserWallet(transaction.userId, creditAmount, "USDT");
      const completedTransaction = await storage.getTransactionById(transaction.id);
      if (completedTransaction) {
        forwardMerchantWebhook(completedTransaction, "completed").catch(() => {});
      }

      await storage.createUserNotification({
        userId: transaction.userId,
        type: transaction.type === "payment_link" ? "payment_link_received" : "deposit_confirmed",
        title: transaction.type === "payment_link" ? "payment_link_received" : "deposit_confirmed",
        message: JSON.stringify({ amount: creditAmount.toFixed(6), currency: "USDT" }),
        transactionId: transaction.id,
        isRead: false,
      });

      if (transaction.paymentIntentId) {
        await storage.updatePaymentIntentStatus(transaction.paymentIntentId, "completed").catch(() => {});
      }

      if (transaction.type === "payment_link" && transaction.payerEmail && transaction.paymentLinkId) {
        try {
          const paymentLinkRecord = await storage.getPaymentLinkById(transaction.paymentLinkId);
          const pdfUrl = (paymentLinkRecord?.hasPdfDelivery && paymentLinkRecord?.pdfPath) ? paymentLinkRecord.pdfPath : null;
          await sendPayerConfirmationEmail(
            transaction.payerEmail,
            transaction.payerName || "Client",
            paymentLinkRecord?.title || "Lien de paiement",
            creditAmount.toFixed(4),
            "USDT",
            transaction.reference || transaction.id,
            pdfUrl,
          );
        } catch (emailErr: any) {
          console.error("[IziChange Webhook] Email error:", emailErr.message);
        }
      }

      const txUser = await storage.getUser(transaction.userId).catch(() => null);
      const txAssetCode = (transaction as any).metadata?.assetCode || "";
      notifyDepositConfirmed({
        userName: (txUser as any)?.fullName || (txUser as any)?.username || "Utilisateur",
        userEmail: (txUser as any)?.email || "",
        amount: creditAmount.toFixed(6),
        currency: "USDT",
        reference: merchantReference,
        externalReference: (transaction as any).externalReference || undefined,
        depositType: transaction.type,
        paymentMethod: "crypto",
        operator: txAssetCode || undefined,        // réseau crypto ex: "USDT.TRC20"
        provider: "IziChange",
        grossAmount: transaction.totalAmount || transaction.amount,
        providerFeeAmount: (transaction as any).metadata?.providerFeeAmountUsdt,
        providerFeePercent: (transaction as any).metadata?.providerFeePercent,
        ashtechFeeAmount: transaction.ashtechFeeAmount || (transaction as any).metadata?.ashtechFeeAmountUsdt,
        ashtechFeePercent: (transaction as any).metadata?.ashtechFeePercent,
        totalFeeAmount: transaction.feeAmount || (transaction as any).metadata?.totalFeeAmountUsdt,
        totalFeePercent: (transaction as any).metadata?.totalFeePercent,
      }).catch(() => {});

      console.log(`[IziChange Webhook] ✓ Credited ${creditAmount.toFixed(4)} USDT — ref=${merchantReference}`);
      return res.json({ received: true });
    } catch (error: any) {
      console.error("[IziChange Webhook] Error:", error);
      if (!res.headersSent) res.status(500).json({ message: "Internal error" });
    }
  });

  // ── Crypto deposit via IziChange ───────────────────────────────────────────
  app.post("/api/deposits/crypto", requireAuth, depositLimiter, async (req, res) => {
    try {
      if (!isIziPayConfigured()) {
        return res.status(503).json({ message: "Paiement crypto non configuré. Contactez l'administrateur." });
      }

      const { amount, currency: reqCurrency } = req.body;
      const numAmount = parseFloat(amount || "0");
      if (!amount || numAmount <= 0) {
        return res.status(400).json({ message: "Montant invalide" });
      }
      const userId = req.userId!;
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "Utilisateur non trouvé" });

      const fiatCurrency = ((reqCurrency || user.preferredCurrency || "XOF") as string).toUpperCase();
      const izipayCurrency = toIziPayCurrency(fiatCurrency);

      // Convert fiat amount to USDT using admin-configured rate (fx_rate_USDT) or fallback to live FX
      const fxRates = await loadFxRates();
      const amountInXAF = convertToXAF(numAmount, fiatCurrency, fxRates);
      const adminRateSetting = await storage.getSetting("fx_rate_USDT");
       const usdtPerXaf = adminRateSetting ? parseFloat(adminRateSetting.value) : (fxRates["USDT"] ?? 585);
      const amountInUSDT = amountInXAF / usdtPerXaf;
      const amounts = await resolveCryptoFeeBreakdown(amountInUSDT);

      const reference = generateTransactionReference("deposit");
      const appBase = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;

      const tx = await storage.createTransaction({
        userId,
        type: "deposit",
        amount: amounts.creditedUsdt.toFixed(6),
        totalAmount: amountInUSDT.toFixed(6),
        feeAmount: amounts.feeUsdt.toFixed(6),
        ashtechFeeAmount: amounts.ashtechFeeUsdt.toFixed(6),
        currency: "USDT",
        status: "pending",
        description: `Dépôt crypto IziChange — ${fiatCurrency} ${numAmount}`,
        paymentMethod: "crypto",
        reference,
        metadata: {
          grossAmountUsdt: amounts.grossUsdt,
          providerFeePercent: amounts.providerFeePercent,
          providerFeeAmountUsdt: amounts.providerFeeUsdt,
          ashtechFeePercent: amounts.ashtechFeePercent,
          ashtechFeeAmountUsdt: amounts.ashtechFeeUsdt,
          totalFeePercent: amounts.totalFeePercent,
          totalFeeAmountUsdt: amounts.feeUsdt,
          creditedAmountUsdt: amounts.creditedUsdt,
        },
      });

      let iziIntent: any;
      try {
        iziIntent = await createPaymentIntent({
          requestedCurrencyType: "fiat",
          currencyRequested: izipayCurrency,
          amountRequested: String(numAmount), // must be string per IziChange API spec
          merchantReference: reference,
          metadata: { userId, transactionId: tx?.id ?? "" },
        });
      } catch (err: any) {
        console.error("[Deposits Crypto] IziChange error:", err.message);
        if (tx?.id) await storage.updateTransactionStatus(tx.id, "failed").catch(() => {});
        return res.status(400).json({ message: "Impossible de créer l'intention de paiement. Veuillez réessayer." });
      }

      if (tx?.id && iziIntent?.id) {
        await storage.updateTransaction(tx.id, { paymentIntentId: iziIntent.id }).catch(() => {});
      }

      console.log(`[Deposits Crypto] IziChange intent: ${fiatCurrency}${numAmount} ≈ ${amounts.creditedUsdt.toFixed(4)} USDT ref=${reference}`);
      res.json({
        paymentUrl: iziIntent.paymentUrl,
        intentId: iziIntent.id,
        reference,
        currency: fiatCurrency,
        amountUsdt: amounts.grossUsdt.toFixed(4),
        grossAmountUsdt: amounts.grossUsdt.toFixed(6),
        providerFeePercent: amounts.providerFeePercent,
        providerFeeAmountUsdt: amounts.providerFeeUsdt.toFixed(6),
        ashtechFeePercent: amounts.ashtechFeePercent,
        ashtechFeeAmountUsdt: amounts.ashtechFeeUsdt.toFixed(6),
        totalFeePercent: amounts.totalFeePercent,
        totalFeeAmountUsdt: amounts.feeUsdt.toFixed(6),
        creditedAmountUsdt: amounts.creditedUsdt.toFixed(6),
      });
    } catch (error: any) {
      console.error("[Deposits Crypto] Error:", error.message, error.stack?.split("\n")[1]);
      res.status(422).json({ message: error.message || "Erreur lors du dépôt crypto" });
    }
  });

  // ── Crypto deposit address via IziChange Direct Charge ───────────────────
  // Calls POST /v1/payment-intents/direct → IziChange returns a unique address.
  app.post("/api/deposits/crypto/address", requireAuth, depositLimiter, async (req, res) => {
    try {
      if (!isIziPayConfigured()) {
        return res.status(503).json({ message: "Paiement crypto non configuré. Contactez l'administrateur." });
      }

      const { assetCode, amount, currency: reqCurrency, refundAddress, countryId } = req.body;

      if (!assetCode) {
        return res.status(400).json({ message: "Veuillez sélectionner un réseau crypto" });
      }
      if (!countryId) {
        return res.status(400).json({ message: "Veuillez sélectionner un pays" });
      }
      const depositCountry = await storage.getCountry(String(countryId));
      if (!depositCountry) {
        return res.status(400).json({ message: "Pays invalide" });
      }
      const disabledCryptoAssets = parseDisabledCryptoAssets(
        (await storage.getSetting("crypto_disabled_assets"))?.value
      );
      if (disabledCryptoAssets.has(assetCode)) {
        return res.status(400).json({ message: "Ce réseau crypto n'est pas disponible actuellement" });
      }

      const numAmount = parseFloat(amount || "0");
      if (!amount || numAmount <= 0) {
        return res.status(400).json({ message: "Montant invalide" });
      }
      if (numAmount < MIN_DIRECT_CRYPTO_USDT) {
        return res.status(422).json({
          error: "minimum_amount",
          message: `Le montant minimum est de ${MIN_DIRECT_CRYPTO_USDT} USDT (montant brut, avant frais).`,
          minimumAmountUsdt: MIN_DIRECT_CRYPTO_USDT,
        });
      }

      const userId = req.userId!;
      const user   = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "Utilisateur non trouvé" });

      // Frontend sends amounts in USDT directly; no fiat conversion needed.
       const amounts = await resolveCryptoFeeBreakdown(numAmount);

      const reference = generateTransactionReference("deposit");

      // Call IziChange Direct Charge API — unique address returned in one shot
      // IziChange requires non-empty firstName & lastName — derive from fullName/email/username.
      const rawName   = ((user as any).fullName || "").trim();
      const nameParts = rawName ? rawName.split(" ") : [];
      const userEmail = ((user as any).email || "").trim();
      const depFirst  = nameParts[0] || userEmail.split("@")[0] || (user as any).username || "Client";
      const depLast   = nameParts.slice(1).join(" ") || "Pay";

      let charge: any;
      try {
        charge = await createDirectCharge({
          requestedCoin: assetCode,
          amount: numAmount.toFixed(4),
          customer: {
            firstName: depFirst,
            lastName:  depLast,
            email:     userEmail || undefined,
            refundAddress: refundAddress || undefined,
          },
          merchantReference: reference,
          metadata: { userId, countryId: depositCountry.id, country: depositCountry.name },
        });
      } catch (chargeErr: any) {
        console.error(`[Deposits/Crypto] createDirectCharge failed (asset=${assetCode}):`, chargeErr.message);
        return res.status(502).json({ message: `Adresse crypto indisponible pour ${assetCode}: ${chargeErr.message}` });
      }

      await storage.createTransaction({
        userId,
        type: "deposit",
        amount: amounts.creditedUsdt.toFixed(6),
        totalAmount: numAmount.toFixed(6),
        feeAmount: amounts.feeUsdt.toFixed(6),
        ashtechFeeAmount: amounts.ashtechFeeUsdt.toFixed(6),
        currency: "USDT",
        status: "pending",
        description: `Dépôt crypto ${assetCode} — ${numAmount} USDT`,
        paymentMethod: "crypto",
        reference,
        externalReference: charge.id || undefined,   // IziChange transaction ID
        metadata: await (async () => {
          const _coin = assetCode.split(".")[0].toUpperCase();
          const _price = await getCryptoPriceUsd(_coin).catch(() => 0);
          const _grossCoin = _price > 0 ? amounts.grossUsdt / _price : null;
          const _creditedCoin = _price > 0 ? amounts.creditedUsdt / _price : null;
          return {
            assetCode,
            address: charge.address,
            memo: charge.memo ?? null,
            izichangeId: charge.id || null,
            grossAmountUsdt: amounts.grossUsdt,
            providerFeePercent: amounts.providerFeePercent,
            providerFeeAmountUsdt: amounts.providerFeeUsdt,
            ashtechFeePercent: amounts.ashtechFeePercent,
            ashtechFeeAmountUsdt: amounts.ashtechFeeUsdt,
            totalFeePercent: amounts.totalFeePercent,
            totalFeeAmountUsdt: amounts.feeUsdt,
            creditedAmountUsdt: amounts.creditedUsdt,
            ...(refundAddress ? { refundAddress } : {}),
            ...(_grossCoin !== null ? { grossAmountCoin: parseFloat(_grossCoin.toFixed(8)), coinPriceUsdt: _price } : {}),
            ...(_creditedCoin !== null ? { creditedAmountCoin: parseFloat(_creditedCoin.toFixed(8)) } : {}),
          };
        })(),
      });

      console.log(`[Deposits/Crypto] Direct charge: addr=${charge.address} memo=${charge.memo ?? "-"} asset=${assetCode} ref=${reference} user=${userId} expiresAt=${charge.expiresAt ?? "n/a"}`);

      return res.json({
        address:    charge.address,
        memo:       charge.memo ?? null,
        memoType:   charge.memoType ?? null,
        assetCode,
        reference,
        grossAmountUsdt: amounts.grossUsdt.toFixed(6),
        providerFeePercent: amounts.providerFeePercent,
        providerFeeAmountUsdt: amounts.providerFeeUsdt.toFixed(6),
        ashtechFeePercent: amounts.ashtechFeePercent,
        ashtechFeeAmountUsdt: amounts.ashtechFeeUsdt.toFixed(6),
        totalFeePercent: amounts.totalFeePercent,
        totalFeeAmountUsdt: amounts.feeUsdt.toFixed(6),
        creditedAmountUsdt: amounts.creditedUsdt.toFixed(6),
        amountUsdt: amounts.grossUsdt.toFixed(4),
        fiatAmount: numAmount,
        expiresAt:  charge.expiresAt ?? null,
      });
    } catch (error: any) {
      console.error("[Deposits/Crypto] Error:", error.message, error.stack?.split("\n")[1]);
      return res.status(422).json({ message: error.message || "Erreur lors de la génération de l'adresse" });
    }
  });

  // ─── PawaPay callbacks ────────────────────────────────────────────────────
  // PawaPay callbacks contain only a provider UUID.  We deliberately look up
  // that UUID in external_reference rather than accepting a merchant reference.
  // PawaPay's documented callback contract requires a publicly reachable POST
  // endpoint and does not send AshTechPay's locally stored webhook secret.
  // A token remains supported for deployments that put one in the configured
  // callback URL, but it is not mandatory by default.
  async function handlePawaPayCallback(req: Request, res: Response, direction: "deposit" | "payout") {
    try {
      const webhookSecret = await getPawaPayWebhookSecret();
      const callbackToken = (req.query.token as string) || (req.headers["x-webhook-token"] as string);
      const callbackTokenRequired = process.env.PAWAPAY_REQUIRE_CALLBACK_TOKEN === "true";
      if (callbackToken && (!webhookSecret || callbackToken !== webhookSecret)) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      if (callbackTokenRequired && (!webhookSecret || !callbackToken)) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      if (process.env.PAWAPAY_REQUIRE_SIGNED_CALLBACKS === "true") {
        const headers: Record<string, string | string[] | undefined> = {};
        for (const [key, value] of Object.entries(req.headers)) headers[key] = value;
        if (!verifyPawaPayCallbackSignature((req as any).rawBody || "", headers, true)) {
          return res.status(401).json({ message: "Unauthorized" });
        }
      }
      const callback = parsePawaPayCallback(req.body);
      if (callback.direction !== direction || !callback.id || !isPawaPayUuidV4(callback.id)) {
        return res.status(400).json({ message: "Invalid callback" });
      }
      // Pending callbacks are acknowledged but never affect a wallet.
      if (callback.status === "pending") return res.status(200).json({ success: true });
      const [transaction] = await db.select().from(transactionsTable)
        .where(eq(transactionsTable.externalReference, callback.id)).limit(1);
      // A valid callback may be retried after data retention or a merchant may
      // send a stale UUID. Acknowledge it to prevent retry storms.
      if (!transaction) return res.status(200).json({ success: true });
      const isPayout = transaction.type === "withdrawal" || transaction.type === "transfer_out";
      if ((direction === "payout") !== isPayout) return res.status(200).json({ success: true });
      const allowedStatus = direction === "deposit"
        ? transaction.status === "pending"
        : ["pending", "processing", "pending_manual"].includes(transaction.status);
      if (!allowedStatus) return res.status(200).json({ success: true });
      if (direction === "deposit") {
        if (callback.status === "failed") {
          const safeFailure = buildProviderErrorPayload({
            error: "payment_failed",
            message: callback.providerMessage,
            fallback: "Le paiement a été refusé par le fournisseur.",
            provider: "pawapay",
            providerCode: callback.providerCode,
            sensitiveValues: [
              transaction.recipientPhone,
              (transaction as any).payerPhone,
            ],
          });
          await storage.updateTransaction(transaction.id, {
            description: String(safeFailure.message),
            metadata: {
              ...(((transaction as any).metadata || {}) as Record<string, unknown>),
              failureReason: {
                failureCode: safeFailure.provider_code || null,
                failureMessage: String(safeFailure.message),
              },
            },
          });
        }
        await processPawaPayDepositCallback(transaction, callback.status);
      } else {
        await processPawaPayPayoutCallback(transaction, callback.status === "completed" ? "success" : "failed");
      }
      return res.status(200).json({ success: true });
    } catch (error: any) {
      // Signature configuration errors and malformed payloads fail closed. Do
      // not expose PawaPay diagnostics, tokens, or callback data to callers.
      console.error("[PawaPay Callback] rejected:", error?.message || "unknown error");
      return res.status(401).json({ message: "Unauthorized" });
    }
  }
  app.post("/api/pawapay/deposit-callback", webhookLimiter, (req, res) => handlePawaPayCallback(req, res, "deposit"));
  app.post("/api/pawapay/payout-callback", webhookLimiter, (req, res) => handlePawaPayCallback(req, res, "payout"));

  // ─── AfribaPay Webhook ────────────────────────────────────────────────────
  app.post("/api/afribapay/webhook", webhookLimiter, async (req, res) => {
    try {
      // ── Vérification du secret webhook (obligatoire) ─────────────────────────
      const webhookSecret = process.env.WEBHOOK_SECRET;
      if (!webhookSecret) {
        console.error("[AfribaPay Webhook] WEBHOOK_SECRET non configuré — requête rejetée");
        return res.status(503).json({ message: "Webhook endpoint not configured" });
      }
      const webhookToken = (req.query.token as string) || (req.headers["x-webhook-token"] as string);
      if (webhookToken !== webhookSecret) {
        console.warn("[AfribaPay Webhook] Token invalide — requête rejetée");
        return res.status(401).json({ message: "Unauthorized" });
      }
      const payload = req.body;
      console.log("[AfribaPay Webhook] Received:", JSON.stringify(payload));

      const parsed = parseAfribaPayWebhook(payload);
      const { order_id, transaction_id, status } = parsed;

      const ref = order_id || transaction_id;
      if (!ref) {
        console.error("[AfribaPay Webhook] Missing order_id/transaction_id");
        return res.status(400).json({ message: "Missing identifier" });
      }

      const transaction = await storage.getTransactionByReference(ref);
      if (!transaction) {
        console.error("[AfribaPay Webhook] Transaction not found:", ref);
        return res.status(404).json({ message: "Transaction not found" });
      }

      if (transaction.status !== "pending") {
        return res.json({ success: true });
      }

      const isPaymentLink = transaction.type === "payment_link";
      const isPayout = transaction.type === "withdrawal" || transaction.type === "transfer_out";
      const txCurrency = transaction.currency || "XAF";

      if (status === "completed") {
        const claimedTransaction = await storage.claimTransactionStatus(transaction.id, "completed");
        if (!claimedTransaction) return res.json({ success: true, message: "already processed" });

        if (isPayout) {
          // Payout success: money already left user's account, just notify
          removePendingPayout(ref);
          await storage.createUserNotification({
            userId: transaction.userId,
            type: "withdrawal_confirmed",
            title: transaction.type === "transfer_out" ? "Transfert confirmé" : "Retrait confirmé",
            message: transaction.type === "transfer_out"
              ? `Votre transfert de ${transaction.amount} ${txCurrency} a été envoyé avec succès.`
              : `Votre retrait de ${transaction.amount} ${txCurrency} a été envoyé avec succès.`,
            transactionId: transaction.id,
          });
          storage.getUser(transaction.userId).then(txUser => {
            notifyWithdrawalAutoValidated({
              userName: txUser?.fullName || txUser?.username || "Utilisateur",
              userEmail: txUser?.email || "",
              userPhone: txUser?.phone || undefined,
              senderCountry: txUser?.country || undefined,
              amount: transaction.amount,
              grossAmount: (transaction as any).totalAmount || transaction.amount,
              currency: txCurrency,
              reference: transaction.reference || String(transaction.id),
              provider: "AfribaPay",
              recipientName: transaction.recipientName || undefined,
              recipientPhone: transaction.recipientPhone || undefined,
              recipientCountry: transaction.recipientCountry || undefined,
            }).catch(() => {});
          }).catch(() => {});
          console.log(`[AfribaPay Webhook] ✓ Payout SUCCESS: ${transaction.id} (${transaction.type})`);
          forwardMerchantWebhook(transaction, "completed").catch(() => {});
        } else {
          // Payin / deposit success: credit user's wallet
          await creditUserWallet(transaction.userId, parseFloat(transaction.amount), txCurrency);
          removePendingPayment(ref);
          await storage.createUserNotification({
            userId: transaction.userId,
            type: isPaymentLink ? "payment_link_received" : "deposit_confirmed",
            title: isPaymentLink ? "Paiement reçu" : "Dépôt confirmé",
            message: isPaymentLink
              ? `Vous avez reçu un paiement de ${transaction.amount} ${txCurrency} de ${transaction.payerName || "un client"}.`
              : `Votre dépôt de ${transaction.amount} ${txCurrency} a été crédité sur votre compte.`,
            transactionId: transaction.id,
          });
          if (transaction.paymentIntentId) {
            await storage.updatePaymentIntentStatus(transaction.paymentIntentId, "completed");
          }
          Promise.all([
            storage.getUser(transaction.userId).catch(() => null),
            transaction.operatorId ? storage.getOperator(transaction.operatorId).catch(() => null) : Promise.resolve(null),
            transaction.paymentIntentId ? storage.getPaymentIntentById(transaction.paymentIntentId).catch(() => null) : Promise.resolve(null),
            isPaymentLink && transaction.paymentLinkId ? storage.getPaymentLinkById(transaction.paymentLinkId).catch(() => null) : Promise.resolve(null),
          ]).then(([txUser, txOp, txIntent, txLink]) => {
            notifyDepositConfirmed({
              userName: txUser?.fullName || txUser?.username || "Utilisateur",
              userEmail: txUser?.email || "",
              userPhone: txUser?.phone || undefined,
              userCountry: txUser?.country || undefined,
              amount: transaction.amount,
              grossAmount: (transaction as any).totalAmount || transaction.amount,
              currency: txCurrency,
              reference: transaction.reference || String(transaction.id),
              provider: "AfribaPay",
              country: undefined,
              depositType: isPaymentLink ? "payment_link" : "deposit",
              paymentMethod: transaction.paymentMethod || undefined,
              phone: transaction.recipientPhone || undefined,
              operator: (txOp as any)?.name || undefined,
              source: (transaction as any).source || undefined,
              ...(isPaymentLink && {
                payerName: transaction.payerName || undefined,
                payerEmail: transaction.payerEmail || undefined,
                payerPhone: (txIntent as any)?.payerPhone || undefined,
                beneficiaryUsername: txUser?.username || undefined,
                beneficiaryPhone: txUser?.phone || undefined,
                creditedCurrency: txCurrency,
                linkTitle: (txLink as any)?.title || undefined,
              }),
            }).catch(() => {});
          }).catch(() => {});
          console.log(`[AfribaPay Webhook] ✓ Deposit SUCCESS: ${transaction.id} → credited ${transaction.amount} ${txCurrency}`);
          forwardMerchantWebhook(transaction, "completed").catch(() => {});
        }

      } else if (status === "failed") {
        const claimedTransaction = await storage.claimTransactionStatus(transaction.id, "failed");
        if (!claimedTransaction) return res.json({ success: true, message: "already processed" });

        if (isPayout) {
          // Payout failed: refund the full debited amount to the wallet that was originally debited
          const refundAmount = parseFloat((transaction as any).totalAmount || transaction.amount);
          await storage.refundToOriginalWallet(transaction.userId, transaction.type, txCurrency, refundAmount);
          removePendingPayout(ref);
          await storage.createUserNotification({
            userId: transaction.userId,
            type: "withdrawal_failed",
            title: transaction.type === "transfer_out" ? "Transfert échoué" : "Retrait échoué",
            message: transaction.type === "transfer_out"
              ? `Votre transfert de ${transaction.amount} ${txCurrency} a échoué. Le montant a été recrédité sur votre compte.`
              : `Votre retrait de ${transaction.amount} ${txCurrency} a échoué. Le montant a été recrédité sur votre compte.`,
            transactionId: transaction.id,
          });
          storage.getUser(transaction.userId).then(txUser => {
            notifyWithdrawalFailed({
              userName: txUser?.fullName || txUser?.username || "Utilisateur",
              userEmail: txUser?.email || "",
              userPhone: txUser?.phone || undefined,
              senderCountry: txUser?.country || undefined,
              amount: transaction.amount,
              grossAmount: (transaction as any).totalAmount || transaction.amount,
              currency: txCurrency,
              reference: transaction.reference || String(transaction.id),
              reason: `Échec ${transaction.type === "transfer_out" ? "transfert" : "retrait"} (AfribaPay)`,
              provider: "AfribaPay",
              recipientName: transaction.recipientName || undefined,
              recipientPhone: transaction.recipientPhone || undefined,
              recipientCountry: transaction.recipientCountry || undefined,
            }).catch(() => {});
          }).catch(() => {});
          console.log(`[AfribaPay Webhook] ✗ Payout FAILED: ${transaction.id} — refunded ${refundAmount} ${txCurrency}`);
          forwardMerchantWebhook(transaction, "failed").catch(() => {});
        } else {
          if (transaction.paymentIntentId) {
            await storage.updatePaymentIntentStatus(transaction.paymentIntentId, "failed");
          }
          removePendingPayment(ref);
          await storage.createUserNotification({
            userId: transaction.userId,
            type: isPaymentLink ? "payment_link_failed" : "deposit_failed",
            title: isPaymentLink ? "Paiement annulé" : "Dépôt annulé",
            message: isPaymentLink
              ? "Le paiement a été annulé ou a échoué."
              : "Votre dépôt a été annulé. Aucun montant n'a été débité.",
            transactionId: transaction.id,
          });
          Promise.all([
            storage.getUser(transaction.userId).catch(() => null),
            transaction.operatorId ? storage.getOperator(transaction.operatorId).catch(() => null) : Promise.resolve(null),
          ]).then(([txUser, txOp]) => {
            notifyDepositFailed({
              userName: txUser?.fullName || txUser?.username || "Utilisateur",
              userEmail: txUser?.email || "",
              userPhone: txUser?.phone || undefined,
              userCountry: txUser?.country || undefined,
              amount: transaction.totalAmount || transaction.amount,
              currency: txCurrency,
              reference: transaction.reference || String(transaction.id),
              reason: isPaymentLink ? "Paiement lien échoué (AfribaPay)" : "Dépôt annulé/échoué (AfribaPay)",
              provider: "AfribaPay",
              country: undefined,
              depositType: isPaymentLink ? "payment_link" : "deposit",
              paymentMethod: transaction.paymentMethod || undefined,
              phone: transaction.recipientPhone || undefined,
              operator: (txOp as any)?.name || undefined,
              source: (transaction as any).source || undefined,
            }).catch(() => {});
          }).catch(() => {});
          console.log(`[AfribaPay Webhook] ✗ Deposit FAILED/CANCELLED: ${transaction.id}`);
          forwardMerchantWebhook(transaction, "failed").catch(() => {});
        }
      }

      res.json({ success: true });
    } catch (error) {
      console.error("[AfribaPay Webhook] Error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ─── PixPay IPN Webhook ───────────────────────────────────────────────────────
  app.post("/api/pixpay/webhook", webhookLimiter, async (req, res) => {
    try {
      // ── Vérification du secret webhook (obligatoire) ─────────────────────────
      const webhookSecret = process.env.WEBHOOK_SECRET;
      if (!webhookSecret) {
        console.error("[PixPay Webhook] WEBHOOK_SECRET non configuré — requête rejetée");
        return res.status(503).json({ message: "Webhook endpoint not configured" });
      }
      const webhookToken = (req.query.token as string) || (req.headers["x-webhook-token"] as string);
      if (webhookToken !== webhookSecret) {
        console.warn("[PixPay Webhook] Token invalide — requête rejetée");
        return res.status(401).json({ message: "Unauthorized" });
      }
      const payload = req.body;
      console.log("[PixPay Webhook] Received:", JSON.stringify(payload));

      const parsed = parsePixPayWebhook(payload);
      const { transactionId, orderId, status, providerMessage } = parsed;

      const ref = orderId || transactionId;
      if (!ref) {
        console.error("[PixPay Webhook] Missing identifier (custom_data / transaction_id)");
        return res.status(400).json({ message: "Missing identifier" });
      }

      // Prefer lookup by our order reference stored in custom_data
      const transaction = await storage.getTransactionByReference(ref);
      if (!transaction) {
        console.error("[PixPay Webhook] Transaction not found:", ref);
        return res.status(404).json({ message: "Transaction not found" });
      }

      if (transaction.status !== "pending") {
        return res.json({ success: true });
      }

      const isPaymentLink = transaction.type === "payment_link";
      const isPayout = transaction.type === "withdrawal" || transaction.type === "transfer_out";
      const txCurrency = transaction.currency || "XAF";

      if (status === "completed") {
        const claimedTransaction = await storage.claimTransactionStatus(transaction.id, "completed");
        if (!claimedTransaction) return res.json({ success: true, message: "already processed" });

        if (isPayout) {
          // Payout success: money already left user's account, just notify
          removePendingPayout(ref);
          await storage.createUserNotification({
            userId: transaction.userId,
            type: "withdrawal_confirmed",
            title: transaction.type === "transfer_out" ? "Transfert confirmé" : "Retrait confirmé",
            message: transaction.type === "transfer_out"
              ? `Votre transfert de ${transaction.amount} ${txCurrency} a été envoyé avec succès.`
              : `Votre retrait de ${transaction.amount} ${txCurrency} a été envoyé avec succès.`,
            transactionId: transaction.id,
          });
          storage.getUser(transaction.userId).then(txUser => {
            notifyWithdrawalAutoValidated({
              userName: txUser?.fullName || txUser?.username || "Utilisateur",
              userEmail: txUser?.email || "",
              userPhone: txUser?.phone || undefined,
              senderCountry: txUser?.country || undefined,
              amount: transaction.amount,
              grossAmount: (transaction as any).totalAmount || transaction.amount,
              currency: txCurrency,
              reference: transaction.reference || String(transaction.id),
              provider: "PixPay",
              recipientName: transaction.recipientName || undefined,
              recipientPhone: transaction.recipientPhone || undefined,
              recipientCountry: transaction.recipientCountry || undefined,
            }).catch(() => {});
          }).catch(() => {});
          console.log(`[PixPay Webhook] ✓ Payout SUCCESS: ${transaction.id} (${transaction.type})`);
          forwardMerchantWebhook(transaction, "completed").catch(() => {});
        } else {
          // Payin / deposit success: credit user's wallet
          await creditUserWallet(transaction.userId, parseFloat(transaction.amount), txCurrency);
          removePendingPayment(ref);
          await storage.createUserNotification({
            userId: transaction.userId,
            type: isPaymentLink ? "payment_link_received" : "deposit_confirmed",
            title: isPaymentLink ? "Paiement reçu" : "Dépôt confirmé",
            message: isPaymentLink
              ? `Vous avez reçu un paiement de ${transaction.amount} ${txCurrency} de ${transaction.payerName || "un client"}.`
              : `Votre dépôt de ${transaction.amount} ${txCurrency} a été crédité sur votre compte.`,
            transactionId: transaction.id,
          });
          if (transaction.paymentIntentId) {
            await storage.updatePaymentIntentStatus(transaction.paymentIntentId, "completed");
          }
          Promise.all([
            storage.getUser(transaction.userId).catch(() => null),
            transaction.operatorId ? storage.getOperator(transaction.operatorId).catch(() => null) : Promise.resolve(null),
            transaction.paymentIntentId ? storage.getPaymentIntentById(transaction.paymentIntentId).catch(() => null) : Promise.resolve(null),
            isPaymentLink && transaction.paymentLinkId ? storage.getPaymentLinkById(transaction.paymentLinkId).catch(() => null) : Promise.resolve(null),
          ]).then(([txUser, txOp, txIntent, txLink]) => {
            notifyDepositConfirmed({
              userName: txUser?.fullName || txUser?.username || "Utilisateur",
              userEmail: txUser?.email || "",
              userPhone: txUser?.phone || undefined,
              userCountry: txUser?.country || undefined,
              amount: transaction.amount,
              grossAmount: (transaction as any).totalAmount || transaction.amount,
              currency: txCurrency,
              reference: transaction.reference || String(transaction.id),
              provider: "PixPay",
              country: undefined,
              depositType: isPaymentLink ? "payment_link" : "deposit",
              paymentMethod: transaction.paymentMethod || undefined,
              phone: transaction.recipientPhone || undefined,
              operator: (txOp as any)?.name || undefined,
              source: (transaction as any).source || undefined,
              ...(isPaymentLink && {
                payerName: transaction.payerName || undefined,
                payerEmail: transaction.payerEmail || undefined,
                payerPhone: (txIntent as any)?.payerPhone || undefined,
                beneficiaryUsername: txUser?.username || undefined,
                beneficiaryPhone: txUser?.phone || undefined,
                creditedCurrency: txCurrency,
                linkTitle: (txLink as any)?.title || undefined,
              }),
            }).catch(() => {});
          }).catch(() => {});
          console.log(`[PixPay Webhook] ✓ Deposit SUCCESS: ${transaction.id} → ${transaction.amount} ${txCurrency}`);
          forwardMerchantWebhook(transaction, "completed").catch(() => {});
        }

      } else if (status === "failed") {
        const claimedTransaction = await storage.claimTransactionStatus(transaction.id, "failed");
        if (!claimedTransaction) return res.json({ success: true, message: "already processed" });

        if (isPayout) {
          // Payout failed: refund the full debited amount to the wallet that was originally debited
          const refundAmount = parseFloat((transaction as any).totalAmount || transaction.amount);
          await storage.refundToOriginalWallet(transaction.userId, transaction.type, txCurrency, refundAmount);
          removePendingPayout(ref);
          await storage.createUserNotification({
            userId: transaction.userId,
            type: "withdrawal_failed",
            title: transaction.type === "transfer_out" ? "Transfert échoué" : "Retrait échoué",
            message: transaction.type === "transfer_out"
              ? `Votre transfert de ${transaction.amount} ${txCurrency} a échoué. Le montant a été recrédité sur votre compte.${providerMessage ? ` (${providerMessage})` : ""}`
              : `Votre retrait de ${transaction.amount} ${txCurrency} a échoué. Le montant a été recrédité sur votre compte.${providerMessage ? ` (${providerMessage})` : ""}`,
            transactionId: transaction.id,
          });
          storage.getUser(transaction.userId).then(txUser => {
            notifyWithdrawalFailed({
              userName: txUser?.fullName || txUser?.username || "Utilisateur",
              userEmail: txUser?.email || "",
              userPhone: txUser?.phone || undefined,
              senderCountry: txUser?.country || undefined,
              amount: transaction.amount,
              grossAmount: (transaction as any).totalAmount || transaction.amount,
              currency: txCurrency,
              reference: transaction.reference || String(transaction.id),
              reason: `${providerMessage || "Échec"} — ${transaction.type === "transfer_out" ? "transfert" : "retrait"} (PixPay)`,
              provider: "PixPay",
              recipientName: transaction.recipientName || undefined,
              recipientPhone: transaction.recipientPhone || undefined,
              recipientCountry: transaction.recipientCountry || undefined,
            }).catch(() => {});
          }).catch(() => {});
          console.log(`[PixPay Webhook] ✗ Payout FAILED: ${transaction.id} — refunded ${refundAmount} ${txCurrency}`);
          forwardMerchantWebhook(transaction, "failed").catch(() => {});
        } else {
          removePendingPayment(ref);
          if (transaction.paymentIntentId) {
            await storage.updatePaymentIntentStatus(transaction.paymentIntentId, "failed");
          }
          await storage.createUserNotification({
            userId: transaction.userId,
            type: isPaymentLink ? "payment_link_failed" : "deposit_failed",
            title: isPaymentLink ? "Paiement annulé" : "Dépôt annulé",
            message: isPaymentLink
              ? `Le paiement a été annulé ou a échoué.${providerMessage ? ` (${providerMessage})` : ""}`
              : `Votre dépôt a été annulé.${providerMessage ? ` (${providerMessage})` : ""}`,
            transactionId: transaction.id,
          });
          Promise.all([
            storage.getUser(transaction.userId).catch(() => null),
            transaction.operatorId ? storage.getOperator(transaction.operatorId).catch(() => null) : Promise.resolve(null),
          ]).then(([txUser, txOp]) => {
            notifyDepositFailed({
              userName: txUser?.fullName || txUser?.username || "Utilisateur",
              userEmail: txUser?.email || "",
              userPhone: txUser?.phone || undefined,
              userCountry: txUser?.country || undefined,
              amount: transaction.totalAmount || transaction.amount,
              currency: txCurrency,
              reference: transaction.reference || String(transaction.id),
              reason: isPaymentLink
                ? `Paiement lien échoué (PixPay)${providerMessage ? ` — ${providerMessage}` : ""}`
                : `Dépôt annulé/échoué (PixPay)${providerMessage ? ` — ${providerMessage}` : ""}`,
              provider: "PixPay",
              country: undefined,
              depositType: isPaymentLink ? "payment_link" : "deposit",
              paymentMethod: transaction.paymentMethod || undefined,
              phone: transaction.recipientPhone || undefined,
              operator: (txOp as any)?.name || undefined,
              source: (transaction as any).source || undefined,
            }).catch(() => {});
          }).catch(() => {});
          console.log(`[PixPay Webhook] ✗ Deposit FAILED: ${transaction.id} — ${providerMessage}`);
          forwardMerchantWebhook(transaction, "failed").catch(() => {});
        }
      }

      res.json({ success: true });
    } catch (error) {
      console.error("[PixPay Webhook] Error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ─── AfribaPay OTP Confirm Routes ────────────────────────────────────────────

  // POST /api/deposits/confirm-otp — validate OTP for an AfribaPay deposit
  app.post("/api/deposits/confirm-otp", requireAuth, otpConfirmLimiter, async (req, res) => {
    try {
      const user = (req as any).user;
      const { ref, otpCode } = req.body;

      if (!ref || !otpCode) {
        return res.status(400).json({ message: "Référence et code OTP requis" });
      }

      const ctx = await loadOtpContext(ref);
      if (!ctx) {
        return res.status(400).json({ message: "Session OTP expirée ou introuvable. Veuillez recommencer." });
      }
      if (ctx.userId && ctx.userId !== user.id) {
        return res.status(403).json({ message: "Cette session OTP n'appartient pas à votre compte." });
      }
      if (ctx.expiresAt < Date.now()) {
        await deleteOtpContext(ref);
        return res.status(400).json({ message: "Le code OTP a expiré. Veuillez recommencer." });
      }

      const callbackUrl = buildWebhookUrl("/api/afribapay/webhook");
      const result = await confirmAfribaPayOtp({
        operator: ctx.operator,
        country: ctx.country,
        phone_number: ctx.phone,
        amount: ctx.amount,
        currency: ctx.currency,
        order_id: ref,
        reference_id: ref,
        otp_code: otpCode,
        notify_url: callbackUrl,
        return_url: `${process.env.APP_URL}/dashboard/deposit?status=success`,
        cancel_url: `${process.env.APP_URL}/dashboard/deposit?status=cancelled`,
        lang: "fr",
      });

      if (!result.success) {
        return res.status(400).json({ message: result.message || "Code OTP invalide ou expiré" });
      }

      await deleteOtpContext(ref);
      console.log(`[OTP Confirm] ✓ Deposit OTP confirmed for ref=${ref}, afriba_tx=${result.transaction_id}`);

      // Update transaction external reference with AfribaPay's transaction_id and start polling
      const tx = await storage.getTransactionByReference(ref);
      if (tx) {
        const extRef = result.transaction_id || ref;
        await storage.updateTransactionExternalReference(tx.id, extRef);
        addPendingPayment({
          transactionId: tx.id,
          reference: ref,
          externalReference: extRef,
          attempts: 0,
          userId: user.id,
          type: "deposit",
          amount: ctx.amount.toString(),
          provider: "afribapay",
        });
      }

      res.json({ success: true, message: "OTP validé. Votre paiement est en cours de traitement." });
    } catch (error) {
      console.error("[OTP Confirm Deposit] Error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // POST /api/payment-links/:slug/confirm-otp — validate OTP for a payment link
  app.post("/api/payment-links/:slug/confirm-otp", otpConfirmLimiter, async (req, res) => {
    try {
      const { ref, otpCode } = req.body;

      if (!ref || !otpCode) {
        return res.status(400).json({ message: "Référence et code OTP requis" });
      }

      const ctx = await loadOtpContext(ref);
      if (!ctx) {
        return res.status(400).json({ message: "Session OTP expirée ou introuvable. Veuillez recommencer." });
      }
      if (ctx.expiresAt < Date.now()) {
        await deleteOtpContext(ref);
        return res.status(400).json({ message: "Le code OTP a expiré. Veuillez recommencer." });
      }
      const paymentLink = await storage.getPaymentLinkBySlug(req.params.slug);
      if (!paymentLink) {
        return res.status(404).json({ message: "Lien de paiement introuvable." });
      }
      const linkTransaction = await storage.getTransactionByReference(ref);
      if (!linkTransaction || linkTransaction.paymentLinkId !== paymentLink.id) {
        return res.status(403).json({ message: "Cette session OTP ne correspond pas à ce lien de paiement." });
      }

      const callbackUrl = buildWebhookUrl("/api/afribapay/webhook");
      const result = await confirmAfribaPayOtp({
        operator: ctx.operator,
        country: ctx.country,
        phone_number: ctx.phone,
        amount: ctx.amount,
        currency: ctx.currency,
        order_id: ref,
        reference_id: ref,
        otp_code: otpCode,
        notify_url: callbackUrl,
        return_url: `${process.env.APP_URL}/pay/success`,
        cancel_url: `${process.env.APP_URL}/pay/cancel`,
        lang: "fr",
      });

      if (!result.success) {
        return res.status(400).json({ message: result.message || "Code OTP invalide ou expiré" });
      }

      await deleteOtpContext(ref);
      console.log(`[OTP Confirm] ✓ PaymentLink OTP confirmed for ref=${ref}, afriba_tx=${result.transaction_id}`);

      // Update transaction external reference and start polling
      const tx = await storage.getTransactionByReference(ref);
      if (tx) {
        const extRef = result.transaction_id || ref;
        await storage.updateTransactionExternalReference(tx.id, extRef);
        addPendingPayment({
          transactionId: tx.id,
          reference: ref,
          externalReference: extRef,
          attempts: 0,
          userId: tx.userId,
          type: "payment_link",
          amount: ctx.amount.toString(),
          provider: "afribapay",
        });
      }

      res.json({ success: true, message: "OTP validé. Le paiement est en cours de traitement." });
    } catch (error) {
      console.error("[OTP Confirm PaymentLink] Error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // ─── AfribaPay Admin Routes ───────────────────────────────────────────────

  // GET /api/admin/afribapay/countries — fetch live AfribaPay country list
  app.get("/api/admin/afribapay/countries", requireAuth, requireAdmin, async (_req, res) => {
    try {
      const countries = await fetchAfribaPayCountries();
      res.json({ success: true, data: countries });
    } catch (err: any) {
      console.error("[AfribaPay Countries] Error:", err);
      res.status(500).json({ message: err.message || "Erreur AfribaPay" });
    }
  });

  app.get("/api/admin/pawapay/active-conf", requireAuth, requireAdmin, async (req, res) => {
    try {
      const requestedCountry = typeof req.query.country === "string" ? req.query.country.toUpperCase() : undefined;
      const country = requestedCountry ? pawaPayCountry(requestedCountry) : undefined;
      const operationType = typeof req.query.operationType === "string" ? req.query.operationType.toUpperCase() : undefined;
      const configuration: any = await getPawaPayActiveConfiguration({
        country,
        operationType,
        forceRefresh: req.query.refresh === "true",
      });
      const countries = Array.isArray(configuration?.countries) ? configuration.countries : [];
      return res.json({
        countries: countries.map((item: any) => ({
          country: item?.country ?? item?.countryCode ?? item?.country_code,
          providers: Array.isArray(item?.providers) ? item.providers.map((provider: any) => ({
            provider: provider?.provider ?? provider?.providerCode ?? provider?.provider_code ?? provider?.name,
            operationTypes: provider?.operationTypes ?? provider?.operation_types ?? provider?.operationType ?? provider?.operation_type ?? [],
          })) : [],
        })),
      });
    } catch (error: any) {
      return res.status(503).json(buildProviderErrorPayload({
        error: "gateway_error", message: error?.message,
        fallback: "La configuration de paiement est indisponible.", provider: "pawapay",
      }));
    }
  });

  // PATCH /api/admin/operators/:id/provider — set provider: afribapay | pixpay
  app.patch("/api/admin/operators/:id/provider", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { paymentProvider, afribapayOperatorCode, pixpayServiceId, pawapayProviderCode } = req.body;

      if (!["afribapay", "pixpay", "pawapay"].includes(paymentProvider)) {
        return res.status(400).json({ message: "Fournisseur invalide." });
      }

      // If switching to PixPay, auto-detect flow type from operator name + country
      let autoFlowType = "ussd";
      if (paymentProvider === "pixpay") {
        const existingOp = await storage.getOperator(id);
        if (existingOp) {
          const country = await storage.getCountry(existingOp.countryId!);
          const countryCode = (country as any)?.code || "";
          autoFlowType = detectPixPayFlowType(existingOp.name, countryCode);
        }
      }

      const updateData: any = {
        paymentProvider,
        afribapayOperatorCode: afribapayOperatorCode || null,
        pixpayServiceId: pixpayServiceId !== undefined ? (pixpayServiceId || null) : undefined,
        pawapayProviderCode: pawapayProviderCode !== undefined ? (pawapayProviderCode || null) : undefined,
        pixpayOperatorType: paymentProvider === "pixpay" ? autoFlowType : "ussd",
      };
      // Remove undefined keys
      Object.keys(updateData).forEach(k => updateData[k] === undefined && delete updateData[k]);

      const updated = await storage.updateOperator(id, updateData);
      if (!updated) return res.status(404).json({ message: "Opérateur non trouvé" });
      console.log(`[Admin] ✓ Operator ${updated.name} (${id}) → provider=${paymentProvider} | pixpayServiceId=${pixpayServiceId || "null"} | type=${autoFlowType}`);
      res.json({ success: true, operator: updated, autoFlowType });
    } catch (err: any) {
      console.error("[Admin Provider] Error:", err);
      res.status(500).json({ message: err.message || "Erreur serveur" });
    }
  });

  // PATCH /api/admin/operators/:id/deposit-provider — fournisseur spécifique aux dépôts (indépendant du retrait/envoi)
  app.patch("/api/admin/operators/:id/deposit-provider", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { depositPaymentProvider, afribapayOperatorCode, pawapayProviderCode } = req.body;
      if (!["afribapay", "pixpay", "pawapay"].includes(depositPaymentProvider)) {
        return res.status(400).json({ message: "Fournisseur invalide." });
      }
      const updateData: any = { depositPaymentProvider };
      if (afribapayOperatorCode !== undefined) updateData.afribapayOperatorCode = afribapayOperatorCode || null;
      if (pawapayProviderCode !== undefined) updateData.pawapayProviderCode = pawapayProviderCode || null;
      const updated = await storage.updateOperator(id, updateData);
      if (!updated) return res.status(404).json({ message: "Opérateur non trouvé" });
      console.log(`[Admin] ✓ Operator ${updated.name} (${id}) → depositProvider=${depositPaymentProvider}`);
      res.json({ success: true, operator: updated });
    } catch (err: any) {
      console.error("[Admin DepositProvider] Error:", err);
      res.status(500).json({ message: err.message || "Erreur serveur" });
    }
  });

  // PATCH /api/admin/fees/:id/afribapay — update AfribaPay fee rate for a fee entry
  app.patch("/api/admin/fees/:id/afribapay", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { afribapayFee, ashtechMargin, isActive, minFee } = req.body;
      const fee = await storage.getFee(id);
      if (!fee) return res.status(404).json({ message: "Frais non trouvé" });
      const updates: any = {};
      if (afribapayFee !== undefined) {
        const rate = parseFloat(afribapayFee);
        const margin = parseFloat(ashtechMargin || "0");
        updates.afribapayFee = String(rate);
        updates.ashtechMargin = String(margin);
        updates.feeValue = String((rate + margin).toFixed(4));
      } else if (ashtechMargin !== undefined) {
        updates.ashtechMargin = String(ashtechMargin);
      }
      if (isActive !== undefined) updates.isActive = Boolean(isActive);
      if (minFee !== undefined) updates.minFee = minFee ? String(minFee) : null;
      const updated = await storage.updateFee(id, updates);
      // Sync retrait <-> envoi
      if (fee.transactionType === 'transfer' || fee.transactionType === 'withdrawal') {
        const otherType = fee.transactionType === 'transfer' ? 'withdrawal' : 'transfer';
        const allFees = await storage.getAllFees();
        let otherFee: typeof allFees[number] | undefined;
        if (fee.operatorId) {
          otherFee = allFees.find(f => f.operatorId === fee.operatorId && f.transactionType === otherType);
        } else if (fee.countryId) {
          otherFee = allFees.find(f => f.countryId === fee.countryId && !f.operatorId && f.transactionType === otherType);
        }
        if (otherFee) {
          await storage.updateFee(otherFee.id, updates);
        }
      }
      res.json({ success: true, fee: updated });
    } catch (err: any) {
      console.error("[Admin AfribaPay Fee] Error:", err);
      res.status(500).json({ message: err.message || "Erreur serveur" });
    }
  });

  // PATCH /api/admin/fees/:id/pixpay — update PixPay fee rate for a fee entry
  app.patch("/api/admin/fees/:id/pixpay", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { pixpayFee, ashtechMargin, isActive, minFee } = req.body;
      const fee = await storage.getFee(id);
      if (!fee) return res.status(404).json({ message: "Frais non trouvé" });
      const updates: any = {};
      if (pixpayFee !== undefined) {
        const rate = parseFloat(pixpayFee);
        const margin = parseFloat(ashtechMargin || "0");
        updates.pixpayFee = String(rate);
        updates.ashtechMargin = String(margin);
        updates.feeValue = String((rate + margin).toFixed(4));
      } else if (ashtechMargin !== undefined) {
        updates.ashtechMargin = String(ashtechMargin);
      }
      if (isActive !== undefined) updates.isActive = Boolean(isActive);
      if (minFee !== undefined) updates.minFee = minFee ? String(minFee) : null;
      const updated = await storage.updateFee(id, updates);
      // Sync retrait <-> envoi
      if (fee.transactionType === 'transfer' || fee.transactionType === 'withdrawal') {
        const otherType = fee.transactionType === 'transfer' ? 'withdrawal' : 'transfer';
        const allFees = await storage.getAllFees();
        let otherFee: typeof allFees[number] | undefined;
        if (fee.operatorId) {
          otherFee = allFees.find(f => f.operatorId === fee.operatorId && f.transactionType === otherType);
        } else if (fee.countryId) {
          otherFee = allFees.find(f => f.countryId === fee.countryId && !f.operatorId && f.transactionType === otherType);
        }
        if (otherFee) {
          await storage.updateFee(otherFee.id, updates);
        }
      }
      res.json({ success: true, fee: updated });
    } catch (err: any) {
      console.error("[Admin PixPay Fee] Error:", err);
      res.status(500).json({ message: err.message || "Erreur serveur" });
    }
  });

  app.patch("/api/admin/fees/:id/pawapay", requireAuth, requireAdmin, async (req, res) => {
    try {
      const fee = await storage.getFee(req.params.id);
      if (!fee) return res.status(404).json({ message: "Frais non trouvé" });
      const updates = buildPawaPayFeeUpdates(req.body, fee);
      const updated = await storage.updateFee(fee.id, updates);
      return res.json({ success: true, fee: updated });
    } catch (err: any) {
      console.error("[Admin PawaPay Fee] Error:", err.message);
      return res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // GET /api/admin/pixpay/operators — list operators that use PixPay
  app.get("/api/admin/pixpay/operators", requireAuth, requireAdmin, async (req, res) => {
    try {
              const allOperators = await storage.getAllOperators();
      const pixpayOperators = allOperators.filter((op: any) => op.paymentProvider === "pixpay");
      res.json(pixpayOperators);
    } catch (err: any) {
      console.error("[Admin PixPay Operators] Error:", err);
      res.status(500).json({ message: err.message || "Erreur serveur" });
    }
  });

  // GET /api/admin/pixpay/supported-countries — list all PixPay supported countries
  app.get("/api/admin/pixpay/supported-countries", requireAuth, requireAdmin, async (_req, res) => {
    res.json(PIXPAY_SUPPORTED_COUNTRIES);
  });

  // ════════════════════════════════════════════════════════════════════════════
  //  API v1  —  External merchant API (authenticated by Bearer API key)
  // ════════════════════════════════════════════════════════════════════════════

  /** Middleware: authenticate via Bearer API key */
  async function requireApiKey(req: any, res: any, next: any) {
    const authHeader = req.headers["authorization"] as string | undefined;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "unauthorized", message: "En-tête Authorization manquant. Format : Bearer <clé>" });
    }
    const key = authHeader.slice(7).trim();
    if (!key.startsWith("ak_")) {
      return res.status(401).json({ error: "unauthorized", message: "Clé API invalide." });
    }
    const user = await storage.getUserByApiKey(key);
    if (!user) return res.status(401).json({ error: "unauthorized", message: "Clé API introuvable ou révoquée." });
    if (!user.isVerified) {
      return res.status(403).json({ error: "account_not_verified", message: "Votre compte n'est pas vérifié. Complétez la vérification KYC pour accéder à l'API." });
    }
    if ((user as any).isBanned) {
      return res.status(403).json({ error: "account_banned", message: "Votre compte n'est pas autorisé à utiliser l'API." });
    }
    if (!(user as any).apiEnabled) {
      return res.status(403).json({ error: "api_not_enabled", message: "L'accès API n'est pas activé sur votre compte. Contactez l'administrateur pour l'activer." });
    }
    req.apiUser = user;
    next();
  }

  /**
   * Normalize internal DB currency codes to standard ISO codes.
   * The DB uses suffixed codes (XOFB, XOFF, XAFC…) to distinguish sub-zones internally,
   * but merchants must use standard codes (XOF, XAF…).
   */
  function normalizeApiCurrency(dbCurrency: string): string {
    const c = (dbCurrency || "").toUpperCase();
    if (c.startsWith("XOF")) return "XOF";
    if (c.startsWith("XAF")) return "XAF";
    return c; // CDF stays unchanged
  }

  /** GET /v1/countries — list all active countries with their operators */
  app.get("/v1/countries", apiV1Limiter, requireApiKey, async (_req, res) => {
    try {
       const countries = (await storage.getActiveCountries()).filter((c: any) => c.isActiveForDeposit !== false);
      const result = await Promise.all(
        countries.map(async (c: any) => {
          const ops = await storage.getOperatorsByCountry(c.id);
          return {
            code: c.code,
            name: c.name,
             currency: normalizeApiCurrency(countryWalletCurrency(c)),
            operators: ops
            .filter((o: any) => {
              const provider = o.depositPaymentProvider || o.paymentProvider;
              return o.isActive &&
                !o.isInMaintenance &&
                (provider === "afribapay" || provider === "pixpay" || provider === "pawapay");
            })
              .map((o: any) => o.name),
          };
        })
      );
      res.json(result.filter((c: any) => c.operators.length > 0));
    } catch (e: any) {
      console.error("[API v1 /countries]", e);
      res.status(500).json({ error: "server_error", message: "Erreur serveur" });
    }
  });

  /** GET /v1/crypto/assets — list crypto assets enabled for Direct SDK */
  app.get("/v1/crypto/assets", apiV1Limiter, requireApiKey, async (_req, res) => {
    try {
      const disabled = parseDisabledCryptoAssets(
        (await storage.getSetting("crypto_disabled_assets"))?.value,
      );
      // The provider catalogue is preferred, but keep the documented static
      // catalogue available when the provider API is temporarily unreachable.
      const liveOrFallback = isIziPayConfigured()
        ? await fetchCryptoAssets().catch((error: any) => {
            console.warn("[API v1 /crypto/assets] live catalogue unavailable, using fallback:", error.message);
            return getStaticCryptoAssets();
          })
        : getStaticCryptoAssets();
      const assets = filterCryptoAssets(
        liveOrFallback,
        disabled,
      );
      const response = Object.entries(assets).flatMap(([coin, definition]) =>
        definition.networks.map(network => ({
          asset_code: network.assetCode,
          coin,
          name: definition.name,
          network: network.id,
          network_label: network.label,
          memo_required: network.memoRequired,
          memo_type: network.memoType,
          currency: "USDT",
        })),
      );
      return res.json({ assets: response });
    } catch (e: any) {
      console.error("[API v1 /crypto/assets]", e);
      return res.status(503).json({
        error: "crypto_unavailable",
        message: "Le catalogue crypto est temporairement indisponible.",
      });
    }
  });

  /**
   * POST /v1/crypto/collect — initiate a Direct SDK crypto pay-in.
   *
   * This is deliberately separate from /v1/collect: the existing Mobile Money
   * contract and routing are left untouched.
   */
  app.post("/v1/crypto/collect", apiV1Limiter, requireApiKey, async (req: any, res) => {
    const requestId = crypto.randomUUID();
    try {
      const merchant = req.apiUser;
      if (!isIziPayConfigured()) {
        return res.status(503).json({
          error: "crypto_unavailable",
          message: "Le paiement crypto n'est pas configuré.",
        });
      }

      const parsed = parseDirectCryptoRequest(req.body);
      if (!parsed.ok) {
        return res.status(400).json({ error: parsed.error, message: parsed.message });
      }
      const request: DirectCryptoRequest = parsed.value;

      const disabled = parseDisabledCryptoAssets(
        (await storage.getSetting("crypto_disabled_assets"))?.value,
      );
      if (disabled.has(request.assetCode)) {
        return res.status(422).json({
          error: "asset_disabled",
          message: `Le réseau crypto ${request.assetCode} n'est pas disponible actuellement.`,
        });
      }

      const availableAssets = filterCryptoAssets(
        isIziPayConfigured()
          ? await fetchCryptoAssets().catch((error: any) => {
              console.warn("[API v1 /crypto/collect] live catalogue unavailable, using fallback:", error.message);
              return getStaticCryptoAssets();
            })
          : getStaticCryptoAssets(),
        disabled,
      );
      const selectedNetwork = Object.values(availableAssets)
        .flatMap(coin => coin.networks)
        .find(network => network.assetCode === request.assetCode);
      if (!selectedNetwork) {
        return res.status(422).json({
          error: "unsupported_asset",
          message: `Réseau crypto non supporté : ${request.assetCode}. Utilisez GET /v1/crypto/assets.`,
        });
      }

      const fxRates = await loadFxRates();
      let grossUsdt: number;
      let originalAmount: number | null = null;
      let originalCurrency: string;
      if (request.currency === "USDT") {
        grossUsdt = request.amount;
        originalCurrency = "USDT";
      } else {
        originalAmount = request.amount;
        originalCurrency = request.currency;
        const amountInXaf = convertToXAF(request.amount, request.currency, fxRates);
        const adminRateSetting = await storage.getSetting("fx_rate_USDT");
        const usdtPerXaf = adminRateSetting
          ? parseFloat(adminRateSetting.value)
           : (fxRates.USDT ?? 585);
        if (!Number.isFinite(usdtPerXaf) || usdtPerXaf <= 0) {
          return res.status(503).json({
            error: "rate_unavailable",
            message: "Le taux de conversion USDT est temporairement indisponible.",
          });
        }
        grossUsdt = amountInXaf / usdtPerXaf;
      }

      if (!Number.isFinite(grossUsdt) || grossUsdt <= 0) {
        return res.status(400).json({
          error: "invalid_amount",
          message: "Le montant converti en USDT doit être positif.",
        });
      }

      const amounts = await resolveCryptoFeeBreakdown(grossUsdt);

      const merchantReference = request.reference?.trim() || null;
      const reference = generateTransactionReference("deposit");
      if (merchantReference) {
        const existing = await storage.getApiTransactionByMerchantReference(merchant.id, merchantReference);
        if (existing) {
          const existingMetadata = (existing as any).metadata || {};
          const sameRequest =
            Number(existing.totalAmount || existing.amount) === Number(amounts.grossUsdt) &&
            String(existingMetadata.assetCode || "").toUpperCase() === request.assetCode.toUpperCase() &&
            String(existingMetadata.originalCurrency || existing.currency).toUpperCase() === originalCurrency.toUpperCase();
          if (!sameRequest) {
            return res.status(409).json({
              error: "idempotency_conflict",
              message: "Cette reference existe déjà avec des paramètres différents.",
            });
          }
          return res.status(200).json({
            transaction_id: existing.id,
            reference: existing.reference,
            merchant_reference: existingMetadata.merchantReference || merchantReference,
            status: existing.status === "completed" ? "success" : existing.status,
            payment_method: "crypto",
            asset_code: existingMetadata.assetCode || request.assetCode,
            network: selectedNetwork.id,
            address: existingMetadata.address || null,
            memo: existingMetadata.memo || null,
            memo_type: existingMetadata.memoType || null,
            amount: request.amount,
            currency: originalCurrency,
            amount_usdt: Number(existing.totalAmount || amounts.grossUsdt),
            credited_amount: Number(existing.amount),
            fee_amount: Number(existing.feeAmount || 0),
            created_at: existing.createdAt,
            idempotent_replay: true,
          });
        }
      }

      let transaction: Transaction;
      try {
        transaction = await storage.createTransaction({
          userId: merchant.id,
          type: "deposit",
          amount: amounts.creditedUsdt.toFixed(6),
          totalAmount: amounts.grossUsdt.toFixed(6),
          feeAmount: amounts.feeUsdt.toFixed(6),
          ashtechFeeAmount: amounts.ashtechFeeUsdt.toFixed(6),
          currency: "USDT",
          status: "pending",
          description: `Paiement API crypto ${request.assetCode} — ${originalAmount ?? amounts.grossUsdt} ${originalCurrency}`,
          paymentMethod: "crypto",
          reference,
          notifyUrl: request.notifyUrl || null,
          source: "api",
          metadata: {
            assetCode: request.assetCode,
            sdk: "direct",
            originalAmount,
            originalCurrency,
            ...(merchantReference ? { merchantReference } : {}),
          },
        });
      } catch (reservationError: any) {
        const raced = merchantReference
          ? await storage.getApiTransactionByMerchantReference(merchant.id, merchantReference)
          : await storage.getTransactionByReference(reference);
        if (raced) {
          return res.status(200).json({
            transaction_id: raced.id,
            reference: raced.reference,
            status: raced.status === "completed" ? "success" : raced.status,
            payment_method: "crypto",
            asset_code: request.assetCode,
            network: selectedNetwork.id,
            amount: request.amount,
            currency: originalCurrency,
            amount_usdt: Number(raced.totalAmount || amounts.grossUsdt),
            credited_amount: Number(raced.amount),
            fee_amount: Number(raced.feeAmount || 0),
            created_at: raced.createdAt,
            idempotent_replay: true,
          });
        }
        throw reservationError;
      }

      const customer = buildDirectCryptoCustomer(request);
      let charge;
      try {
        charge = await createDirectCharge({
          requestedCoin: request.assetCode,
          amount: amounts.grossUsdt.toFixed(6),
           ...(customer ? { customer } : {}),
          merchantReference: reference,
          metadata: {
            merchantId: merchant.id,
            source: "direct_sdk",
            ...(merchantReference ? { merchantReference } : {}),
            assetCode: request.assetCode,
            currency: originalCurrency,
            originalAmount,
          },
        });
      } catch (chargeError: any) {
        await storage.updateTransactionStatus(transaction.id, "failed");
        const providerStatus = Number(chargeError?.status);
        const providerCode = chargeError?.code;
        console.error(
          `[API v1 /crypto/collect] request=${requestId} createDirectCharge:`,
          chargeError?.message,
          providerCode ? `code=${providerCode}` : "",
        );
        return res.status(502).json({
          ...buildProviderErrorPayload({
            error: providerCode === "provider_invalid_response"
              ? "provider_invalid_response"
              : "gateway_error",
            message: chargeError?.message,
            fallback: "Impossible de générer l'adresse crypto.",
            provider: "izichange",
            providerCode,
            providerStatus: Number.isFinite(providerStatus) ? providerStatus : undefined,
          }),
          request_id: requestId,
        });
      }
       if (selectedNetwork.memoRequired && !charge.memo) {
         await storage.updateTransactionStatus(transaction.id, "failed");
         return res.status(502).json({
           error: "provider_missing_memo",
           message: `Le réseau ${request.assetCode} exige un ${selectedNetwork.memoType || "memo/tag"}, mais le fournisseur n'en a pas retourné.`,
           request_id: requestId,
         });
       }

      const cryptoMetadata = await (async () => {
          const _coin = request.assetCode.split(".")[0].toUpperCase();
          const _price = await getCryptoPriceUsd(_coin).catch(() => 0);
          const _grossCoin = _price > 0 ? amounts.grossUsdt / _price : null;
          const _creditedCoin = _price > 0 ? amounts.creditedUsdt / _price : null;
          return {
            assetCode: request.assetCode,
            address: charge.address,
            memo: charge.memo ?? null,
            memoType: charge.memoType ?? null,
            izichangeId: charge.id || null,
            sdk: "direct",
            originalAmount,
            originalCurrency,
            feePercent: amounts.feePercent,
            grossAmountUsdt: amounts.grossUsdt,
            providerFeePercent: amounts.providerFeePercent,
            providerFeeAmountUsdt: amounts.providerFeeUsdt,
            ashtechFeePercent: amounts.ashtechFeePercent,
            ashtechFeeAmountUsdt: amounts.ashtechFeeUsdt,
            totalFeePercent: amounts.totalFeePercent,
            totalFeeAmountUsdt: amounts.feeUsdt,
            creditedAmountUsdt: amounts.creditedUsdt,
            expiresAt: charge.expiresAt ?? null,
            ...(_grossCoin !== null ? { grossAmountCoin: parseFloat(_grossCoin.toFixed(8)), coinPriceUsdt: _price } : {}),
            ...(_creditedCoin !== null ? { creditedAmountCoin: parseFloat(_creditedCoin.toFixed(8)) } : {}),
          };
        })();
      const finalCryptoMetadata = {
        ...cryptoMetadata,
        ...(merchantReference ? { merchantReference } : {}),
      };
      await storage.updateTransaction(transaction.id, {
        externalReference: charge.id || undefined,
        metadata: finalCryptoMetadata,
      });
      transaction = {
        ...transaction,
        externalReference: charge.id || transaction.externalReference,
        metadata: finalCryptoMetadata,
      } as Transaction;

      console.log(
        `[API v1 /crypto/collect] merchant=${merchant.id} asset=${request.assetCode} ` +
        `amount=${amounts.grossUsdt} USDT ref=${reference}`,
      );
      return res.status(202).json({
        transaction_id: transaction.id,
            reference,
            merchant_reference: merchantReference,
        status: "pending",
        payment_method: "crypto",
        asset_code: request.assetCode,
        network: selectedNetwork.id,
        address: charge.address,
        memo: charge.memo ?? null,
        memo_type: charge.memoType ?? null,
        amount: request.amount,
        currency: originalCurrency,
        amount_usdt: amounts.grossUsdt,
        credited_amount: amounts.creditedUsdt,
        fee_amount: amounts.feeUsdt,
        gross_amount_usdt: amounts.grossUsdt,
        provider_fee_percent: amounts.providerFeePercent,
        provider_fee_amount_usdt: amounts.providerFeeUsdt,
        ashtech_fee_percent: amounts.ashtechFeePercent,
        ashtech_fee_amount_usdt: amounts.ashtechFeeUsdt,
        total_fee_percent: amounts.totalFeePercent,
        total_fee_amount_usdt: amounts.feeUsdt,
        credited_amount_usdt: amounts.creditedUsdt,
        fee_amount_usdt: amounts.feeUsdt,
        fee_percent: amounts.feePercent,
        expires_at: charge.expiresAt ?? null,
        created_at: transaction.createdAt,
      });
    } catch (e: any) {
      console.error(`[API v1 /crypto/collect] request=${requestId}`, e?.stack || e);
      return res.status(500).json({
        error: "server_error",
        message: "Le serveur n'a pas pu finaliser la création du paiement crypto.",
        stage: "transaction_creation",
        ...(typeof e?.code === "string" && /^[a-z0-9_.-]+$/i.test(e.code)
          ? { detail_code: e.code }
          : {}),
        request_id: requestId,
      });
    }
  });

  /** POST /v1/collect — initiate a Mobile Money collection */
  app.post("/v1/collect", apiV1Limiter, requireApiKey, async (req: any, res) => {
    try {
      const merchant = req.apiUser;
      const {
        amount, currency, phone, operator: operatorName, country_code, reference, notify_url,
        preAuthorisationCode, preauthorizationCode, otp,
      } = req.body;
      const merchantReference = typeof reference === "string" && reference.trim()
        ? reference.trim()
        : null;
      const pawaPayPreAuthorisationCode = preAuthorisationCode || preauthorizationCode || otp;

      // ── Validation ────────────────────────────────────────────────────────
      if (!amount || !currency || !phone || !operatorName || !country_code) {
        return res.status(400).json({ error: "bad_request", message: "Champs requis : amount, currency, phone, operator, country_code" });
      }
      const amountNum = parseFloat(amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        return res.status(400).json({ error: "bad_request", message: "Le montant doit être un nombre positif." });
      }

      // ── Find country ──────────────────────────────────────────────────────
       const allCountries = (await storage.getActiveCountries()).filter((c: any) => c.isActiveForDeposit !== false);
      const country = allCountries.find(
        (c: any) => c.code.toUpperCase() === country_code.toUpperCase()
      );
      if (!country) return res.status(422).json({ error: "unprocessable", message: `Pays non supporté : ${country_code}` });

      // ── Find operator ──────────────────────────────────────────────────────
      const countryOps = await storage.getOperatorsByCountry(country.id);
       const operatorRecord = countryOps.find(
         (o: any) =>
           o.name.toLowerCase() === operatorName.toLowerCase() &&
           o.isActive &&
           !o.isInMaintenance
       );
      if (!operatorRecord) {
         const available = countryOps
           .filter((o: any) => o.isActive && !o.isInMaintenance)
           .map((o: any) => o.name)
           .join(", ");
        return res.status(422).json({
          error: "unprocessable",
          message: `Opérateur non supporté pour ce pays. Disponibles : ${available}`,
        });
      }
      // ── Validate currency matches country (accept both normalized and internal codes) ────
       const walletCurrency = countryWalletCurrency(country);
       const expectedIso = normalizeApiCurrency(walletCurrency);
      const receivedIso = normalizeApiCurrency(currency);
      if (receivedIso !== expectedIso) {
        return res.status(422).json({
          error: "unprocessable",
          message: `Devise incorrecte pour ce pays. Attendu : ${expectedIso}`,
        });
      }

      // ── Resolve payment provider (use operator tag, fallback to country-based detection) ─
        const PIXPAY_COLLECT_CODES = new Set(["CM","CD","CI","SN","BF"]);
        const AFRIBAPAY_COLLECT_CODES = new Set(["BF","BJ","CD","CF","CG","CI","CM","GA","GW","ML","NE","SN","TD","TG"]);
      const paymentProvider = ((operatorRecord as any).depositPaymentProvider || (operatorRecord as any).paymentProvider) as string;
      if (paymentProvider !== "afribapay" && paymentProvider !== "pixpay" && paymentProvider !== "pawapay") {
        return res.status(422).json({ error: "unprocessable", message: "Aucun fournisseur de paiement valide n'est configuré pour cet opérateur." });
      }
       const countryCode = country.code.toUpperCase();
        const providerCountries = paymentProvider === "pixpay" ? PIXPAY_COLLECT_CODES
          : paymentProvider === "afribapay" ? AFRIBAPAY_COLLECT_CODES : null;
        if (providerCountries && !providerCountries.has(countryCode)) {
         return res.status(422).json({
           error: "unprocessable",
           message: `Le pays ${country.code} n'est pas pris en charge pour cet opérateur.`,
         });
       }
       if (paymentProvider === "pixpay") {
         const serviceId = getPixPayServiceId(operatorRecord.name, country.code, "cash_out");
         if (!serviceId) {
           return res.status(422).json({
             error: "unprocessable",
             message: "Cet opérateur n'est pas configuré pour la collecte Mobile Money.",
           });
         }
       }
      console.log(`[API /v1/collect] merchant=${merchant.id} | country=${country.code} | operator=${operatorName} | provider=${paymentProvider} | amount=${amountNum} ${currency}`);
      const resolvedFeeRecord = await storage.resolveFee("deposit", country.id, (operatorRecord as any).id);
      const ashtechMarginPct = (resolvedFeeRecord as any)?.ashtechMargin != null
        ? parseFloat((resolvedFeeRecord as any).ashtechMargin)
        : ASHTECH_MARGIN;

      let creditedAmount: number;
      let ashtechFeeAmount: number;
      if (paymentProvider === "afribapay") {
        const rate = (resolvedFeeRecord as any)?.afribapayFee ? parseFloat((resolvedFeeRecord as any).afribapayFee) : 3.0;
        const af = computeAfribaPayFees(amountNum, rate, ashtechMarginPct);
        creditedAmount = af.creditedAmount;
        ashtechFeeAmount = af.ashtechFeeAmount;
      } else if (paymentProvider === "pixpay") {
        const rate = (resolvedFeeRecord as any)?.pixpayFee ? parseFloat((resolvedFeeRecord as any).pixpayFee) : 3.0;
        const pf = computePixPayFees(amountNum, rate, ashtechMarginPct);
        creditedAmount = pf.creditedAmount;
        ashtechFeeAmount = pf.ashtechFeeAmount;
      } else {
        const rate = (resolvedFeeRecord as any)?.pawapayFee != null ? parseFloat((resolvedFeeRecord as any).pawapayFee) : 3.0;
        const pf = computePixPayFees(amountNum, rate, ashtechMarginPct);
        creditedAmount = pf.creditedAmount;
        ashtechFeeAmount = pf.ashtechFeeAmount;
      }

       // The merchant reference is kept for idempotency and merchant webhooks,
       // but every provider receives an AshTech-generated reference.
       const depositRef = generateTransactionReference("deposit");

       if (merchantReference && !req.body.otp) {
         const existing = await storage.getApiTransactionByMerchantReference(merchant.id, merchantReference);
         if (existing) {
           const sameRequest =
             parseFloat(String(existing.totalAmount || existing.amount)) === amountNum &&
             String(existing.currency).toUpperCase() === walletCurrency.toUpperCase() &&
             String(existing.recipientPhone || "") === String(phone) &&
             String(existing.operatorId || "") === String((operatorRecord as any).id || "");
           if (!sameRequest) {
             return res.status(409).json({
               error: "idempotency_conflict",
               message: "Cette reference existe déjà avec des paramètres différents.",
             });
           }
           return res.status(200).json({
             transaction_id: existing.id,
             reference: existing.reference,
             merchant_reference: merchantReference,
             status: existing.status === "completed" ? "success" : existing.status,
             amount: parseFloat(String(existing.totalAmount || existing.amount)),
             credited_amount: parseFloat(String(existing.amount)),
             fee_amount: parseFloat(String(existing.feeAmount || "0")),
             currency: normalizeApiCurrency(existing.currency),
             operator: operatorName,
             phone,
             country_code: country.code,
             created_at: existing.createdAt,
             idempotent_replay: true,
           });
         }
       }

      // ── PixPay OTP pre-check ──────────────────────────────────────────────
      if (paymentProvider === "pixpay") {
        const pxFlowType = detectPixPayFlowType(operatorName, country.code);
        if (pxFlowType === "otp" && !req.body.otp) {
          const ussdCode = PIXPAY_OTP_USSD_CODES[country.code.toUpperCase()] || "#144*82#";
          const amountForCode = ussdCode.includes("montant") ? ussdCode.replace("montant", String(Math.round(amountNum))) : ussdCode;
          return res.status(400).json({
            error: "otp_required",
            message: `OTP requis. Composez ${amountForCode} pour obtenir votre code OTP, puis relancez la requête avec le champ 'otp'.`,
            ussd_code: amountForCode,
          });
        }
      }

      // ── AfribaPay OTP: second call — confirm OTP from cached session ────────
      // The client previously received a 400 otp_required with a `reference` field.
      // They now resend with otp + reference. We must NOT call initiateAfribaPayOtp
      // again (that would trigger a new SMS and invalidate the cached session on
      // AfribaPay's side). Just call confirmAfribaPayOtp directly.
      //
      // Guard: if otp is present but reference is absent, the client cannot have
      // the correct session — return a clear 400 rather than creating a duplicate
      // transaction and calling the wrong (non-OTP) AfribaPay endpoint, which
      // causes a 502 gateway_error. This was the root cause of the merchant bug
      // where the second call omitted the reference field.
      if (paymentProvider === "afribapay" && req.body.otp && !req.body.reference) {
        return res.status(400).json({
          error: "missing_reference",
          message: "Le champ 'reference' est obligatoire lors de la confirmation OTP. Utilisez la valeur reçue dans la réponse 400 otp_required initiale.",
        });
      }
      if (paymentProvider === "afribapay" && req.body.otp && req.body.reference) {
        const otpMerchantReference = String(req.body.reference).trim();
        const ctx = await loadOtpContext(otpMerchantReference);
        if (!ctx) {
          return res.status(400).json({
            error: "otp_expired",
            message: "Session OTP expirée ou introuvable. Relancez la requête sans le champ 'otp' pour initier une nouvelle session.",
          });
        }
        if (ctx.userId && ctx.userId !== merchant.id) {
          return res.status(403).json({ error: "forbidden", message: "Cette session OTP n'appartient pas à votre compte." });
        }
        const callbackUrlOtp = buildWebhookUrl("/api/afribapay/webhook");
        const afribapayCurrencyOtp = AFRIBAPAY_ISO_CURRENCY[country.code.toUpperCase()] || country.currency;
        const confirmedResponse = await confirmAfribaPayOtp({
          operator: ctx.operator,
          country: ctx.country,
          phone_number: ctx.phone,
          amount: ctx.amount,
          currency: afribapayCurrencyOtp,
          order_id: ctx.afribaTransactionId,
          reference_id: ctx.afribaTransactionId,
          otp_code: req.body.otp as string,
          notify_url: callbackUrlOtp,
          return_url: `${process.env.APP_URL}/dashboard/deposit?status=success`,
          cancel_url: `${process.env.APP_URL}/dashboard/deposit?status=cancelled`,
          lang: "fr",
        });
        await deleteOtpContext(otpMerchantReference);
        if (otpMerchantReference !== ctx.afribaTransactionId) {
          await deleteOtpContext(ctx.afribaTransactionId);
        }
        const existingTxOtp = await storage.getTransactionByReference(ctx.afribaTransactionId);
        if (!confirmedResponse.success) {
          if (existingTxOtp) await storage.updateTransactionStatus(existingTxOtp.id, "failed");
          return res.status(502).json(buildProviderErrorPayload({
            error: "gateway_error",
            message: confirmedResponse.message,
            fallback: "Code OTP invalide ou expiré.",
            provider: "afribapay",
            raw: confirmedResponse.raw,
            providerCode: confirmedResponse.providerCode,
            providerStatus: confirmedResponse.providerStatus,
            sensitiveValues: [phone],
          }));
        }
        const extRefOtp = confirmedResponse.transaction_id || ctx.afribaTransactionId;
        if (existingTxOtp) {
          await storage.updateTransactionExternalReference(existingTxOtp.id, extRefOtp);
          addPendingPayment({
            transactionId: existingTxOtp.id,
            reference: existingTxOtp.reference || ctx.afribaTransactionId,
            externalReference: extRefOtp,
            attempts: 0,
            userId: merchant.id,
            type: "deposit",
            amount: ctx.amount.toString(),
            provider: "afribapay",
            countryCode: country.code,
          });
        }
        return res.status(202).json({
          transaction_id: existingTxOtp?.id || ctx.afribaTransactionId,
          reference: existingTxOtp?.reference || ctx.afribaTransactionId,
          merchant_reference: otpMerchantReference,
          status: "pending",
          amount: amountNum,
          credited_amount: creditedAmount,
          fee_amount: ashtechFeeAmount,
          currency: normalizeApiCurrency(walletCurrency),
          operator: operatorName,
          phone,
          country_code: country.code,
          created_at: (existingTxOtp as any)?.createdAt,
        });
      }

      // ── AfribaPay OTP: first call — detect, initiate (if SMS), cache, return 400 ─
      // Two OTP sub-types handled differently:
      //
      //   type "api"  (Orange CI, LigdiCash BF…):
      //     AfribaPay sends an SMS when we POST /v1/pay/otp with otp_code: "".
      //     → Call initiateAfribaPayOtp, cache session, return 400 with reference.
      //
      //   type "ussd" (Orange BF *144*4*6*montant#, Orange SN #144*391#…):
      //     The user dials the USSD code themselves. AfribaPay does NOT expose an
      //     SMS initiation endpoint for these — calling initiateAfribaPayOtp for
      //     them returns an error and causes a 502. Instead:
      //     → Skip initiateAfribaPayOtp, cache session, return 400 with ussd_code.
      //     The second call (with otp + reference) calls confirmAfribaPayOtp.
      if (paymentProvider === "afribapay") {
        const afribaOpCodePre = resolveAfribaPayOperatorCode(operatorRecord, operatorName);
        const otpInfoPre = await getAfribaPayOtpInfo(country.code, afribaOpCodePre);
        if (otpInfoPre.required && !req.body.otp) {
          // Normalize phone (same logic as main AfribaPay block below)
          const COUNTRY_PREFIXES_PRE: Record<string, string> = {
            CM: "237", SN: "221", CI: "225", BF: "226", ML: "223",
            GN: "224", BJ: "229", TG: "228", NE: "227", CD: "243",
            CG: "242", CF: "236", TD: "235", GA: "241", GQ: "240",
            MG: "261", RW: "250", KE: "254", TZ: "255", UG: "256",
            GH: "233", NG: "234",
          };
          let localPhonePre = phone.replace(/\s/g, "");
          if (localPhonePre.startsWith("+")) localPhonePre = localPhonePre.slice(1);
          const countryPrefixPre = COUNTRY_PREFIXES_PRE[country.code.toUpperCase()];
          if (countryPrefixPre && localPhonePre.startsWith(countryPrefixPre)) {
            localPhonePre = localPhonePre.slice(countryPrefixPre.length);
          }
          const afribapayCurrencyPre = AFRIBAPAY_ISO_CURRENCY[country.code.toUpperCase()] || normalizeApiCurrency(walletCurrency);
          const callbackUrlPre = buildWebhookUrl("/api/afribapay/webhook");

          // Create the transaction NOW so it exists when the client confirms the OTP
          const txPre = await storage.createTransaction({
            userId: merchant.id,
            type: "deposit",
            amount: creditedAmount.toString(),
            currency: walletCurrency,
            status: "pending",
            description: `Paiement API — ${operatorName} — ${phone}`,
            paymentMethod: "mobile_money",
            reference: depositRef,
            operatorId: (operatorRecord as any).id,
            feeAmount: ashtechFeeAmount.toFixed(2),
            totalAmount: amountNum.toFixed(2),
            recipientPhone: phone,
            notifyUrl: notify_url || null,
            source: "api",
            metadata: merchantReference ? { merchantReference } : undefined,
          });

          if (otpInfoPre.type === "api") {
            // SMS-type OTP: AfribaPay sends the code — trigger it now.
            const otpInitResultPre = await initiateAfribaPayOtp({
              operator: afribaOpCodePre,
              country: country.code,
              phone_number: localPhonePre,
              amount: amountNum,
              currency: afribapayCurrencyPre,
              order_id: depositRef,
              reference_id: depositRef,
              notify_url: callbackUrlPre,
            });
            if (!otpInitResultPre.success) {
              await storage.updateTransactionStatus(txPre.id, "failed");
              return res.status(502).json(buildProviderErrorPayload({
                error: "gateway_error",
                message: otpInitResultPre.message,
                fallback: "Impossible d'envoyer le code OTP.",
                provider: "afribapay",
                raw: otpInitResultPre.raw,
                providerCode: otpInitResultPre.providerCode,
                providerStatus: otpInitResultPre.providerStatus,
                sensitiveValues: [phone],
              }));
            }
          }
          // USSD-type OTP: user dials the USSD code shown in ussd_code — no SMS
          // endpoint to call. Cache immediately so the confirm call can find the session.

          const otpContext: OtpContext = {
            userId: merchant.id,
            operator: afribaOpCodePre,
            country: country.code,
            phone: localPhonePre,
            amount: amountNum,
            currency: afribapayCurrencyPre,
            afribaTransactionId: depositRef,
            expiresAt: Date.now() + 15 * 60 * 1000, // 15 min
            otpType: otpInfoPre.type === "none" ? undefined : otpInfoPre.type,
          };
          await persistOtpContext(depositRef, otpContext);
          if (merchantReference && merchantReference !== depositRef) {
            await persistOtpContext(merchantReference, otpContext);
          }

          // Substitute "montant" placeholder with the actual amount (e.g. BF Orange: *144*4*6*5000#)
          const ussdCodeForCollect = otpInfoPre.ussdCode?.includes("montant")
            ? otpInfoPre.ussdCode.replace(/montant/gi, String(Math.round(amountNum)))
            : (otpInfoPre.ussdCode || null);
          const otpMsg = otpInfoPre.type === "ussd"
            ? `OTP requis. Composez ${ussdCodeForCollect} sur votre téléphone pour obtenir votre code, puis relancez la requête avec les champs 'otp' et 'reference'.`
            : "OTP requis. Un code a été envoyé par SMS. Relancez la requête avec les champs 'otp' et 'reference'.";

          return res.status(400).json({
            error: "otp_required",
            message: otpMsg,
            reference: depositRef, // client MUST include this in the confirmation call
            ...(merchantReference ? { merchant_reference: merchantReference } : {}),
            ussd_code: ussdCodeForCollect,
          });
        }
      }

      // ── Create transaction ────────────────────────────────────────────────
      let pawaOperation: Awaited<ReturnType<typeof resolvePawaPayOperationConfiguration>> | undefined;
      if (paymentProvider === "pawapay") {
         try {
           const pawaProvider = resolvePawaPayProviderCode(operatorRecord, operatorName, country.code);
           pawaOperation = await resolvePawaPayOperationConfiguration(
             pawaProvider, "DEPOSIT", pawaPayCountry(country.code), toPawaPayCurrency(walletCurrency),
           );
           if (pawaOperation?.authType === "PREAUTH" && !pawaPayPreAuthorisationCode) {
             return res.status(428).json({
               error: "pawa_preauthorisation_required",
               message: "Une préautorisation Mobile Money est requise avant le paiement.",
               pawaPayAuth: pawaPayAuthPayload(pawaOperation),
             });
           }
           await assertPawaPayProviderActive(
             pawaProvider, "DEPOSIT", pawaPayCountry(country.code), toPawaPayCurrency(walletCurrency), pawaOperation ?? undefined,
           );
         } catch (error: any) {
           console.error("[API v1/collect] PawaPay provider validation failed:", error);
           return res.status(503).json(buildProviderErrorPayload({
             error: "provider_unavailable",
             message: error?.message,
             fallback: "Le fournisseur de paiement n'est pas disponible pour cette opération.",
             provider: "pawapay",
           }));
         }
       }
       const pawaPayDepositId = paymentProvider === "pawapay" ? createPawaPayId() : undefined;
       const transaction = await storage.createTransaction({
        userId: merchant.id,
        type: "deposit",
        amount: creditedAmount.toString(),
        currency: walletCurrency,
        status: "pending",
        description: `Paiement API — ${operatorName} — ${phone}`,
        paymentMethod: "mobile_money",
        reference: depositRef,
        operatorId: (operatorRecord as any).id,
        feeAmount: ashtechFeeAmount.toFixed(2),
        totalAmount: amountNum.toFixed(2),
        recipientPhone: phone,
        notifyUrl: notify_url || null,
        source: "api",
         ...(pawaPayDepositId ? { externalReference: pawaPayDepositId } : {}),
        metadata: {
              ...(merchantReference ? { merchantReference } : {}),
              ...(pawaPayDepositId ? {
              paymentProvider: "pawapay",
              pawaCountry: pawaPayCountry(country.code),
              countryCode: country.code,
              walletCurrency,
              } : {}),
            },
      });

      // ── Call payment provider ──────────────────────────────────────────────
      const callbackUrl = buildWebhookUrl("/api/afribapay/webhook");
      const pixpayIpnUrl = buildWebhookUrl("/api/pixpay/webhook");
      let pawaPayResult: Awaited<ReturnType<typeof createPawaPayDeposit>> | undefined;

       if (paymentProvider === "pawapay") {
         pawaPayResult = await createPawaPayDeposit({
           depositId: pawaPayDepositId, amount: amountNum.toFixed(2),
           country: pawaPayCountry(country.code),
           currency: toPawaPayCurrency(walletCurrency),
           payer: { provider: resolvePawaPayProviderCode(operatorRecord, operatorName, country.code), phoneNumber: normalizePhone(phone) || "" },
            clientReferenceId: depositRef,
            customerMessage: PAWAPAY_CUSTOMER_MESSAGE,
            operationConfiguration: pawaOperation,
            preAuthorisationCode: pawaPayPreAuthorisationCode,
         });
         if (pawaPayResult.status === "failed") {
           await storage.claimTransactionStatus(transaction.id, "failed");
           return res.status(502).json(buildProviderErrorPayload({
             error: "gateway_error", message: pawaPayResult.providerMessage, fallback: "Échec du paiement Mobile Money.",
             provider: "pawapay", raw: pawaPayResult.raw, providerCode: pawaPayResult.providerCode, providerStatus: pawaPayResult.providerStatus, sensitiveValues: [phone],
           }));
         }
         if (pawaPayResult.status === "completed") await processPawaPayDepositCallback(transaction, "completed");
         else addPendingPayment({ transactionId: transaction.id, reference: depositRef, externalReference: pawaPayDepositId!, attempts: 0, userId: merchant.id, type: "deposit", amount: creditedAmount.toString(), provider: "pawapay", countryCode: country.code });
       } else if (paymentProvider === "afribapay") {
        warnIfAfribaPayUnsupportedCountry(country.code, "v1/collect");
        const afribaOpCode = resolveAfribaPayOperatorCode(operatorRecord, operatorName);
        const afribapayCurrency = AFRIBAPAY_ISO_CURRENCY[country.code.toUpperCase()] || country.currency;

        // Normalize phone: strip spaces, leading +, then country prefix
        const COUNTRY_PREFIXES: Record<string, string> = {
          CM: "237", SN: "221", CI: "225", BF: "226", ML: "223",
          GN: "224", BJ: "229", TG: "228", NE: "227", CD: "243",
          CG: "242", CF: "236", TD: "235", GA: "241", GQ: "240",
          MG: "261", RW: "250", KE: "254", TZ: "255", UG: "256",
          GH: "233", NG: "234",
        };
        let localPhone = phone.replace(/\s/g, "");
        if (localPhone.startsWith("+")) localPhone = localPhone.slice(1);
        const countryPrefix = COUNTRY_PREFIXES[country.code.toUpperCase()];
        if (countryPrefix && localPhone.startsWith(countryPrefix)) {
          localPhone = localPhone.slice(countryPrefix.length);
        }

        // OTP operators (Orange CI/BF, Moov CI/BF, etc.) are fully handled above:
        //   first call  → initiate OTP + cache (returns 400 otp_required + reference)
        //   second call → early-exit via otpContextCache (returns 202 after confirmAfribaPayOtp)
        // This block only executes for non-OTP operators → direct /v1/pay/payin.
        const afribaResponse = await initiateAfribaPayin({
          operator: afribaOpCode,
          country: country.code,
          phone_number: localPhone,
          amount: amountNum,
          currency: afribapayCurrency,
          order_id: depositRef,
          reference_id: depositRef,
          notify_url: callbackUrl,
          return_url: `${process.env.APP_URL}/dashboard/deposit?status=success`,
          cancel_url: `${process.env.APP_URL}/dashboard/deposit?status=cancelled`,
        });
        if (afribaResponse.success) {
          const extRef = afribaResponse.transaction_id || depositRef;
          await storage.updateTransactionExternalReference(transaction.id, extRef);
          // Wave (and other redirect-based operators): AfribaPay returns provider_link.
          // Capture it so the unified Wave response logic below can include it.
          if (afribaResponse.provider_link) {
            (transaction as any)._waveUrl = afribaResponse.provider_link;
            console.log(`[API v1/collect] AfribaPay Wave link for ${depositRef}: ${afribaResponse.provider_link}`);
          }
          addPendingPayment({
            transactionId: transaction.id,
            reference: depositRef,
            externalReference: extRef,
            attempts: 0,
            userId: merchant.id,
            type: "deposit",
            amount: creditedAmount.toString(),
            provider: "afribapay",
            countryCode: country.code,
          });
        } else if (isAfribaPayOtpRequiredMessage(afribaResponse.message)) {
          // Safety net: AfribaPay rejected the (non-OTP-pre-detected) payin call and
          // triggered an OTP SMS automatically on its side. Cache the session so the
          // client can confirm with otp + reference — do NOT call initiateAfribaPayOtp
          // again (that would invalidate the already-sent SMS).
          console.warn(`[API v1/collect] OTP required but not pre-detected for operator=${afribaOpCode} country=${country.code} — caching session for client confirmation`);
          await persistOtpContext(depositRef, {
            userId: merchant.id,
            operator: afribaOpCode,
            country: country.code,
            phone: localPhone,
            amount: amountNum,
            currency: afribapayCurrency,
            afribaTransactionId: depositRef,
            expiresAt: Date.now() + 15 * 60 * 1000,
            otpType: "api",
          });
          return res.status(400).json({
            error: "otp_required",
            message: "OTP requis. Un code a été envoyé par SMS. Relancez la requête avec les champs 'otp' et 'reference'.",
            reference: depositRef,
          });
        } else {
          await storage.updateTransactionStatus(transaction.id, "failed");
          return res.status(502).json(buildProviderErrorPayload({
            error: "gateway_error",
            message: afribaResponse.message,
            fallback: "Échec du paiement Mobile Money.",
            provider: "afribapay",
            raw: afribaResponse.raw,
            providerCode: afribaResponse.providerCode,
            providerStatus: afribaResponse.providerStatus,
            sensitiveValues: [phone],
          }));
        }
      } else {
        // PixPay
        const pxFlowType = detectPixPayFlowType(operatorName, country.code);
        const pxServiceId = getPixPayServiceId(operatorName, country.code, "cash_out");
        const pxBaseParams = {
          serviceId: String(pxServiceId ?? 0),
          amount: amountNum,
          phone,
          countryCode: country.code,
          orderId: depositRef,
          ipnUrl: pixpayIpnUrl,
          customData: depositRef,
        };
        let pixpayResponse: any;
        if (pxFlowType === "otp") {
          pixpayResponse = await initiatePixPayOtp({ ...pxBaseParams, omOtp: req.body.otp! });
        } else if (pxFlowType === "wave") {
          const appBase = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
          pixpayResponse = await initiatePixPayWave({
            ...pxBaseParams,
            redirectUrl: `${appBase}/dashboard/deposit?ref=${depositRef}&status=success`,
            redirectErrorUrl: `${appBase}/dashboard/deposit?ref=${depositRef}&status=cancelled`,
          });
        } else {
          pixpayResponse = await initiatePixPayUssd(pxBaseParams);
        }
        if (pixpayResponse.success) {
          const extRef = pixpayResponse.transactionId || depositRef;
          await storage.updateTransactionExternalReference(transaction.id, extRef);
          addPendingPayment({
            transactionId: transaction.id,
            reference: depositRef,
            externalReference: extRef,
            attempts: 0,
            userId: merchant.id,
            type: "deposit",
            amount: creditedAmount.toString(),
            provider: "pixpay",
            countryCode: country.code,
          });
          if (pixpayResponse.waveUrl) {
            (transaction as any)._waveUrl = pixpayResponse.waveUrl;
          }
        } else {
          await storage.updateTransactionStatus(transaction.id, "failed");
          return res.status(502).json(buildProviderErrorPayload({
            error: "gateway_error",
            message: pixpayResponse.providerMessage || pixpayResponse.message,
            fallback: "Échec du paiement Mobile Money.",
            provider: "pixpay",
            raw: pixpayResponse.raw,
            providerCode: pixpayResponse.providerCode,
            providerStatus: pixpayResponse.providerStatus,
            sensitiveValues: [phone],
          }));
        }
      }

      // Detect if Wave to include wave_url in response
      const isWave = detectPixPayFlowType(operatorName, country.code) === "wave";

      const responseBody: Record<string, any> = {
        transaction_id: transaction.id,
        reference: depositRef,
        status: "pending",
        amount: amountNum,
        credited_amount: creditedAmount,
        fee_amount: ashtechFeeAmount,
        currency: normalizeApiCurrency(walletCurrency),
        operator: operatorName,
        phone,
        country_code: country.code,
        created_at: (transaction as any).createdAt,
        ...(merchantReference ? { merchant_reference: merchantReference } : {}),
      };
      if (isWave && (transaction as any)._waveUrl) {
        responseBody.wave_url = (transaction as any)._waveUrl;
        responseBody.flow = "wave";
      }
      if (pawaPayResult) {
        responseBody.authorization_url = pawaPayResult.authorizationUrl || null;
        responseBody.next_step = pawaPayResult.nextStep || null;
        responseBody.pawa_pay_auth = pawaPayAuthPayload(pawaPayResult);
        if (pawaPayResult.authorizationUrl) responseBody.flow = "redirect";
      }

      res.status(202).json(responseBody);
    } catch (e: any) {
      console.error("[API v1 /collect]", e);
      res.status(500).json({ error: "server_error", message: "Erreur interne." });
    }
  });

  /** GET /v1/transaction/:id — get status of an API transaction */
  app.get("/v1/transaction/:id", apiV1Limiter, requireApiKey, async (req: any, res) => {
    try {
      const merchant = req.apiUser;
      const tx = await storage.getTransactionById(req.params.id);
      if (!tx) return res.status(404).json({ error: "not_found", message: "Transaction introuvable." });
      if (tx.userId !== merchant.id) return res.status(403).json({ error: "forbidden", message: "Accès refusé." });

      // notify_url is optional: API clients may poll this endpoint directly.
      // Expire only crypto payments on demand so an overdue transaction
      // returns "failed" immediately, even between background poller cycles.
      if (tx.status === "pending" && tx.paymentMethod === "crypto" && tx.reference) {
        await expireCryptoPaymentIfNeeded(tx.reference);
      }
      const latestTx = await storage.getTransactionById(req.params.id);
      if (!latestTx) return res.status(404).json({ error: "not_found", message: "Transaction introuvable." });

      // Resolve operator name from operatorId
      let operatorName: string | null = null;
      if ((latestTx as any).operatorId) {
        try {
          const op = await storage.getOperator((latestTx as any).operatorId);
          if (op) operatorName = op.name;
        } catch (_) { /* non-blocking */ }
      }

      const isoStatus = latestTx.status === "completed" ? "success" : latestTx.status;

      const responseBody: Record<string, any> = {
        transaction_id: latestTx.id,
        reference: latestTx.reference,
        merchant_reference: ((latestTx as any).metadata || {}).merchantReference || null,
        status: isoStatus,
        amount: parseFloat((latestTx as any).totalAmount || latestTx.amount),
        credited_amount: parseFloat(latestTx.amount),
        fee_amount: parseFloat((latestTx as any).feeAmount || "0"),
        currency: normalizeApiCurrency(latestTx.currency),
        phone: latestTx.recipientPhone,
        operator: operatorName,
        created_at: latestTx.createdAt,
        confirmed_at: (latestTx as any).confirmedAt || null,
      };
      if (
        latestTx.status === "pending" &&
        classifyPawaPayControlledTransaction(latestTx.type, latestTx.externalReference) === "incoming"
      ) {
        try {
          const pawaStatus = await getPawaPayDeposit(latestTx.externalReference!);
          responseBody.authorization_url = pawaStatus.authorizationUrl || null;
          responseBody.next_step = pawaStatus.nextStep || null;
        } catch (error) {
          console.warn("[API v1 transaction] PawaPay authorization lookup failed:", error instanceof Error ? error.message : "unknown error");
        }
      }
      // Crypto-only fields are added without changing the Mobile Money response.
      if (latestTx.paymentMethod === "crypto") {
        const metadata = (latestTx as any).metadata || {};
        responseBody.payment_method = "crypto";
        responseBody.asset_code = metadata.assetCode || null;
        responseBody.address = metadata.address || null;
        responseBody.memo = metadata.memo || null;
        responseBody.memo_type = metadata.memoType || null;
        responseBody.expires_at = metadata.expiresAt || null;
        responseBody.amount_usdt = parseFloat((tx as any).totalAmount || tx.amount);
        responseBody.credited_amount_usdt = parseFloat(tx.amount);
        responseBody.fee_amount_usdt = parseFloat((tx as any).feeAmount || "0");
      }
      res.json(responseBody);
    } catch (e: any) {
      console.error("[API v1 /transaction/:id]", e);
      res.status(500).json({ error: "server_error", message: "Erreur interne." });
    }
  });

  /** GET /v1/fees — live fee schedule (admin-controlled, auto-propagated) */
  app.get("/v1/fees", apiV1Limiter, requireApiKey, async (_req, res) => {
    try {
       const countries = (await storage.getActiveCountries()).filter((c: any) => c.isActiveForDeposit !== false);
      const result = await Promise.all(
        countries.map(async (c: any) => {
          const ops = await storage.getOperatorsByCountry(c.id);
         const activeOps = ops.filter((o: any) => {
           const provider = o.depositPaymentProvider || o.paymentProvider;
           return o.isActive && !o.isInMaintenance && (provider === "afribapay" || provider === "pixpay" || provider === "pawapay");
         });
          if (activeOps.length === 0) return null;

           // Resolve each operator with its own provider fee. Mixed-provider
           // countries must not expose a PixPay fee for an AfribaPay operator.
           const operatorFees = await Promise.all(activeOps.map(async (o: any) => {
             const provider = o.depositPaymentProvider || o.paymentProvider;
             const feeRecord = await storage.resolveFee("deposit", c.id, o.id);
             const providerFee = feeRecord
               ? parseFloat((provider === "pixpay"
                 ? feeRecord.pixpayFee
                  : provider === "pawapay"
                  ? feeRecord.pawapayFee
                 : feeRecord.afribapayFee) ?? "3.0")
               : 3.0;
             const ashtechMargin = feeRecord
               ? parseFloat(feeRecord.ashtechMargin ?? "2.0")
               : 2.0;
             return {
               name: o.name,
               total_fee_pct: parseFloat((providerFee + ashtechMargin).toFixed(2)),
               provider_fee_pct: parseFloat(providerFee.toFixed(2)),
               ashtech_margin_pct: parseFloat(ashtechMargin.toFixed(2)),
             };
           }));
           const primaryFee = operatorFees[0];

          return {
            country_code: c.code,
            country_name: c.name,
             currency: normalizeApiCurrency(countryWalletCurrency(c)),
             total_fee_pct: primaryFee.total_fee_pct,
             ashtech_margin_pct: primaryFee.ashtech_margin_pct,
            operators: activeOps.map((o: any) => o.name),
             operator_fees: operatorFees,
          };
        })
      );
      res.json(result.filter(Boolean));
    } catch (e: any) {
      console.error("[API v1 /fees]", e);
      res.status(500).json({ error: "server_error", message: "Erreur serveur" });
    }
  });

  // ── Hosted Page ──────────────────────────────────────────────────────────

  function generateHpKey(prefix: string): string {
    return prefix + crypto.randomBytes(20).toString("hex");
  }

  // GET /api/hosted-page/config — get merchant config
  app.get("/api/hosted-page/config", async (req: Request, res: Response) => {
    if (!req.session?.userId) return res.status(401).json({ error: "Unauthorized" });
    try {
      const config = await storage.getHostedPageConfig(req.session.userId);
      res.json(config || null);
    } catch (e: any) {
      res.status(500).json({ error: "server_error" });
    }
  });

  // POST /api/hosted-page/config — save URLs + generate keys
  app.post("/api/hosted-page/config", async (req: Request, res: Response) => {
    if (!req.session?.userId) return res.status(401).json({ error: "Unauthorized" });
    try {
      const { successUrl, cancelUrl, notifyUrl, regenerate } = req.body;
      const existing = await storage.getHostedPageConfig(req.session.userId);
      const hasKeys = existing?.pkLive && existing?.skLive && existing?.hpLive;
      const data: any = {};
      if (successUrl !== undefined) data.successUrl = successUrl;
      if (cancelUrl !== undefined) data.cancelUrl = cancelUrl;
      if (notifyUrl !== undefined) data.notifyUrl = notifyUrl || null;
      if (!hasKeys || regenerate) {
        data.pkLive = generateHpKey("pk_live_");
        data.skLive = generateHpKey("sk_live_");
        data.hpLive = generateHpKey("hp_live_");
      }
      const config = await storage.saveHostedPageConfig(req.session.userId, data);
      res.json(config);
    } catch (e: any) {
      console.error("[hosted-page/config]", e);
      res.status(500).json({ error: "server_error" });
    }
  });

  // POST /api/v1/hosted-payment/create — create a hosted payment link (uses existing /pay/:slug page)
  app.post("/api/v1/hosted-payment/create", hostedPaymentLimiter, async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization || "";
      const hpKey = authHeader.replace("Bearer ", "").trim();
      if (!hpKey.startsWith("hp_live_")) {
        return res.status(401).json({ error: "unauthorized", message: "Invalid hp_live key." });
      }
      const merchant = await storage.getUserByHpKey(hpKey);
      if (!merchant) return res.status(401).json({ error: "unauthorized", message: "Key not found." });
      if (!merchant.isVerified) {
        return res.status(403).json({ error: "account_not_verified", message: "Votre compte n'est pas vérifié. Complétez la vérification KYC pour accéder à l'API." });
      }
      if (!(merchant as any).apiEnabled) {
        return res.status(403).json({ error: "api_not_enabled", message: "L'accès API n'est pas activé sur votre compte. Contactez l'administrateur pour l'activer." });
      }

      const {
        amount,
        currency,
        description,
        is_fixed_amount,
        allowed_countries,
        notify_url,
      } = req.body;

      const isFixedAmount = is_fixed_amount !== false; // default: true (fixed price)

      if (!currency) {
        return res.status(400).json({ error: "missing_fields", message: "currency is required." });
      }
      const validCurrencies = ["XOF", "XAF", "CDF"];
      if (!validCurrencies.includes(currency)) {
        return res.status(400).json({ error: "invalid_currency", message: `currency must be one of: ${validCurrencies.join(", ")}` });
      }

      let numAmount = 0;
      if (isFixedAmount) {
        if (!amount) {
          return res.status(400).json({ error: "missing_fields", message: "amount is required when is_fixed_amount is true." });
        }
        numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount <= 0) {
          return res.status(400).json({ error: "invalid_amount", message: "amount must be a positive number." });
        }
      }

       // Validate allowed_countries against the live catalogue and persist
       // canonical ISO country codes. This prevents links from targeting
       // removed countries or countries without a usable provider.
       const activeCountries = await storage.getActiveCountries();
       const countriesWithOperators = await Promise.all(activeCountries.map(async (country) => {
         const operators = await storage.getOperatorsByCountry(country.id);
         return {
           country,
           hasUsableOperator: operators.some((operator: any) => {
             const provider = operator.depositPaymentProvider || operator.paymentProvider;
             return operator.isActive &&
               !operator.isInMaintenance &&
               (provider === "afribapay" || provider === "pixpay" || provider === "pawapay");
           }),
         };
       }));
       let countriesFilter: string[] | null = null;
       if (Array.isArray(allowed_countries) && allowed_countries.length > 0) {
         const resolvedCodes: string[] = [];
         for (const rawCountry of allowed_countries) {
           if (typeof rawCountry !== "string" || !rawCountry.trim()) {
             return res.status(400).json({
               error: "invalid_allowed_countries",
               message: "allowed_countries doit contenir des codes ou identifiants de pays valides.",
             });
           }
           const value = rawCountry.trim().toUpperCase();
           const match = countriesWithOperators.find(({ country, hasUsableOperator }) =>
             hasUsableOperator &&
             (country.code.toUpperCase() === value || country.id.toUpperCase() === value)
           );
           if (!match) {
             return res.status(400).json({
               error: "invalid_allowed_countries",
               message: `Pays inactif ou sans opérateur disponible : ${rawCountry}`,
             });
           }
           const code = match.country.code.toUpperCase();
           if (!resolvedCodes.includes(code)) resolvedCodes.push(code);
         }
         countriesFilter = resolvedCodes;
       }

      // Generate a unique slug for this payment link
      let slug = "hp-" + generateSlug();
      while (await storage.getPaymentLinkBySlug(slug)) {
        slug = "hp-" + generateSlug();
      }

      const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min

      // Use merchant's default notify_url if none provided in request
      const merchantConfig = await storage.getHostedPageConfig(merchant.id).catch(() => null);
      const effectiveNotifyUrl = notify_url || (merchantConfig as any)?.notifyUrl || null;

      // Create a real payment link in the existing system → uses the existing /pay/:slug page
      const paymentLink = await storage.createPaymentLink({
        userId: merchant.id,
        title: description || "Paiement Ashtech Pay",
        description: description || null,
        amount: String(numAmount),
        currency,
        slug,
        isFixedAmount,
        imagePath: null,
        pdfPath: null,
        hasPdfDelivery: false,
        redirectUrl: null,
        expiresAt,
        allowedCountries: countriesFilter,
        notifyUrl: effectiveNotifyUrl,
      });

      const host = req.headers.host || "ashtechpay.top";
      const protocol = ((req.headers["x-forwarded-proto"] as string) || "https").split(",")[0].trim();
      const payUrl = `${protocol}://${host}/pay/${slug}`;

      res.json({
        status: "success",
        payment_link: payUrl,
        payment_id: paymentLink.id,
        slug,
        is_fixed_amount: isFixedAmount,
        amount: isFixedAmount ? numAmount : null,
        currency,
        allowed_countries: countriesFilter,
        expires_at: expiresAt,
      });
    } catch (e: any) {
      console.error("[v1/hosted-payment/create]", e);
      res.status(500).json({ error: "server_error" });
    }
  });

  // GET /api/v1/hosted-payment/:payment_id — check payment link status
  app.get("/api/v1/hosted-payment/:payment_id", async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization || "";
      const hpKey = authHeader.replace("Bearer ", "").trim();
      if (!hpKey.startsWith("hp_live_")) {
        return res.status(401).json({ error: "unauthorized", message: "Invalid hp_live key." });
      }
      const merchant = await storage.getUserByHpKey(hpKey);
      if (!merchant) return res.status(401).json({ error: "unauthorized" });

      const link = await storage.getPaymentLinkById(req.params.payment_id);
      if (!link) return res.status(404).json({ error: "not_found" });
      if (link.userId !== merchant.id) return res.status(403).json({ error: "forbidden" });

      // Determine status from transactions linked to this payment link
      const txns = await storage.getTransactionsByPaymentLinkId(link.id);
      let status = "pending";
      const now = new Date();
      if (txns.some((t: any) => t.status === "completed")) {
        status = "success";
      } else if (txns.some((t: any) => t.status === "processing")) {
        status = "processing";
      } else if (txns.some((t: any) => t.status === "failed")) {
        status = "failed";
      } else if (link.expiresAt && link.expiresAt < now) {
        status = "expired";
      }

      // Find the successful transaction for amount paid (in case of free amount)
      const successTxn = txns.find((t: any) => t.status === "completed");

      res.json({
        payment_id: link.id,
        slug: link.slug,
        is_fixed_amount: link.isFixedAmount,
        amount: link.isFixedAmount ? parseFloat(link.amount) : (successTxn ? parseFloat(successTxn.amount) : null),
        currency: link.currency,
        description: link.description,
        allowed_countries: link.allowedCountries,
        status,
        paid_at: successTxn?.createdAt ?? null,
        created_at: link.createdAt,
        expires_at: link.expiresAt,
      });
    } catch (e: any) {
      res.status(500).json({ error: "server_error" });
    }
  });

  // GET /api/public/hosted-session/:id — get session for public checkout
  app.get("/api/public/hosted-session/:id", async (req: Request, res: Response) => {
    try {
      const session = await storage.getHostedPaymentSession(req.params.id);
      if (!session) return res.status(404).json({ error: "not_found", message: "Session introuvable." });
      if (session.expiresAt && new Date() > session.expiresAt) {
        return res.status(410).json({ error: "expired", message: "Ce lien de paiement a expiré." });
      }
      const merchant = await storage.getUser(session.merchantId);
      res.json({
        payment_id: session.id,
        amount: parseFloat(session.amount),
        currency: session.currency,
        description: session.description,
        status: session.status,
        merchant_name: merchant?.fullName || "Marchand",
        expires_at: session.expiresAt,
      });
    } catch (e: any) {
      res.status(500).json({ error: "server_error" });
    }
  });

  // POST /api/public/hosted-session/:id/pay — initiate payment for checkout
  app.post("/api/public/hosted-session/:id/pay", async (req: Request, res: Response) => {
    try {
      const hpSession = await storage.getHostedPaymentSession(req.params.id);
      if (!hpSession) return res.status(404).json({ error: "not_found" });
      if (hpSession.status !== "pending") {
        return res.status(400).json({ error: "already_processed", message: "Ce paiement a déjà été traité." });
      }
      if (hpSession.expiresAt && new Date() > hpSession.expiresAt) {
        return res.status(410).json({ error: "expired", message: "Ce lien de paiement a expiré." });
      }

      const { phone, countryId, operatorId } = req.body;
      if (!phone || !countryId || !operatorId) {
        return res.status(400).json({ error: "missing_fields", message: "phone, countryId et operatorId sont requis." });
      }

      const country = await storage.getCountry(countryId);
      if (!country) return res.status(400).json({ error: "invalid_country" });
      const operator = await storage.getOperator(operatorId);
      if (!operator) return res.status(400).json({ error: "invalid_operator" });
        if (!country.isActive || country.isActiveForDeposit === false) {
          return res.status(400).json({ error: "inactive_country" });
        }
       if (operator.countryId !== country.id || !operator.isActive || operator.isInMaintenance) {
         return res.status(400).json({ error: "invalid_operator", message: "Opérateur indisponible pour ce pays." });
       }

      const merchant = await storage.getUser(hpSession.merchantId);
      if (!merchant) return res.status(500).json({ error: "merchant_not_found" });

       const walletCurrency = countryWalletCurrency(country);
       const expectedCurrency = normalizeApiCurrency(walletCurrency);
       if (normalizeApiCurrency(hpSession.currency) !== expectedCurrency) {
         return res.status(400).json({
           error: "currency_country_mismatch",
           message: `La devise ${hpSession.currency} ne correspond pas au pays ${country.code}.`,
         });
       }

      // Resolve fee
      const fee = await storage.resolveFee("deposit", country.id, operator.id);
      const amount = parseFloat(hpSession.amount);
       const provider = (operator as any).depositPaymentProvider || (operator as any).paymentProvider;
        if (provider !== "afribapay" && provider !== "pixpay" && provider !== "pawapay") {
         return res.status(400).json({ error: "provider_unavailable" });
       }
       const providerFeeRate = parseFloat(
          (provider === "pixpay" ? (fee as any)?.pixpayFee : provider === "pawapay" ? (fee as any)?.pawapayFee : (fee as any)?.afribapayFee) || "3"
       );
       const marginRate = parseFloat((fee as any)?.ashtechMargin || String(ASHTECH_MARGIN));
        const feeBreakdown = provider === "pixpay" || provider === "pawapay"
         ? computePixPayFees(amount, providerFeeRate, marginRate)
         : computeAfribaPayFees(amount, providerFeeRate, marginRate);
       const feeAmount = feeBreakdown.totalFeeAmount;
       const creditedAmount = feeBreakdown.creditedAmount;
       const totalAmount = amount;

      // Create transaction
      const txRef = "HP-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8).toUpperCase();
       if (provider === "pawapay") {
         await assertPawaPayProviderActive(resolvePawaPayProviderCode(operator, operator.name, country.code), "DEPOSIT", pawaPayCountry(country.code));
       }
       const pawaPayDepositId = provider === "pawapay" ? createPawaPayId() : undefined;
      const tx = await storage.createTransaction({
        userId: merchant.id,
        type: "deposit",
         amount: String(creditedAmount),
         currency: walletCurrency,
        status: "pending",
        reference: txRef,
        recipientPhone: phone,
        recipientName: null,
        description: hpSession.description || `Paiement ${hpSession.id}`,
        countryId: country.id,
        operatorId: operator.id,
         feeAmount: String(feeAmount),
        totalAmount: String(totalAmount),
        notifyUrl: null,
        source: "hosted_page",
        confirmedAt: null,
         ...(pawaPayDepositId ? { externalReference: pawaPayDepositId } : {}),
          ...(pawaPayDepositId ? {
            metadata: {
              paymentProvider: "pawapay",
              pawaCountry: pawaPayCountry(country.code),
              countryCode: country.code,
              walletCurrency,
            },
          } : {}),
      } as any);

      // Update hosted session to processing
      await storage.updateHostedPaymentSession(hpSession.id, {
        status: "processing",
        transactionId: tx.id,
      });

       // Initiate payment (AfribaPay or PixPay)
      let payResult: any = null;
       const countryCode = country.code.toUpperCase();

      try {
         if (provider === "pixpay") {
           const pixpayServiceId = getPixPayServiceId(operator.name, countryCode, "cash_out");
           if (!pixpayServiceId) throw new Error("Opérateur non configuré pour la collecte PixPay.");
           const pixBaseParams = {
             serviceId: String(pixpayServiceId),
             amount: amount,
            phone,
            countryCode,
            orderId: txRef,
             ipnUrl: buildWebhookUrl("/api/pixpay/webhook"),
            customData: txRef,
          };
          const flowType = detectPixPayFlowType(operator.name, countryCode);
          if (flowType === "wave") {
            const appBase = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
            const waveRes = await initiatePixPayWave({
              ...pixBaseParams,
              redirectUrl: `${appBase}/hpay/${hpSession.id}?status=success`,
              redirectErrorUrl: `${appBase}/hpay/${hpSession.id}?status=cancelled`,
            });
            if (!waveRes.success) {
              throw createProviderFailure(
                waveRes.providerMessage || waveRes.message || "Erreur PixPay Wave",
                {
                  provider: "pixpay",
                  raw: waveRes.raw,
                  providerCode: waveRes.providerCode,
                  providerStatus: waveRes.providerStatus,
                },
              );
            }
            const extRef = waveRes.transactionId || txRef;
            await storage.updateTransactionExternalReference(tx.id, extRef);
            payResult = { flow: "wave", wave_url: waveRes.waveUrl || null, ussd_code: null, extRef };
          } else if (flowType === "otp") {
            const ussdCode = PIXPAY_OTP_USSD_CODES[countryCode.toUpperCase()] || "*144#";
            payResult = { flow: "otp_ussd", ussd_code: ussdCode, extRef: txRef };
          } else {
            const ussdRes = await initiatePixPayUssd(pixBaseParams);
            if (!ussdRes.success) {
              throw createProviderFailure(
                ussdRes.providerMessage || ussdRes.message || "Erreur PixPay USSD",
                {
                  provider: "pixpay",
                  raw: ussdRes.raw,
                  providerCode: ussdRes.providerCode,
                  providerStatus: ussdRes.providerStatus,
                },
              );
            }
            const extRef = ussdRes.transactionId || txRef;
            await storage.updateTransactionExternalReference(tx.id, extRef);
            payResult = { flow: "ussd_push", ussd_code: null, extRef };
          }
          } else if (provider === "pawapay") {
           const appBase = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
           const result = await createPawaPayPaymentPage({
             depositId: pawaPayDepositId, amount: amount.toFixed(2), currency: toPawaPayCurrency(walletCurrency),
             phoneNumber: normalizePhone(phone) || "", country: pawaPayCountry(countryCode),
             provider: resolvePawaPayProviderCode(operator, operator.name, countryCode),
             clientReferenceId: txRef, customerMessage: PAWAPAY_CUSTOMER_MESSAGE, returnUrl: `${appBase}/hpay/${hpSession.id}`,
             metadata: { hostedSessionId: hpSession.id },
           });
           if (result.status === "failed" || !result.redirectUrl) throw createProviderFailure(result.providerMessage || "Payment page unavailable", {
             provider: "pawapay", raw: result.raw, providerCode: result.providerCode, providerStatus: result.providerStatus,
           });
           payResult = { flow: "provider_page", redirect_url: result.redirectUrl, ussd_code: null, extRef: pawaPayDepositId, completed: result.status === "completed" };
          } else if (provider === "afribapay") {
          const afribapayOperatorCode = resolveAfribaPayOperatorCode(operator, operator.name);
          const afribapayCurrency = AFRIBAPAY_ISO_CURRENCY[countryCode.toUpperCase()] || country.currency;
          let localPhone = phone.replace(/\s/g, "");
          if (localPhone.startsWith("+")) localPhone = localPhone.slice(1);
          const afribaResponse = await initiateAfribaPayin({
            operator: afribapayOperatorCode,
            country: countryCode,
            phone_number: localPhone,
             amount: amount,
            currency: afribapayCurrency,
            order_id: txRef,
            reference_id: txRef,
          });
          if (!afribaResponse.success) {
            throw createProviderFailure(
              afribaResponse.message || "Erreur AfribaPay",
              {
                provider: "afribapay",
                raw: afribaResponse.raw,
                providerCode: afribaResponse.providerCode,
                providerStatus: afribaResponse.providerStatus,
              },
            );
          }
          const extRef = afribaResponse.transaction_id || txRef;
          await storage.updateTransactionExternalReference(tx.id, extRef);
          payResult = { flow: "ussd_push", ussd_code: null, extRef };
        } else {
          return res.status(400).json({ error: "unsupported_country", message: "Pays non supporté pour le paiement." });
        }
      } catch (payErr: any) {
        await storage.updateHostedPaymentSession(hpSession.id, { status: "failed" });
        await storage.updateTransactionStatus(tx.id, "failed");
        return res.status(502).json(buildProviderErrorPayload({
          error: "payment_initiation_failed",
          message: payErr?.message,
          fallback: "Échec de l'initiation du paiement.",
          provider: payErr?.provider || provider,
          raw: payErr?.raw,
          providerCode: payErr?.providerCode,
          providerStatus: payErr?.providerStatus,
          sensitiveValues: [phone],
        }));
      }

      // Register only asynchronous provider responses. Immediate PawaPay
      // completion shares the normal idempotent wallet settlement path.
      if (payResult.completed && provider === "pawapay") {
        await processPawaPayDepositCallback(tx, "completed");
        await storage.updateHostedPaymentSession(hpSession.id, { status: "success" });
      } else {
        addPendingPayment({
          transactionId: tx.id,
          reference: txRef,
          externalReference: payResult.extRef || txRef,
          userId: merchant.id,
          type: "deposit",
           amount: String(creditedAmount),
          provider,
          countryCode,
        });
      }

      res.json({
        status: payResult.completed ? "completed" : "initiated",
        transaction_id: tx.id,
        flow: payResult.flow,
        ussd_code: payResult.ussd_code || null,
        wave_url: payResult.wave_url || null,
        redirect_url: payResult.redirect_url || null,
        otp_info: payResult.otp_info || null,
      });
    } catch (e: any) {
      console.error("[public/hosted-session/:id/pay]", e);
      res.status(500).json({ error: "server_error" });
    }
  });

  // GET /api/public/hosted-session/:id/status — poll transaction status
  app.get("/api/public/hosted-session/:id/status", async (req: Request, res: Response) => {
    try {
      const session = await storage.getHostedPaymentSession(req.params.id);
      if (!session) return res.status(404).json({ error: "not_found" });

      let status = session.status;

      // If processing, check underlying transaction
      if (session.transactionId && session.status === "processing") {
        const tx = await storage.getTransactionById(session.transactionId);
        if (tx?.status === "completed") {
          status = "success";
          await storage.updateHostedPaymentSession(session.id, { status: "success" });
        } else if (tx?.status === "failed") {
          status = "failed";
          await storage.updateHostedPaymentSession(session.id, { status: "failed" });
        }
      }

      const config = await storage.getHostedPageConfig(session.merchantId);
      res.json({
        status,
        success_url: config?.successUrl || null,
        cancel_url: config?.cancelUrl || null,
      });
    } catch (e: any) {
      res.status(500).json({ error: "server_error" });
    }
  });

  // ── Admin API Management ─────────────────────────────────────────────────────

  // GET /api/admin/api-management — list users with API stats (SQL JOIN — no full table scans)
  app.get("/api/admin/api-management", requireAuth, requireAdmin, async (_req, res) => {
    try {
      const rows = await db.execute(drizzleSql`
        SELECT
          u.id, u.full_name, u.email, u.username, u.is_verified, u.api_enabled, u.api_key, u.created_at,
          COUNT(t.id) FILTER (WHERE t.status = 'completed')::int                            AS total_tx,
          COUNT(t.id) FILTER (WHERE t.status = 'completed' AND t.source = 'api')::int       AS sdk_tx,
          COUNT(t.id) FILTER (WHERE t.status = 'completed' AND t.source = 'hosted_page')::int AS hp_tx,
          COALESCE(SUM(t.amount::numeric) FILTER (WHERE t.status = 'completed'), 0)            AS total_amount,
          COALESCE(SUM(t.amount::numeric) FILTER (WHERE t.status = 'completed' AND t.source = 'api'), 0) AS sdk_amount,
          COALESCE(SUM(t.amount::numeric) FILTER (WHERE t.status = 'completed' AND t.source = 'hosted_page'), 0) AS hp_amount
        FROM users u
        LEFT JOIN transactions t ON t.user_id = u.id
        WHERE u.role NOT IN ('admin', 'support', 'finance')
        GROUP BY u.id, u.full_name, u.email, u.username, u.is_verified, u.api_enabled, u.api_key, u.created_at
        ORDER BY u.created_at DESC
      `);

      const result = (rows.rows as any[]).map(row => ({
        id: row.id,
        fullName: row.full_name,
        email: row.email,
        username: row.username,
        isVerified: row.is_verified,
        apiEnabled: row.api_enabled || false,
        hasApiKey: !!row.api_key,
        createdAt: row.created_at,
        stats: {
          totalTransactions: Number(row.total_tx || 0),
          sdkTransactions: Number(row.sdk_tx || 0),
          hpTransactions: Number(row.hp_tx || 0),
          totalCollected: parseFloat(row.total_amount || "0"),
          sdkCollected: parseFloat(row.sdk_amount || "0"),
          hpCollected: parseFloat(row.hp_amount || "0"),
        },
      }));

      res.json(result);
    } catch (e: any) {
      console.error("[Admin API Management]", e);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // POST /api/admin/api-management/:userId/toggle — enable or disable API access
  app.post("/api/admin/api-management/:userId/toggle", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const { enabled } = req.body;
      if (typeof enabled !== "boolean") {
        return res.status(400).json({ message: "'enabled' doit être un booléen" });
      }
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "Utilisateur non trouvé" });

      await storage.updateUser(userId, { apiEnabled: enabled } as any);
      res.json({ success: true, userId, apiEnabled: enabled });
    } catch (e: any) {
      console.error("[Admin API Toggle]", e);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // ─── EMAIL CAMPAIGN ROUTES ────────────────────────────────────────────────

  async function getUsersBySegment(segment: string) {
    const allUsers = await storage.getAllUsers();
    // Only target users with a real email
    const withEmail = allUsers.filter(u => u.email && u.role === "user");

    if (segment === "all") return withEmail;
    if (segment === "kyc_verified") return withEmail.filter(u => u.kycStatus === "verified");
    if (segment === "kyc_pending") return withEmail.filter(u => u.kycStatus === "pending");
    if (segment === "kyc_rejected") return withEmail.filter(u => u.kycStatus === "rejected");
    if (segment === "kyc_not_submitted") return withEmail.filter(u => u.kycStatus === "not_submitted");

    if (segment === "kyc_verified_no_tx" || segment === "active") {
      const allTx = await storage.getAllTransactions();
      const txCountByUser: Record<string, number> = {};
      for (const tx of allTx) {
        if (tx.userId) txCountByUser[tx.userId] = (txCountByUser[tx.userId] || 0) + 1;
      }
      if (segment === "kyc_verified_no_tx") {
        return withEmail.filter(u => u.kycStatus === "verified" && !txCountByUser[u.id]);
      }
      if (segment === "active") {
        return withEmail.filter(u => (txCountByUser[u.id] || 0) >= 10);
      }
    }
    return [];
  }

  // GET /api/admin/email-segment-count?segment=xxx
  app.get("/api/admin/email-segment-count", requireAuth, requireAdmin, async (req, res) => {
    try {
      const segment = req.query.segment as string;
      if (!segment) return res.status(400).json({ message: "Segment requis" });
      const users = await getUsersBySegment(segment);
      res.json({ count: users.length });
    } catch (e: any) {
      console.error("[EmailSegmentCount]", e);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // POST /api/admin/send-email-campaign
  app.post("/api/admin/send-email-campaign", requireAuth, requireAdmin, async (req, res) => {
    try {
      const {
        segment, subject, previewText, body,
        hasButton, buttonText, buttonUrl, buttonColor, buttonTextColor,
      } = req.body;

      if (!segment || !subject?.trim() || !body?.trim()) {
        return res.status(400).json({ message: "Segment, objet et corps requis" });
      }

      const targets = await getUsersBySegment(segment);
      if (targets.length === 0) {
        return res.status(400).json({ message: "Aucun utilisateur dans ce segment" });
      }

      let sent = 0;
      let failed = 0;

      // Send in batches of 5 to avoid rate limits
      for (let i = 0; i < targets.length; i += 5) {
        const batch = targets.slice(i, i + 5);
        await Promise.all(batch.map(async (user) => {
          const firstName = (user.fullName?.trim().split(" ")[0]) || user.username || "client";
          try {
            await sendCampaignEmail({
              to: user.email!,
              firstName,
              subject,
              body,
              hasButton: !!hasButton,
              buttonText,
              buttonUrl,
              buttonColor,
              buttonTextColor,
            });
            sent++;
          } catch (err) {
            console.error(`[Campaign] Failed for ${user.email?.replace(/(.{2}).+(@.+)/, "$1***$2")}:`, err);
            failed++;
          }
        }));
        // Small delay between batches
        if (i + 5 < targets.length) {
          await new Promise(r => setTimeout(r, 200));
        }
      }

      console.log(`[Campaign] Sent: ${sent}, Failed: ${failed}, Segment: ${segment}`);
      res.json({ sent, failed, total: targets.length });
    } catch (e: any) {
      console.error("[EmailCampaign]", e);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // ─── Bot Banner Images ──────────────────────────────────────────────────────
  // VULN-A4: rate-limited + type-allowlist to prevent CPU DoS via sharp
  const VALID_BANNER_TYPES = new Set([
    "stats","pending","kyc","users","revenue","wallet",
    "rapport","liens","top","verif","broadcast","taux",
    "pays","search","user","help","ban","tx",
  ]);
  app.get("/api/bot/banner/:type", bannerLimiter, async (req, res) => {
    const type = req.params.type;
    if (!VALID_BANNER_TYPES.has(type)) {
      return res.status(400).json({ error: "Invalid banner type" });
    }
    try {
      const { generateBanner } = await import("./bannerGenerator");
      const png = await generateBanner(type as any);
      res.set("Content-Type", "image/png");
      res.set("Cache-Control", "public, max-age=86400");
      res.send(png);
    } catch {
      res.status(404).json({ error: "Banner not found" });
    }
  });

  // ─── Telegram Webhook ────────────────────────────────────────────────────────
  // VULN-A3: verify X-Telegram-Bot-Api-Secret-Token before processing any update
  app.post("/api/telegram/webhook", webhookLimiter, async (req, res) => {
    const expectedSecret = getTelegramWebhookSecret();
    const receivedSecret = req.headers["x-telegram-bot-api-secret-token"];
    if (!receivedSecret || receivedSecret !== expectedSecret) {
      // Acknowledge to Telegram to avoid retries, but do not process
      return res.json({ ok: true });
    }
    res.json({ ok: true }); // answer Telegram immediately
    try {
      await handleTelegramUpdate(req.body, {
        getStats: async (period: string) => {
          const [adminStats, allUsers, kycPending, kycApproved, kycRejected] = await Promise.all([
            storage.getAdminStats(period),
            storage.getAllUsers(),
            storage.countKycByStatus("pending"),
            storage.countKycByStatus("approved"),
            storage.countKycByStatus("rejected"),
          ]);
          const recentUsers = [...allUsers]
            .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
            .slice(0, 5)
            .map(u => ({
              username: u.fullName || u.username,
              email: u.email ?? null,
              createdAt: u.createdAt ?? null,
              kycStatus: u.kycStatus ?? "not_submitted",
            }));
          return {
            period,
            totalUsers: adminStats.totalUsers,
            bannedUsers: adminStats.bannedUsers,
            depositCount: adminStats.depositCount,
            depositVol: adminStats.totalDeposits,
            withdrawalCount: adminStats.withdrawalCount,
            withdrawalVol: adminStats.totalWithdrawals,
            transferCount: adminStats.transferCount,
            paymentLinkCount: adminStats.paymentLinkCount,
            totalRevenue: adminStats.totalRevenue,
            depositFees: adminStats.depositFees,
            withdrawalFees: adminStats.withdrawalFees,
            transferFees: adminStats.transferFees,
            paymentLinkFees: adminStats.paymentLinkFees,
            pendingDeposits: adminStats.pendingDeposits,
            pendingWithdrawals: adminStats.pendingWithdrawals,
            pendingTransfers: adminStats.pendingTransfers,
            kycPending,
            kycApproved,
            kycRejected,
            recentUsers,
          };
        },

        approveKyc: async (submissionId) => {
          const allUsers = await storage.getAllUsers();
          const adminUser = allUsers.find(u => u.role === "admin");
          if (!adminUser) return null;

          const submission = await storage.approveKycSubmission(submissionId, adminUser.id, "Approuvé via Telegram").catch(() => null);
          if (!submission) return null;

          const kycUser = await storage.getUser(submission.userId).catch(() => null);
          if (!kycUser) return null;

          await storage.createUserNotification({
            userId: submission.userId,
            type: "kyc_approved",
            title: "Compte vérifié",
            message: "Félicitations ! Votre vérification KYC a été approuvée.",
            transactionId: null,
          }).catch(() => {});

          notifyKycApproved({
            adminName: adminUser.fullName || adminUser.username,
            userName: kycUser.fullName || kycUser.username,
            userEmail: kycUser.email || "",
            userId: kycUser.id,
          }).catch(() => {});

          await storage.createAdminLog({
            adminId: adminUser.id,
            action: "approve_kyc",
            targetType: "kyc_submission",
            targetId: submissionId,
            details: JSON.stringify({ via: "telegram_bot" }),
            ipAddress: "telegram",
          }).catch(() => {});

          return { userName: kycUser.fullName || kycUser.username, userEmail: kycUser.email || "" };
        },

        rejectKyc: async (submissionId, reason) => {
          const allUsers = await storage.getAllUsers();
          const adminUser = allUsers.find(u => u.role === "admin");
          if (!adminUser) return null;

          const submission = await storage.rejectKycSubmission(submissionId, adminUser.id, reason).catch(() => null);
          if (!submission) return null;

          const kycUser = await storage.getUser(submission.userId).catch(() => null);
          if (!kycUser) return null;

          await storage.createUserNotification({
            userId: submission.userId,
            type: "kyc_rejected",
            title: "Vérification rejetée",
            message: `Votre vérification KYC a été rejetée. Raison : ${reason}. Veuillez soumettre de nouveaux documents.`,
            transactionId: null,
          }).catch(() => {});

          notifyKycRejected({
            adminName: adminUser.fullName || adminUser.username,
            userName: kycUser.fullName || kycUser.username,
            userEmail: kycUser.email || "",
            userId: kycUser.id,
            reason,
          }).catch(() => {});

          await storage.createAdminLog({
            adminId: adminUser.id,
            action: "reject_kyc",
            targetType: "kyc_submission",
            targetId: submissionId,
            details: JSON.stringify({ via: "telegram_bot", note: reason }),
            ipAddress: "telegram",
          }).catch(() => {});

          return { userName: kycUser.fullName || kycUser.username, userEmail: kycUser.email || "" };
        },

        // ── Ban / Unban ──────────────────────────────────────────────────────
        banUser: async (email, reason, unban = false) => {
          const user = await storage.getUserByEmailOrPhone(email.trim()).catch(() => null);
          if (!user) return null;
          if (unban) {
            await storage.unbanUser(user.id);
          } else {
            await storage.banUser(user.id, reason);
          }
          return { userName: user.fullName || user.username, banned: !unban };
        },

        // ── User info ────────────────────────────────────────────────────────
        getUserInfo: async (email) => {
          const user = await storage.getUserByEmailOrPhone(email.trim()).catch(() => null);
          if (!user) return null;
          const [txList, walletList] = await Promise.all([
            storage.getTransactionsByUserId(user.id).catch(() => [] as any[]),
            storage.getWalletsByUserIds([user.id]).catch(() => [] as any[]),
          ]);
          const recentTx = [...txList]
            .sort((a: any, b: any) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
            .slice(0, 5)
            .map((t: any) => ({
              type: t.type,
              amount: t.amount,
              currency: t.currency || "XAF",
              status: t.status,
              createdAt: t.createdAt ?? null,
            }));
          const wallets = walletList
            .filter((w: any) => parseFloat(w.balance) > 0)
            .map((w: any) => ({ currency: w.currency, balance: parseFloat(w.balance) }));
          return {
            userName: user.fullName || user.username,
            email: user.email || "",
            balance: parseFloat(user.balance ?? "0"),
            currency: user.preferredCurrency || "XAF",
            kycStatus: user.kycStatus || "not_submitted",
            country: user.country ?? undefined,
            createdAt: user.createdAt ?? null,
            recentTx,
            wallets,
          };
        },

        // ── Set FX rate ──────────────────────────────────────────────────────
        setFxRate: async (currency, rate) => {
          try {
            await storage.upsertSetting(`fx_rate_${currency}`, String(rate), `Taux de change ${currency}/XAF`);
            return true;
          } catch {
            return false;
          }
        },

        // ── Countries ────────────────────────────────────────────────────────
        getCountries: async () => {
          const countries = await storage.getAllCountries().catch(() => [] as any[]);
          return countries.map((c: any) => ({
            id: String(c.id),
            code: c.code || "",
            name: c.name || c.code || "",
            currency: CURRENCY_ZONE[String(c.code || "").toUpperCase()] || c.currency || "XAF",
            isActive: c.isActive !== false,
          }));
        },

        toggleCountry: async (id) => {
          const country = await storage.getCountry(id).catch(() => null);
          if (!country) return null;
          const newActive = !((country as any).isActive !== false);
          await storage.updateCountry(id, { isActive: newActive } as any);
          return { name: (country as any).name || (country as any).code || id, isActive: newActive };
        },

        // ── Top 10 users ─────────────────────────────────────────────────────
        getTopUsers: async () => {
          const { loadFxRates, convertToXAF } = await import("./walletHelper");
          const [allUsers, fxRates] = await Promise.all([
            storage.getAllUsers().catch(() => [] as any[]),
            loadFxRates().catch(() => ({} as Record<string, number>)),
          ]);
          const nonBanned = allUsers.filter((u: any) => !u.isBanned);
          const userIds = nonBanned.map((u: any) => u.id);
          const allWallets = await storage.getWalletsByUserIds(userIds).catch(() => [] as any[]);

          // Group secondary wallets by userId
          const walletsByUser: Record<string, any[]> = {};
          for (const w of allWallets) {
            if (!walletsByUser[w.userId]) walletsByUser[w.userId] = [];
            walletsByUser[w.userId].push(w);
          }

          // Compute total XAF equivalent for each user
          const ranked = nonBanned.map((u: any) => {
            const primaryXAF = convertToXAF(parseFloat(u.balance ?? "0"), u.preferredCurrency || "XAF", fxRates);
            const secondaryXAF = (walletsByUser[u.id] || []).reduce((sum: number, w: any) => {
              return sum + convertToXAF(parseFloat(w.balance ?? "0"), w.currency, fxRates);
            }, 0);
            const totalXAF = primaryXAF + secondaryXAF;
            return {
              userName: u.fullName || u.username,
              email: u.email || "",
              balance: Math.round(totalXAF),
              currency: "XAF",
            };
          });

          return ranked
            .sort((a: any, b: any) => b.balance - a.balance)
            .slice(0, 10);
        },

        // ── Broadcast email ──────────────────────────────────────────────────
        broadcastEmail: async (subject, body) => {
          const allUsers = await storage.getAllUsers().catch(() => [] as any[]);
          const eligible = allUsers.filter((u: any) => u.email && !u.isBanned);
          let count = 0;
          for (const u of eligible) {
            try {
              await sendCampaignEmail({
                to: u.email!,
                firstName: u.fullName || u.username || "",
                subject,
                body: body.replace(/\{prenom\}/gi, u.fullName || u.username || ""),
                hasButton: true,
                buttonText: "Accéder à mon compte",
                buttonUrl: `https://${process.env.REPLIT_DEV_DOMAIN || "ashtechpay.com"}/dashboard`,
              });
              count++;
            } catch { /* skip failed */ }
          }
          return { count };
        },

        // ── Verify transaction ───────────────────────────────────────────────
        verifyTransaction: async (reference) => {
          const tx = await storage.getTransactionByReference(reference).catch(() => null);
          if (!tx) return null;
          const txUser = await storage.getUser(tx.userId).catch(() => null);
          return {
            type: tx.type,
            amount: tx.amount,
            currency: tx.currency || "XAF",
            status: tx.status,
            userName: txUser ? (txUser.fullName || txUser.username) : "—",
            createdAt: tx.createdAt ?? null,
            description: tx.description ?? undefined,
          };
        },

        // ── Active payment links today ───────────────────────────────────────
        getActiveLinks: async () => {
          const allLinks = await storage.getAllPaymentLinks().catch(() => [] as any[]);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const todayLinks = allLinks.filter((l: any) => {
            const created = l.createdAt ? new Date(l.createdAt) : null;
            return created && created >= today;
          });
          const allUsers = await storage.getAllUsers().catch(() => [] as any[]);
          const userMap = new Map(allUsers.map((u: any) => [u.id, u.fullName || u.username]));
          return todayLinks.map((l: any) => ({
            title: l.title || l.name || "Sans titre",
            slug: l.slug || l.id,
            amount: l.amount || "0",
            currency: l.currency || "XAF",
            userName: userMap.get(l.userId) || "—",
          }));
        },

        // ── Platform total balance ───────────────────────────────────────────
        getPlatformBalance: async () => {
          const [allUsers, fxRates, adminStats] = await Promise.all([
            storage.getAllUsers().catch(() => [] as any[]),
            loadFxRates(),
            storage.getAdminStats("all").catch(() => null as any),
          ]);
          const activeUsers = allUsers.filter((u: any) => !u.isBanned);
          const userIds = activeUsers.map((u: any) => u.id);
          const secWallets = await storage.getWalletsByUserIds(userIds).catch(() => [] as any[]);

          // Merge primary (users.balance grouped by preferredCurrency) + secondary wallets
          const byMap: Record<string, number> = {};
          for (const u of activeUsers) {
            const cur = u.preferredCurrency || "XAF";
            byMap[cur] = (byMap[cur] || 0) + parseFloat(u.balance ?? "0");
          }
          for (const w of secWallets) {
            const bal = parseFloat(w.balance ?? "0");
            if (bal > 0) byMap[w.currency] = (byMap[w.currency] || 0) + bal;
          }

          const byCurrency = Object.entries(byMap)
            .filter(([, v]) => v > 0)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([currency, balance]) => ({ currency, balance: Math.round(balance * 100) / 100 }));

          const totalXAF = byCurrency.reduce((sum, { currency, balance }) => {
            return sum + convertToXAF(balance, currency, fxRates);
          }, 0);

          return {
            totalXAF: Math.round(totalXAF * 100) / 100,
            byCurrency,
            userCount: activeUsers.length,
            revenue: {
              deposits: parseFloat(adminStats?.depositFees ?? "0"),
              withdrawals: parseFloat(adminStats?.withdrawalFees ?? "0"),
              transfers: parseFloat(adminStats?.transferFees ?? "0"),
              paymentLinks: parseFloat(adminStats?.paymentLinkFees ?? "0"),
              conversions: parseFloat(adminStats?.conversionFees ?? "0"),
              total: parseFloat(adminStats?.totalRevenue ?? "0"),
            },
          };
        },

        // ── Reset user password ──────────────────────────────────────────────
        resetUserPassword: async (email) => {
          const user = await storage.getUserByEmailOrPhone(email.trim()).catch(() => null);
          if (!user || !user.email) return null;
          const resetToken = crypto.randomBytes(32).toString("hex");
          const expiry = new Date(Date.now() + 3600000);
          await storage.setResetToken(user.id, resetToken, expiry).catch(() => {});
          sendPasswordResetEmail(user.email, user.fullName || user.username, resetToken).catch(() => {});
          return { userName: user.fullName || user.username, found: true };
        },

        // ── Approve withdrawal ───────────────────────────────────────────────
        approveWithdrawal: async (reference, provider) => {
          const tx = await storage.getTransactionByReference(reference).catch(() => null);
          if (!tx || !["pending", "pending_manual"].includes(tx.status)) return null;
          const txUser = await storage.getUser(tx.userId).catch(() => null);
          if (!txUser) return null;

          let countryCode = "CM";
          if (tx.recipientCountry) {
            const rc = tx.recipientCountry.trim();
            if (rc.length === 2) {
              countryCode = rc.toUpperCase();
            } else {
              const countries = await storage.getAllCountries().catch(() => [] as any[]);
              const c = countries.find((c: any) => c.name?.toLowerCase() === rc.toLowerCase());
              if (c?.code) countryCode = c.code;
            }
          }

          const operatorId = tx.operatorId;
          const operator = operatorId ? await storage.getOperator(operatorId) : null;
          const operatorName = ((operator as any)?.name || "").toUpperCase();
          const txCurrency = tx.currency || "XAF";
          const txAmount = parseFloat(tx.amount);
          const txRef = tx.reference || tx.id;
          const beneficiaryPhone = tx.recipientPhone || "";
          const beneficiaryName = tx.recipientName || txUser.fullName || txUser.username;
          if (tx.externalReference && isPawaPayUuidV4(tx.externalReference)) {
            const reconciled = await reconcilePawaPayPayoutAttempt(tx);
            return {
              userName: txUser.fullName || txUser.username,
              amount: tx.amount,
              currency: txCurrency,
              provider: "pawapay",
              status: reconciled === "completed" ? "completed" : reconciled === "failed" ? "failed" : "processing",
            };
          }

          try {
            let payoutResult: { success: boolean; transaction_id?: string; message?: string };
            // pollerRef must match the actual reference submitted to the provider
            // so the poller status check finds the right transaction.
            let telegramPollerRef = txRef;

            if (provider === "afribapay") {
              const afribapayOperatorCode = resolveAfribaPayOperatorCode(operator, operatorName);
              const afribapayCurrency = AFRIBAPAY_ISO_CURRENCY[countryCode.toUpperCase()] || txCurrency;
              const callbackUrl = buildWebhookUrl("/api/afribapay/webhook");
              const phonePrefixes: Record<string, string> = {
                CM: "237", SN: "221", CI: "225", BF: "226", ML: "223",
                GN: "224", BJ: "229", TG: "228", NE: "227", CD: "243",
                CG: "242", CF: "236", TD: "235", GA: "241", GQ: "240",
                MG: "261", RW: "250", KE: "254", TZ: "255", UG: "256",
                GH: "233", NG: "234",
              };
              let localPhone = beneficiaryPhone.replace(/\s/g, "");
              if (localPhone.startsWith("+")) localPhone = localPhone.slice(1);
              const pfx = phonePrefixes[countryCode];
              if (pfx && localPhone.startsWith(pfx)) localPhone = localPhone.slice(pfx.length);

              // Use a unique retry ref so AfribaPay doesn't reject "reference already exists"
              const afribaRetryRef = `${txRef}-R${Date.now().toString(36)}`;
              const afribaResult = await initiateAfribaPayout({
                operator: afribapayOperatorCode,
                country: countryCode,
                phone_number: localPhone,
                amount: txAmount,
                currency: afribapayCurrency,
                order_id: afribaRetryRef,
                reference_id: afribaRetryRef,
                notify_url: callbackUrl,
              });
              if (afribaResult.success) {
                // Poll by submitted order_id — AfribaPay status API uses order_id.
                // Persist it as externalReference so restart recovery finds the right ref.
                telegramPollerRef = afribaRetryRef;
                await storage.updateTransactionExternalReference(tx.id, afribaRetryRef);
              }
              payoutResult = afribaResult;

            } else if (provider === "pixpay") {
              const cashInServiceId = getPixPayServiceId(operator?.name || "", countryCode, "cash_in");
              const pixpayIpnUrl = buildWebhookUrl("/api/pixpay/webhook");
              // Use a unique retry ref for PixPay as well
              const pixpayRetryRef = `${txRef}-R${Date.now().toString(36)}`;
              const pixpayResult = await initiatePixPayPayout({
                serviceId: String(cashInServiceId || ""),
                amount: txAmount,
                phone: beneficiaryPhone.replace(/\s/g, ""),
                countryCode,
                orderId: pixpayRetryRef,
                ipnUrl: pixpayIpnUrl,
                customData: txRef,
              });
              if (pixpayResult.success) {
                // Poll by PixPay's own transactionId; persist as externalReference.
                telegramPollerRef = pixpayResult.transactionId || pixpayRetryRef;
                await storage.updateTransactionExternalReference(tx.id, telegramPollerRef);
              }
              payoutResult = { success: pixpayResult.success, transaction_id: pixpayResult.transactionId, message: pixpayResult.message };

            } else if (provider === "pawapay") {
              if (tx.externalReference && isPawaPayUuidV4(tx.externalReference)) {
                const existingId = tx.externalReference;
                let existingStatus: "pending" | "completed" | "failed" = "pending";
                try { existingStatus = (await getPawaPayPayout(existingId)).status; } catch { existingStatus = "pending"; }
                if (existingStatus === "completed" || existingStatus === "failed") {
                  await processPawaPayPayoutCallback(tx, existingStatus === "completed" ? "success" : "failed");
                  return { userName: txUser.fullName || txUser.username, amount: tx.amount, currency: txCurrency };
                }
                await storage.updateTransactionStatus(tx.id, "processing");
                addPendingPayout({
                  transactionId: tx.id, reference: existingId, externalReference: existingId, userId: tx.userId,
                  amount: tx.amount, totalDebited: tx.totalAmount || tx.amount, provider: "pawapay",
                  countryCode, txType: tx.type, txCurrency,
                });
                return {
                  userName: txUser.fullName || txUser.username,
                  amount: tx.amount,
                  currency: txCurrency,
                  provider: "pawapay",
                  status: "processing",
                };
              }
              await assertPawaPayProviderActive(resolvePawaPayProviderCode(operator, operator?.name || "", countryCode), "PAYOUT", pawaPayCountry(countryCode));
              const payoutId = createPawaPayId();
              await storage.updateTransactionMetadata(tx.id, {
                ...((tx.metadata || {}) as Record<string, unknown>),
                paymentProvider: "pawapay", pawaCountry: pawaPayCountry(countryCode),
                walletCurrency: (tx.metadata as any)?.walletCurrency || tx.currency || "XAF",
              });
              // Persist before submitting: a timeout is ambiguous and must be
              // recoverable by UUID rather than refunded or force-completed.
              await storage.updateTransactionExternalReference(tx.id, payoutId);
              const result = await createPawaPayPayout({
                payoutId,
                country: pawaPayCountry(countryCode),
                amount: txAmount.toFixed(2),
                currency: toPawaPayCurrency(txCurrency),
                recipient: {
                  provider: resolvePawaPayProviderCode(operator, operator?.name || "", countryCode),
                  phoneNumber: normalizePhone(beneficiaryPhone) || "",
                },
                clientReferenceId: txRef,
                customerMessage: PAWAPAY_CUSTOMER_MESSAGE,
              });
              telegramPollerRef = payoutId;
              payoutResult = { success: result.success, transaction_id: payoutId, message: result.providerMessage };

            } else {
              payoutResult = {
                success: false,
                message: "Fournisseur de paiement non supporté",
              };
            }

            if (payoutResult.success) {
              await storage.updateTransactionStatus(tx.id, "processing");
              addPendingPayout({
                transactionId: tx.id,
                reference: telegramPollerRef,
                userId: tx.userId,
                amount: tx.amount,
                totalDebited: tx.totalAmount || tx.amount,
                provider: provider as "afribapay" | "pixpay" | "pawapay",
                ...(provider === "pawapay" ? { externalReference: telegramPollerRef } : {}),
                countryCode,
                txType: tx.type,
                txCurrency,
                walletCurrency: (tx.metadata as any)?.walletCurrency || txCurrency,
              });
            } else {
              console.error(`[Telegram Approve] Payout failed via ${provider}: ${payoutResult.message}`);
              await storage.updateTransactionStatus(tx.id, provider === "pawapay" ? "pending_manual" : "completed");
            }
          } catch (err: any) {
            console.error(`[Telegram Approve] Payout error via ${provider}:`, err?.message || err);
            // A PawaPay transport error after UUID persistence has an unknown
            // provider outcome. Leave it for manual/recovery processing.
            await storage.updateTransactionStatus(tx.id, provider === "pawapay" ? "pending_manual" : "completed");
          }

          const finalTransaction = await storage.getTransactionById(tx.id).catch(() => null);
          const finalStatus = finalTransaction?.status === "pending_manual"
            ? "pending_manual"
            : finalTransaction?.status === "completed"
              ? "completed"
              : "processing";
          return {
            userName: txUser.fullName || txUser.username,
            amount: tx.amount,
            currency: txCurrency,
            provider,
            status: finalStatus,
          };
        },

        // ── Reject withdrawal ────────────────────────────────────────────────
        rejectWithdrawal: async (reference, reason) => {
          const tx = await storage.getTransactionByReference(reference).catch(() => null);
          if (!tx || !["pending", "pending_manual", "processing"].includes(tx.status)) return null;
          const txUser = await storage.getUser(tx.userId).catch(() => null);
          if (!txUser) return null;

          if (tx.externalReference && isPawaPayUuidV4(tx.externalReference)) {
            const reconciled = await reconcilePawaPayPayoutAttempt(tx);
            if (reconciled === "unresolved") {
              throw new Error("Paiement encore en cours de rapprochement; rejet manuel interdit.");
            }
            return { userName: txUser.fullName || txUser.username };
          }
          await storage.updateTransactionStatus(tx.id, "failed");
          const totalDebited = parseFloat(tx.totalAmount || tx.amount);
          await storage.refundToOriginalWallet(tx.userId, tx.type, tx.currency || "XAF", totalDebited);

          await storage.createUserNotification({
            userId: tx.userId,
            type: "withdrawal_failed",
            title: "Retrait annulé",
            message: `Votre retrait de ${tx.amount} ${tx.currency} a été annulé. Raison : ${reason}. Votre solde a été remboursé.`,
            transactionId: tx.id,
            isRead: false,
          }).catch(() => {});

          return { userName: txUser.fullName || txUser.username };
        },

        // ── Search users by partial email ────────────────────────────────────
        searchUsers: async (query) => {
          const found = await storage.searchUsersByEmail(query);
          return found.map(u => ({
            userName: u.fullName || u.username,
            email: u.email ?? "",
            balance: parseFloat(u.balance ?? "0"),
            currency: u.preferredCurrency ?? "XAF",
            kycStatus: u.kycStatus ?? "not_submitted",
            country: u.country ?? undefined,
            banned: !!u.isBanned,
          }));
        },

        // ── Approve withdrawal number change ─────────────────────────────────
        approveWithdrawalNumberChange: async (changeId) => {
          const allUsers = await storage.getAllUsers();
          const adminUser = allUsers.find(u => u.role === "admin");
          if (!adminUser) return null;

          const change = await storage.approveWithdrawalNumberChange(changeId, adminUser.id, undefined).catch(() => null);
          if (!change) return null;

          const wnUser = await storage.getUser(change.userId).catch(() => null);
          if (!wnUser) return null;

          // Notify user in-app
          await storage.createUserNotification({
            userId: change.userId,
            type: "withdrawal_number_approved",
            title: "Numéro de retrait approuvé",
            message: change.action === "delete"
              ? "Votre demande de suppression du numéro de retrait a été approuvée."
              : `Votre numéro de retrait ${change.newPhoneNumber || ""} a été approuvé et est maintenant actif.`,
            transactionId: null,
          }).catch(() => {});

          // Send email notification
          if (wnUser.email) {
            const { sendWithdrawalNumberApprovedEmail } = await import("./email").catch(() => ({ sendWithdrawalNumberApprovedEmail: null } as any));
            if (sendWithdrawalNumberApprovedEmail) {
              sendWithdrawalNumberApprovedEmail(
                wnUser.email,
                wnUser.fullName || wnUser.username,
                change.newPhoneNumber || "",
                change.newOperatorName || undefined
              ).catch(() => {});
            }
          }

          await storage.createAdminLog({
            adminId: adminUser.id,
            action: "approve_withdrawal_number_change",
            targetType: "withdrawal_number_change",
            targetId: changeId,
            details: JSON.stringify({ via: "telegram_bot" }),
            ipAddress: "telegram",
          }).catch(() => {});

          return {
            userName: wnUser.fullName || wnUser.username,
            userEmail: wnUser.email || "",
            newPhone: change.newPhoneNumber || "",
            action: change.action,
          };
        },

        // ── Reject withdrawal number change ──────────────────────────────────
        rejectWithdrawalNumberChange: async (changeId, reason) => {
          const allUsers = await storage.getAllUsers();
          const adminUser = allUsers.find(u => u.role === "admin");
          if (!adminUser) return null;

          const change = await storage.rejectWithdrawalNumberChange(changeId, adminUser.id, reason).catch(() => null);
          if (!change) return null;

          const wnUser = await storage.getUser(change.userId).catch(() => null);
          if (!wnUser) return null;

          // Notify user in-app
          await storage.createUserNotification({
            userId: change.userId,
            type: "withdrawal_number_rejected",
            title: "Demande de numéro refusée",
            message: `Votre demande de modification du numéro de retrait a été refusée. Raison : ${reason}`,
            transactionId: null,
          }).catch(() => {});

          await storage.createAdminLog({
            adminId: adminUser.id,
            action: "reject_withdrawal_number_change",
            targetType: "withdrawal_number_change",
            targetId: changeId,
            details: JSON.stringify({ via: "telegram_bot", note: reason }),
            ipAddress: "telegram",
          }).catch(() => {});

          return {
            userName: wnUser.fullName || wnUser.username,
            userEmail: wnUser.email || "",
          };
        },
        getBlockedIps: () => getBlockedIps(),
        unblockIpByIdentifier: (identifier: string) => unblockByIdentifier(identifier),

        // ── Reply to ticket from Telegram ────────────────────────────────────
        replyToTicket: async (ticketId, message) => {
          const ticket = await storage.getTicket(ticketId).catch(() => null);
          if (!ticket) return null;
          const ticketUser = await storage.getUser(ticket.userId).catch(() => null);
          if (!ticketUser) return null;
          const allUsers = await storage.getAllUsers();
          const adminUser = allUsers.find(u => u.role === "admin" || u.role === "support");
          if (!adminUser) return null;

          const isUserViewing = getUserViewingTicket(ticket.userId, ticketId);
          await storage.createTicketMessage({
            ticketId,
            senderId: adminUser.id,
            message,
            isAdmin: true,
            readByAdmin: true,
            readByUser: isUserViewing,
          });
          await storage.updateTicket(ticketId, {
            status: ticket.status === "open" ? "in_progress" : ticket.status,
          });
          notifyUser(ticket.userId, "new_message", { ticketId, message });
          await storage.createUserNotification({
            userId: ticket.userId,
            type: "admin_message",
            title: "Nouveau message du support",
            message: `Réponse à votre ticket : ${ticket.subject}`,
            transactionId: null,
            isRead: false,
          }).catch(() => {});
          return {
            userName: ticketUser.fullName || ticketUser.username,
            subject: ticket.subject,
          };
        },

        // ── Close ticket from Telegram ───────────────────────────────────────
        closeTicket: async (ticketId) => {
          const ticket = await storage.getTicket(ticketId).catch(() => null);
          if (!ticket) return null;
          const ticketUser = await storage.getUser(ticket.userId).catch(() => null);
          if (!ticketUser) return null;
          await storage.updateTicket(ticketId, { status: "closed" });
          notifyUser(ticket.userId, "ticket_closed", { ticketId });
          await storage.createUserNotification({
            userId: ticket.userId,
            type: "ticket_closed",
            title: "Ticket clôturé",
            message: `Votre ticket "${ticket.subject}" a été clôturé par le support.`,
            transactionId: null,
            isRead: false,
          }).catch(() => {});
          return {
            userName: ticketUser.fullName || ticketUser.username,
            subject: ticket.subject,
          };
        },

        // ── Force execute conversion from Telegram ───────────────────────────
        executeConversion: async (conversionId) => {
          const allUsers = await storage.getAllUsers();
          const adminUser = allUsers.find(u => u.role === "admin");
          if (!adminUser) return null;

          const req = await storage.getConversionRequest(conversionId).catch(() => null);
          if (!req || req.status !== "pending") return null;

          const convUser = await storage.getUser(req.userId).catch(() => null);
          if (!convUser) return null;

          const fromAmount = parseFloat(req.fromAmount);
          // Use stored toAmount — calculated at creation time with admin FX rates, no external API needed
          const receivedAmount = req.toAmount
            ? parseFloat(req.toAmount)
            : await (async () => {
                // Fallback: recalculate using admin-configured FX rates
                const execFallbackRates = await loadFxRates();
                return convertCurrency(fromAmount, req.fromCurrency, req.toCurrency, execFallbackRates);
              })();
          if (!receivedAmount || !isFinite(receivedAmount) || receivedAmount <= 0) return null;
          const userPrimary = convUser.preferredCurrency || "XAF";

          if (req.toCurrency === userPrimary) {
            await storage.updateUserBalance(req.userId, receivedAmount);
          } else {
            await storage.upsertWallet(req.userId, req.toCurrency, receivedAmount);
          }

          await storage.updateConversionRequest(conversionId, {
            status: "completed",
            toAmount: receivedAmount.toFixed(2),
            executedAt: new Date(),
            executedById: adminUser.id,
          });

          // Update related transaction
          const meta = (() => { try { return JSON.parse(req.notes || "{}"); } catch { return {}; } })();
          if (meta.txId) await storage.updateTransactionStatus(meta.txId, "completed").catch(() => {});

          await storage.createUserNotification({
            userId: req.userId,
            title: "Conversion effectuée ✅",
            message: `Votre conversion de ${fromAmount.toFixed(2)} ${req.fromCurrency} → ${receivedAmount.toFixed(2)} ${req.toCurrency} a été effectuée.`,
            type: "success",
          }).catch(() => {});

          return {
            userName: convUser.fullName || convUser.username,
            fromAmount: fromAmount.toFixed(2),
            fromCurrency: req.fromCurrency,
            toAmount: receivedAmount.toFixed(2),
            toCurrency: req.toCurrency,
          };
        },

        // ── Cancel & refund conversion from Telegram ─────────────────────────
        cancelConversion: async (conversionId) => {
          const req = await storage.getConversionRequest(conversionId).catch(() => null);
          if (!req || req.status !== "pending") return null;

          const convUser = await storage.getUser(req.userId).catch(() => null);
          if (!convUser) return null;

          const fromAmount = parseFloat(req.fromAmount);
          const userPrimary = convUser.preferredCurrency || "XAF";

          // Refund source wallet
          if (req.fromCurrency === userPrimary) {
            await storage.updateUserBalance(req.userId, fromAmount);
          } else {
            await storage.upsertWallet(req.userId, req.fromCurrency, fromAmount);
          }

          await storage.updateConversionRequest(conversionId, { status: "cancelled" });

          const meta = (() => { try { return JSON.parse(req.notes || "{}"); } catch { return {}; } })();
          if (meta.txId) await storage.updateTransactionStatus(meta.txId, "failed").catch(() => {});

          await storage.createUserNotification({
            userId: req.userId,
            title: "Conversion annulée",
            message: `Votre conversion de ${fromAmount.toFixed(2)} ${req.fromCurrency} a été annulée. Votre solde a été remboursé.`,
            type: "info",
          }).catch(() => {});

          return {
            userName: convUser.fullName || convUser.username,
            fromAmount: fromAmount.toFixed(2),
            fromCurrency: req.fromCurrency,
          };
        },
      });
    } catch (err: any) {
      console.error("[TelegramWebhook] Error:", err?.message);
    }
  });

  // Register Telegram webhook after all routes are set up.
  // Priority: APP_URL (production) > REPLIT_DEV_DOMAIN (dev only, no APP_URL set).
  // This prevents the Replit dev server from overwriting the production webhook.
  setImmediate(async () => {
    const replitDomain = process.env.REPLIT_DEV_DOMAIN;
    const appUrl = (process.env.APP_URL || "").replace(/\/$/, "");

    let webhookBase: string | null = null;
    if (appUrl) {
      // Production APP_URL always takes priority — never overwrite with Replit domain
      webhookBase = appUrl;
    } else if (replitDomain) {
      // Only use Replit domain in pure dev (no APP_URL configured)
      webhookBase = `https://${replitDomain}`;
    }

    if (webhookBase) {
      const webhookUrl = `${webhookBase}/api/telegram/webhook`;
      console.log(`[Telegram] Registering webhook → ${webhookUrl}`);
      await registerTelegramWebhook(webhookUrl);
    } else {
      console.warn("[Telegram] No domain found (REPLIT_DEV_DOMAIN / APP_URL) — webhook not registered.");
    }
  });

  return httpServer;
}
