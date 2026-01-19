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
  { value: "CDF", label: "CDF", flag: "🇨🇩", name: "Franc Congolais" },
  { value: "USD", label: "$", flag: "🇺🇸", name: "Dollar US" },
  { value: "EUR", label: "€", flag: "🇪🇺", name: "Euro" },
] as const;
