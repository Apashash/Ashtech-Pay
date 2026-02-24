// ─── Swychr Payout API client ───────────────────────────────────────────────
// Doc: payout.yaml — Base URL: https://api.accountpe.com/api/payout
// Auth: POST /admin/auth  →  { status, message, token }
// Payout: POST /create_transaction
// Status: POST /transaction_status

const PAYOUT_BASE_URL = "https://api.accountpe.com/api/payout";

// ─── Country dial code mapping ────────────────────────────────────────────
const DIAL_CODES: Record<string, string> = {
  BJ: "229",  // Bénin
  BF: "226",  // Burkina Faso
  CM: "237",  // Cameroun
  CF: "236",  // Centrafrique
  CG: "242",  // Congo
  CI: "225",  // Côte d'Ivoire
  GA: "241",  // Gabon
  GH: "233",  // Ghana
  GN: "224",  // Guinée Conakry
  GQ: "240",  // Guinée équatoriale
  GW: "245",  // Guinée-Bissau
  KE: "254",  // Kenya
  ML: "223",  // Mali
  NE: "227",  // Niger
  NG: "234",  // Nigeria
  UG: "256",  // Ouganda
  CD: "243",  // RD Congo
  RW: "250",  // Rwanda
  SN: "221",  // Sénégal
  TZ: "255",  // Tanzanie
  TD: "235",  // Tchad
  TG: "228",  // Togo
};

/**
 * Format a phone number to E.164 international format: +<dialCode><localNumber>
 * If number already starts with +, return as-is.
 * Strips spaces, dashes, parentheses before formatting.
 */
export function formatInternationalPhone(phone: string, country_code: string): string {
  const cleaned = phone.replace(/[\s\-().]/g, "");
  if (cleaned.startsWith("+")) return cleaned;
  const dialCode = DIAL_CODES[country_code.toUpperCase()];
  if (!dialCode) return cleaned;
  // Remove leading 0 if present (local format)
  const local = cleaned.startsWith("0") ? cleaned.slice(1) : cleaned;
  return `+${dialCode}${local}`;
}
const SWYCHR_EMAIL    = process.env.SWYCHR_EMAIL    || "";
const SWYCHR_PASSWORD = process.env.SWYCHR_PASSWORD || "";

// ─── Token cache (separate from payin token) ──────────────────────────────

let cachedPayoutToken: string | null = null;
let payoutTokenExpiry: Date | null   = null;

function parseJwtExp(token: string): Date | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = JSON.parse(Buffer.from(parts[1], "base64").toString());
    if (payload.exp) return new Date(payload.exp * 1000);
  } catch {}
  return null;
}

export async function getPayoutToken(): Promise<string> {
  if (cachedPayoutToken && payoutTokenExpiry && new Date() < payoutTokenExpiry) {
    return cachedPayoutToken;
  }

  const res = await fetch(`${PAYOUT_BASE_URL}/admin/auth`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ email: SWYCHR_EMAIL, password: SWYCHR_PASSWORD }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Payout auth failed: ${res.status} ${text}`);
  }

  const json  = await res.json();
  // Doc: AuthResponse { status, message, token }
  const token = json.token || json.data?.token;
  if (!token) throw new Error("Payout auth: no token in response");

  const expiry = parseJwtExp(token) || new Date(Date.now() + 47 * 60 * 60 * 1000);
  cachedPayoutToken  = token;
  payoutTokenExpiry  = expiry;
  console.log("[PayoutAPI] New token obtained, valid until:", expiry.toISOString());
  return cachedPayoutToken!;
}

// ─── Types ────────────────────────────────────────────────────────────────

export interface SwychrPayoutParams {
  country_code:     string;
  beneficiary_name: string;
  mobile_no:        string;
  amount:           number;
  transaction_id:   string;
  payment_method:   "mobile_money" | "bank_transfer";
  remarks?:         string;
  bank_code?:       string;
  account_number?:  string;
  address?:         string;
}

export interface SwychrPayoutResult {
  success:       boolean;
  transaction_id?: string;
  message?:      string;
  rawStatus?:    number;
}

export type PayoutStatus = "pending" | "processing" | "success" | "failed" | "refunded" | "cancelled";

export interface SwychrPayoutStatusResult {
  success:           boolean;
  status?:           PayoutStatus;
  provider_reference?: string | null;
  failure_reason?:   string | null;
  message?:          string;
}

// ─── Create payout transaction ────────────────────────────────────────────

export async function createSwychrPayout(
  params: SwychrPayoutParams
): Promise<SwychrPayoutResult> {
  try {
    const token = await getPayoutToken();

    console.log(`[PayoutAPI] Creating payout: ${params.country_code} ${params.amount} → ${params.mobile_no}`);

    const res = await fetch(`${PAYOUT_BASE_URL}/create_transaction`, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({
        country_code:     params.country_code,
        beneficiary_name: params.beneficiary_name,
        mobile_no:        params.mobile_no,
        amount:           params.amount,
        transaction_id:   params.transaction_id,
        payment_method:   params.payment_method,
        remarks:          params.remarks || "Retrait Ashtech Pay",
        ...(params.bank_code     && { bank_code:      params.bank_code }),
        ...(params.account_number && { account_number: params.account_number }),
        ...(params.address       && { address:         params.address }),
      }),
    });

    const json = await res.json();
    console.log(`[PayoutAPI] create_transaction response HTTP=${res.status} body.status=${json.status}:`, JSON.stringify(json));

    // Swychr returns HTTP 200 even for errors — check json.status (400, 404, etc.)
    const bodyStatus = typeof json.status === "number" ? json.status : res.status;
    if (!res.ok || bodyStatus >= 400) {
      return { success: false, message: json.message || `HTTP ${bodyStatus}`, rawStatus: bodyStatus };
    }

    // Doc: CreateTransactionResponse { status, message, transaction_id, data? }
    const extTxId = json.transaction_id || (json.data && json.data.transaction_id) || params.transaction_id;
    return { success: true, transaction_id: extTxId, message: json.message, rawStatus: json.status };

  } catch (err: any) {
    console.error("[PayoutAPI] createSwychrPayout error:", err.message);
    return { success: false, message: err.message };
  }
}

// ─── Fiat → PUSD conversion (for wallet-to-wallet convert) ──────────────────
export async function fiatToPusd(currencyCode: string, fiatAmount: number): Promise<{ success: boolean; pusdAmount?: number; message?: string }> {
  try {
    const token = await getPayoutToken();
    const res = await fetch(`${PAYOUT_BASE_URL}/fiat_to_pusd_conversion`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ currency_code: currencyCode, fiat_amount: fiatAmount }),
    });
    const json = await res.json();
    const bodyStatus = typeof json.status === "number" ? json.status : res.status;
    if (bodyStatus >= 400) return { success: false, message: json.message || `HTTP ${bodyStatus}` };
    const pusd = json.data?.pusd_amount ?? json.pusd_amount ?? json.data?.amount;
    return { success: true, pusdAmount: pusd };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

// ─── PUSD → Fiat rate (for wallet-to-wallet convert) ─────────────────────────
export async function pusdToFiatRate(countryCode: string, pusdAmount: number): Promise<{ success: boolean; fiatAmount?: number; currency?: string; message?: string }> {
  try {
    const token = await getPayoutToken();
    const res = await fetch(`${PAYOUT_BASE_URL}/pusd_to_fiat_rate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ country_code: countryCode, amount: pusdAmount }),
    });
    const json = await res.json();
    const bodyStatus = typeof json.status === "number" ? json.status : res.status;
    if (bodyStatus >= 400) return { success: false, message: json.message || `HTTP ${bodyStatus}` };
    const fiat = json.data?.fiat_amount ?? json.fiat_amount ?? json.data?.amount;
    const currency = json.data?.currency_code ?? json.currency_code;
    return { success: true, fiatAmount: fiat, currency };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

// ─── Check payout transaction status ─────────────────────────────────────

export async function checkSwychrPayoutStatus(
  transaction_id: string
): Promise<SwychrPayoutStatusResult> {
  try {
    const token = await getPayoutToken();

    const res = await fetch(`${PAYOUT_BASE_URL}/transaction_status`, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({ transaction_id }),
    });

    if (!res.ok) {
      return { success: false, message: `HTTP ${res.status}` };
    }

    const json = await res.json();
    console.log(`[PayoutAPI] transaction_status HTTP=${res.status} body.status=${json.status}:`, JSON.stringify(json));

    // Swychr returns HTTP 200 even for errors — check json.status
    const bodyStatus = typeof json.status === "number" ? json.status : res.status;
    if (!res.ok || bodyStatus >= 400) {
      // 404 = not found in Swychr → treat as failed
      return { success: false, message: json.message || `HTTP ${bodyStatus}`, status: "failed" };
    }

    // Doc: TransactionStatusResponse { status, message, data: { transaction_id, status, ... } }
    const data: any = json.data || {};
    const rawStatus = (data.status || "") as string;
    const normalizedStatus = rawStatus.toLowerCase() as PayoutStatus;

    return {
      success:            true,
      status:             normalizedStatus || undefined,
      provider_reference: data.provider_reference || null,
      failure_reason:     data.failure_reason     || null,
      message:            json.message,
    };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}
