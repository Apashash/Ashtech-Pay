import fs from "fs";
import path from "path";

// ─── Production endpoints (doc: Collection swychr api.md) ────────────────────
// Base URL changed from /swychpay/ to /payin/ per updated documentation
const SWYCHR_BASE_URL = "https://api.accountpe.com/api/payin";
const SWYCHR_EMAIL = process.env.SWYCHR_EMAIL || "";
const SWYCHR_PASSWORD = process.env.SWYCHR_PASSWORD || "";
const TOKEN_FILE = path.join(process.cwd(), ".local", "swychr_token.json");

// ─── Fee Rates (TARIFS ASHTECH PAY – PAYMENT COLLECTION) ────────────────────
// Swychr base fee + Ashtech 2% margin = total facturé client (simple addition)
export const SWYCHR_FEE_RATES: Record<string, number> = {
  CM: 2.50,  // Cameroun          → total client: 4.50%
  KE: 1.50,  // Kenya             → total client: 3.50%
  GA: 3.00,  // Gabon             → total client: 5.00%
  CD: 3.50,  // Congo DRC         → total client: 5.50%
  SN: 2.50,  // Sénégal           → total client: 4.50%
  CI: 3.00,  // Côte d'Ivoire     → total client: 5.00%
  BF: 3.00,  // Burkina Faso      → total client: 5.00%
  ML: 3.00,  // Mali              → total client: 5.00%
  BJ: 3.00,  // Bénin             → total client: 5.00%
  TG: 3.00,  // Togo              → total client: 5.00%
  TZ: 3.00,  // Tanzanie          → total client: 5.00%
  UG: 3.00,  // Ouganda           → total client: 5.00%
  NG: 2.00,  // Nigéria           → total client: 4.00%
  NE: 3.50,  // Niger             → total client: 5.50%
  RW: 3.75,  // Rwanda            → total client: 5.75%
  CG: 4.50,  // Congo Brazzaville → total client: 6.50%
  GN: 3.75,  // Guinée Conakry    → total client: 5.75%
  GH: 2.50,  // Ghana             → total client: 4.50%
  TD: 3.00,  // Tchad             → total client: 5.00%
  GQ: 3.00,  // Guinée équatoriale → total client: 5.00%
  GW: 3.00,  // Guinée-Bissau     → total client: 5.00%
  CF: 3.00,  // Centrafrique      → total client: 5.00%
};

export const ASHTECH_MARGIN = 2.0;

export function getSwychrFeeRate(countryCode: string): number {
  return SWYCHR_FEE_RATES[countryCode.toUpperCase()] ?? 3.0;
}

/**
 * Fee breakdown per tariff table (simple addition):
 *   totalRate      = swychrRate + ashtechMarginPct (default 2%)
 *   swychrFeeAmt   = gross × swychrRate%   (passed to client via pass_digital_charge)
 *   ashtechFeeAmt  = gross × ashtechMarginPct%
 *   creditedAmount = gross × (1 - totalRate%)
 *   amountToSwychr = gross - swychrFeeAmt  (what we send; Swychr adds its fee on top)
 *
 * Example CM (swychr 2.5%, ashtech 2%), gross = 1000 XAF:
 *   swychrFee=25, ashtechFee=20, totalFee=45 (4.5%), credited=955, toSwychr=975
 *
 * @param ashtechMarginPct - Ashtech margin % (from DB per operator, defaults to ASHTECH_MARGIN)
 */
export function computeSwychrFees(grossAmount: number, countryCode: string, ashtechMarginPct?: number) {
  const swychrFeeRate  = getSwychrFeeRate(countryCode);
  const ashtechFeeRate = ashtechMarginPct ?? ASHTECH_MARGIN;
  const totalFeeRate   = swychrFeeRate + ashtechFeeRate;

  const totalFeeAmount   = grossAmount * totalFeeRate   / 100;
  const swychrFeeAmount  = grossAmount * swychrFeeRate  / 100;
  const ashtechFeeAmount = grossAmount * ashtechFeeRate / 100;
  const creditedAmount   = grossAmount - totalFeeAmount;
  const amountToSwychr   = grossAmount - swychrFeeAmount;

  return {
    amountToSwychr:   Math.round(amountToSwychr   * 100) / 100,
    swychrFeeRate,
    ashtechFeeRate,
    totalFeeRate,
    swychrFeeAmount:  Math.round(swychrFeeAmount  * 100) / 100,
    ashtechFeeAmount: Math.round(ashtechFeeAmount * 100) / 100,
    totalFeeAmount:   Math.round(totalFeeAmount   * 100) / 100,
    creditedAmount:   Math.round(creditedAmount   * 100) / 100,
  };
}

// ─── Token management ─────────────────────────────────────────────────────────

let cachedToken: string | null = null;
let tokenExpiry: Date | null = null;

/** Force-clear the token cache so the next call re-authenticates. */
export function clearSwychrTokenCache(): void {
  cachedToken  = null;
  tokenExpiry  = null;
  try {
    if (fs.existsSync(TOKEN_FILE)) fs.unlinkSync(TOKEN_FILE);
  } catch { /* ignore */ }
  console.log("[Swychr] Token cache cleared — will re-authenticate on next request");
}

/** Returns true if the error looks like a token-invalidation response from Swychr. */
function isTokenInvalidError(msg?: string | null): boolean {
  if (!msg) return false;
  const lower = msg.toLowerCase();
  return lower.includes("security token") ||
         lower.includes("token is not valid") ||
         lower.includes("unauthorized") ||
         lower.includes("unauthenticated") ||
         lower.includes("token expired");
}

function parseJwtExp(token: string): Date | null {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
    if (payload.exp) return new Date(payload.exp * 1000);
  } catch {}
  return null;
}

function loadPersistedToken(): void {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      const d = JSON.parse(fs.readFileSync(TOKEN_FILE, "utf8"));
      if (d.token && d.expiry) {
        const exp = new Date(d.expiry);
        if (exp > new Date()) {
          cachedToken  = d.token;
          tokenExpiry  = exp;
          console.log("[Swychr] Loaded persisted token, valid until:", exp.toISOString());
        }
      }
    }
  } catch (e) {
    console.warn("[Swychr] Could not load persisted token:", e);
  }
}

function persistToken(token: string, expiry: Date): void {
  try {
    const dir = path.dirname(TOKEN_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(TOKEN_FILE, JSON.stringify({ token, expiry: expiry.toISOString() }), "utf8");
  } catch (e) {
    console.warn("[Swychr] Could not persist token:", e);
  }
}

loadPersistedToken();

/**
 * Doc: POST /admin/auth
 * Production: https://api.accountpe.com/api/payin/admin/auth
 * Response: { token, message, email }
 */
export async function getSwychrToken(): Promise<string> {
  if (cachedToken && tokenExpiry && new Date() < tokenExpiry) {
    return cachedToken;
  }
  if (!SWYCHR_EMAIL || !SWYCHR_PASSWORD) {
    throw new Error("Swychr non configuré — SWYCHR_EMAIL et SWYCHR_PASSWORD sont requis");
  }
  const res = await fetch(`${SWYCHR_BASE_URL}/admin/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: SWYCHR_EMAIL, password: SWYCHR_PASSWORD }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Swychr auth failed: ${res.status} ${text}`);
  }
  const json = await res.json();
  // Doc: token is at root level (not data.token)
  const token = json.token || json.data?.token;
  if (!token) throw new Error(`Swychr auth: no token in response`);
  const expiry = parseJwtExp(token) || new Date(Date.now() + 47 * 60 * 60 * 1000);
  cachedToken = token;
  tokenExpiry = expiry;
  persistToken(token, expiry);
  console.log("[Swychr] New token obtained, valid until:", expiry.toISOString());
  return cachedToken!;
}

// ─── Create payment link ──────────────────────────────────────────────────────

export interface SwychrCreateLinkParams {
  country_code: string;
  name: string;
  email: string;
  mobile?: string;
  grossAmount: number;
  currency: string;
  transaction_id: string;
  description?: string;
  callback_url?: string;
}

export interface SwychrCreateLinkResponse {
  success: boolean;
  data?: {
    id: number;
    payment_link: string;
    transaction_id: string;
  };
  fees?: ReturnType<typeof computeSwychrFees>;
  message?: string;
}

/**
 * Doc: POST /create_payment_links
 * Production: https://api.accountpe.com/api/payin/create_payment_links
 * Response: { data: { id, payment_link, transaction_id }, message, status }
 *
 * pass_digital_charge: true → Swychr adds its fee on top, client pays ~grossAmount
 */
async function doCreateSwychrPaymentLink(
  params: SwychrCreateLinkParams,
  token: string,
): Promise<{ res: Response; data: any }> {
  const fees = computeSwychrFees(params.grossAmount, params.country_code);
  console.log(
    `[Swychr] Creating link: gross=${params.grossAmount}, swychrFee=${fees.swychrFeeAmount}, ` +
    `ashtechFee=${fees.ashtechFeeAmount}, credited=${fees.creditedAmount}, totalFee=${fees.totalFeeRate}%`
  );
  const res = await fetch(`${SWYCHR_BASE_URL}/create_payment_links`, {
    method: "POST",
    headers: {
      "Content-Type":    "application/json",
      "Authorization":   `Bearer ${token}`,
      "Idempotency-Key": params.transaction_id,
    },
    body: JSON.stringify({
      country_code:        params.country_code,
      name:                params.name,
      email:               params.email,
      mobile:              params.mobile,
      amount:              params.grossAmount,
      currency:            params.currency,
      transaction_id:      params.transaction_id,
      description:         params.description,
      pass_digital_charge: false,
      callback_url:        params.callback_url,
    }),
  });
  const data = await res.json();
  return { res, data };
}

export async function createSwychrPaymentLink(
  params: SwychrCreateLinkParams
): Promise<SwychrCreateLinkResponse> {
  try {
    const fees = computeSwychrFees(params.grossAmount, params.country_code);
    let token = await getSwychrToken();
    let { res, data } = await doCreateSwychrPaymentLink(params, token);

    // ── Auto-retry if Swychr signals the token is invalid/revoked ─────────────
    if ((!res.ok || !data.data?.id) && (res.status === 401 || isTokenInvalidError(data?.message))) {
      console.warn(`[Swychr] Token rejected (${res.status} — "${data?.message}") — clearing cache and retrying…`);
      clearSwychrTokenCache();
      token = await getSwychrToken();
      ({ res, data } = await doCreateSwychrPaymentLink(params, token));
    }

    if (!res.ok || !data.data?.id) {
      console.error("[Swychr] Create link failed:", JSON.stringify(data));
      return { success: false, message: data.message || data.errors?.[0]?.detail || `HTTP ${res.status}` };
    }

    const id           = data.data.id as number;
    const payment_link = data.data.payment_link as string;

    console.log(`[Swychr] Payment link created: id=${id}, url=${payment_link}`);
    return {
      success: true,
      data: { id, payment_link, transaction_id: params.transaction_id },
      fees,
      message: data.message,
    };
  } catch (err: any) {
    console.error("[Swychr] createSwychrPaymentLink error:", err.message);
    return { success: false, message: err.message };
  }
}

// ─── Check payment status ─────────────────────────────────────────────────────

export interface SwychrStatusResponse {
  success: boolean;
  status?: "pending" | "completed" | "failed";
  rawStatus?: number | null;
  data?: any;
  message?: string;
}

/**
 * Doc: POST /payment_link_status
 * Production: https://api.accountpe.com/api/payin/payment_link_status
 * Body: { transaction_id }
 * Response: { data: { data: { attributes: { status, ... } } }, message, status:200 }
 *
 * Status values:
 *   0 = pending (waiting for payment)
 *   1 = completed (payment received)
 *   2 = failed/expired
 */
async function doCheckSwychrStatus(transaction_id: string, token: string) {
  const res = await fetch(`${SWYCHR_BASE_URL}/payment_link_status`, {
    method:  "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify({ transaction_id }),
  });
  const json = await res.json().catch(() => ({}));
  return { res, json };
}

export async function checkSwychrPaymentStatus(
  transaction_id: string
): Promise<SwychrStatusResponse> {
  try {
    let token = await getSwychrToken();
    let { res, json } = await doCheckSwychrStatus(transaction_id, token);

    // ── Auto-retry on token invalidation ──────────────────────────────────────
    if (!res.ok && (res.status === 401 || isTokenInvalidError(json?.message))) {
      console.warn(`[Swychr] Status check token rejected — clearing cache and retrying…`);
      clearSwychrTokenCache();
      token = await getSwychrToken();
      ({ res, json } = await doCheckSwychrStatus(transaction_id, token));
    }

    if (!res.ok) {
      return { success: false, message: `HTTP ${res.status}` };
    }

    const attrs = json.data?.data?.attributes;
    if (!attrs) {
      return { success: true, status: "pending", rawStatus: null, data: {} };
    }

    const rawStatus = typeof attrs.status === "number" ? attrs.status : null;
    return {
      success:   true,
      status:    mapRawStatus(rawStatus),
      rawStatus,
      data:      attrs,
    };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

function mapRawStatus(raw: number | null): "pending" | "completed" | "failed" {
  if (raw === 1) return "completed";
  if (raw === 2 || raw === 3) return "failed"; // 2=failed, 3=refunded (YAML spec)
  return "pending"; // 0 or null = pending
}

// ─── Re-export for backward compat (checkout page fallback) ──────────────────

export interface SwychrPaymentDetails {
  transactionId: string;
  netPayable: number;
  currency: string;
  description: string;
  name: string;
  email: string;
  mobile: string;
  adminName: string;
  adminEmail: string;
  paymentLink: string;
}

/**
 * Fetch payment details for a transaction using the documented status endpoint.
 * Doc: POST /payment_link_status → attributes include all link metadata.
 */
export async function fetchPaymentLinkDetails(
  transaction_id: string
): Promise<SwychrPaymentDetails | null> {
  try {
    let token = await getSwychrToken();
    let res = await fetch(`${SWYCHR_BASE_URL}/payment_link_status`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ transaction_id }),
    });

    // ── Auto-retry on token invalidation ──────────────────────────────────────
    if (!res.ok && res.status === 401) {
      clearSwychrTokenCache();
      token = await getSwychrToken();
      res = await fetch(`${SWYCHR_BASE_URL}/payment_link_status`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ transaction_id }),
      });
    }

    if (!res.ok) return null;
    const json  = await res.json();
    const attrs = json.data?.data?.attributes;
    if (!attrs) return null;
    return {
      transactionId: attrs.transaction_id || transaction_id,
      netPayable:    parseFloat(attrs.net_payable) || 0,
      currency:      attrs.currency_code  || "XAF",
      description:   attrs.description   || "",
      name:          attrs.name           || "",
      email:         attrs.email          || "",
      mobile:        attrs.mobile         || "",
      adminName:     attrs.admin_name     || "Ashtech Pay",
      adminEmail:    attrs.admin_email    || "",
      paymentLink:   attrs.payment_uuid   || "",
    };
  } catch {
    return null;
  }
}
