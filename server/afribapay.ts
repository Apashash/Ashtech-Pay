import path from "path";
import fs from "fs";

// ─── AfribaPay Production Credentials ────────────────────────────────────────
const AFRIBAPAY_PUBLIC_KEY  = process.env.AFRIBAPAY_PUBLIC_KEY  || "pk_live_2603110746342dls1P3";
const AFRIBAPAY_SECRET_KEY  = process.env.AFRIBAPAY_SECRET_KEY  || "sk_live_AFP110326PG00HSfXSeCPb9bxX4zOhw";
const AFRIBAPAY_MERCHANT_KEY = process.env.AFRIBAPAY_MERCHANT_KEY || "mk_live_260311074634zkO";
const AFRIBAPAY_AGENT_ID    = process.env.AFRIBAPAY_AGENT_ID    || "APM6232659";

const AFRIBAPAY_PAYIN_URL   = "https://api.afribapay.com";
const AFRIBAPAY_PAYOUT_URL  = "https://api-payout.afribapay.com";

const TOKEN_FILE = path.join(process.cwd(), ".local", "afribapay_token.json");

// ─── Token cache ──────────────────────────────────────────────────────────────
let cachedToken: string | null = null;
let tokenExpiry: Date | null = null;

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
    throw new Error(`AfribaPay auth failed: ${data.error?.message || JSON.stringify(data)}`);
  }

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
}

export interface AfribaPayinResult {
  success: boolean;
  transaction_id?: string;
  order_id?: string;
  status?: string;
  message?: string;
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
      return_url: "",
      cancel_url: "",
    };

    console.log(`[AfribaPay Payin] Initiating ${params.amount} ${params.currency} for ${params.phone_number} (${params.operator}/${params.country})`);

    const res = await fetch(`${AFRIBAPAY_PAYIN_URL}/v1/pay/payin`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const data = await res.json();
    console.log(`[AfribaPay Payin] Response:`, JSON.stringify(data));

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

    console.log(`[AfribaPay Payout] Initiating ${params.amount} ${params.currency} to ${params.phone_number} (${params.operator}/${params.country})`);

    const res = await fetch(`${AFRIBAPAY_PAYOUT_URL}/v1/pay/payout`, {
      method: "POST",
      headers: payoutHeaders,
      body: JSON.stringify(body),
    });

    const data = await res.json();
    console.log(`[AfribaPay Payout] Response:`, JSON.stringify(data));

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

// ─── Check status ─────────────────────────────────────────────────────────────
export async function checkAfribaPayStatus(
  identifier: string,
  type: "order_id" | "transaction_id" = "order_id"
): Promise<{ status: "completed" | "failed" | "pending"; raw?: any }> {
  try {
    const headers = await authHeaders();
    const param = type === "transaction_id" ? `transaction_id=${identifier}` : `order_id=${identifier}`;
    const res = await fetch(`${AFRIBAPAY_PAYIN_URL}/v1/status?${param}`, { headers });
    const data = await res.json();

    const d = data.data;
    const status = (d?.status || "").toUpperCase();

    if (status === "SUCCESS" || status === "COMPLETED" || status === "SUCCESSFUL") {
      return { status: "completed", raw: data };
    } else if (status === "FAILED" || status === "ERROR" || status === "CANCELLED") {
      return { status: "failed", raw: data };
    }
    return { status: "pending", raw: data };
  } catch (err: any) {
    console.error("[AfribaPay Status] Error:", err);
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
