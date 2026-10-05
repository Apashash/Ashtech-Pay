import crypto from "crypto";
import { randomUUID } from "node:crypto";
import { db, pool } from "./db";
import { storage } from "./storage";
import { decryptField, encryptField, isFieldEncryptionConfigured } from "./fieldEncryption";
import type { Transaction } from "@shared/schema-runtime";
import { sql } from "drizzle-orm";
import { postJsonToSafeWebhook } from "./networkSecurity";

type FinalStatus = "completed" | "failed";

let workerStarted = false;
const isMysql = process.env.DB_DIALECT?.toLowerCase() === "mysql";

async function mysqlQuery(text: string, values: unknown[] = []) {
  return pool.query(text, values);
}

export function isSafeMerchantWebhookUrl(rawUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  const host = parsed.hostname.toLowerCase();
  return !(
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "169.254.169.254" ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^::1$/.test(host) ||
    /^fd/.test(host) ||
    /^fe80/.test(host)
  );
}

function buildPayload(transaction: Transaction, finalStatus: FinalStatus, notifyUrl: string) {
  const metadata = ((transaction as any).metadata || {}) as Record<string, any>;
  const isPayout = transaction.type === "withdrawal" || transaction.type === "transfer_out";
  const eventPrefix = transaction.type === "conversion" ? "conversion" : isPayout ? "payout" : "payment";
  return {
    event: finalStatus === "completed" ? `${eventPrefix}.completed` : `${eventPrefix}.failed`,
    transaction_id: transaction.id,
    reference: transaction.reference,
    merchant_reference: metadata.merchantReference ?? null,
    status: finalStatus,
    amount: Number(transaction.amount),
    total_amount: Number(transaction.totalAmount || transaction.amount),
    currency: transaction.currency,
    type: transaction.type,
    phone: transaction.recipientPhone ?? null,
    payment_link_id: transaction.paymentLinkId || null,
    timestamp: new Date().toISOString(),
    fee_amount: Number(transaction.feeAmount || 0),
    provider_fee_amount: metadata.providerFeeAmountUsdt ?? 0,
    provider_fee_percent: metadata.providerFeePercent ?? 0,
    ashtech_fee_amount: Number(transaction.ashtechFeeAmount || metadata.ashtechFeeAmountUsdt || 0),
    ashtech_fee_percent: metadata.ashtechFeePercent ?? 0,
    total_fee_amount: Number(transaction.feeAmount || 0),
    total_fee_percent: metadata.totalFeePercent ?? 0,
    ...(transaction.paymentMethod === "crypto"
      ? {
          payment_method: "crypto",
          asset_code: metadata.assetCode ?? null,
          address: metadata.address ?? null,
          memo: metadata.memo ?? null,
        }
      : {}),
    // Keep the exact URL out of the payload; it is stored separately and signed.
    _notify_url: notifyUrl,
  };
}

export async function enqueueMerchantWebhook(
  transaction: Transaction,
  finalStatus: FinalStatus,
  notifyUrlOverride?: string | null,
): Promise<void> {
  const notifyUrl = notifyUrlOverride || transaction.notifyUrl;
  if (!notifyUrl) return;
  if (!isSafeMerchantWebhookUrl(notifyUrl)) {
    console.warn("[MerchantWebhook] Blocked unsafe notify_url");
    return;
  }

  const payload = buildPayload(transaction, finalStatus, notifyUrl);
  delete (payload as any)._notify_url;
  if (isMysql) {
    await mysqlQuery(
      `INSERT IGNORE INTO merchant_webhook_deliveries
        (id, merchant_id, transaction_id, event, notify_url, payload)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [randomUUID(), transaction.userId, transaction.id, payload.event, notifyUrl, JSON.stringify(payload)],
    );
    const inserted = await mysqlQuery(
      `SELECT id FROM merchant_webhook_deliveries WHERE transaction_id = ? AND event = ? LIMIT 1`,
      [transaction.id, payload.event],
    );
    const deliveryId = inserted.rows[0]?.id;
    if (deliveryId) await deliverMerchantWebhook(String(deliveryId));
    return;
  }
  const inserted = await db.execute(sql`
    INSERT INTO merchant_webhook_deliveries
      (merchant_id, transaction_id, event, notify_url, payload)
    VALUES
      (${transaction.userId}, ${transaction.id}, ${payload.event}, ${notifyUrl}, ${JSON.stringify(payload)}::jsonb)
    ON CONFLICT (transaction_id, event) DO NOTHING
    RETURNING id
  `);
  const deliveryId = (inserted.rows[0] as any)?.id;
  if (!deliveryId) return;
  await deliverMerchantWebhook(deliveryId);
}

async function deliverMerchantWebhook(deliveryId: string): Promise<void> {
  if (isMysql) {
    const claim = await mysqlQuery(
      `UPDATE merchant_webhook_deliveries
       SET status = 'delivering',
           attempts = attempts + 1,
           next_attempt_at = DATE_ADD(NOW(), INTERVAL 5 MINUTE)
       WHERE id = ?
         AND status IN ('pending', 'delivering')
         AND delivered_at IS NULL
         AND next_attempt_at <= NOW()`,
      [deliveryId],
    );
    if (claim.rowCount === 0) return;
    const claimed = await mysqlQuery(
      `SELECT * FROM merchant_webhook_deliveries WHERE id = ? AND status = 'delivering' LIMIT 1`,
      [deliveryId],
    );
    const delivery = claimed.rows[0] as any;
    if (!delivery) return;
    await deliverClaimedMerchantWebhook(delivery);
    return;
  }
  const claimed = await db.execute(sql`
    UPDATE merchant_webhook_deliveries
    SET status = 'delivering',
        attempts = attempts + 1,
        next_attempt_at = NOW() + INTERVAL '5 minutes'
    WHERE id = ${deliveryId}
      AND status IN ('pending', 'delivering')
      AND delivered_at IS NULL
      AND next_attempt_at <= NOW()
    RETURNING *
  `);
  const delivery = claimed.rows[0] as any;
  if (!delivery) return;
  await deliverClaimedMerchantWebhook(delivery);
}

async function deliverClaimedMerchantWebhook(delivery: any): Promise<void> {
  const deliveryId = String(delivery.id);
  const merchant = delivery.merchant_id ? await storage.getUser(delivery.merchant_id) : undefined;
  if (!isFieldEncryptionConfigured()) {
    await markRetry(deliveryId, "field encryption is not configured", 900);
    return;
  }
  const storedSecret = merchant ? (merchant as any).apiWebhookSecret : null;
  const secret = decryptField(storedSecret);
  if (!secret) {
    await markRetry(deliveryId, "merchant webhook secret is not configured", 900);
    return;
  }
  if (merchant && !storedSecret?.startsWith("enc:")) {
    await storage.updateUser(merchant.id, { apiWebhookSecret: encryptField(secret) } as any);
  }

  const body = JSON.stringify(delivery.payload);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await postJsonToSafeWebhook(
      delivery.notify_url,
      {
        "Content-Type": "application/json",
        "X-Ashtech-Event-Id": delivery.id,
        "X-Ashtech-Timestamp": timestamp,
        "X-Ashtech-Signature": `sha256=${signature}`,
      },
      body,
      controller.signal,
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    if (isMysql) {
      await mysqlQuery(
        `UPDATE merchant_webhook_deliveries
         SET status = 'delivered', delivered_at = NOW(), last_error = NULL
         WHERE id = ?`,
        [deliveryId],
      );
    } else await db.execute(sql`
      UPDATE merchant_webhook_deliveries
      SET status = 'delivered', delivered_at = NOW(), last_error = NULL
      WHERE id = ${deliveryId}
    `);
    console.log(`[MerchantWebhook] delivered status=${response.status} delivery=${deliveryId}`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const attempts = Number(delivery.attempts) || 1;
    const maxAttempts = 8;
    const permanentlyFailed = attempts >= maxAttempts;
    const delaySeconds = Math.min(3600, Math.max(30, 30 * 2 ** Math.min(attempts - 1, 6)));
    if (isMysql) {
      const retryState = permanentlyFailed ? "failed" : "pending";
      const retryDelay = permanentlyFailed ? 900 : delaySeconds;
      await mysqlQuery(
        `UPDATE merchant_webhook_deliveries
         SET status = ?, last_error = ?, next_attempt_at = DATE_ADD(NOW(), INTERVAL ${retryDelay} SECOND)
         WHERE id = ?`,
        [retryState, message, deliveryId],
      );
    } else await db.execute(sql`
      UPDATE merchant_webhook_deliveries
      SET status = ${permanentlyFailed ? "failed" : "pending"},
          last_error = ${message},
          next_attempt_at = NOW() + (${permanentlyFailed ? 900 : delaySeconds} || ' seconds')::interval
      WHERE id = ${deliveryId}
    `);
    console.warn(
      `[MerchantWebhook] Delivery failed: ${message}` +
      (permanentlyFailed ? ` (permanent failure after ${maxAttempts} attempts)` : ` (retry in ${delaySeconds}s)`),
    );
  } finally {
    clearTimeout(timer);
  }
}

async function markRetry(deliveryId: string, message: string, delaySeconds: number): Promise<void> {
  if (isMysql) {
    await mysqlQuery(
      `UPDATE merchant_webhook_deliveries
       SET status = 'pending',
           last_error = ?,
           next_attempt_at = DATE_ADD(NOW(), INTERVAL ${delaySeconds} SECOND)
       WHERE id = ?`,
      [message, deliveryId],
    );
  } else await db.execute(sql`
    UPDATE merchant_webhook_deliveries
    SET status = 'pending',
        last_error = ${message},
        next_attempt_at = NOW() + (${delaySeconds} || ' seconds')::interval
    WHERE id = ${deliveryId}
  `);
  console.warn(`[MerchantWebhook] ${message} delivery=${deliveryId}`);
}

async function processDueMerchantWebhooks(): Promise<void> {
  for (let i = 0; i < 20; i++) {
    if (isMysql) {
      const due = await mysqlQuery(
        `SELECT id
         FROM merchant_webhook_deliveries
         WHERE status IN ('pending', 'delivering')
           AND delivered_at IS NULL
           AND next_attempt_at <= NOW()
         ORDER BY next_attempt_at ASC
         LIMIT 1`,
      );
      const id = due.rows[0]?.id;
      if (!id) break;
      await deliverMerchantWebhook(String(id));
      continue;
    }
    const due = await db.execute(sql`
      SELECT id
      FROM merchant_webhook_deliveries
      WHERE status IN ('pending', 'delivering')
        AND delivered_at IS NULL
        AND next_attempt_at <= NOW()
      ORDER BY next_attempt_at ASC
      LIMIT 1
    `);
    const id = (due.rows[0] as any)?.id;
    if (!id) break;
    await deliverMerchantWebhook(id);
  }
}

export function startMerchantWebhookWorker(): void {
  if (workerStarted) return;
  workerStarted = true;
  setInterval(() => {
    processDueMerchantWebhooks().catch(error =>
      console.error("[MerchantWebhook] Delivery worker error:", error?.message || error),
    );
  }, 15_000);
  processDueMerchantWebhooks().catch(error =>
    console.error("[MerchantWebhook] Initial delivery recovery error:", error?.message || error),
  );
}