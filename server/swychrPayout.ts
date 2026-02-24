// ─── Swychr Payout API client ───────────────────────────────────────────────
// Doc: payout.yaml — Base URL: https://api.accountpe.com/api/payout
// Auth: POST /admin/auth  →  { status, message, token }
// Payout: POST /create_transaction
// Status: POST /transaction_status

const PAYOUT_BASE_URL = "https://api.accountpe.com/api/payout";
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
    console.log(`[PayoutAPI] create_transaction response ${res.status}:`, JSON.stringify(json));

    if (!res.ok) {
      return { success: false, message: json.message || `HTTP ${res.status}`, rawStatus: res.status };
    }

    // Doc: CreateTransactionResponse { status, message, transaction_id, data? }
    const extTxId = json.transaction_id || params.transaction_id;
    return { success: true, transaction_id: extTxId, message: json.message, rawStatus: json.status };

  } catch (err: any) {
    console.error("[PayoutAPI] createSwychrPayout error:", err.message);
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
    // Doc: TransactionStatusResponse { status, message, data: { transaction_id, status, amount, currency, updated_at, provider_reference, failure_reason } }
    const data: any = json.data || {};

    return {
      success:            true,
      status:             data.status as PayoutStatus,
      provider_reference: data.provider_reference || null,
      failure_reason:     data.failure_reason     || null,
      message:            json.message,
    };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}
