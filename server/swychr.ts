import fs from "fs";
import path from "path";

// Production base URL for Swychr API
const SWYCHR_BASE_URL = "https://api.accountpe.com/api";
const SWYCHR_EMAIL = process.env.SWYCHR_EMAIL || "";
const SWYCHR_PASSWORD = process.env.SWYCHR_PASSWORD || "";
const TOKEN_FILE = path.join(process.cwd(), ".local", "swychr_token.json");

// ─── Fee Rates (from official Ashtech Pay tariff table) ─────────────────────
// Source: "Collection swychr api.md" – TARIFS ASHTECH PAY – PAYMENT COLLECTION
// Swychr base fee + Ashtech 2% margin = total charged to client
// pass_digital_charge: true → Swychr adds its fee on top, client pays gross amount
export const SWYCHR_FEE_RATES: Record<string, number> = {
  CM: 2.50,  // Cameroun        → total client: 4.50%
  KE: 1.50,  // Kenya           → total client: 3.50%
  GA: 3.00,  // Gabon           → total client: 5.00%
  CD: 3.50,  // Congo DRC       → total client: 5.50%
  SN: 2.50,  // Sénégal         → total client: 4.50%
  CI: 3.00,  // Côte d'Ivoire   → total client: 5.00%
  BF: 3.00,  // Burkina Faso    → total client: 5.00%
  ML: 3.00,  // Mali            → total client: 5.00%
  BJ: 3.00,  // Bénin           → total client: 5.00%
  TG: 3.00,  // Togo            → total client: 5.00%
  TZ: 3.00,  // Tanzanie        → total client: 5.00%
  UG: 3.00,  // Ouganda         → total client: 5.00%
  NG: 2.00,  // Nigéria         → total client: 4.00%
  NE: 3.50,  // Niger           → total client: 5.50%
  RW: 3.75,  // Rwanda          → total client: 5.75%
  CG: 4.50,  // Congo Brazzaville → total client: 6.50%
  GN: 3.75,  // Guinée Conakry  → total client: 5.75%
  GH: 2.50,  // Ghana           → total client: 4.50%
  TD: 3.00,  // Tchad           → total client: 5.00%
  GQ: 3.00,  // Guinée équatoriale → total client: 5.00%
  GW: 3.00,  // Guinée-Bissau   → total client: 5.00%
  CF: 3.00,  // Centrafrique    → total client: 5.00%
};

// Ashtech margin is always 2% on top of Swychr base fee
export const ASHTECH_MARGIN = 2.0;

export function getSwychrFeeRate(countryCode: string): number {
  return SWYCHR_FEE_RATES[countryCode.toUpperCase()] ?? 3.0;
}

/**
 * Compute fee breakdown per the official tariff table (simple addition):
 *   totalRate = swychrRate + ashtechRate
 *   swychrFeeAmount = gross × swychrRate%   (passed to client via pass_digital_charge)
 *   ashtechFeeAmount = gross × 2%
 *   creditedAmount = gross × (1 - totalRate%)
 *   amountToSwychr = gross - swychrFeeAmount  (what we send to API; client pays ~gross on Swychr page)
 *
 * Example – Cameroun (swychr 2.5%, ashtech 2%), gross = 100 XAF:
 *   swychrFee = 2.50, ashtechFee = 2.00, totalFee = 4.50, credited = 95.50, toSwychr = 97.50
 */
export function computeSwychrFees(grossAmount: number, countryCode: string): {
  amountToSwychr: number;
  swychrFeeRate: number;
  ashtechFeeRate: number;
  totalFeeRate: number;
  swychrFeeAmount: number;
  ashtechFeeAmount: number;
  totalFeeAmount: number;
  creditedAmount: number;
} {
  const swychrFeeRate = getSwychrFeeRate(countryCode);
  const ashtechFeeRate = ASHTECH_MARGIN;
  const totalFeeRate = swychrFeeRate + ashtechFeeRate;

  const swychrFeeAmount  = grossAmount * swychrFeeRate / 100;
  const ashtechFeeAmount = grossAmount * ashtechFeeRate / 100;
  const totalFeeAmount   = grossAmount * totalFeeRate / 100;
  const creditedAmount   = grossAmount - totalFeeAmount;
  // Amount sent to Swychr API. With pass_digital_charge=true, Swychr adds its fee
  // on top → client pays ≈ grossAmount on the payment page.
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

// ─── Token Management ────────────────────────────────────────────────────────

let cachedToken: string | null = null;
let tokenExpiry: Date | null = null;

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
      const data = JSON.parse(fs.readFileSync(TOKEN_FILE, "utf8"));
      if (data.token && data.expiry) {
        const expiry = new Date(data.expiry);
        if (expiry > new Date()) {
          cachedToken = data.token;
          tokenExpiry = expiry;
          console.log("[Swychr] Loaded persisted token, valid until:", expiry.toISOString());
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
 * Obtain a bearer token for admin operations.
 * Doc: POST /admin/auth  (production path: /swychpay/auth/login)
 */
export async function getSwychrToken(): Promise<string> {
  if (cachedToken && tokenExpiry && new Date() < tokenExpiry) {
    return cachedToken;
  }
  const res = await fetch(`${SWYCHR_BASE_URL}/swychpay/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: SWYCHR_EMAIL, password: SWYCHR_PASSWORD }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Swychr auth failed: ${res.status} ${text}`);
  }
  const json = await res.json();
  const token = json.data?.token || json.token;
  if (!token) throw new Error(`Swychr auth: no token in response`);
  const expiry = parseJwtExp(token) || new Date(Date.now() + 47 * 60 * 60 * 1000);
  cachedToken = token;
  tokenExpiry = expiry;
  persistToken(token, expiry);
  console.log("[Swychr] New token obtained, valid until:", expiry.toISOString());
  return cachedToken!;
}

// ─── Create Payment Link ─────────────────────────────────────────────────────

export interface SwychrCreateLinkParams {
  country_code: string;
  name: string;
  email: string;
  mobile?: string;
  grossAmount: number;   // total the user enters (e.g. 1000 XAF)
  currency: string;
  transaction_id: string;
  description?: string;
  callback_url?: string; // webhook URL for status updates
}

export interface SwychrCreateLinkResponse {
  success: boolean;
  data?: {
    id: number;
    payment_link: string;   // https://app.swychrconnect.com/payment/{uuid}
    transaction_id: string;
  };
  fees?: ReturnType<typeof computeSwychrFees>;
  message?: string;
}

/**
 * Create a hosted payment link for collecting payment.
 * Doc: POST /create_payment_links  (production: /swychpay/create_payment_links)
 *
 * pass_digital_charge: true → Swychr adds its fee on top of amountToSwychr,
 * so the client pays ≈ grossAmount on the payment page.
 */
export async function createSwychrPaymentLink(params: SwychrCreateLinkParams): Promise<SwychrCreateLinkResponse> {
  try {
    const token = await getSwychrToken();
    const fees  = computeSwychrFees(params.grossAmount, params.country_code);

    console.log(`[Swychr] Creating payment link: gross=${params.grossAmount}, toSwychr=${fees.amountToSwychr}, credited=${fees.creditedAmount}, totalFee=${fees.totalFeeRate}%`);

    const res = await fetch(`${SWYCHR_BASE_URL}/swychpay/create_payment_links`, {
      method: "POST",
      headers: {
        "Content-Type":   "application/json",
        "Authorization":  `Bearer ${token}`,
        "Idempotency-Key": params.transaction_id,
      },
      body: JSON.stringify({
        country_code:        params.country_code,
        name:                params.name,
        email:               params.email,
        mobile:              params.mobile,
        amount:              fees.amountToSwychr,
        currency:            params.currency,
        transaction_id:      params.transaction_id,
        description:         params.description,
        pass_digital_charge: true,
        callback_url:        params.callback_url,
      }),
    });

    const data = await res.json();

    if (!res.ok || !data.data?.id) {
      console.error("[Swychr] Payment link creation failed:", data);
      return { success: false, message: data.message || data.error || `HTTP ${res.status}` };
    }

    const id = data.data.id as number;

    // Doc says response includes payment_link. In practice it may be missing;
    // fetch it via payment_link_byid as a fallback.
    let payment_link: string = data.data?.payment_link || "";
    if (!payment_link) {
      payment_link = await resolvePaymentLink(params.transaction_id, id);
    }

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

/**
 * Resolve the hosted payment URL from the transaction_id.
 * First tries the documented /payment_link_status endpoint,
 * falls back to /payment_link_byid (undocumented but available in production).
 */
async function resolvePaymentLink(transaction_id: string, fallbackId: number): Promise<string> {
  // Try documented endpoint first
  try {
    const token = await getSwychrToken();
    const r = await fetch(`${SWYCHR_BASE_URL}/swychpay/payment_link_status`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ transaction_id }),
    });
    if (r.ok) {
      const d = await r.json();
      const link = d.data?.data?.attributes?.payment_uuid || d.data?.payment_link || "";
      if (link) return link;
    }
  } catch {}

  // Fallback: undocumented endpoint available in production
  try {
    const r = await fetch(`${SWYCHR_BASE_URL}/swychpay/payment_link_byid`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ params: { id: transaction_id } }),
    });
    if (r.ok) {
      const d = await r.json();
      const link = d.data?.data?.attributes?.payment_uuid || "";
      if (link) return link;
    }
  } catch {}

  return `https://app.swychrconnect.com/payment/${fallbackId}`;
}

// ─── Check Payment Status ─────────────────────────────────────────────────────

export interface SwychrStatusResponse {
  success: boolean;
  status?: "pending" | "completed" | "failed";
  rawStatus?: number | string | null;
  data?: any;
  message?: string;
}

/**
 * Check status of a payment link by transaction_id.
 * Doc: POST /payment_link_status → returns {data:{data:{}}, message, status:200}
 * Note: In production, data.data is empty {}; actual status arrives via webhook.
 * Falls back to /payment_link_byid for richer data if available.
 */
export async function checkSwychrPaymentStatus(transaction_id: string): Promise<SwychrStatusResponse> {
  try {
    const token = await getSwychrToken();

    // Try the documented endpoint first
    const r1 = await fetch(`${SWYCHR_BASE_URL}/swychpay/payment_link_status`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ transaction_id }),
    });

    if (r1.ok) {
      const d1 = await r1.json();
      const attrs = d1.data?.data?.attributes || d1.data?.data || {};
      const rawStatus = attrs.status ?? null;

      // Doc: data.data is {} for pending. Only interpret if non-empty.
      if (rawStatus !== null && rawStatus !== undefined) {
        return {
          success: true,
          status: mapRawStatus(rawStatus),
          rawStatus,
          data: attrs,
        };
      }
      // Empty response = still pending (no payment yet)
      return { success: true, status: "pending", rawStatus: null, data: {} };
    }

    // Fallback: use undocumented endpoint if documented one is unavailable
    const r2 = await fetch(`${SWYCHR_BASE_URL}/swychpay/payment_link_byid`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ params: { id: transaction_id } }),
    });
    if (!r2.ok) return { success: false, message: `HTTP ${r2.status}` };

    const d2 = await r2.json();
    const attrs2 = d2.data?.data?.attributes;
    if (!attrs2) return { success: false, message: "Payment not found" };

    const rawStatus2 = attrs2.status ?? null;
    return {
      success: true,
      status: mapRawStatus(rawStatus2),
      rawStatus: rawStatus2,
      data: attrs2,
    };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

function mapRawStatus(raw: any): "pending" | "completed" | "failed" {
  if (raw === 1 || raw === "success" || raw === "completed") return "completed";
  if (raw === "expired" || raw === "cancelled") return "failed";
  // raw=2 with no prior payment attempt = still pending (Swychr account issue)
  // raw=0 = new link, pending
  return "pending";
}

// ─── Checkout Page – Payment Details ─────────────────────────────────────────

export interface SwychrPaymentDetails {
  transactionId: string;
  agencyCode: string;
  secretKey: string;
  web: string;
  netPayable: number;
  currency: string;
  description: string;
  name: string;
  email: string;
  mobile: string;
  adminName: string;
  adminLogo: string;
  adminEmail: string;
}

/**
 * Fetch full payment details for the checkout page.
 * Uses undocumented endpoints (payment_link_byid → payment_link_details)
 * to retrieve TouchPay SDK credentials for our custom checkout page.
 */
export async function fetchPaymentLinkDetails(transaction_id: string): Promise<SwychrPaymentDetails | null> {
  try {
    // Step 1: resolve UUID from transaction_id
    const r1 = await fetch(`${SWYCHR_BASE_URL}/swychpay/payment_link_byid`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ params: { id: transaction_id } }),
    });
    if (!r1.ok) return null;
    const d1 = await r1.json();
    const uuidUrl = d1.data?.data?.attributes?.payment_uuid || "";
    const uuid = uuidUrl.split("/payment/")[1];
    if (!uuid) return null;

    // Step 2: fetch full details (includes agency_code, secret_key for TouchPay SDK)
    const r2 = await fetch(`${SWYCHR_BASE_URL}/swychpay/payment_link_details`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ params: { id: uuid } }),
    });
    if (!r2.ok) return null;
    const d2 = await r2.json();
    const attrs = d2.data?.data?.attributes;
    if (!attrs) return null;

    return {
      transactionId: attrs.transaction_id || transaction_id,
      agencyCode:    attrs.agency_code || "",
      secretKey:     attrs.secret_key  || "",
      web:           attrs.web         || "swychr.com",
      netPayable:    parseFloat(attrs.net_payable) || 0,
      currency:      attrs.currency_code           || "XAF",
      description:   attrs.description             || "",
      name:          attrs.name                    || "",
      email:         attrs.email                   || "",
      mobile:        attrs.mobile                  || "",
      adminName:     attrs.admin_name              || "Ashtech Pay",
      adminLogo:     attrs.admin_logo              || "",
      adminEmail:    attrs.admin_email             || "",
    };
  } catch {
    return null;
  }
}
