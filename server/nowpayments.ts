import crypto from "crypto";

const NOWPAYMENTS_API_KEY = process.env.NOWPAYMENTS_API_KEY || "";
const NOWPAYMENTS_IPN_SECRET = process.env.NOWPAYMENTS_IPN_SECRET || "";
const BASE_URL = "https://api.nowpayments.io/v1";

export interface NowPaymentsInvoiceParams {
  priceAmount: number;
  priceCurrency: string;
  payCurrency: string;
  orderId: string;
  orderDescription: string;
  ipnCallbackUrl: string;
  successUrl: string;
  cancelUrl: string;
}

export async function createNowPaymentsInvoice(params: NowPaymentsInvoiceParams): Promise<{ id: string; invoice_url: string; order_id: string }> {
  const body = {
    price_amount: params.priceAmount,
    price_currency: params.priceCurrency,
    pay_currency: params.payCurrency,
    order_id: params.orderId,
    order_description: params.orderDescription,
    ipn_callback_url: params.ipnCallbackUrl,
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
  };

  const res = await fetch(`${BASE_URL}/invoice`, {
    method: "POST",
    headers: {
      "x-api-key": NOWPAYMENTS_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`NowPayments invoice error (${res.status}): ${errText}`);
  }

  return res.json();
}

export async function getNowPaymentsPaymentStatus(paymentId: string): Promise<{
  payment_id: string;
  payment_status: string;
  actually_paid: number;
  pay_currency: string;
  price_amount: number;
  price_currency: string;
  order_id: string;
}> {
  const res = await fetch(`${BASE_URL}/payment/${paymentId}`, {
    headers: { "x-api-key": NOWPAYMENTS_API_KEY },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`NowPayments status error (${res.status}): ${errText}`);
  }

  return res.json();
}

function sortObjectDeep(obj: any): any {
  if (Array.isArray(obj)) return obj.map(sortObjectDeep);
  if (obj !== null && typeof obj === "object") {
    return Object.keys(obj).sort().reduce((acc: any, key) => {
      acc[key] = sortObjectDeep(obj[key]);
      return acc;
    }, {});
  }
  return obj;
}

export function verifyNowPaymentsIpn(rawBody: Record<string, any>, signature: string): boolean {
  try {
    if (!NOWPAYMENTS_IPN_SECRET || !signature) return false;
    const sorted = JSON.stringify(sortObjectDeep(rawBody));
    const hmac = crypto.createHmac("sha512", NOWPAYMENTS_IPN_SECRET);
    hmac.update(sorted);
    const computed = hmac.digest("hex");
    return computed === signature.toLowerCase();
  } catch {
    return false;
  }
}

// NowPayments statuses: waiting, confirming, confirmed, sending, partially_paid, finished, failed, refunded, expired
export function mapNowPaymentsStatus(status: string): "pending" | "completed" | "failed" {
  if (["finished", "confirmed", "sending"].includes(status)) return "completed";
  if (["failed", "refunded", "expired"].includes(status)) return "failed";
  return "pending";
}
