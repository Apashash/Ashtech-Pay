import { IziPayClient } from "izichangepay-sdk";

export const IZIPAY_API_KEY = process.env.IZIPAY_API_KEY || "";
export const IZIPAY_WEBHOOK_SECRET = process.env.IZIPAY_WEBHOOK_SECRET || "";

// The SDK derives env (live/test) from the key prefix automatically.
// A placeholder key avoids a crash at startup when the key isn't set yet.
export const izipay = new IziPayClient({
  apiKey: IZIPAY_API_KEY || "sk_test_placeholder",
});

export { IziPayClient };

// Map internal platform currency codes → IziChange-supported fiat currencies.
// IziChange supports: XOF, XAF, GHS, NGN, KES
const IZIPAY_FIAT_MAP: Record<string, string> = {
  XAF:  "XAF", XAFC: "XAF", XAFG: "XAF",
  XOF:  "XOF", XOFC: "XOF", XOFF: "XOF", XOFB: "XOF", XOFT: "XOF", XOFS: "XOF",
  NGN:  "NGN",
  GHS:  "GHS",
  KES:  "KES",
  CDF:  "XAF", // fallback to XAF for Congolese franc (IziChange doesn't support CDF yet)
};

export const IZIPAY_DEFAULT_CURRENCY = "XOF";

/**
 * Map an internal platform currency to an IziChange-supported fiat currency.
 * Falls back to XOF for unknown currencies.
 */
export function toIziPayCurrency(currency: string): string {
  return IZIPAY_FIAT_MAP[(currency ?? "").toUpperCase()] ?? IZIPAY_DEFAULT_CURRENCY;
}

/** Returns true if the IZIPAY_API_KEY is configured */
export function isIziPayConfigured(): boolean {
  return !!IZIPAY_API_KEY && !IZIPAY_API_KEY.startsWith("sk_test_placeholder");
}
