import { storage } from "./storage";
import { ALL_FX_CURRENCIES } from "@shared/schema";

// CFA franc currencies — XAF and XOF and all Swychr country-specific variants
// All have the same value (1 XAF = 1 XOF, both pegged to EUR at same rate)
export const CFA_CURRENCIES = new Set([
  "XAF", "XAFC", "XAFG",                                         // Central African CFA (BEAC)
  "XOF", "XOFC", "XOFF", "XOFN", "XOFB", "XOFT", "XOFS", "XOFM", // West African CFA (BCEAO)
]);

// XAF reference (1 USD ≈ 585 XAF) — used only for fallback default computation
const XAF_PER_USD = 585;

// Build fallback defaults: XAF-direct (how many XAF = 1 unit of currency)
// using ALL_FX_CURRENCIES which stores USD-pivot rates (units per 1 USD)
const FALLBACK_RATES: Record<string, number> = {};
ALL_FX_CURRENCIES.forEach(c => {
  // xaf_direct = (XAF per USD) / (currency per USD) = XAF per 1 unit of currency
  FALLBACK_RATES[c.code] = XAF_PER_USD / c.defaultRate;
});
// CFA variants all 1:1 with XAF
CFA_CURRENCIES.forEach(code => { FALLBACK_RATES[code] = 1; });

// Load XAF-direct rates from countries table.
// Each country has: currency (e.g. "CDF") + exchangeRate (XAF per 1 unit)
// If multiple countries share the same currency, the last one wins (they should be identical).
export async function loadFxRates(): Promise<Record<string, number>> {
  const allCountries = await storage.getAllCountries();
  const rates: Record<string, number> = { ...FALLBACK_RATES };

  allCountries.forEach((c: any) => {
    const rate = parseFloat(c.exchangeRate as string);
    if (c.currency && !isNaN(rate) && rate > 0) {
      rates[c.currency] = rate;
    }
  });

  // CFA currencies are always 1:1 with XAF
  CFA_CURRENCIES.forEach(code => { rates[code] = 1; });

  return rates;
}

// Convert an amount in `fromCurrency` to XAF using XAF-direct rates
export function convertToXAF(amount: number, fromCurrency: string, fxRates: Record<string, number>): number {
  if (fromCurrency === "XAF") return amount;
  if (CFA_CURRENCIES.has(fromCurrency)) return amount;

  const rate = fxRates[fromCurrency];
  if (rate === undefined || rate === 0) {
    console.warn(`[walletHelper] No rate found for ${fromCurrency}, falling back to 1:1`);
    return amount;
  }
  // rate = XAF per 1 unit of fromCurrency
  return amount * rate;
}

// Convert an XAF amount to `targetCurrency` using XAF-direct rates
export function convertFromXAF(amountXAF: number, targetCurrency: string, fxRates: Record<string, number>): number {
  if (targetCurrency === "XAF") return amountXAF;
  if (CFA_CURRENCIES.has(targetCurrency)) return amountXAF;

  const rate = fxRates[targetCurrency];
  if (rate === undefined || rate === 0) {
    console.warn(`[walletHelper] No rate found for ${targetCurrency}, falling back to 1:1`);
    return amountXAF;
  }
  // rate = XAF per 1 unit of targetCurrency  →  targetCurrency per XAF = 1/rate
  return amountXAF / rate;
}

// Convert between two arbitrary currencies via XAF as pivot
export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  fxRates: Record<string, number>
): number {
  if (fromCurrency === toCurrency) return amount;
  if (CFA_CURRENCIES.has(fromCurrency) && CFA_CURRENCIES.has(toCurrency)) return amount;

  const amountInXAF = convertToXAF(amount, fromCurrency, fxRates);
  return convertFromXAF(amountInXAF, toCurrency, fxRates);
}


// West African CFA family (BCEAO) — XOF and all country-specific variants are 1:1
const XOF_FAMILY = new Set(["XOF", "XOFC", "XOFF", "XOFN", "XOFB", "XOFT", "XOFS", "XOFM"]);
// Central African CFA family (BEAC) — XAF and country-specific variants are 1:1
const XAF_FAMILY = new Set(["XAF", "XAFC", "XAFG"]);

export function sameCfaFamily(a: string, b: string): boolean {
  if (XOF_FAMILY.has(a) && XOF_FAMILY.has(b)) return true;
  if (XAF_FAMILY.has(a) && XAF_FAMILY.has(b)) return true;
  return false;
}

// ─── Currency family helpers (for pair-based conversion fees) ─────────────────

// Normalise a currency code to its base family regardless of country suffix.
// XOFT (Togo), XOFC (Côte d'Ivoire), XOFB (Bénin)… → XOF
// XAFG (Gabon), XAFC (Congo)… → XAF
// CDF → CDF
export function normalizeCurrencyFamily(currency: string): "XAF" | "XOF" | "CDF" | "OTHER" {
  if (XOF_FAMILY.has(currency)) return "XOF";
  if (XAF_FAMILY.has(currency)) return "XAF";
  if (currency === "CDF") return "CDF";
  return "OTHER";
}

// Returns the settings key suffix for a conversion pair, e.g. "xof_xaf".
// Used to look up conversion_provider_fee_<key> and conversion_ashtech_fee_<key>.
// Returns null for unknown or same-family pairs (no fee rule applies).
export function getConversionPairKey(fromCurrency: string, toCurrency: string): string | null {
  const from = normalizeCurrencyFamily(fromCurrency);
  const to   = normalizeCurrencyFamily(toCurrency);
  // Intra-famille (même devise → même famille, pays différent)
  if (from === "XAF" && to === "XAF") return "xaf_xaf";
  if (from === "XOF" && to === "XOF") return "xof_xof";
  // Inter-famille CFA
  if (from === "XOF" && to === "XAF") return "xof_xaf";
  if (from === "XAF" && to === "XOF") return "xaf_xof";
  // CDF ↔ CFA
  if (from === "CDF" && (to === "XAF" || to === "XOF")) return "cdf_cfa";
  if ((from === "XAF" || from === "XOF") && to === "CDF") return "cfa_cdf";
  // USDT ↔ CFA (XAF/XOF)
  if ((from === "XAF" || from === "XOF") && toCurrency === "USDT") return "cfa_usdt";
  if (fromCurrency === "USDT" && (to === "XAF" || to === "XOF")) return "usdt_cfa";
  return null;
}

// Smart wallet crediting:
//
// Rules (in order):
//  1. Exact match with preferred currency → credit primary balance (users.balance)
//  2. Any other currency → credit a secondary wallet in the EXACT currency code
//     Each country keeps its own wallet: XOFT (Togo), XAFG (Gabon), XAFC (Congo),
//     XOF (Senegal/generic West Africa), XAF (Cameroon primary), etc.
//     The user then converts between country wallets as needed.
//
export async function creditUserWallet(
  userId: string,
  amount: number,
  paymentCurrency: string
): Promise<void> {
  if (amount <= 0) return;

  const user = await storage.getUser(userId);
  if (!user) {
    console.error(`[walletHelper] creditUserWallet: user ${userId} not found`);
    return;
  }

  const preferredCurrency = user.preferredCurrency || "XAF";

  // Rule 1: Exact match → credit primary balance
  if (paymentCurrency === preferredCurrency) {
    await storage.updateUserBalance(userId, amount);
    return;
  }

  // Rule 2: Any other currency → own secondary wallet
  console.log(`[walletHelper] Crediting secondary wallet ${paymentCurrency} for user ${userId}: +${amount}`);
  await storage.upsertWallet(userId, paymentCurrency, amount);
}
