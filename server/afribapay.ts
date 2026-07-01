import path from "path";
import fs from "fs";

// ─── AfribaPay Production Credentials ────────────────────────────────────────
const AFRIBAPAY_PUBLIC_KEY  = process.env.AFRIBAPAY_PUBLIC_KEY!;
const AFRIBAPAY_SECRET_KEY  = process.env.AFRIBAPAY_SECRET_KEY!;
const AFRIBAPAY_MERCHANT_KEY = process.env.AFRIBAPAY_MERCHANT_KEY!;
const AFRIBAPAY_AGENT_ID    = process.env.AFRIBAPAY_AGENT_ID!;

const AFRIBAPAY_PAYIN_URL   = "https://api.afribapay.com";
const AFRIBAPAY_PAYOUT_URL  = "https://api-payout.afribapay.com";

const TOKEN_FILE = path.join(process.cwd(), ".local", "afribapay_token.json");

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
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      const data = JSON.parse(fs.readFileSync(TOKEN_FILE, "utf-8"));
      if (data.token && data.expiry && new Date(data.expiry) > new Date(Date.now() + 60_000)) {
        cachedToken = data.token;
        tokenExpiry = new Date(data.expiry);
      }
    }
  } catch {}
}

function saveCachedToken(token: string, expiry: Date) {
  try {
    fs.mkdirSync(path.dirname(TOKEN_FILE), { recursive: true });
    fs.writeFileSync(TOKEN_FILE, JSON.stringify({ token, expiry: expiry.toISOString() }));
  } catch {}
}

loadCachedToken();

// ─── Get token ────────────────────────────────────────────────────────────────
export async function getAfribaPayToken(): Promise<string> {
  if (cachedToken && tokenExpiry && tokenExpiry > new Date(Date.now() + 60_000)) {
    return cachedToken;
  }

  // Circuit open — don't make HTTP calls, fail silently
  if (isAfribaPayCircuitOpen()) {
    throw new Error("AfribaPay circuit open — subscription invalid, retry paused for 30 min");
  }

  const encoded = Buffer.from(`${AFRIBAPAY_PUBLIC_KEY}:${AFRIBAPAY_SECRET_KEY}`).toString("base64");
  const res = await fetch(`${AFRIBAPAY_PAYIN_URL}/v1/token`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${encoded}`,
      "Content-Type": "application/json",
    },
  });

  const data = await res.json();
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
  tokenExpiry = new Date(data.data.expires_at);
  saveCachedToken(cachedToken!, tokenExpiry);
  return cachedToken!;
}

// ─── Common headers ───────────────────────────────────────────────────────────
async function authHeaders() {
  const token = await getAfribaPayToken();
  return {
    "Authorization": `Bearer ${token}`,
    "X-Merchant-Key": AFRIBAPAY_MERCHANT_KEY,
    "X-Agent-ID": AFRIBAPAY_AGENT_ID,
    "Content-Type": "application/json",
  };
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
  const headers = await authHeaders();
  const res = await fetch(`${AFRIBAPAY_PAYIN_URL}/v1/countries`, { headers });
  const data = await res.json();
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
  raw?: any;
}

export async function initiateAfribaPayin(params: AfribaPayinParams): Promise<AfribaPayinResult> {
  try {
    const headers = await authHeaders();
    const body = {
      operator: params.operator,
      country: params.country,
      phone_number: params.phone_number,
      amount: params.amount,
      currency: params.currency,
      order_id: params.order_id,
      merchant_key: AFRIBAPAY_MERCHANT_KEY,
      reference_id: params.reference_id || params.order_id,
      lang: params.lang || "fr",
      notify_url: params.notify_url || "",
      return_url: params.return_url || "",
      cancel_url: params.cancel_url || "",
    };

    console.log(`[AfribaPay Payin] Initiating ${params.amount} ${params.currency} for ${maskPhone(params.phone_number)} (${params.operator}/${params.country})`);

    const res = await fetch(`${AFRIBAPAY_PAYIN_URL}/v1/pay/payin`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const data = await res.json();
    console.log(`[AfribaPay Payin] Response:`, JSON.stringify(maskPiiInObject(data)));

    if (!res.ok || data.error) {
      return { success: false, message: data.error?.message || data.data?.message || "Erreur AfribaPay", raw: data };
    }

    const d = data.data;
    if (d?.status === "FAILED" || d?.status === "ERROR") {
      return { success: false, message: d.message || "Échec AfribaPay", raw: data };
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
    return { success: false, message: err.message || "Erreur réseau AfribaPay" };
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
  raw?: any;
}

export async function initiateAfribaPayout(params: AfribaPayoutParams): Promise<AfribaPayoutResult> {
  try {
    const headers = await authHeaders();
    const payoutHeaders = {
      ...headers,
      "Authorization": headers["Authorization"],
    };

    const body = {
      operator: params.operator,
      country: params.country,
      phone_number: params.phone_number,
      amount: params.amount,
      currency: params.currency,
      order_id: params.order_id,
      merchant_key: AFRIBAPAY_MERCHANT_KEY,
      reference_id: params.reference_id || params.order_id,
      lang: params.lang || "fr",
      notify_url: params.notify_url || "",
      return_url: "",
      cancel_url: "",
    };

    console.log(`[AfribaPay Payout] Initiating ${params.amount} ${params.currency} to ${maskPhone(params.phone_number)} (${params.operator}/${params.country})`);

    const res = await fetch(`${AFRIBAPAY_PAYOUT_URL}/v1/pay/payout`, {
      method: "POST",
      headers: payoutHeaders,
      body: JSON.stringify(body),
    });

    const data = await res.json();
    console.log(`[AfribaPay Payout] Response:`, JSON.stringify(maskPiiInObject(data)));

    if (!res.ok || data.error) {
      return { success: false, message: data.error?.message || data.data?.message || "Erreur payout AfribaPay", raw: data };
    }

    const d = data.data;
    if (d?.status === "FAILED" || d?.status === "ERROR") {
      return { success: false, message: d.message || "Échec payout AfribaPay", raw: data };
    }

    return {
      success: true,
      transaction_id: d?.transaction_id,
      order_id: d?.order_id,
      status: d?.status || "PENDING",
      raw: data,
    };
  } catch (err: any) {
    console.error("[AfribaPay Payout] Error:", err);
    return { success: false, message: err.message || "Erreur réseau AfribaPay payout" };
  }
}

// ─── Check payin status (deposits / payment links) ────────────────────────────
export async function checkAfribaPayStatus(
  identifier: string,
  type: "order_id" | "transaction_id" = "order_id"
): Promise<{ status: "completed" | "failed" | "pending"; raw?: any }> {
  try {
    const headers = await authHeaders();
    const param = type === "transaction_id" ? `transaction_id=${identifier}` : `order_id=${identifier}`;
    const url = `${AFRIBAPAY_PAYIN_URL}/v1/status?${param}`;
    const res = await fetch(url, { headers });
    const data = await res.json();

    const d = data.data;
    const rawStatus = (d?.status || d?.transaction_status || "").toUpperCase();
    console.log(`[AfribaPay PayinStatus] ${param} → HTTP ${res.status} | raw_status="${rawStatus}" | data=${JSON.stringify(maskPiiInObject(d))}`);

    if (rawStatus === "SUCCESS" || rawStatus === "COMPLETED" || rawStatus === "SUCCESSFUL"
        || rawStatus === "PAID" || rawStatus === "APPROVED") {
      return { status: "completed", raw: data };
    } else if (rawStatus === "FAILED" || rawStatus === "ERROR" || rawStatus === "CANCELLED"
               || rawStatus === "REJECTED" || rawStatus === "EXPIRED") {
      return { status: "failed", raw: data };
    }
    return { status: "pending", raw: data };
  } catch (err: any) {
    console.error("[AfribaPay PayinStatus] Error:", err);
    return { status: "pending" };
  }
}

// ─── Check payout status (withdrawals / transfers) ────────────────────────────
export async function checkAfribaPayoutStatus(
  identifier: string,
  type: "order_id" | "transaction_id" = "order_id"
): Promise<{ status: "completed" | "failed" | "pending"; raw?: any }> {
  try {
    const headers = await authHeaders();
    const param = type === "transaction_id" ? `transaction_id=${identifier}` : `order_id=${identifier}`;
    const url = `${AFRIBAPAY_PAYOUT_URL}/v1/status?${param}`;
    const res = await fetch(url, { headers });
    const data = await res.json();

    const d = data.data;
    const rawStatus = (d?.status || d?.transaction_status || d?.payout_status || "").toUpperCase();
    console.log(`[AfribaPay PayoutStatus] ${param} → HTTP ${res.status} | raw_status="${rawStatus}" | data=${JSON.stringify(maskPiiInObject(d))}`);

    if (rawStatus === "SUCCESS" || rawStatus === "COMPLETED" || rawStatus === "SUCCESSFUL"
        || rawStatus === "PAID" || rawStatus === "APPROVED" || rawStatus === "PROCESSED") {
      return { status: "completed", raw: data };
    } else if (rawStatus === "FAILED" || rawStatus === "ERROR" || rawStatus === "CANCELLED"
               || rawStatus === "REJECTED" || rawStatus === "EXPIRED") {
      return { status: "failed", raw: data };
    }
    return { status: "pending", raw: data };
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
    const headers = await authHeaders();
    const res = await fetch(`${AFRIBAPAY_PAYIN_URL}/v1/balance`, { headers });
    const data = await res.json();
    return data.data || data;
  } catch (err: any) {
    console.error("[AfribaPay Balance] Error:", err);
    return null;
  }
}

// ─── Countries cache for OTP detection ────────────────────────────────────────
let _countriesCache: Record<string, AfribaPayCountry> | null = null;
let _countriesCacheExpiry: number = 0;

async function getCachedCountries(): Promise<Record<string, AfribaPayCountry>> {
  if (_countriesCache && Date.now() < _countriesCacheExpiry) return _countriesCache;
  try {
    _countriesCache = await fetchAfribaPayCountries();
    _countriesCacheExpiry = Date.now() + 24 * 60 * 60 * 1000; // 24h
  } catch {
    _countriesCache = _countriesCache || {};
  }
  return _countriesCache;
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
  try {
    const countries = await getCachedCountries();
    const countryData = countries[country.toUpperCase()];
    if (!countryData) return { required: false, type: "none", ussdCode: "" };
    for (const [, curData] of Object.entries(countryData.currencies)) {
      const op = curData.operators.find(o => o.operator_code === operatorCode.toLowerCase());
      if (op) {
        if (op.otp_required !== 1) return { required: false, type: "none", ussdCode: "" };
        // Detect type: if ussd_code references AfribaPay endpoint → API OTP (AfribaPay sends SMS)
        // Otherwise → USSD OTP (user dials the code themselves to get OTP)
        const isApiOtp = !op.ussd_code || op.ussd_code.toLowerCase().includes("endpoint") || op.ussd_code.toLowerCase().includes("/pay/otp");
        return {
          required: true,
          type: isApiOtp ? "api" : "ussd",
          ussdCode: isApiOtp ? "" : op.ussd_code,
        };
      }
    }
    return { required: false, type: "none", ussdCode: "" };
  } catch {
    return { required: false, type: "none", ussdCode: "" };
  }
}

// ─── OTP initiation (POST /v1/pay/otp WITHOUT otp_code — sends SMS) ─────────
export async function initiateAfribaPayOtp(params: Omit<AfribaPayinParams, "return_url" | "cancel_url">): Promise<{ success: boolean; message?: string; raw?: any }> {
  try {
    const headers = await authHeaders();
    const body = {
      operator: params.operator,
      country: params.country,
      phone_number: params.phone_number,
      amount: params.amount,
      currency: params.currency,
      order_id: params.order_id,
      merchant_key: AFRIBAPAY_MERCHANT_KEY,
      reference_id: params.reference_id || params.order_id,
      lang: params.lang || "fr",
      notify_url: params.notify_url || "",
    };

    console.log(`[AfribaPay OTP Init] Sending OTP SMS: ${params.amount} ${params.currency} for ${maskPhone(params.phone_number)} (${params.operator}/${params.country})`);

    const res = await fetch(`${AFRIBAPAY_PAYIN_URL}/v1/pay/otp`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    let data: any = null;
    const text = await res.text();
    try { data = JSON.parse(text); } catch { data = text; }
    console.log(`[AfribaPay OTP Init] Response status=${res.status} body=${JSON.stringify(maskPiiInObject(data))}`);

    // AfribaPay returns "" (empty string) or 2xx on success — treat non-5xx as success
    if (res.status >= 500) {
      const msg = (typeof data === "object" && data?.error?.message) || "Échec d'envoi du code OTP";
      return { success: false, message: msg, raw: data };
    }

    return { success: true, raw: data };
  } catch (err: any) {
    console.error("[AfribaPay OTP Init] Error:", err);
    return { success: false, message: err.message || "Erreur réseau OTP" };
  }
}

// ─── OTP confirmation (POST /v1/pay/otp with otp_code) ────────────────────────
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
}

export async function confirmAfribaPayOtp(params: AfribaPayOtpParams): Promise<AfribaPayinResult> {
  try {
    const headers = await authHeaders();
    const body = {
      operator: params.operator,
      country: params.country,
      phone_number: params.phone_number,
      amount: params.amount,
      currency: params.currency,
      order_id: params.order_id,
      merchant_key: AFRIBAPAY_MERCHANT_KEY,
      reference_id: params.reference_id || params.order_id,
      otp_code: params.otp_code,
      notify_url: params.notify_url || "",
    };

    console.log(`[AfribaPay OTP] Confirming OTP for order_id=${params.order_id} operator=${params.operator}`);

    const res = await fetch(`${AFRIBAPAY_PAYIN_URL}/v1/pay/otp`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const data = await res.json();
    console.log(`[AfribaPay OTP] Response:`, JSON.stringify(maskPiiInObject(data)));

    if (!res.ok || data.error) {
      return { success: false, message: data.error?.message || "Code OTP invalide ou expiré", raw: data };
    }

    const d = data.data;
    if (d?.status === "FAILED" || d?.status === "ERROR") {
      return { success: false, message: d?.message || "OTP rejeté par l'opérateur", raw: data };
    }

    return {
      success: true,
      transaction_id: d?.transaction_id,
      order_id: d?.order_id,
      status: d?.status || "PENDING",
      raw: data,
    };
  } catch (err: any) {
    console.error("[AfribaPay OTP] Error:", err);
    return { success: false, message: err.message || "Erreur réseau OTP" };
  }
}

// ─── Parse AfribaPay webhook ──────────────────────────────────────────────────
export function parseAfribaPayWebhook(payload: any): {
  order_id?: string;
  transaction_id?: string;
  status: "completed" | "failed" | "pending";
} {
  const d = payload?.data || payload;
  const statusRaw = (d?.status || "").toUpperCase();

  let status: "completed" | "failed" | "pending" = "pending";
  if (statusRaw === "SUCCESS" || statusRaw === "COMPLETED" || statusRaw === "SUCCESSFUL") {
    status = "completed";
  } else if (statusRaw === "FAILED" || statusRaw === "ERROR" || statusRaw === "CANCELLED") {
    status = "failed";
  }

  return {
    order_id: d?.order_id,
    transaction_id: d?.transaction_id,
    status,
  };
}
