export const PROVIDER_COUNTRY_CODES = {
  // Current AfribaPay country catalogue, including countries verified from the live API.
  afribapay: ["BJ", "BF", "CD", "CF", "CG", "CI", "CM", "GA", "GM", "GN", "GW", "ML", "NE", "SN", "TD", "TG"],
  pixpay: ["CM", "CD", "CI", "SN", "BF"],
  pawapay: ["BJ", "BF", "CM", "CI", "CD", "ET", "GA", "GH", "KE", "LS", "MW", "MZ", "NG", "CG", "RW", "SN", "SL", "TZ", "UG", "ZM"],
} as const;

export type PayoutProvider = keyof typeof PROVIDER_COUNTRY_CODES;

export const PAYOUT_PROVIDER_LABELS: Record<PayoutProvider, string> = {
  afribapay: "AfribaPay",
  pixpay: "PixPay",
  pawapay: "PawaPay",
};

export function getPayoutProviderCountryCodes(provider: PayoutProvider): readonly string[] {
  return PROVIDER_COUNTRY_CODES[provider];
}

export function isProviderAvailable(provider: PayoutProvider, countryCode: string): boolean {
  return (PROVIDER_COUNTRY_CODES[provider] as readonly string[])
    .includes(countryCode.trim().toUpperCase());
}

export function getAvailablePayoutProviders(countryCode: string): PayoutProvider[] {
  const normalized = countryCode.trim().toUpperCase();
  return (Object.keys(PROVIDER_COUNTRY_CODES) as PayoutProvider[])
    .filter(provider => isProviderAvailable(provider, normalized));
}