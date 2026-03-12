// ─── PixPay API Integration ───────────────────────────────────────────────────
// Docs: https://docs.pixpay.sn/
// Production URL: https://proxy-coreapi.pixelinnov.net/api_v1/transaction/airtime
// 3 API keys based on currency zone (XAF / XOF / CDF)

const PIXPAY_URL = "https://proxy-coreapi.pixelinnov.net/api_v1/transaction/airtime";

// Currency → API key mapping
const PIXPAY_API_KEYS: Record<string, string> = {
  XAF: process.env.PIXPAY_API_KEY_XAF || "PIX_c2724339-716f-4034-b5e5-2a17c1c35d0e",
  XOF: process.env.PIXPAY_API_KEY_XOF || "PIX_40771cae-bd73-4a08-988f-52e4c6ad3ce7",
  CDF: process.env.PIXPAY_API_KEY_CDF || "PIX_6295ed31-dc99-4d3c-b5f7-e3ebb1d43ef6",
};

// Map ISO country code → PixPay currency zone
export const PIXPAY_CURRENCY_MAP: Record<string, string> = {
  // XAF zone
  CM: "XAF", CF: "XAF", TD: "XAF", GQ: "XAF", CG: "XAF", GA: "XAF",
  // XOF zone
  BF: "XOF", BJ: "XOF", CI: "XOF", GW: "XOF", ML: "XOF",
  NE: "XOF", SN: "XOF", TG: "XOF", GN: "XOF",
  // CDF zone
  CD: "CDF",
};

function getApiKey(countryCode: string): string {
  const currency = PIXPAY_CURRENCY_MAP[countryCode.toUpperCase()];
  if (!currency) throw new Error(`PixPay: pays non supporté — ${countryCode}`);
  const key = PIXPAY_API_KEYS[currency];
  if (!key) throw new Error(`PixPay: clé API manquante pour ${currency}`);
  return key;
}

// ─── Types ────────────────────────────────────────────────────────────────────
export interface PixPayinParams {
  serviceId: string;          // numeric service_id configured per operator
  amount: number;
  phone: string;              // destination phone number (with or without prefix)
  countryCode: string;        // ISO country code e.g. "CM"
  orderId: string;            // unique reference from our side
  ipnUrl?: string;
  customData?: string;
}

export interface PixPayinResult {
  success: boolean;
  transactionId?: string;     // PIX_xxxxx returned by PixPay
  status?: string;
  message?: string;
  raw?: any;
}

// ─── Initiate payment ─────────────────────────────────────────────────────────
export async function initiatePixPayin(params: PixPayinParams): Promise<PixPayinResult> {
  try {
    const apiKey = getApiKey(params.countryCode);

    const body: Record<string, any> = {
      amount: params.amount,
      api_key: apiKey,
      destination: params.phone,
      ipn_url: params.ipnUrl || "",
      service_id: parseInt(params.serviceId, 10),
      custom_data: params.customData || params.orderId,
    };

    console.log(`[PixPay] Initiating ${params.amount} for ${params.phone} | service_id=${params.serviceId} | country=${params.countryCode}`);

    const res = await fetch(PIXPAY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    console.log(`[PixPay] Response:`, JSON.stringify(data));

    if (data.statut_code !== 200 || !data.data) {
      return {
        success: false,
        message: data.message || "Échec de l'initiation PixPay",
        raw: data,
      };
    }

    const d = data.data;
    const state = (d.state || "").toUpperCase();
    if (state === "FAILED" || state === "CANCELLED") {
      return { success: false, message: d.response || "Transaction PixPay rejetée", raw: data };
    }

    return {
      success: true,
      transactionId: d.transaction_id,
      status: d.state || "PENDING1",
      message: data.message,
      raw: data,
    };
  } catch (err: any) {
    console.error("[PixPay] Error:", err);
    return { success: false, message: err.message || "Erreur réseau PixPay" };
  }
}

// ─── Check transaction status ─────────────────────────────────────────────────
// PixPay doesn't have a dedicated status endpoint in the docs,
// so we rely on IPN callbacks. For polling we consider PENDING1 = still pending.
export async function checkPixPayStatus(
  transactionId: string,
  countryCode: string = "CM"
): Promise<{ status: "completed" | "failed" | "pending"; raw?: any }> {
  // PixPay uses IPN exclusively. We store final state via webhook.
  // If still pending after timeout, the poller will fail it.
  // Mark as pending until IPN arrives.
  return { status: "pending" };
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

// ─── Fee computation ──────────────────────────────────────────────────────────
export function computePixPayFees(
  grossAmount: number,
  pixpayFeeRate: number,
  ashtechMarginPct: number = 2.0
) {
  const totalFeeRate = pixpayFeeRate + ashtechMarginPct;
  const totalFeeAmount = grossAmount * totalFeeRate / 100;
  const pixpayFeeAmount = grossAmount * pixpayFeeRate / 100;
  const ashtechFeeAmount = grossAmount * ashtechMarginPct / 100;
  const creditedAmount = grossAmount - totalFeeAmount;

  return {
    pixpayFeeRate,
    ashtechFeeRate: ashtechMarginPct,
    totalFeeRate,
    pixpayFeeAmount: Math.round(pixpayFeeAmount * 100) / 100,
    ashtechFeeAmount: Math.round(ashtechFeeAmount * 100) / 100,
    totalFeeAmount: Math.round(totalFeeAmount * 100) / 100,
    creditedAmount: Math.round(creditedAmount * 100) / 100,
  };
}

// ─── Supported countries list for admin display ───────────────────────────────
export const PIXPAY_SUPPORTED_COUNTRIES = [
  // XAF zone
  { code: "CM", name: "Cameroun", currency: "XAF" },
  { code: "CF", name: "Centrafrique", currency: "XAF" },
  { code: "TD", name: "Tchad", currency: "XAF" },
  { code: "GQ", name: "Guinée équatoriale", currency: "XAF" },
  { code: "CG", name: "Congo Brazzaville", currency: "XAF" },
  { code: "GA", name: "Gabon", currency: "XAF" },
  // XOF zone
  { code: "BF", name: "Burkina Faso", currency: "XOF" },
  { code: "BJ", name: "Bénin", currency: "XOF" },
  { code: "CI", name: "Côte d'Ivoire", currency: "XOF" },
  { code: "GW", name: "Guinée-Bissau", currency: "XOF" },
  { code: "ML", name: "Mali", currency: "XOF" },
  { code: "NE", name: "Niger", currency: "XOF" },
  { code: "SN", name: "Sénégal", currency: "XOF" },
  { code: "TG", name: "Togo", currency: "XOF" },
  { code: "GN", name: "Guinée Conakry", currency: "XOF" },
  // CDF zone
  { code: "CD", name: "RD Congo", currency: "CDF" },
];
