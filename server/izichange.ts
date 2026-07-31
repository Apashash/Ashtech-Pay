import crypto from "crypto";

export const IZIPAY_API_KEY     = process.env.IZIPAY_API_KEY     || "";
export const IZIPAY_WEBHOOK_SECRET = process.env.IZIPAY_WEBHOOK_SECRET || "";

// Derive base URL from key prefix (sk_test_ → sandbox, sk_live_ → production)
const IZIPAY_BASE_URL = IZIPAY_API_KEY.startsWith("sk_test_")
  ? "https://api.sandbox-pay.izichange.com"
  : "https://api.pay.izichange.com";

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
  return !!IZIPAY_API_KEY &&
    IZIPAY_API_KEY !== "sk_test_placeholder" &&
    !IZIPAY_API_KEY.startsWith("sk_test_placeholder");
}

// ── Direct API helper (no SDK) ────────────────────────────────────────────────
async function iziRequest(
  method: string,
  path: string,
  body?: Record<string, unknown>,
  idempotencyKey?: string,
): Promise<any> {
  const headers: Record<string, string> = {
    Authorization:  `Bearer ${IZIPAY_API_KEY}`,
    "Content-Type": "application/json",
  };
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

  const res = await fetch(`${IZIPAY_BASE_URL}${path}`, {
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

// ── Wallet-as-a-Service (WaaS) ────────────────────────────────────────────────

export interface WaaSAccount {
  id: string;
  label: string;
  externalRef?: string;
  status: string;
  createdAt: string;
}

export interface WaaSDepositAddress {
  address: string;
  assetCode: string;
  memo: string | null;
  memoType: string | null;
  shared: boolean;
}

/** Create a sub-wallet for a user. externalRef = your internal userId (unique). */
export async function createWaaSAccount(
  externalRef: string,
  label: string,
  email?: string,
): Promise<WaaSAccount> {
  return iziRequest("POST", "/v1/accounts", {
    label,
    externalRef,
    ...(email ? { email } : {}),
  });
}

/** Retrieve a sub-wallet by its IziChange id. */
export async function getWaaSAccount(accountId: string): Promise<WaaSAccount> {
  return iziRequest("GET", `/v1/accounts/${accountId}`);
}

/**
 * Find an existing sub-wallet by externalRef (returns null if not found).
 * Uses the list endpoint with externalRef filter.
 */
export async function findWaaSAccountByExternalRef(
  externalRef: string,
): Promise<WaaSAccount | null> {
  try {
    const result = await iziRequest(
      "GET",
      `/v1/accounts?externalRef=${encodeURIComponent(externalRef)}&limit=1`,
    );
    return (result?.data as WaaSAccount[])?.[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Get the permanent deposit address for a (sub-wallet, assetCode) pair.
 * assetCode examples: "USDT.BEP20", "USDT.TRC20", "BTC", "XRP", "TON"
 */
export async function getWaaSDepositAddress(
  accountId: string,
  assetCode: string,
): Promise<WaaSDepositAddress> {
  return iziRequest("GET", `/v1/accounts/${accountId}/addresses/${assetCode}`);
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
