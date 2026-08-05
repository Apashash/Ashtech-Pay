// AfribaPay : BJ, BF, CM, CF, CG, CI, GA, GM, GN, GW, ML, NE, CD, SN, TD, TG
export const AFRIBAPAY_COUNTRY_CODES = ["BJ","BF","CM","CF","CG","CI","GA","GM","GN","GW","ML","NE","CD","SN","TD","TG"];

// PixPay : CM, CD, CI, SN, BF seulement
export const PIXPAY_COUNTRY_CODES = ["CM","CD","CI","SN","BF"];

export function isProviderAvailable(provider: "afribapay" | "pixpay", countryCode: string): boolean {
  if (provider === "afribapay") return AFRIBAPAY_COUNTRY_CODES.includes(countryCode);
  if (provider === "pixpay") return PIXPAY_COUNTRY_CODES.includes(countryCode);
  return false;
}
