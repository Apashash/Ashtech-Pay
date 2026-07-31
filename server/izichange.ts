import crypto from "crypto";

// ── Lazy getters — read process.env at CALL TIME, not at module load ─────────
// Critical: this file is imported (ESM-hoisted) BEFORE server/index.ts runs its
// .env loader. Module-level constants would be "" on Plesk/Passenger. Getters
// always see the value that was injected by the .env IIFE or by the OS env.
export function getIziPayApiKey(): string {
  return process.env.IZIPAY_API_KEY || "";
}
export function getIziPayWebhookSecret(): string {
  return process.env.IZIPAY_WEBHOOK_SECRET || "";
}
function getIziPayBaseUrl(): string {
  const key = getIziPayApiKey();
  return key.startsWith("sk_test_")
    ? "https://api.sandbox-pay.izichange.com"
    : "https://api.pay.izichange.com";
}

// Back-compat aliases used in routes.ts (keep so import doesn't break)
/** @deprecated use getIziPayApiKey() */
export const IZIPAY_API_KEY = "";          // always "" — do not rely on this
/** @deprecated use getIziPayWebhookSecret() */
export const IZIPAY_WEBHOOK_SECRET = "";   // always "" — do not rely on this

// ── Currency mapping ──────────────────────────────────────────────────────────
// Map internal platform codes → IziChange-supported fiat currencies.
const IZIPAY_FIAT_MAP: Record<string, string> = {
  XAF:  "XAF", XAFC: "XAF", XAFG: "XAF",
  XOF:  "XOF", XOFC: "XOF", XOFF: "XOF", XOFB: "XOF", XOFT: "XOF", XOFS: "XOF",
  NGN:  "NGN",
  GHS:  "GHS",
  KES:  "KES",
  CDF:  "XAF", // fallback — IziChange doesn't support CDF yet
};

export const IZIPAY_DEFAULT_CURRENCY = "XOF";

export function toIziPayCurrency(currency: string): string {
  return IZIPAY_FIAT_MAP[(currency ?? "").toUpperCase()] ?? IZIPAY_DEFAULT_CURRENCY;
}

export function isIziPayConfigured(): boolean {
  const key = getIziPayApiKey();
  return !!key &&
    key !== "sk_test_placeholder" &&
    !key.startsWith("sk_test_placeholder");
}

// ── Direct API helper (no SDK) ────────────────────────────────────────────────
async function iziRequest(
  method: string,
  path: string,
  body?: Record<string, unknown>,
  idempotencyKey?: string,
): Promise<any> {
  const headers: Record<string, string> = {
    Authorization:  `Bearer ${getIziPayApiKey()}`,
    "Content-Type": "application/json",
  };
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

  const res = await fetch(`${getIziPayBaseUrl()}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let json: any;
  try { json = await res.json(); } catch { json = {}; }

  if (!res.ok) {
    const msg = json?.message || `IziChange API error ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

// ── Payment Intents ───────────────────────────────────────────────────────────
export interface CreatePaymentIntentParams {
  requestedCurrencyType: "fiat" | "crypto";
  /** ISO currency code, e.g. "XOF", "XAF", "GHS" */
  currencyRequested: string;
  /** Amount as a decimal string in major units, e.g. "5000" (never centimes, never a JS number) */
  amountRequested: string;
  acceptedCoins?: string[];
  merchantReference?: string;
  metadata?: Record<string, unknown>;
  /** Explicit idempotency key — recommended; defaults to merchantReference */
  idempotencyKey?: string;
}

export interface PaymentIntentResult {
  id:         string;
  publicId:   string;
  paymentUrl: string;
  status:     string;
}

export async function createPaymentIntent(
  params: CreatePaymentIntentParams,
): Promise<PaymentIntentResult> {
  const { idempotencyKey, ...body } = params;
  return iziRequest(
    "POST",
    "/v1/payment-intents",
    body as Record<string, unknown>,
    idempotencyKey ?? params.merchantReference,
  );
}

// ── Direct Crypto Charge (`POST /v1/payment-intents/direct`) ─────────────────
// Returns a one-time deposit address for a specific coin/network.
// No sub-accounts (WaaS) needed — IziChange attributes the payment via merchantReference.

export interface DirectChargeParams {
  /** Coin + network, e.g. "USDT.TRC20", "BTC", "XRP", "TON" */
  requestedCoin: string;
  /** Amount in USDT as a decimal string, e.g. "100" */
  amount: string;
  customer?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    /** Refund address if the payment is cancelled */
    refundAddress?: string;
  };
  merchantReference?: string;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}

export interface DirectChargeResult {
  id: string;
  status: string;
  merchantReference?: string;
  /** Crypto address the payer must send to */
  address: string;
  /** Memo / destination tag (XRP, TON, XLM…) — null if not applicable */
  memo: string | null;
  memoType: string | null;
  requestedCoin: string;
  amount: string;
}

/**
 * Create a direct crypto charge.
 * IziChange generates a unique deposit address for this payment and fires
 * `payment_intent.completed` webhook once the payment is confirmed.
 */
export async function createDirectCharge(
  params: DirectChargeParams,
): Promise<DirectChargeResult> {
  const { idempotencyKey, ...body } = params;
  return iziRequest(
    "POST",
    "/v1/payment-intents/direct",
    body as Record<string, unknown>,
    idempotencyKey ?? params.merchantReference,
  );
}

// ── Webhook validation (manual HMAC-SHA256, toleranceSeconds = 5 min) ────────
export class IziPayWebhookError extends Error {
  constructor(public reason: string) {
    super(reason);
    this.name = "IziPayWebhookError";
  }
}

export function validateWebhook(
  rawBody:   Buffer | string,
  sigHeader: string | undefined,
  secret:    string,
  toleranceSeconds = 300,
): Record<string, any> {
  if (!sigHeader)                       throw new IziPayWebhookError("missing_signature");
  if (!sigHeader.startsWith("sha256=")) throw new IziPayWebhookError("malformed_signature");

  const provided = sigHeader.slice("sha256=".length);
  const raw      = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody);

  let expectedBuf: Buffer;
  try {
    expectedBuf = Buffer.from(
      crypto.createHmac("sha256", secret).update(raw).digest("hex"),
    );
  } catch {
    throw new IziPayWebhookError("invalid_signature");
  }

  let providedBuf: Buffer;
  try { providedBuf = Buffer.from(provided); } catch { throw new IziPayWebhookError("malformed_signature"); }

  if (
    providedBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(providedBuf, expectedBuf)
  ) {
    throw new IziPayWebhookError("invalid_signature");
  }

  let event: Record<string, any>;
  try { event = JSON.parse(raw.toString("utf8")); }
  catch { throw new IziPayWebhookError("invalid_body"); }

  const ts = event.timestamp as number | undefined;
  if (!ts) throw new IziPayWebhookError("missing_timestamp");

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > toleranceSeconds) throw new IziPayWebhookError("expired_timestamp");

  return event;
}
