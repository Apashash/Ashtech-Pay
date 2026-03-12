// ─── PixPay API Integration ───────────────────────────────────────────────────
// Docs: https://docs.pixpay.sn/
// Direct API — client never leaves Ashtech Pay platform
// 3 operator flows: USSD (push), OTP (Orange CI), Wave (redirect)

const PIXPAY_AIRTIME_URL = "https://proxy-coreapi.pixelinnov.net/api_v1/transaction/airtime";
const PIXPAY_STATUS_URL  = "https://proxy-coreapi.pixelinnov.net/api_v1/transaction/status";

// ─── API keys by currency zone ────────────────────────────────────────────────
const PIXPAY_API_KEYS: Record<string, string> = {
  XAF: process.env.PIXPAY_API_KEY_XAF || "PIX_c2724339-716f-4034-b5e5-2a17c1c35d0e",
  XOF: process.env.PIXPAY_API_KEY_XOF || "PIX_40771cae-bd73-4a08-988f-52e4c6ad3ce7",
  CDF: process.env.PIXPAY_API_KEY_CDF || "PIX_6295ed31-dc99-4d3c-b5f7-e3ebb1d43ef6",
};

// ─── Country → currency zone mapping ─────────────────────────────────────────
export const PIXPAY_CURRENCY_MAP: Record<string, string> = {
  CM: "XAF", CF: "XAF", TD: "XAF", GQ: "XAF", CG: "XAF", GA: "XAF",
  BF: "XOF", BJ: "XOF", CI: "XOF", GW: "XOF", ML: "XOF",
  NE: "XOF", SN: "XOF", TG: "XOF", GN: "XOF",
  CD: "CDF",
};

export function getPixPayApiKey(countryCode: string): string {
  const zone = PIXPAY_CURRENCY_MAP[countryCode.toUpperCase()];
  if (!zone) throw new Error(`PixPay: pays non supporté — ${countryCode}`);
  const key = PIXPAY_API_KEYS[zone];
  if (!key) throw new Error(`PixPay: clé API manquante pour ${zone}`);
  return key;
}

// ─── Operator types ────────────────────────────────────────────────────────────
// 'ussd'  → USSD push, user validates on phone (most operators)
// 'otp'   → Orange CI only: user dials #144*82# to get code, enters it on platform
// 'wave'  → Wave CI / Wave SN: redirect to Wave deeplink
export type PixPayOperatorType = "ussd" | "otp" | "wave";

// ─── Auto-detect flow type from operator name + country ───────────────────────
// Rules from PixPay documentation:
//   - Wave (any country)  → wave redirect
//   - Orange + CI         → OTP (#144*82#)
//   - Everything else     → USSD push
export function detectPixPayFlowType(operatorName: string, countryCode: string): PixPayOperatorType {
  const name = operatorName.toLowerCase();
  if (name.includes("wave")) return "wave";
  if (name.includes("orange") && countryCode.toUpperCase() === "CI") return "otp";
  return "ussd";
}

// ─── Fixed service ID lookup table (from merchant integration dossier) ────────
// Format: operator_keyword → { COUNTRY_CODE: { cash_in: id, cash_out: id } }
// PixPay naming (opposite of intuition):
//   cash_out = payin  = deposit   (platform collects from user)
//   cash_in  = payout = withdrawal (platform sends to user)
const PIXPAY_SERVICE_ID_TABLE: Record<string, Partial<Record<string, { cash_in: number; cash_out: number }>>> = {
  // ── Orange / OM ───────────────────────────────────────────────────────────
  orange: {
    CI: { cash_in: 2,   cash_out: 1   },
    SN: { cash_in: 214, cash_out: 213 },
    BF: { cash_in: 240, cash_out: 241 },
    CM: { cash_in: 336, cash_out: 337 },
    CD: { cash_in: 346, cash_out: 347 },
  },
  // ── MTN ───────────────────────────────────────────────────────────────────
  mtn: {
    CI: { cash_in: 6,   cash_out: 5   },
    CM: { cash_in: 338, cash_out: 339 },
  },
  // ── Moov / Flooz ──────────────────────────────────────────────────────────
  moov: {
    CI: { cash_in: 4,   cash_out: 3   },
    BF: { cash_in: 238, cash_out: 239 },
  },
  flooz: {
    CI: { cash_in: 4,   cash_out: 3   },
    BF: { cash_in: 238, cash_out: 239 },
  },
  // ── Wave ──────────────────────────────────────────────────────────────────
  wave: {
    CI: { cash_in: 8,   cash_out: 7   },
    SN: { cash_in: 210, cash_out: 211 },
  },
  // ── M-Pesa ────────────────────────────────────────────────────────────────
  mpesa: {
    CD: { cash_in: 342, cash_out: 343 },
  },
  // ── Airtel ────────────────────────────────────────────────────────────────
  airtel: {
    CD: { cash_in: 344, cash_out: 345 },
  },
  // ── Afrimoney ─────────────────────────────────────────────────────────────
  afrimoney: {
    CD: { cash_in: 348, cash_out: 349 },
  },
  // ── Mix / Free (Sénégal — autres opérateurs) ──────────────────────────────
  mix: {
    SN: { cash_in: 340, cash_out: 341 },
  },
  free: {
    SN: { cash_in: 340, cash_out: 341 },
  },
  expresso: {
    SN: { cash_in: 340, cash_out: 341 },
  },
};

// ─── Auto-resolve service ID from operator name + country + direction ─────────
// direction: "cash_out" for deposits/collections (PixPay payin), "cash_in" for withdrawals/payouts (PixPay payout)
export function getPixPayServiceId(
  operatorName: string,
  countryCode: string,
  direction: "cash_in" | "cash_out" = "cash_out"
): number | null {
  const name = operatorName.toLowerCase();
  const cc   = countryCode.toUpperCase();
  for (const [keyword, countries] of Object.entries(PIXPAY_SERVICE_ID_TABLE)) {
    if (name.includes(keyword)) {
      const entry = countries[cc];
      if (entry) return entry[direction];
    }
  }
  return null;
}

// ─── Get full config for an operator (for admin display) ─────────────────────
export function getPixPayOperatorConfig(
  operatorName: string,
  countryCode: string
): { flowType: PixPayOperatorType; serviceIdCashIn: number | null; serviceIdCashOut: number | null } {
  return {
    flowType:        detectPixPayFlowType(operatorName, countryCode),
    serviceIdCashIn:  getPixPayServiceId(operatorName, countryCode, "cash_in"),
    serviceIdCashOut: getPixPayServiceId(operatorName, countryCode, "cash_out"),
  };
}

// Wave business_name_id — set in PixPay merchant account
const PIXPAY_WAVE_BUSINESS_ID = process.env.PIXPAY_WAVE_BUSINESS_ID || "";

// ─── Params & result types ────────────────────────────────────────────────────
export interface PixPayBaseParams {
  serviceId: string;
  amount: number;
  phone: string;
  countryCode: string;
  orderId: string;
  ipnUrl?: string;
  customData?: string;
}

export interface PixPayOtpParams extends PixPayBaseParams {
  omOtp: string; // OTP code entered by user (from #144*82#)
}

export interface PixPayWaveParams extends PixPayBaseParams {
  redirectUrl: string;
  redirectErrorUrl: string;
}

export interface PixPayinResult {
  success: boolean;
  transactionId?: string; // PIX_xxxxx returned by PixPay
  waveUrl?: string;       // Wave payment URL (for wave operators only)
  status?: string;
  message?: string;
  raw?: any;
}

// ─── Build common request body ────────────────────────────────────────────────
function buildBaseBody(params: PixPayBaseParams, countryCode: string): Record<string, any> {
  return {
    amount: params.amount,
    api_key: getPixPayApiKey(countryCode),
    destination: params.phone,
    ipn_url: params.ipnUrl || "",
    service_id: parseInt(params.serviceId, 10),
    custom_data: params.customData || params.orderId,
  };
}

// ─── Generic call helper ──────────────────────────────────────────────────────
async function callPixPay(body: Record<string, any>, logLabel: string): Promise<PixPayinResult> {
  console.log(`[PixPay ${logLabel}] Body:`, JSON.stringify({ ...body, api_key: "***" }));
  const res = await fetch(PIXPAY_AIRTIME_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  console.log(`[PixPay ${logLabel}] Response:`, JSON.stringify(data));

  if (data.statut_code !== 200 || !data.data) {
    return { success: false, message: data.message || "Échec PixPay", raw: data };
  }

  const d = data.data;
  const state = (d.state || "").toUpperCase();
  if (state === "FAILED" || state === "CANCELLED") {
    return { success: false, message: d.response || data.message || "Transaction rejetée", raw: data };
  }

  // Wave operators return sms_link (payment URL)
  const waveUrl = d.sms_link || undefined;

  return {
    success: true,
    transactionId: d.transaction_id,
    waveUrl,
    status: d.state || "PENDING1",
    message: data.message,
    raw: data,
  };
}

// ─── USSD push (most operators) ──────────────────────────────────────────────
export async function initiatePixPayUssd(params: PixPayBaseParams): Promise<PixPayinResult> {
  try {
    const body = buildBaseBody(params, params.countryCode);
    return await callPixPay(body, "USSD");
  } catch (err: any) {
    console.error("[PixPay USSD] Error:", err);
    return { success: false, message: err.message || "Erreur réseau PixPay" };
  }
}

// ─── OTP (Orange CI only) ─────────────────────────────────────────────────────
// User dials #144*82# to get OTP, enters it on our platform.
// We send ONE API call including om_otp.
export async function initiatePixPayOtp(params: PixPayOtpParams): Promise<PixPayinResult> {
  try {
    const body = {
      ...buildBaseBody(params, params.countryCode),
      om_otp: params.omOtp,
    };
    return await callPixPay(body, "OTP");
  } catch (err: any) {
    console.error("[PixPay OTP] Error:", err);
    return { success: false, message: err.message || "Erreur réseau PixPay OTP" };
  }
}

// ─── Wave (Wave CI / Wave SN) ────────────────────────────────────────────────
// Returns a Wave payment URL in `waveUrl` that the user must open.
export async function initiatePixPayWave(params: PixPayWaveParams): Promise<PixPayinResult> {
  try {
    const body = {
      ...buildBaseBody(params, params.countryCode),
      business_name_id: PIXPAY_WAVE_BUSINESS_ID,
      redirect_url: params.redirectUrl,
      redirect_error_url: params.redirectErrorUrl,
    };
    return await callPixPay(body, "Wave");
  } catch (err: any) {
    console.error("[PixPay Wave] Error:", err);
    return { success: false, message: err.message || "Erreur réseau PixPay Wave" };
  }
}

// ─── Status check (use sparingly — PixPay warns against abuse) ───────────────
export async function checkPixPayStatus(
  transactionId: string,
  countryCode: string = "CM"
): Promise<{ status: "completed" | "failed" | "pending"; raw?: any }> {
  try {
    const apiKey = getPixPayApiKey(countryCode);
    const res = await fetch(PIXPAY_STATUS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: apiKey, transaction_ids: transactionId }),
    });
    const data = await res.json();

    if (data.statut_code !== 200 || !data.data) return { status: "pending", raw: data };

    const state = (data.data.state || "").toUpperCase();
    if (state === "SUCCESS" || state === "SUCCESSFUL" || state === "COMPLETED") {
      return { status: "completed", raw: data };
    } else if (state === "FAILED" || state === "CANCELLED" || state === "FAILURE") {
      return { status: "failed", raw: data };
    }
    return { status: "pending", raw: data };
  } catch (err: any) {
    console.error("[PixPay Status] Error:", err);
    return { status: "pending" };
  }
}

// ─── Parse PixPay IPN webhook ─────────────────────────────────────────────────
export function parsePixPayWebhook(payload: any): {
  transactionId?: string;
  orderId?: string;
  status: "completed" | "failed" | "pending";
  providerMessage?: string;
} {
  const state = (payload?.state || "").toUpperCase();

  let status: "completed" | "failed" | "pending" = "pending";
  if (state === "SUCCESS" || state === "SUCCESSFUL" || state === "COMPLETED") {
    status = "completed";
  } else if (state === "FAILED" || state === "CANCELLED" || state === "FAILURE") {
    status = "failed";
  }

  return {
    transactionId: payload?.transaction_id,
    orderId: payload?.custom_data,
    status,
    providerMessage: payload?.response || payload?.error,
  };
}

// ─── Payout (cash_in service_id — withdrawal to user, PixPay naming) ─────────
export interface PixPayoutParams {
  serviceId: string;
  amount: number;
  phone: string;
  countryCode: string;
  orderId: string;
  ipnUrl?: string;
  customData?: string;
}

export interface PixPayoutResult {
  success: boolean;
  transactionId?: string;
  status?: string;
  message?: string;
  raw?: any;
}

export async function initiatePixPayPayout(params: PixPayoutParams): Promise<PixPayoutResult> {
  try {
    const body = buildBaseBody(
      { ...params, serviceId: params.serviceId },
      params.countryCode
    );
    console.log(`[PixPay Payout] Body:`, JSON.stringify({ ...body, api_key: "***" }));
    const res = await fetch(PIXPAY_AIRTIME_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    console.log(`[PixPay Payout] Response:`, JSON.stringify(data));

    if (data.statut_code !== 200 || !data.data) {
      return { success: false, message: data.message || "Échec payout PixPay", raw: data };
    }

    const d = data.data;
    const state = (d.state || "").toUpperCase();
    if (state === "FAILED" || state === "CANCELLED") {
      return { success: false, message: d.response || data.message || "Payout rejeté", raw: data };
    }

    return {
      success: true,
      transactionId: d.transaction_id,
      status: d.state || "PENDING1",
      message: data.message,
      raw: data,
    };
  } catch (err: any) {
    console.error("[PixPay Payout] Error:", err);
    return { success: false, message: err.message || "Erreur réseau PixPay payout" };
  }
}

// ─── Fee computation ──────────────────────────────────────────────────────────
export function computePixPayFees(
  grossAmount: number,
  pixpayFeeRate: number,
  ashtechMarginPct: number = 2.0
) {
  const totalFeeRate = pixpayFeeRate + ashtechMarginPct;
  const totalFeeAmount    = grossAmount * totalFeeRate / 100;
  const pixpayFeeAmount   = grossAmount * pixpayFeeRate / 100;
  const ashtechFeeAmount  = grossAmount * ashtechMarginPct / 100;
  const creditedAmount    = grossAmount - totalFeeAmount;
  return {
    pixpayFeeRate,
    ashtechFeeRate: ashtechMarginPct,
    totalFeeRate,
    pixpayFeeAmount:  Math.round(pixpayFeeAmount  * 100) / 100,
    ashtechFeeAmount: Math.round(ashtechFeeAmount * 100) / 100,
    totalFeeAmount:   Math.round(totalFeeAmount   * 100) / 100,
    creditedAmount:   Math.round(creditedAmount   * 100) / 100,
  };
}

// ─── Supported countries (for admin display) ──────────────────────────────────
export const PIXPAY_SUPPORTED_COUNTRIES = [
  { code: "CM", name: "Cameroun",          currency: "XAF", flag: "🇨🇲" },
  { code: "CF", name: "Centrafrique",      currency: "XAF", flag: "🇨🇫" },
  { code: "TD", name: "Tchad",             currency: "XAF", flag: "🇹🇩" },
  { code: "GQ", name: "Guinée équatoriale",currency: "XAF", flag: "🇬🇶" },
  { code: "CG", name: "Congo Brazzaville", currency: "XAF", flag: "🇨🇬" },
  { code: "GA", name: "Gabon",             currency: "XAF", flag: "🇬🇦" },
  { code: "BF", name: "Burkina Faso",      currency: "XOF", flag: "🇧🇫" },
  { code: "BJ", name: "Bénin",             currency: "XOF", flag: "🇧🇯" },
  { code: "CI", name: "Côte d'Ivoire",     currency: "XOF", flag: "🇨🇮" },
  { code: "GW", name: "Guinée-Bissau",     currency: "XOF", flag: "🇬🇼" },
  { code: "ML", name: "Mali",              currency: "XOF", flag: "🇲🇱" },
  { code: "NE", name: "Niger",             currency: "XOF", flag: "🇳🇪" },
  { code: "SN", name: "Sénégal",           currency: "XOF", flag: "🇸🇳" },
  { code: "TG", name: "Togo",              currency: "XOF", flag: "🇹🇬" },
  { code: "GN", name: "Guinée Conakry",    currency: "XOF", flag: "🇬🇳" },
  { code: "CD", name: "RD Congo",          currency: "CDF", flag: "🇨🇩" },
];
