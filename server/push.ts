import crypto from "crypto";
import webpush from "web-push";
import { db } from "./db";
import { pushSubscriptions, type PushSubscription } from "@shared/schema";
import { decryptField } from "./fieldEncryption";
import { eq } from "drizzle-orm";

export interface BrowserPushPayload {
  title: string;
  body: string;
  type?: string;
  transactionId?: string | null;
  url?: string;
}

interface VapidConfig {
  publicKey: string;
  privateKey: string;
}

let vapidConfig: VapidConfig | null | undefined;

function toBase64Url(value: Buffer): string {
  return value.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
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
          title: payload.title,
          body: payload.body,
          type: payload.type || "notification",
          transactionId: payload.transactionId || null,
          url: payload.url || "/dashboard/notifications",
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