import { ALL_FX_CURRENCIES, CURRENCY_SYMBOLS, type SupportedCurrency } from "@shared/schema";

// Build default rates from ALL_FX_CURRENCIES (admin panel currencies)
const DEFAULT_RATES: Record<string, number> = {};
ALL_FX_CURRENCIES.forEach(c => { DEFAULT_RATES[c.code] = c.defaultRate; });

export function formatWalletBalance(amount: string | number, currency: string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  const symbol = (CURRENCY_SYMBOLS as Record<string, string>)[currency] || currency;
  if (currency === "USD") return `$${num.toFixed(2)}`;
  if (currency === "EUR") return `${num.toFixed(2)} €`;
  if (currency === "USDT") return `${new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(num)} USDT`;
  return `${new Intl.NumberFormat("fr-FR").format(Math.round(num))} ${symbol}`;
}

export function convertCurrency(amountXAF: number, toCurrency: string, customRates?: Record<string, number>): number {
  const rates = customRates || DEFAULT_RATES;
  const xafRate = rates["XAF"] ?? DEFAULT_RATES["XAF"] ?? 585;
  const toRate = rates[toCurrency] ?? DEFAULT_RATES[toCurrency] ?? 1;
  // amountXAF is in XAF units; convert to USD then to target
  const inUSD = amountXAF / xafRate;
  return inUSD * toRate;
}

// Currencies whose amounts are stored natively (not as XAF equivalents)
// and must NOT be converted through the XAF pivot before display.
// CDF has defaultRate 0 in schema — it is stored in its own unit.
const NATIVE_CRYPTO_CURRENCIES = new Set(["USDT", "CDF"]);

export function formatCurrency(amount: string | number, currency: SupportedCurrency = "XAF", customRates?: Record<string, number>): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;

  // Crypto currencies are stored in their own unit — never divide by the XAF rate
  if (NATIVE_CRYPTO_CURRENCIES.has(currency as string)) {
    const symbol = (CURRENCY_SYMBOLS as Record<string, string>)[currency] || currency;
    const formatted = new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(num);
    return `${formatted} ${symbol}`;
  }

  const convertedAmount = convertCurrency(num, currency, customRates);

  const symbol = (CURRENCY_SYMBOLS as Record<string, string>)[currency] || currency;

  if (currency === "USD" || (currency as string) === "EUR") {
    const formatted = new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(convertedAmount);
    return currency === "USD" ? `$${formatted}` : `${formatted} €`;
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
  RWF: { label: "RWF", flag: "🇷🇼", name: "Franc Rwandais" },
  TZS: { label: "TZS", flag: "🇹🇿", name: "Shilling Tanzanien" },
  UGX: { label: "UGX", flag: "🇺🇬", name: "Shilling Ougandais" },
};
