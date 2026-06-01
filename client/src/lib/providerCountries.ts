// Codes pays supportés par chaque fournisseur de paiement
// Swychr : UG, TG, TZ, SN, RW, NG, NE, ML, KE, CI, GN, GH, GA, CD, CG, CM, BF, BJ
export const SWYCHR_COUNTRY_CODES = ["BJ","BF","CM","CG","CD","CI","GA","GN","GH","KE","ML","NE","NG","UG","RW","SN","TZ","TG"];

// AfribaPay : BJ, BF, CM, CF, CG, CI, GA, GM, GN, GW, ML, NE, CD, SN, TD, TG
export const AFRIBAPAY_COUNTRY_CODES = ["BJ","BF","CM","CF","CG","CI","GA","GM","GN","GW","ML","NE","CD","SN","TD","TG"];

// PixPay : CM, CD, CI, SN, BF seulement
export const PIXPAY_COUNTRY_CODES = ["CM","CD","CI","SN","BF"];

export function isProviderAvailable(provider: "swychr" | "afribapay" | "pixpay", countryCode: string): boolean {
  if (provider === "swychr") return SWYCHR_COUNTRY_CODES.includes(countryCode);
  if (provider === "afribapay") return AFRIBAPAY_COUNTRY_CODES.includes(countryCode);
  if (provider === "pixpay") return PIXPAY_COUNTRY_CODES.includes(countryCode);
  return false;
}
