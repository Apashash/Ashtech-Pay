import { storage } from "./storage";
import { ALL_FX_CURRENCIES } from "@shared/schema";

// CFA franc currencies — XAF and XOF and all Swychr country-specific variants
// All have the same value (1 XAF = 1 XOF, both pegged to EUR at same rate)
export const CFA_CURRENCIES = new Set([
  "XAF", "XAFC", "XAFG",                                         // Central African CFA (BEAC)
  "XOF", "XOFC", "XOFF", "XOFN", "XOFB", "XOFT", "XOFS", "XOFM", // West African CFA (BCEAO)
]);


// Load fx rates (units per 1 USD) from admin "Devises & Taux de change" settings
export async function loadFxRates(): Promise<Record<string, number>> {
  const allSettings = await storage.getAllSettings();
  const rates: Record<string, number> = {};
  allSettings.forEach(s => {
    if (s.key.startsWith("fx_rate_")) {
      const code = s.key.replace("fx_rate_", "");
      const val = parseFloat(s.value);
      if (!isNaN(val) && val > 0) rates[code] = val;
    }
  });
  ALL_FX_CURRENCIES.forEach(c => {
    if (!rates[c.code]) rates[c.code] = c.defaultRate;
  });
  return rates;
}

// Convert an amount to the target currency using admin rates (USD as pivot)
export function convertFromXAF(amountXAF: number, targetCurrency: string, fxRates: Record<string, number>): number {
  if (targetCurrency === "XAF") return amountXAF;
  // All CFA variants (XOF, XOFS, XOFC, XOFT, etc.) are 1:1 with XAF
  if (CFA_CURRENCIES.has(targetCurrency)) return amountXAF;
  
  // 1. Convert XAF to USD (A to USD)
  const xafRate = fxRates["XAF"] || 585;
  const amountUSD = amountXAF / xafRate;
  
  // 2. Convert USD to Target (USD to B)
  const targetRate = fxRates[targetCurrency];
  if (targetRate === undefined) {
    console.warn(`[walletHelper] No rate found for ${targetCurrency}, falling back to 1:1 with USD`);
    return amountUSD;
  }

  return amountUSD * targetRate;
}

// Convert any currency amount to XAF using admin rates (USD as pivot)
export function convertToXAF(amount: number, fromCurrency: string, fxRates: Record<string, number>): number {
  if (fromCurrency === "XAF") return amount;
  // All CFA variants (XOF, XOFS, XOFC, XOFT, etc.) are 1:1 with XAF
  if (CFA_CURRENCIES.has(fromCurrency)) return amount;
  
  // 1. Convert Source to USD (A to USD)
  const fromRate = fxRates[fromCurrency];
  if (fromRate === undefined) {
    console.warn(`[walletHelper] No rate found for ${fromCurrency}, falling back to 1:1 with USD`);
    return amount; // Treat as USD if no rate
  }
  const amountUSD = amount / fromRate;

  // 2. Convert USD to XAF (USD to B)
  const xafRate = fxRates["XAF"] || 585;
  return amountUSD * xafRate;
}

// Convert between two arbitrary currencies via USD as pivot
export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  fxRates: Record<string, number>
): number {
  if (fromCurrency === toCurrency) return amount;
  // CFA variants are all 1:1 with each other
  if (CFA_CURRENCIES.has(fromCurrency) && CFA_CURRENCIES.has(toCurrency)) return amount;
  
  // 1. Convert Source to USD
  const fromRate = CFA_CURRENCIES.has(fromCurrency) ? (fxRates["XAF"] || 585) : fxRates[fromCurrency];
  const amountUSD = fromRate ? (amount / fromRate) : amount;

  // 2. Convert USD to Target
  const targetRate = CFA_CURRENCIES.has(toCurrency) ? (fxRates["XAF"] || 585) : fxRates[toCurrency];
  return targetRate ? (amountUSD * targetRate) : amountUSD;
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

  // Rule 2: Any other currency (including same-family CFA variants) → own secondary wallet
  // e.g. XOFT for Togo, XAFG for Gabon — each country has its own wallet
  console.log(`[walletHelper] Crediting secondary wallet ${paymentCurrency} for user ${userId}: +${amount}`);
  await storage.upsertWallet(userId, paymentCurrency, amount);
}
