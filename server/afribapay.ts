import path from "path";
import fs from "fs";
import crypto from "crypto";
import { encryptField, decryptField, isFieldEncryptionConfigured } from "./fieldEncryption";
import { appPath } from "./appPaths";

// ─── AfribaPay Production Credentials ────────────────────────────────────────
const AFRIBAPAY_PAYIN_URL   = "https://api.afribapay.com";
const AFRIBAPAY_PAYOUT_URL  = "https://api-payout.afribapay.com";

const TOKEN_FILE = appPath(".local", "afribapay_token.json");
const TOKEN_REFRESH_SKEW_MS = 60_000;
const TOKEN_FALLBACK_TTL_MS = 15 * 60_000;
const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;
const PROVIDER_TIMEOUT_MESSAGE = "Le service de paiement n'a pas répondu dans le délai prévu. Veuillez réessayer.";

function isAbortError(error: unknown): boolean {
  const candidate = error as { name?: unknown; code?: unknown; message?: unknown } | null;
  return candidate?.name === "AbortError"
    || candidate?.code === "ABORT_ERR"
    || /aborted|abort/i.test(String(candidate?.message || ""));
}

export const AFRIBAPAY_MIN_PAYIN_AMOUNT = 100;
// AfribaPay's public docs currently state both 2,000,000 and 2,500,000 for
// PAYIN. Use the lower documented ceiling until the provider confirms which
// limit is authoritative.
export const AFRIBAPAY_MAX_PAYIN_AMOUNT = 2_000_000;

function getAfribaPayCredentials() {
  return {
    publicKey: process.env.AFRIBAPAY_PUBLIC_KEY
      || process.env.AFRIBAPAY_API_KEY
      || process.env.AFRIBAPAY_CLIENT_ID
      || "",
    secretKey: process.env.AFRIBAPAY_SECRET_KEY
      || process.env.AFRIBAPAY_API_SECRET
      || process.env.AFRIBAPAY_CLIENT_SECRET
      || "",
    merchantKey: process.env.AFRIBAPAY_MERCHANT_KEY || "",
    agentId: process.env.AFRIBAPAY_AGENT_ID || "",
  };
}

export function isAfribaPayConfigured(): boolean {
  const credentials = getAfribaPayCredentials();
  return Boolean(credentials.publicKey && credentials.secretKey);
}

// ─── PII masking helpers for logs ──────────────────────────────────────────────
// Avoid printing full phone numbers / emails in server logs (GDPR / PII hygiene).
function maskPhone(phone: string | undefined | null): string {
  if (!phone) return String(phone);
  const s = String(phone);
  return s.length <= 4 ? "***" : `${s.slice(0, 3)}***${s.slice(-2)}`;
}
function maskEmail(email: string | undefined | null): string {
  if (!email) return String(email);
  const [user, domain] = String(email).split("@");
  if (!domain) return "***";
  return `${user.slice(0, 2)}***@${domain}`;
}
function maskPiiInObject(obj: any): any {
  if (!obj || typeof obj !== "object") return obj;
  const clone: any = Array.isArray(obj) ? [...obj] : { ...obj };
  for (const key of Object.keys(clone)) {
    const lower = key.toLowerCase();
    if (typeof clone[key] === "string" && (lower.includes("phone") || lower.includes("msisdn"))) {
      clone[key] = maskPhone(clone[key]);
    } else if (typeof clone[key] === "string" && lower.includes("email")) {
      clone[key] = maskEmail(clone[key]);
    } else if (clone[key] && typeof clone[key] === "object") {
      clone[key] = maskPiiInObject(clone[key]);
    }
  }
  return clone;
}

// ─── Token cache ──────────────────────────────────────────────────────────────
let cachedToken: string | null = null;
let tokenExpiry: Date | null = null;
let tokenRefreshPromise: Promise<string> | null = null;
let tokenRefreshTimer: NodeJS.Timeout | null = null;

// ─── Circuit breaker ──────────────────────────────────────────────────────────
// After CIRCUIT_BREAK_AFTER consecutive auth failures, stop retrying for
// CIRCUIT_RESET_MS milliseconds. Prevents the poller from flooding logs with
// a stack trace every 3 seconds when the subscription is invalid/inactive.
const CIRCUIT_BREAK_AFTER = 3;
const CIRCUIT_RESET_MS = 30 * 60 * 1000; // 30 minutes
let authFailures = 0;
let circuitOpenUntil: number | null = null;

export function isAfribaPayCircuitOpen(): boolean {
  if (circuitOpenUntil === null) return false;
  if (Date.now() > circuitOpenUntil) {
    circuitOpenUntil = null;
    authFailures = 0;
    console.log("[AfribaPay] Circuit breaker reset — will retry auth");
    return false;
  }
  return true;
}

function recordAuthFailure(raw: string) {
  authFailures++;
  if (authFailures >= CIRCUIT_BREAK_AFTER && circuitOpenUntil === null) {
    circuitOpenUntil = Date.now() + CIRCUIT_RESET_MS;
    console.error(`[AfribaPay Auth] Circuit OPEN after ${authFailures} failures (${raw}). Will retry in 30 min.`);
  } else if (authFailures < CIRCUIT_BREAK_AFTER) {
    console.error(`[AfribaPay Auth] Failed (${authFailures}/${CIRCUIT_BREAK_AFTER}): ${raw}`);
  }
  // When circuit is already open, stay silent to avoid log flooding
}

function loadCachedToken() {
  if (!isFieldEncryptionConfigured()) return;
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      const encrypted = fs.readFileSync(TOKEN_FILE, "utf-8");
      if (!encrypted.startsWith("enc:")) {
        // Legacy versions wrote this file in cleartext. Never reuse that token.
        clearCachedTokenFile();
        return;
      }
      const decrypted = decryptField(encrypted);
      if (!decrypted) return;
      const data = JSON.parse(decrypted);
      if (data.token && data.expiry && new Date(data.expiry) > new Date(Date.now() + TOKEN_REFRESH_SKEW_MS)) {
        cachedToken = data.token;
        tokenExpiry = new Date(data.expiry);
        scheduleTokenRefresh(tokenExpiry);
      }
    }
  } catch {}
}

function saveCachedToken(token: string, expiry: Date) {
  // Never persist a bearer token in cleartext. Without the project encryption
  // key, keep the cache in memory only.
  if (!isFieldEncryptionConfigured()) return;
  try {
    fs.mkdirSync(path.dirname(TOKEN_FILE), { recursive: true });
    const encrypted = encryptField(JSON.stringify({ token, expiry: expiry.toISOString() }));
    if (!encrypted) return;
    fs.writeFileSync(TOKEN_FILE, encrypted, { encoding: "utf-8", mode: 0o600 });
    try { fs.chmodSync(TOKEN_FILE, 0o600); } catch {}
  } catch {}
}

function clearCachedTokenFile() {
  try { fs.unlinkSync(TOKEN_FILE); } catch {}
}

function scheduleTokenRefresh(expiry: Date) {
  if (tokenRefreshTimer) clearTimeout(tokenRefreshTimer);
  const delay = Math.max(1_000, expiry.getTime() - Date.now() - TOKEN_REFRESH_SKEW_MS);
  tokenRefreshTimer = setTimeout(() => {
    tokenRefreshTimer = null;
    void getAfribaPayToken().catch((err: any) => {
      console.error("[AfribaPay Auth] Background token refresh failed:", err?.message || err);
    });
  }, delay);
  tokenRefreshTimer.unref?.();
}

loadCachedToken();

// ─── Get token ────────────────────────────────────────────────────────────────
export async function getAfribaPayToken(): Promise<string> {
  if (cachedToken && tokenExpiry && tokenExpiry > new Date(Date.now() + TOKEN_REFRESH_SKEW_MS)) {
    return cachedToken;
  }

  if (tokenRefreshPromise) return tokenRefreshPromise;

  tokenRefreshPromise = refreshAfribaPayToken();
  try {
    return await tokenRefreshPromise;
  } finally {
    tokenRefreshPromise = null;
  }
}

async function refreshAfribaPayToken(): Promise<string> {
  if (isAfribaPayCircuitOpen()) {
    throw new Error("AfribaPay circuit open — authentication retry paused temporarily");
  }

  const { publicKey, secretKey } = getAfribaPayCredentials();
  if (!publicKey || !secretKey) {
    throw new Error("AfribaPay API credentials are not configured");
  }

  const encoded = Buffer.from(`${publicKey}:${secretKey}`).toString("base64");
  const controller = new AbortController();
  const timeoutMs = Number(process.env.AFRIBAPAY_REQUEST_TIMEOUT_MS);
  const requestTimeoutMs = Number.isFinite(timeoutMs) && timeoutMs >= 1_000 && timeoutMs <= 120_000
    ? timeoutMs
    : DEFAULT_REQUEST_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), requestTimeoutMs);
  let res: Response;
  let data: any;
  try {
    res = await fetch(`${AFRIBAPAY_PAYIN_URL}/v1/token`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Authorization": `Basic ${encoded}`,
        "Content-Type": "application/json",
      },
    });
    data = await res.json();
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok || !data.data?.access_token) {
    const raw = data.error?.message || data.message || JSON.stringify(data).slice(0, 120);
    recordAuthFailure(raw);
    const friendly = (raw.toLowerCase().includes("subscription invalid") || raw.toLowerCase().includes("subscription inactive"))
      ? "Ce service de paiement est temporairement indisponible. Veuillez réessayer plus tard ou contacter le support."
      : raw;
    throw new Error(friendly || `AfribaPay auth failed: ${raw}`);
  }

  // Successful auth — reset circuit breaker
  authFailures = 0;
  circuitOpenUntil = null;
  cachedToken = data.data.access_token;
  const expiresAt = data.data.expires_at || data.expires_at || data.data.expiresAt;
  const expiresIn = Number(data.data.expires_in ?? data.expires_in);
  const parsedExpiry = expiresAt ? new Date(expiresAt) : new Date(Date.now() + (
    Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn * 1_000 : TOKEN_FALLBACK_TTL_MS
  ));
  tokenExpiry = Number.isNaN(parsedExpiry.getTime())
    ? new Date(Date.now() + TOKEN_FALLBACK_TTL_MS)
    : parsedExpiry;
  saveCachedToken(cachedToken!, tokenExpiry);
  scheduleTokenRefresh(tokenExpiry);
  return cachedToken!;
}

export function invalidateAfribaPayToken() {
  cachedToken = null;
  tokenExpiry = null;
  if (tokenRefreshTimer) clearTimeout(tokenRefreshTimer);
  tokenRefreshTimer = null;
  clearCachedTokenFile();
  // A token rejection means the cached token is stale. Allow a clean
  // authentication attempt immediately; real auth failures still trip the
  // normal circuit breaker in refreshAfribaPayToken().
  authFailures = 0;
  circuitOpenUntil = null;
}

// ─── Common headers ───────────────────────────────────────────────────────────
async function authHeaders() {
  const token = await getAfribaPayToken();
  const { merchantKey, agentId } = getAfribaPayCredentials();
  return {
    "Authorization": `Bearer ${token}`,
    "X-Merchant-Key": merchantKey,
    "X-Agent-ID": agentId,
    "Content-Type": "application/json",
  };
}

function isInvalidSecurityToken(res: Response, data: any, rawText: string): boolean {
  const message = [
    typeof data === "string" ? data : "",
    data?.message,
    data?.error?.message,
    data?.error,
    data?.data?.message,
  ].filter(Boolean).join(" ").toLowerCase();
  return res.status === 401
    || message.includes("security token is not valid")
    || message.includes("invalid security token")
    || message.includes("token has expired")
    || message.includes("jwt expired")
    || rawText.toLowerCase().includes("security token is not valid");
}

async function fetchAfribaPayJson(
  url: string,
  init: RequestInit = {},
): Promise<{ res: Response; data: any }> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const headers = await authHeaders();
    const controller = new AbortController();
    const timeoutMs = Number(process.env.AFRIBAPAY_REQUEST_TIMEOUT_MS);
    const requestTimeoutMs = Number.isFinite(timeoutMs) && timeoutMs >= 1_000 && timeoutMs <= 120_000
      ? timeoutMs
      : DEFAULT_REQUEST_TIMEOUT_MS;
    const timer = setTimeout(() => controller.abort(), requestTimeoutMs);
    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
        headers: {
          ...headers,
          ...(init.headers as Record<string, string> | undefined),
        },
      });
      const rawText = await response.text();
      let data: any;
      try { data = rawText ? JSON.parse(rawText) : null; } catch { data = rawText; }

      if (attempt === 0 && isInvalidSecurityToken(response, data, rawText)) {
        console.warn("[AfribaPay Auth] Provider rejected the bearer token; refreshing and retrying once.");
        invalidateAfribaPayToken();
        continue;
      }
      return { res: response, data };
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error("AfribaPay authentication failed after token refresh");
}

export function validateAfribaPayinAmount(amount: number): string | undefined {
  if (!Number.isFinite(amount) || amount < AFRIBAPAY_MIN_PAYIN_AMOUNT) {
    return `Le montant AfribaPay doit être supérieur ou égal à ${AFRIBAPAY_MIN_PAYIN_AMOUNT}.`;
  }
  if (amount > AFRIBAPAY_MAX_PAYIN_AMOUNT) {
    return `Le montant AfribaPay doit être inférieur ou égal à ${AFRIBAPAY_MAX_PAYIN_AMOUNT}.`;
  }
  return undefined;
}

/**
 * AfribaPay documents an HMAC-SHA256 signature over the exact raw request body
 * in the `AfribaPAY-Sign` header. The provider's API key is the secret used
 * for this signature (the server-side secret credential, never a client key).
 */
export function verifyAfribaPayWebhookSignature(
  rawBody: Buffer | string | undefined,
  signature: string | string[] | undefined,
  apiKey?: string,
  timestamp?: string,
): boolean {
  if (!rawBody || !signature || Array.isArray(signature)) return false;
  const secret = apiKey || getAfribaPayCredentials().secretKey;
  if (!secret) return false;
  const received = signature.trim().replace(/^sha256=/i, "");
  if (!/^[a-f0-9]{64}$/i.test(received)) return false;
  const receivedBuffer = Buffer.from(received, "hex");
  const bodyBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody);
  const signedMessages = [bodyBuffer];
  if (timestamp?.trim()) {
    const timestampValue = timestamp.trim();
    // AfribaPay's published callback examples use both raw-body and
    // timestamp-prefixed signing descriptions. Keep all accepted variants
    // server-side and require the same secret/HMAC for each one.
    signedMessages.push(
      Buffer.from(`${timestampValue}${bodyBuffer.toString("utf8")}`),
      Buffer.from(`${timestampValue}.${bodyBuffer.toString("utf8")}`),
      Buffer.from(`${timestampValue}/${bodyBuffer.toString("utf8")}`),
    );
  }
  return signedMessages.some(message => {
    const expected = crypto.createHmac("sha256", secret).update(message).digest("hex");
    const expectedBuffer = Buffer.from(expected, "hex");
    return receivedBuffer.length === expectedBuffer.length
      && crypto.timingSafeEqual(receivedBuffer, expectedBuffer);
  });
}

// ─── Fetch countries (from AfribaPay) ────────────────────────────────────────
export interface AfribaPayCountry {
  country_code: string;
  country_name: string;
  country_flag: string;
  prefix: string;
  taxes: string;
  currencies: Record<string, {
    currency: string;
    operators: Array<{
      operator_code: string;
      operator_name: string;
      otp_required: number;
      ussd_code: string;
      wallet: number;
    }>;
  }>;
}

export async function fetchAfribaPayCountries(): Promise<Record<string, AfribaPayCountry>> {
  const { res, data } = await fetchAfribaPayJson(`${AFRIBAPAY_PAYIN_URL}/v1/countries`);
  if (!res.ok || data.error) {
    throw new Error(`AfribaPay countries failed: ${data.error?.message || JSON.stringify(data)}`);
  }
  return data.data as Record<string, AfribaPayCountry>;
}

// ─── Payin ───────────────────────────────────────────────────────────────────
export interface AfribaPayinParams {
  operator: string;
  country: string;      // ISO country code e.g. "CM"
  phone_number: string; // without country prefix e.g. "656000000"
  amount: number;
  currency: string;     // e.g. "XAF"
  order_id: string;     // unique reference from our side
  reference_id?: string;
  lang?: string;
  notify_url?: string;
  return_url?: string;  // redirect URL after Wave/wallet payment
  cancel_url?: string;
}

export interface AfribaPayinResult {
  success: boolean;
  transaction_id?: string;
  order_id?: string;
  status?: string;
  message?: string;
  provider_link?: string; // Wave/wallet redirect URL (e.g. https://pay.wave.com/c/...)
  providerCode?: string;
  providerStatus?: number;
  raw?: any;
}

export async function initiateAfribaPayin(params: AfribaPayinParams): Promise<AfribaPayinResult> {
  try {
    const amountError = validateAfribaPayinAmount(params.amount);
    if (amountError) {
      return {
        success: false,
        message: amountError,
        providerCode: "amount_out_of_range",
        providerStatus: 422,
      };
    }
    const { merchantKey } = getAfribaPayCredentials();
    const body = {
      operator: params.operator,
      country: params.country,
      phone_number: params.phone_number,
      amount: params.amount,
      currency: params.currency,
      order_id: params.order_id,
      merchant_key: merchantKey,
      reference_id: params.reference_id || params.order_id,
      lang: params.lang || "fr",
      notify_url: params.notify_url || "",
      return_url: params.return_url || "",
      cancel_url: params.cancel_url || "",
    };

    console.log(`[AfribaPay Payin] Initiating ${params.amount} ${params.currency} (${params.operator}/${params.country})`);

    const { res, data } = await fetchAfribaPayJson(`${AFRIBAPAY_PAYIN_URL}/v1/pay/payin`, {
      method: "POST",
      body: JSON.stringify(body),
    });

    console.log(`[AfribaPay Payin] Response:`, JSON.stringify(maskPiiInObject(data)));

    if (!res.ok || data.error) {
      // AfribaPay error shape: { "error": "server_error", "message": "..." }
      // data.error is a string code, not an object — read data.message for the human text.
      return {
        success: false,
        message: data.error?.message || data.message || data.data?.message || "Erreur AfribaPay",
        providerCode: typeof data.error === "string" ? data.error : (typeof data.code === "string" ? data.code : undefined),
        providerStatus: res.status,
        raw: data,
      };
    }

    const d = data.data;
    if (d?.status === "FAILED" || d?.status === "ERROR") {
      return {
        success: false,
        message: d.message || "Échec AfribaPay",
        providerCode: typeof d.code === "string" ? d.code : undefined,
        providerStatus: res.status,
        raw: data,
      };
    }

    return {
      success: true,
      transaction_id: d?.transaction_id,
      order_id: d?.order_id,
      status: d?.status || "PENDING",
      provider_link: d?.provider_link || undefined,
      raw: data,
    };
  } catch (err: any) {
    console.error("[AfribaPay Payin] Error:", err);
    return isAbortError(err)
      ? {
          success: false,
          message: PROVIDER_TIMEOUT_MESSAGE,
          providerCode: "provider_timeout",
          providerStatus: 504,
        }
      : { success: false, message: err.message || "Erreur réseau de paiement" };
  }
}

// ─── Payout ───────────────────────────────────────────────────────────────────
export interface AfribaPayoutParams {
  operator: string;
  country: string;
  phone_number: string;
  amount: number;
  currency: string;
  order_id: string;
  reference_id?: string;
  lang?: string;
  notify_url?: string;
}

export interface AfribaPayoutResult {
  success: boolean;
  transaction_id?: string;
  order_id?: string;
  status?: string;
  message?: string;
  providerCode?: string;
  providerStatus?: number;
  raw?: any;
}

export function resolveAfribaPayPayoutOrderId(
  providerOrderId: string | null | undefined,
  submittedOrderId: string,
): string {
  return providerOrderId?.trim() || submittedOrderId.trim();
}

export async function initiateAfribaPayout(params: AfribaPayoutParams): Promise<AfribaPayoutResult> {
  try {
    const { merchantKey } = getAfribaPayCredentials();

    const body = {
      operator: params.operator,
      country: params.country,
      phone_number: params.phone_number,
      amount: params.amount,
      currency: params.currency,
      order_id: params.order_id,
      merchant_key: merchantKey,
      reference_id: params.reference_id || params.order_id,
      lang: params.lang || "fr",
      notify_url: params.notify_url || "",
      return_url: "",
      cancel_url: "",
    };

    console.log(`[AfribaPay Payout] Initiating ${params.amount} ${params.currency} (${params.operator}/${params.country})`);

    const { res, data } = await fetchAfribaPayJson(`${AFRIBAPAY_PAYOUT_URL}/v1/pay/payout`, {
      method: "POST",
      body: JSON.stringify(body),
    });

    console.log(`[AfribaPay Payout] Response:`, JSON.stringify(maskPiiInObject(data)));

    if (!res.ok || data.error) {
      return {
        success: false,
        transaction_id: data.data?.transaction_id,
        order_id: data.data?.order_id,
        message: data.error?.message || data.message || data.data?.message || "Erreur payout AfribaPay",
        providerCode: typeof data.error === "string" ? data.error : (typeof data.code === "string" ? data.code : undefined),
        providerStatus: res.status,
        raw: data,
      };
    }

    const d = data.data;
    const payoutStatus = String(d?.status || "").toUpperCase();
    if (["FAILED", "ERROR", "REJECTED", "CANCELLED", "EXPIRED", "NOT_FOUND", "NOT FOUND"].includes(payoutStatus)) {
      return {
        success: false,
        transaction_id: d?.transaction_id,
        order_id: d?.order_id,
        message: d.message || "Échec payout AfribaPay",
        status: payoutStatus,
        providerCode: typeof d.code === "string" ? d.code : undefined,
        providerStatus: res.status,
        raw: data,
      };
    }

    return {
      success: true,
      transaction_id: d?.transaction_id,
      order_id: d?.order_id,
      status: payoutStatus || "PENDING",
      raw: data,
    };
  } catch (err: any) {
    console.error("[AfribaPay Payout] Error:", err);
    return { success: false, message: err.message || "Erreur réseau lors de l'envoi Mobile Money" };
  }
}

// ─── Check payin status (deposits / payment links) ────────────────────────────
export async function checkAfribaPayStatus(
  identifier: string,
  type: "order_id" | "transaction_id" = "order_id"
): Promise<{ status: "completed" | "failed" | "pending"; raw?: any }> {
  try {
    const param = type === "transaction_id" ? `transaction_id=${identifier}` : `order_id=${identifier}`;
    const url = `${AFRIBAPAY_PAYIN_URL}/v1/status?${param}`;
    const { res, data } = await fetchAfribaPayJson(url);

    const d = data.data;
    const rawStatus = (d?.status || d?.transaction_status || "").toUpperCase();
    console.log(`[AfribaPay PayinStatus] ${param} → HTTP ${res.status} | raw_status="${rawStatus}" | data=${JSON.stringify(maskPiiInObject(d))}`);

    return { status: classifyAfribaPayinStatus(res.status, rawStatus), raw: data };
  } catch (err: any) {
    console.error("[AfribaPay PayinStatus] Error:", err);
    return { status: "pending" };
  }
}

export function classifyAfribaPayinStatus(
  httpStatus: number,
  providerStatus: string | undefined,
): "completed" | "failed" | "pending" {
  // Lookup failures are not payment failures; only a successful status
  // response may carry a terminal pay-in state.
  if (httpStatus < 200 || httpStatus >= 300) return "pending";
  const status = String(providerStatus || "").toUpperCase();
  if (["SUCCESS", "COMPLETED", "SUCCESSFUL", "PAID", "APPROVED"].includes(status)) {
    return "completed";
  }
  if (["FAILED", "CANCELLED", "REJECTED", "EXPIRED"].includes(status)) {
    return "failed";
  }
  return "pending";
}

export function resolveAfribaPayPayinTransactionId(
  providerReference: string | null | undefined,
  ashtechReference: string,
): string | null {
  const normalized = providerReference?.trim();
  return normalized && normalized !== ashtechReference ? normalized : null;
}

const AFRIBAPAY_ORDER_ID_FALLBACK_AFTER_MS = 24 * 60 * 60 * 1000;

export function shouldCheckAfribaPayOrderIdFallback(
  transactionIdStatus: "completed" | "failed" | "pending",
  startedAt: number,
  now = Date.now(),
): boolean {
  return transactionIdStatus === "pending"
    && now - startedAt >= AFRIBAPAY_ORDER_ID_FALLBACK_AFTER_MS;
}

export function classifyAfribaPayoutStatus(
  httpStatus: number,
  providerStatus: string | undefined,
): "completed" | "failed" | "pending" {
  // Only successful status lookups can confirm a terminal state. HTTP errors
  // and generic ERROR values do not prove that a payout was rejected.
  if (httpStatus < 200 || httpStatus >= 300) return "pending";

  const status = String(providerStatus || "").toUpperCase();
  if (["SUCCESS", "COMPLETED", "SUCCESSFUL", "PAID", "APPROVED", "PROCESSED"].includes(status)) {
    return "completed";
  }
  if (["FAILED", "CANCELLED", "REJECTED", "EXPIRED"].includes(status)) {
    return "failed";
  }
  // NOT_FOUND is not treated as terminal until AfribaPay confirms that
  // transaction-level NOT_FOUND differs from its documented non-final HTTP 404.
  return "pending";
}

// ─── Check payout status (withdrawals / transfers) ────────────────────────────
export async function checkAfribaPayoutStatus(
  identifier: string,
  type: "order_id" | "transaction_id" = "order_id"
): Promise<{ status: "completed" | "failed" | "pending"; raw?: any }> {
  try {
    const param = type === "transaction_id" ? `transaction_id=${identifier}` : `order_id=${identifier}`;
    const url = `${AFRIBAPAY_PAYOUT_URL}/v1/status?${param}`;
    const { res, data } = await fetchAfribaPayJson(url);

    const d = data.data;
    const rawStatus = (d?.status || d?.transaction_status || d?.payout_status || "").toUpperCase();
    console.log(`[AfribaPay PayoutStatus] ${param} → HTTP ${res.status} | raw_status="${rawStatus}" | data=${JSON.stringify(maskPiiInObject(d))}`);

    return { status: classifyAfribaPayoutStatus(res.status, rawStatus), raw: data };
  } catch (err: any) {
    console.error("[AfribaPay PayoutStatus] Error:", err);
    return { status: "pending" };
  }
}

// ─── Fee computation ──────────────────────────────────────────────────────────
export const AFRIBAPAY_DEFAULT_MARGIN = 2.0; // Ashtech default margin %

export function computeAfribaPayFees(
  grossAmount: number,
  afribapayFeeRate: number,   // AfribaPay's fee %
  ashtechMarginPct: number = AFRIBAPAY_DEFAULT_MARGIN
) {
  const totalFeeRate = afribapayFeeRate + ashtechMarginPct;
  const totalFeeAmount    = grossAmount * totalFeeRate / 100;
  const afribapayFeeAmount = grossAmount * afribapayFeeRate / 100;
  const ashtechFeeAmount  = grossAmount * ashtechMarginPct / 100;
  const creditedAmount    = grossAmount - totalFeeAmount;

  return {
    afribapayFeeRate,
    ashtechFeeRate: ashtechMarginPct,
    totalFeeRate,
    afribapayFeeAmount: Math.round(afribapayFeeAmount * 100) / 100,
    ashtechFeeAmount:   Math.round(ashtechFeeAmount   * 100) / 100,
    totalFeeAmount:     Math.round(totalFeeAmount     * 100) / 100,
    creditedAmount:     Math.round(creditedAmount     * 100) / 100,
  };
}

// ─── Get balance ──────────────────────────────────────────────────────────────
export async function getAfribaPayBalance(): Promise<any> {
  try {
    const { data } = await fetchAfribaPayJson(`${AFRIBAPAY_PAYIN_URL}/v1/balance`);
    return data.data || data;
  } catch (err: any) {
    console.error("[AfribaPay Balance] Error:", err);
    return null;
  }
}

// ─── Countries cache for OTP detection ────────────────────────────────────────
let _countriesCache: Record<string, AfribaPayCountry> | null = null;
let _countriesCacheExpiry: number = 0;
let _countriesFetchFailed = false;

async function getCachedCountries(): Promise<Record<string, AfribaPayCountry>> {
  if (_countriesCache && Date.now() < _countriesCacheExpiry) return _countriesCache;
  try {
    _countriesCache = await fetchAfribaPayCountries();
    _countriesCacheExpiry = Date.now() + 24 * 60 * 60 * 1000; // 24h
    _countriesFetchFailed = false;
  } catch (err: any) {
    // IMPORTANT: do NOT silently pretend nothing needs OTP when this call fails —
    // that previously caused Orange/Moov (which DO require OTP) to be sent through
    // the plain payin flow, get rejected by AfribaPay with "This operation requires
    // an OTP code.", and surface as an opaque 502/400 with no OTP UI shown at all.
    _countriesFetchFailed = true;
    console.error("[AfribaPay] Failed to fetch /v1/countries for OTP detection — falling back to static OTP overrides only:", err?.message || err);
    _countriesCache = _countriesCache || {};
  }
  return _countriesCache;
}

// ─── Static OTP-required overrides ────────────────────────────────────────────
// Source of truth: AfribaPay /v1/countries API (verified 2026-07).
// Used as a typed fallback when the live API is unreachable or returns stale data.
//
// type "ussd" = user must dial the USSD code to obtain OTP, then submit it.
// type "api"  = AfribaPay sends the OTP by SMS via POST /v1/pay/otp (otp_code: "").
//
// Only operators with otp_required: 1 in the live API belong here.
// DO NOT add operators that are otp_required: 0 (e.g. CI/moov, BF/moov, GN/orange).
const AFRIBAPAY_STATIC_OTP_TABLE: Record<string, Record<string, { type: "api" | "ussd"; ussdCode: string }>> = {
  BF: {
    orange:     { type: "ussd", ussdCode: "*144*4*6*montant#" },
    wligdicash: { type: "api",  ussdCode: "" },
  },
  CI: {
    orange: { type: "ussd", ussdCode: "#144*82#" },
  },
  SN: {
    orange: { type: "ussd", ussdCode: "#144*391#" },
  },
  // GN/orange → otp_required: 0 per live API — NOT in this table.
  // CI/moov   → otp_required: 0 per live API — NOT in this table.
  // BF/moov   → otp_required: 0 per live API — NOT in this table.
};

function staticOtpEntry(country: string, operatorCode: string): { type: "api" | "ussd"; ussdCode: string } | null {
  return AFRIBAPAY_STATIC_OTP_TABLE[country.toUpperCase()]?.[operatorCode.toLowerCase()] ?? null;
}

/** True if an AfribaPay error message is the upstream "OTP required" rejection. */
export function isAfribaPayOtpRequiredMessage(message: string | undefined | null): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return m.includes("otp") && (m.includes("require") || m.includes("requis") || m.includes("necessit") || m.includes("nécessit"));
}

export async function isAfribaPayOtpRequired(country: string, operatorCode: string): Promise<boolean> {
  const info = await getAfribaPayOtpInfo(country, operatorCode);
  return info.required;
}

export async function getAfribaPayOtpInfo(country: string, operatorCode: string): Promise<{
  required: boolean;
  type: "api" | "ussd" | "none";
  ussdCode: string;
}> {
  const staticEntry = staticOtpEntry(country, operatorCode);
  try {
    const countries = await getCachedCountries();
    const countryData = countries[country.toUpperCase()];
    if (countryData) {
      for (const [, curData] of Object.entries(countryData.currencies)) {
        const op = curData.operators.find(o => o.operator_code === operatorCode.toLowerCase());
        if (op) {
          if (op.otp_required !== 1) {
            // Live API says not required — trust it. The static table is only for
            // operators confirmed as otp_required:1, so no override needed here.
            return { required: false, type: "none", ussdCode: "" };
          }
          // Detect type from ussd_code field:
          //   "endpoint" or "/pay/otp" → AfribaPay sends SMS (api)
          //   otherwise               → user dials the USSD code themselves (ussd)
          const isApiOtp = !op.ussd_code
            || op.ussd_code.toLowerCase().includes("endpoint")
            || op.ussd_code.toLowerCase().includes("/pay/otp");
          const liveUssdCode = isApiOtp ? "" : op.ussd_code;
          return {
            required: true,
            type: isApiOtp ? "api" : "ussd",
            // Prefer static USSD code if live one is missing/empty — static table
            // has the exact dial strings from the official AfribaPay docs.
            ussdCode: liveUssdCode || staticEntry?.ussdCode || "",
          };
        }
      }
    }
    // Operator not found in live data — fall back to the static table.
    // This preserves correct type/ussdCode even when the live API is down.
    if (staticEntry) return { required: true, type: staticEntry.type, ussdCode: staticEntry.ussdCode };
    return { required: false, type: "none", ussdCode: "" };
  } catch (err: any) {
    console.error(`[AfribaPay] getAfribaPayOtpInfo(${country}, ${operatorCode}) failed:`, err?.message || err);
    if (staticEntry) return { required: true, type: staticEntry.type, ussdCode: staticEntry.ussdCode };
    return { required: false, type: "none", ussdCode: "" };
  }
}

// ─── OTP initiation (POST /v1/pay/otp with empty otp_code — sends SMS) ──────
// AfribaPay requires otp_code to be present in the body (even empty "") to
// distinguish initiation from confirmation. Without it the endpoint returns 500.
export async function initiateAfribaPayOtp(params: Omit<AfribaPayinParams, "return_url" | "cancel_url">): Promise<{
  success: boolean;
  message?: string;
  providerCode?: string;
  providerStatus?: number;
  raw?: any;
}> {
  try {
    const amountError = validateAfribaPayinAmount(params.amount);
    if (amountError) {
      return {
        success: false,
        message: amountError,
        providerCode: "amount_out_of_range",
        providerStatus: 422,
      };
    }
    const { merchantKey } = getAfribaPayCredentials();
    const body = {
      operator: params.operator,
      country: params.country,
      phone_number: params.phone_number,
      amount: params.amount,
      currency: params.currency,
      order_id: params.order_id,
      merchant_key: merchantKey,
      reference_id: params.reference_id || params.order_id,
      lang: params.lang || "fr",
      notify_url: params.notify_url || "",
      otp_code: "",   // Required by AfribaPay even for initiation; empty = "send SMS"
    };

    console.log(`[AfribaPay OTP Init] Sending OTP SMS: ${params.amount} ${params.currency} (${params.operator}/${params.country})`);

    const { res, data } = await fetchAfribaPayJson(`${AFRIBAPAY_PAYIN_URL}/v1/pay/otp`, {
      method: "POST",
      body: JSON.stringify(body),
    });

    console.log(`[AfribaPay OTP Init] Response status=${res.status} body=${JSON.stringify(maskPiiInObject(data))}`);

    // Treat any non-2xx as failure (previously only >= 500 was checked,
    // which meant 4xx errors were silently treated as success — a bug that
    // caused the OTP screen to appear even when no SMS was sent).
    if (!res.ok) {
      const errObj = typeof data === "object" ? data : null;
      // AfribaPay error shape: { "error": "server_error", "message": "..." }
      // data.error is a string code — read data.message for the human-readable text.
      const msg = errObj?.error?.message || errObj?.message || errObj?.data?.message
        || (typeof data === "string" && data.length < 200 ? data : null)
        || `Échec d'envoi du code OTP (HTTP ${res.status})`;
      console.error(`[AfribaPay OTP Init] FAILED status=${res.status} msg="${msg}"`);
      return {
        success: false,
        message: msg,
        providerCode: typeof errObj?.error === "string" ? errObj.error : (typeof errObj?.code === "string" ? errObj.code : undefined),
        providerStatus: res.status,
        raw: data,
      };
    }

    return { success: true, raw: data };
  } catch (err: any) {
    console.error("[AfribaPay OTP Init] Error:", err);
    return isAbortError(err)
      ? {
          success: false,
          message: PROVIDER_TIMEOUT_MESSAGE,
          providerCode: "provider_timeout",
          providerStatus: 504,
        }
      : { success: false, message: err.message || "Erreur réseau OTP" };
  }
}

// ─── OTP confirmation (POST /v1/pay/payin with otp_code) ─────────────────────
// Per AfribaPay docs: step 1 = POST /v1/pay/otp (sends SMS, otp_code:"")
//                    step 2 = POST /v1/pay/payin WITH otp_code filled
// Do NOT call /v1/pay/otp again for confirmation — it must go to /v1/pay/payin.
export interface AfribaPayOtpParams {
  operator: string;
  country: string;
  phone_number: string;
  amount: number;
  currency: string;
  order_id: string;
  reference_id?: string;
  otp_code: string;
  notify_url?: string;
  return_url?: string;
  cancel_url?: string;
  lang?: string;
}

export async function confirmAfribaPayOtp(params: AfribaPayOtpParams): Promise<AfribaPayinResult> {
  try {
    const amountError = validateAfribaPayinAmount(params.amount);
    if (amountError) {
      return {
        success: false,
        message: amountError,
        providerCode: "amount_out_of_range",
        providerStatus: 422,
      };
    }
    const { merchantKey } = getAfribaPayCredentials();
    const body = {
      operator: params.operator,
      country: params.country,
      phone_number: params.phone_number,
      amount: params.amount,
      currency: params.currency,
      order_id: params.order_id,
      merchant_key: merchantKey,
      reference_id: params.reference_id || params.order_id,
      otp_code: params.otp_code,
      notify_url: params.notify_url || "",
      return_url: params.return_url || "",
      cancel_url: params.cancel_url || "",
      lang: params.lang || "fr",
    };

    console.log(`[AfribaPay OTP Confirm] Calling /v1/pay/payin with otp_code for order_id=${params.order_id} operator=${params.operator}`);

    const { res, data } = await fetchAfribaPayJson(`${AFRIBAPAY_PAYIN_URL}/v1/pay/payin`, {
      method: "POST",
      body: JSON.stringify(body),
    });

    console.log(`[AfribaPay OTP Confirm] Response status=${res.status} body=${JSON.stringify(maskPiiInObject(data))}`);

    if (!res.ok) {
      const errObj = typeof data === "object" ? data : null;
      // AfribaPay error shape: { "error": "server_error", "message": "..." }
      // data.error is a string code — read data.message for the human-readable text.
      const msg = errObj?.error?.message || errObj?.message || errObj?.data?.message
        || (typeof data === "string" && data.length < 200 ? data : null)
        || "Code OTP invalide ou expiré";
      return {
        success: false,
        message: msg,
        providerCode: typeof errObj?.error === "string" ? errObj.error : (typeof errObj?.code === "string" ? errObj.code : undefined),
        providerStatus: res.status,
        raw: data,
      };
    }

    const d = data?.data;
    if (d?.status === "FAILED" || d?.status === "ERROR") {
      return {
        success: false,
        message: d?.message || "OTP rejeté par l'opérateur",
        providerCode: typeof d?.code === "string" ? d.code : undefined,
        providerStatus: res.status,
        raw: data,
      };
    }

    return {
      success: true,
      transaction_id: d?.transaction_id,
      order_id: d?.order_id,
      status: d?.status || "PENDING",
      raw: data,
    };
  } catch (err: any) {
    console.error("[AfribaPay OTP Confirm] Error:", err);
    return isAbortError(err)
      ? {
          success: false,
          message: PROVIDER_TIMEOUT_MESSAGE,
          providerCode: "provider_timeout",
          providerStatus: 504,
        }
      : { success: false, message: err.message || "Erreur réseau OTP" };
  }
}

export function isRetryableAfribaOtpRejection(result: {
  message?: string | null;
  providerCode?: string | null;
}): boolean {
  const code = String(result.providerCode || "").toLowerCase();
  if (/(invalid|incorrect|expired|otp).*(otp|code|invalid|incorrect|expired)|otp_(invalid|expired|incorrect)/.test(code)) {
    return true;
  }

  const message = String(result.message || "");
  const mentionsOtp = /(otp|one[-\s]?time|verification code|\bcode\b)/i.test(message);
  const rejectsCode = /(invalid|incorrect|wrong|expired|expire|invalide|faux|rejet|reject|refus)/i.test(message);
  return mentionsOtp && rejectsCode;
}

// ─── Parse AfribaPay webhook ──────────────────────────────────────────────────
export function parseAfribaPayWebhook(payload: any): {
  order_id?: string;
  reference_id?: string;
  transaction_id?: string;
  status: "completed" | "failed" | "pending";
} {
  const d = payload?.data || payload;
  const statusRaw = (d?.status || d?.transaction_status || d?.payment_status || "").toUpperCase();

  let status: "completed" | "failed" | "pending" = "pending";
  if (statusRaw === "SUCCESS" || statusRaw === "COMPLETED" || statusRaw === "SUCCESSFUL"
      || statusRaw === "PAID" || statusRaw === "APPROVED" || statusRaw === "PROCESSED") {
    status = "completed";
  } else if (statusRaw === "FAILED" || statusRaw === "ERROR" || statusRaw === "CANCELLED"
      || statusRaw === "REJECTED" || statusRaw === "EXPIRED") {
    status = "failed";
  }

  return {
    order_id: d?.order_id,
    reference_id: d?.reference_id,
    transaction_id: d?.transaction_id,
    status,
  };
}
