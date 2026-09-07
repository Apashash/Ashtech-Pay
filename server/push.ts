import crypto from "crypto";
import webpush from "web-push";
import { db } from "./db";
import { pushSubscriptions, transactions, type PushSubscription } from "@shared/schema";
import { decryptField } from "./fieldEncryption";
import { eq } from "drizzle-orm";

export interface BrowserPushPayload {
  title: string;
  body: string;
  type?: string;
  transactionId?: string | null;
  url?: string;
  /** Internal formatting overrides; never sent directly to the browser. */
  amountOverride?: unknown;
  currencyOverride?: unknown;
}

interface VapidConfig {
  publicKey: string;
  privateKey: string;
}

let vapidConfig: VapidConfig | null | undefined;

const PUSH_CTA = "Appuyez pour consulter votre compte.";

function toBase64Url(value: Buffer): string {
  return value.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function formatAmount(amount: unknown, currency: unknown): string | null {
  if (amount === null || amount === undefined || amount === "") return null;

  const numericAmount = Number(amount);
  const formattedAmount = Number.isFinite(numericAmount)
    ? numericAmount.toLocaleString("fr-FR", { maximumFractionDigits: 2 })
    : String(amount);
  const formattedCurrency = currency ? ` ${String(currency)}` : "";
  return `${formattedAmount}${formattedCurrency}`;
}

function normalizeAmountsInText(text: string): string {
  return text
    .replace(/[\u00a0\u202f]/g, " ")
    .replace(/\b(\d[\d\s.,]*)\s+([A-Z]{3})\b/g, (_match, amount: string, currency: string) => {
      return formatAmount(amount.replace(/\s/g, "").replace(",", "."), currency) || `${amount} ${currency}`;
    });
}

function parseNotificationMetadata(body: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(body);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function extractAmountFromText(text: string): string | null {
  const match = text
    .replace(/[\u00a0\u202f]/g, " ")
    .match(/\b(\d[\d\s.,]*)\s+([A-Z]{3})\b/);
  if (!match) return null;

  const rawAmount = match[1].replace(/\s/g, "").replace(",", ".");
  return formatAmount(rawAmount, match[2]);
}

function formatPushNotification(payload: BrowserPushPayload): {
  title: string;
  body: string;
  url: string;
} {
  const metadata = parseNotificationMetadata(payload.body);
  const amount = formatAmount(payload.amountOverride, payload.currencyOverride)
    || formatAmount(metadata?.amount, metadata?.currency)
    || extractAmountFromText(payload.body);
  const type = payload.type || "notification";
  const detailsUrl = "/dashboard/notifications";
  const accountUrl = "/dashboard";

  switch (type) {
    case "deposit_confirmed":
      return {
        title: "Dépôt confirmé",
        body: amount
          ? `Votre compte a été crédité de ${amount}. ${PUSH_CTA}`
          : `Votre dépôt a été confirmé. ${PUSH_CTA}`,
        url: accountUrl,
      };
    case "payment_link_received":
      return {
        title: "Paiement reçu",
        body: amount
          ? `Vous avez reçu un paiement de ${amount} via votre lien. ${PUSH_CTA}`
          : `Un paiement a été reçu via votre lien. ${PUSH_CTA}`,
        url: accountUrl,
      };
    case "withdrawal_confirmed":
      return {
        title: "Retrait confirmé",
        body: amount
          ? `Votre retrait de ${amount} a été effectué avec succès. ${PUSH_CTA}`
          : `Votre retrait a été effectué avec succès. ${PUSH_CTA}`,
        url: accountUrl,
      };
    case "withdrawal_pending":
      return {
        title: "Retrait en attente",
        body: amount
          ? `Votre retrait de ${amount} est en attente. Cliquez pour consulter.`
          : "Votre retrait est en attente. Cliquez pour consulter.",
        url: detailsUrl,
      };
    case "deposit_failed":
      return {
        title: "Dépôt non abouti",
        body: amount
          ? `Votre dépôt de ${amount} n'a pas pu être confirmé. ${PUSH_CTA}`
          : `Votre dépôt n'a pas pu être confirmé. ${PUSH_CTA}`,
        url: detailsUrl,
      };
    case "payment_link_failed":
      return {
        title: "Paiement non abouti",
        body: amount
          ? `Le paiement de ${amount} via votre lien n'a pas abouti. ${PUSH_CTA}`
          : `Le paiement via votre lien n'a pas abouti. ${PUSH_CTA}`,
        url: detailsUrl,
      };
    case "withdrawal_failed":
      return {
        title: "Retrait non abouti",
        body: amount
          ? `Votre retrait de ${amount} n'a pas abouti. Consultez les détails dans votre compte.`
          : `Votre retrait n'a pas abouti. Consultez les détails dans votre compte.`,
        url: detailsUrl,
      };
    case "transfer_received":
      return {
        title: "Argent reçu",
        body: metadata
          ? (amount
            ? `Une opération de ${amount} a été enregistrée. ${PUSH_CTA}`
            : `Vous avez une nouvelle notification. ${PUSH_CTA}`)
          : `${normalizeAmountsInText(payload.body).replace(/\s+$/, "")} ${PUSH_CTA}`,
        url: accountUrl,
      };
    default: {
      const body = metadata
        ? (amount
          ? `Une opération de ${amount} a été enregistrée.`
          : "Vous avez une nouvelle notification.")
        : normalizeAmountsInText(payload.body);
      const shouldAddCta = !/Appuyez pour consulter|consulter les détails/i.test(body)
        && !["admin_message", "global_message"].includes(type);
      return {
        title: payload.title,
        body: shouldAddCta ? `${body.replace(/\s+$/, "")} ${PUSH_CTA}` : body,
        url: payload.url || detailsUrl,
      };
    }
  }
}

async function hydrateIncomingPaymentPayload(payload: BrowserPushPayload): Promise<BrowserPushPayload> {
  if (!payload.transactionId) {
    return payload;
  }

  const [transaction] = await db
    .select({
      amount: transactions.amount,
      totalAmount: transactions.totalAmount,
      currency: transactions.currency,
    })
    .from(transactions)
    .where(eq(transactions.id, payload.transactionId))
    .limit(1);

  if (!transaction) return payload;

  const isWithdrawal = payload.type?.startsWith("withdrawal_") ?? false;
  const exactAmount = isWithdrawal
    ? transaction.totalAmount || transaction.amount
    : transaction.amount;

  return {
    ...payload,
    amountOverride: exactAmount,
    currencyOverride: transaction.currency || "XAF",
  };
}

/**
 * Derive one stable P-256 VAPID key from the dedicated key when available.
 * FIELD_ENCRYPTION_KEY is used as a backwards-compatible fallback so an
 * existing deployment works without exposing a private key in source control.
 */
function getVapidConfig(): VapidConfig | null {
  if (vapidConfig !== undefined) return vapidConfig;

  const source = process.env.WEB_PUSH_VAPID_PRIVATE_KEY || process.env.FIELD_ENCRYPTION_KEY;
  if (!source || source.trim().length < 8) {
    vapidConfig = null;
    return vapidConfig;
  }

  try {
    const privateKey = crypto.createHash("sha256").update(source).digest();
    const ecdh = crypto.createECDH("prime256v1");
    ecdh.setPrivateKey(privateKey);
    const publicKey = ecdh.getPublicKey(undefined, "uncompressed");
    vapidConfig = {
      publicKey: toBase64Url(publicKey),
      privateKey: toBase64Url(privateKey),
    };
    return vapidConfig;
  } catch (error: any) {
    console.error("[Push] Unable to initialize VAPID keys:", error?.message || error);
    vapidConfig = null;
    return vapidConfig;
  }
}

export function getVapidPublicKey(): string | null {
  return getVapidConfig()?.publicKey ?? null;
}

function configureWebPush(): VapidConfig | null {
  const config = getVapidConfig();
  if (!config) return null;
  webpush.setVapidDetails("mailto:support@ashtechpay.top", config.publicKey, config.privateKey);
  return config;
}

function decryptSubscription(subscription: PushSubscription): PushSubscription | null {
  const endpoint = decryptField(subscription.endpoint);
  const p256dh = decryptField(subscription.p256dh);
  const auth = decryptField(subscription.auth);
  if (!endpoint || !p256dh || !auth) return null;
  return { ...subscription, endpoint, p256dh, auth };
}

export async function sendPushNotification(userId: string, payload: BrowserPushPayload): Promise<void> {
  if (!configureWebPush()) return;

  const pushPayload = await hydrateIncomingPaymentPayload(payload);
  const formatted = formatPushNotification(pushPayload);
  const subscriptions = await db.select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));

  await Promise.all(subscriptions.map(async (stored) => {
    const subscription = decryptSubscription(stored);
    if (!subscription) return;

    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        JSON.stringify({
          title: formatted.title,
          body: formatted.body,
          type: payload.type || "notification",
          transactionId: payload.transactionId || null,
          url: formatted.url,
        }),
        { TTL: 300 },
      );
      await db.update(pushSubscriptions)
        .set({ updatedAt: new Date() })
        .where(eq(pushSubscriptions.id, stored.id));
    } catch (error: any) {
      const statusCode = Number(error?.statusCode);
      if (statusCode === 404 || statusCode === 410) {
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, stored.id));
        return;
      }
      console.error(`[Push] Delivery failed for subscription ${stored.id}:`, error?.message || error);
    }
  }));
}

/**
 * Deliver a broadcast push only to users who have an active browser
 * subscription. Global messages remain backed by the global_messages table,
 * so this function only handles the transient browser delivery.
 */
export async function sendPushNotificationToAll(payload: BrowserPushPayload): Promise<void> {
  if (!configureWebPush()) return;

  const subscriptions = await db
    .select({ userId: pushSubscriptions.userId })
    .from(pushSubscriptions);
  const userIds = [...new Set(subscriptions.map(({ userId }) => userId))];

  await Promise.allSettled(
    userIds.map((userId) => sendPushNotification(userId, payload)),
  );
}