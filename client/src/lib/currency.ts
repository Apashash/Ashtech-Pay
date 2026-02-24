import { EXCHANGE_RATES, CURRENCY_SYMBOLS, type SupportedCurrency } from "@shared/schema";

export function convertCurrency(amountXAF: number, toCurrency: SupportedCurrency, customRates?: Record<string, number>): number {
  const rates = customRates || EXCHANGE_RATES;
  const rate = rates[toCurrency] ?? EXCHANGE_RATES[toCurrency] ?? 1;
  return amountXAF * rate;
}

export function formatCurrency(amount: string | number, currency: SupportedCurrency = "XAF", customRates?: Record<string, number>): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  const convertedAmount = convertCurrency(num, currency, customRates);
  
  const symbol = CURRENCY_SYMBOLS[currency];
  
  if (currency === "USD" || (currency as string) === "EUR") {
    const formatted = new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(convertedAmount);
    return currency === "USD" ? `${symbol}${formatted}` : `${formatted} ${symbol}`;
  }
  
  return new Intl.NumberFormat("fr-FR").format(Math.round(convertedAmount)) + " " + symbol;
}

export const CURRENCY_OPTIONS = [
  { value: "XAF", label: "XAF", flag: "🇨🇲", name: "Franc CFA (CEMAC)" },
  { value: "XOF", label: "XOF", flag: "🇸🇳", name: "Franc CFA (UEMOA)" },
  { value: "CDF", label: "CDF", flag: "🇨🇩", name: "Franc Congolais" },
  { value: "USD", label: "$", flag: "🇺🇸", name: "Dollar US" },
  { value: "EUR", label: "€", flag: "🇪🇺", name: "Euro" },
] as const;

export const ALL_CURRENCY_META: Record<string, { label: string; flag: string; name: string }> = {
  XAF: { label: "XAF", flag: "🇨🇲", name: "Franc CFA (CEMAC)" },
  XOF: { label: "XOF", flag: "🇸🇳", name: "Franc CFA (UEMOA)" },
  CDF: { label: "CDF", flag: "🇨🇩", name: "Franc Congolais" },
  USD: { label: "$",   flag: "🇺🇸", name: "Dollar US" },
  GHS: { label: "GHS", flag: "🇬🇭", name: "Cédi Ghanéen" },
  NGN: { label: "NGN", flag: "🇳🇬", name: "Naira Nigérian" },
  KES: { label: "KES", flag: "🇰🇪", name: "Shilling Kenyan" },
  RWF: { label: "RWF", flag: "🇷🇼", name: "Franc Rwandais" },
  TZS: { label: "TZS", flag: "🇹🇿", name: "Shilling Tanzanien" },
  UGX: { label: "UGX", flag: "🇺🇬", name: "Shilling Ougandais" },
  GNF: { label: "GNF", flag: "🇬🇳", name: "Franc Guinéen" },
};
