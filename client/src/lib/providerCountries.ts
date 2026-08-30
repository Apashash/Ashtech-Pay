// AfribaPay : BJ, BF, CM, CF, CG, CI, GA, GW, ML, NE, CD, SN, TD, TG
export const AFRIBAPAY_COUNTRY_CODES = ["BJ","BF","CM","CF","CG","CI","GA","GW","ML","NE","CD","SN","TD","TG"];

// PixPay : CM, CD, CI, SN, BF seulement
export const PIXPAY_COUNTRY_CODES = ["CM","CD","CI","SN","BF"];

// PawaPay (documented coverage): BJ, BF, CM, CI, CD, ET, GA, GH, KE, LS, MW, MZ, NG, CG, RW, SN, SL, TZ, UG, ZM
export const PAWAPAY_COUNTRY_CODES = ["BJ","BF","CM","CI","CD","ET","GA","GH","KE","LS","MW","MZ","NG","CG","RW","SN","SL","TZ","UG","ZM"];

export function isProviderAvailable(provider: "afribapay" | "pixpay" | "pawapay", countryCode: string): boolean {
  if (provider === "afribapay") return AFRIBAPAY_COUNTRY_CODES.includes(countryCode);
  if (provider === "pixpay") return PIXPAY_COUNTRY_CODES.includes(countryCode);
  if (provider === "pawapay") return PAWAPAY_COUNTRY_CODES.includes(countryCode);
  return false;
}
