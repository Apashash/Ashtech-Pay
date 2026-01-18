import { EXCHANGE_RATES, CURRENCY_SYMBOLS, type SupportedCurrency } from "@shared/schema";

export function convertCurrency(amountXAF: number, toCurrency: SupportedCurrency): number {
  const rate = EXCHANGE_RATES[toCurrency];
  return amountXAF * rate;
}

export function formatCurrency(amount: string | number, currency: SupportedCurrency = "XAF"): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  const convertedAmount = convertCurrency(num, currency);
  
  const symbol = CURRENCY_SYMBOLS[currency];
  
  if (currency === "USD" || currency === "EUR") {
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
  { value: "USD", label: "$", flag: "🇺🇸", name: "Dollar US" },
  { value: "EUR", label: "€", flag: "🇪🇺", name: "Euro" },
] as const;
