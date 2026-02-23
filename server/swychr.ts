import fs from "fs";
import path from "path";

const SWYCHR_BASE_URL = "https://api.accountpe.com/api";
const SWYCHR_EMAIL = process.env.SWYCHR_EMAIL || "";
const SWYCHR_PASSWORD = process.env.SWYCHR_PASSWORD || "";
const TOKEN_FILE = path.join(process.cwd(), ".local", "swychr_token.json");

// Swychr fee rates per country (from official tariff documentation)
// These are the fees charged by Swychr – passed to customer via pass_digital_charge=true
export const SWYCHR_FEE_RATES: Record<string, number> = {
  CM: 2.5,   // Cameroun
  KE: 1.5,   // Kenya
  GA: 3.0,   // Gabon
  CD: 3.5,   // Congo DRC
  SN: 2.5,   // Sénégal
  CI: 3.0,   // Côte d'Ivoire
  BF: 3.0,   // Burkina Faso
  ML: 3.0,   // Mali
  BJ: 3.0,   // Bénin
  TG: 3.0,   // Togo
  TZ: 3.0,   // Tanzanie
  UG: 3.0,   // Ouganda
  NG: 2.0,   // Nigéria
  NE: 3.5,   // Niger
  RW: 3.75,  // Rwanda
  CG: 4.5,   // Congo Brazzaville
  GN: 3.75,  // Guinée Conakry
  GH: 2.5,   // Ghana
  TD: 3.0,   // Tchad
  GQ: 3.0,   // Guinée équatoriale
  GW: 3.0,   // Guinée-Bissau
  CF: 3.0,   // Centrafrique
};

// Ashtech margin applied on top of Swychr fee (always 2%)
export const ASHTECH_MARGIN = 2.0;

export function getSwychrFeeRate(countryCode: string): number {
  return SWYCHR_FEE_RATES[countryCode.toUpperCase()] ?? 3.0;
}

/**
 * Given a gross amount (what the client types in the UI), compute:
 * - amountToSwychr: the net amount to send to Swychr API
 *   → Swychr will add its fee on top → client pays exactly grossAmount
 * - ashtechFeeAmount: our 2% margin deducted from what we receive
 * - creditedAmount: what gets credited to the user's wallet
 * - swychrFeeAmount: Swychr's portion (paid by customer to Swychr)
 * - totalFeeAmount: total deducted from customer's payment
 */
export function computeSwychrFees(grossAmount: number, countryCode: string): {
  amountToSwychr: number;
  swychrFeeRate: number;
  swychrFeeAmount: number;
  ashtechFeeAmount: number;
  creditedAmount: number;
  totalFeeAmount: number;
} {
  const swychrFeeRate = getSwychrFeeRate(countryCode);
  const amountToSwychr = grossAmount / (1 + swychrFeeRate / 100);
  const swychrFeeAmount = grossAmount - amountToSwychr;
  const ashtechFeeAmount = amountToSwychr * (ASHTECH_MARGIN / 100);
  const creditedAmount = amountToSwychr - ashtechFeeAmount;
  const totalFeeAmount = swychrFeeAmount + ashtechFeeAmount;
  return {
    amountToSwychr: Math.round(amountToSwychr * 100) / 100,
    swychrFeeRate,
    swychrFeeAmount: Math.round(swychrFeeAmount * 100) / 100,
    ashtechFeeAmount: Math.round(ashtechFeeAmount * 100) / 100,
    creditedAmount: Math.round(creditedAmount * 100) / 100,
    totalFeeAmount: Math.round(totalFeeAmount * 100) / 100,
  };
}

let cachedToken: string | null = null;
let tokenExpiry: Date | null = null;

function parseJwtExp(token: string): Date | null {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
    if (payload.exp) {
      return new Date(payload.exp * 1000);
    }
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
  if (!token) {
    throw new Error(`Swychr auth: no token in response: ${JSON.stringify(json)}`);
  }
  const jwtExpiry = parseJwtExp(token);
  const expiry = jwtExpiry || new Date(Date.now() + 47 * 60 * 60 * 1000);
  cachedToken = token;
  tokenExpiry = expiry;
  persistToken(token, expiry);
  console.log("[Swychr] New token obtained, valid until:", expiry.toISOString());
  return cachedToken!;
}

async function fetchPaymentUuid(transaction_id: string): Promise<string | null> {
  try {
    const res = await fetch(`${SWYCHR_BASE_URL}/swychpay/payment_link_byid`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ params: { id: transaction_id } }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const attrs = data.data?.data?.attributes;
    return attrs?.payment_uuid || null;
  } catch {
    return null;
  }
}

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

export async function fetchPaymentLinkDetails(transaction_id: string): Promise<SwychrPaymentDetails | null> {
  try {
    const uuidUrl = await fetchPaymentUuid(transaction_id);
    if (!uuidUrl) return null;
    const uuid = uuidUrl.split("/payment/")[1];
    if (!uuid) return null;
    const res = await fetch(`${SWYCHR_BASE_URL}/swychpay/payment_link_details`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ params: { id: uuid } }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const attrs = data.data?.data?.attributes;
    if (!attrs) return null;
    return {
      transactionId: attrs.transaction_id || transaction_id,
      agencyCode: attrs.agency_code || "",
      secretKey: attrs.secret_key || "",
      web: attrs.web || "swychr.com",
      netPayable: parseFloat(attrs.net_payable) || 0,
      currency: attrs.currency_code || "XAF",
      description: attrs.description || "",
      name: attrs.name || "",
      email: attrs.email || "",
      mobile: attrs.mobile || "",
      adminName: attrs.admin_name || "Ashtech Pay",
      adminLogo: attrs.admin_logo || "",
      adminEmail: attrs.admin_email || "",
    };
  } catch {
    return null;
  }
}

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
  fees?: {
    amountToSwychr: number;
    swychrFeeRate: number;
    swychrFeeAmount: number;
    ashtechFeeAmount: number;
    creditedAmount: number;
    totalFeeAmount: number;
  };
  message?: string;
}

export async function createSwychrPaymentLink(params: SwychrCreateLinkParams): Promise<SwychrCreateLinkResponse> {
  try {
    const token = await getSwychrToken();
    const fees = computeSwychrFees(params.grossAmount, params.country_code);

    const res = await fetch(`${SWYCHR_BASE_URL}/swychpay/create_payment_links`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
        "Idempotency-Key": params.transaction_id,
      },
      body: JSON.stringify({
        country_code: params.country_code,
        name: params.name,
        email: params.email,
        mobile: params.mobile,
        amount: fees.amountToSwychr,
        currency: params.currency,
        transaction_id: params.transaction_id,
        description: params.description,
        pass_digital_charge: true,
        callback_url: params.callback_url,
      }),
    });
    const data = await res.json();
    if (res.ok && data.data?.id) {
      const id = data.data.id;
      // Extract payment_link from creation response (per doc), or fetch UUID separately
      let payment_link: string = data.data?.payment_link || "";
      if (!payment_link) {
        const uuid = await fetchPaymentUuid(params.transaction_id);
        payment_link = uuid || `https://app.swychrconnect.com/payment/${id}`;
      }
      console.log(`[Swychr] Payment link created: id=${id}, url=${payment_link}`);
      console.log(`[Swychr] Fees: grossAmount=${params.grossAmount}, toSwychr=${fees.amountToSwychr}, credited=${fees.creditedAmount}`);
      return {
        success: true,
        data: { id, payment_link, transaction_id: params.transaction_id },
        fees,
        message: data.message,
      };
    }
    return { success: false, message: data.message || data.error || `HTTP ${res.status}` };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

export interface SwychrStatusResponse {
  success: boolean;
  status?: "pending" | "completed" | "failed";
  rawStatus?: number;
  data?: any;
  message?: string;
}

export async function checkSwychrPaymentStatus(transaction_id: string): Promise<SwychrStatusResponse> {
  try {
    // Use payment_link_byid (payment_link_status endpoint is not available in production)
    const res = await fetch(`${SWYCHR_BASE_URL}/swychpay/payment_link_byid`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ params: { id: transaction_id } }),
    });
    if (!res.ok) {
      return { success: false, message: `HTTP ${res.status}` };
    }
    const data = await res.json();
    const attrs = data.data?.data?.attributes;
    if (!attrs) {
      return { success: false, message: data.message || "Payment not found" };
    }
    const rawStatus = attrs.status ?? null;
    // status=1 means payment credited (success)
    // status=0/2 means pending/new (no payment yet)
    // Only mark as failed on explicit string statuses (webhook will confirm)
    let status: "pending" | "completed" | "failed" = "pending";
    if (rawStatus === 1 || rawStatus === "success" || rawStatus === "completed") {
      status = "completed";
    } else if (rawStatus === "expired" || rawStatus === "failed" || rawStatus === "cancelled") {
      status = "failed";
    }
    return { success: true, status, rawStatus, data: attrs };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}
