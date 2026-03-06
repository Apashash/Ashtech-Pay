import { storage } from "./storage";
import { ALL_FX_CURRENCIES } from "@shared/schema";

// CFA franc currencies — XAF and XOF and all Swychr country-specific variants
// All have the same value (1 XAF = 1 XOF, both pegged to EUR at same rate)
export const CFA_CURRENCIES = new Set([
  "XAF", "XAFC", "XAFG",                                         // Central African CFA (BEAC)
  "XOF", "XOFC", "XOFF", "XOFN", "XOFB", "XOFT", "XOFS", "XOFM", // West African CFA (BCEAO)
]);

// Normalize Swychr country-specific CFA codes to standard codes
// XAFC (Congo Brazza) → XAF, XOFC (Côte d'Ivoire) → XOF, etc.
export function normalizeCurrency(currency: string): string {
  if (["XAF", "XAFC", "XAFG"].includes(currency)) return "XAF";
  if (["XOF", "XOFC", "XOFF", "XOFN", "XOFB", "XOFT", "XOFS", "XOFM"].includes(currency)) return "XOF";
  return currency;
}

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

// Convert an amount to the target currency using admin rates (Strict country codes)
export function convertFromXAF(amountXAF: number, targetCurrency: string, fxRates: Record<string, number>): number {
  if (targetCurrency === "XAF") return amountXAF;
  
  // All rates in fxRates are "Units per 1 USD" (e.g., XAF=585, GHS=12)
  const xafRate = fxRates["XAF"] || 585;
  const targetRate = fxRates[targetCurrency];
  
  if (targetRate === undefined) {
    console.warn(`[walletHelper] No rate found for ${targetCurrency}, falling back to 1:1 with XAF`);
    return amountXAF;
  }

  // Formula: Amount_Target = Amount_XAF * (Rate_Target / Rate_XAF)
  // Example: 585 XAF -> ? GHS with XAF=585, GHS=12
  // 585 * (12 / 585) = 12 GHS. Correct.
  return amountXAF * (targetRate / xafRate);
}

// Convert any currency amount to XAF using admin rates (Strict country codes)
export function convertToXAF(amount: number, fromCurrency: string, fxRates: Record<string, number>): number {
  if (fromCurrency === "XAF") return amount;
  
  const xafRate = fxRates["XAF"] || 585;
  const fromRate = fxRates[fromCurrency];

  if (fromRate === undefined) {
    console.warn(`[walletHelper] No rate found for ${fromCurrency}, falling back to 1:1 with XAF`);
    return amount;
  }

  // Formula: Amount_XAF = Amount_From * (Rate_XAF / Rate_From)
  // Example: 12 GHS -> ? XAF with XAF=585, GHS=12
  // 12 * (585 / 12) = 585 XAF. Correct.
  return amount * (xafRate / fromRate);
}

// Convert between two arbitrary currencies via XAF as pivot (Strict country codes)
export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  fxRates: Record<string, number>
): number {
  if (fromCurrency === toCurrency) return amount;
  const amountInXAF = convertToXAF(amount, fromCurrency, fxRates);
  return convertFromXAF(amountInXAF, toCurrency, fxRates);
}

// Delete zero-balance secondary wallets for a user (cleanup unused wallets)
export async function cleanupEmptyWallets(userId: string): Promise<void> {
  try {
    const wallets = await storage.getUserWallets(userId);
    for (const wallet of wallets) {
      if (parseFloat(wallet.balance || "0") <= 0) {
        await storage.deleteWallet(wallet.id);
      }
    }
  } catch (err) {
    console.error("[walletHelper] cleanupEmptyWallets error:", err);
  }
}

// Smart wallet crediting using admin exchange rates:
//
// Rules (in order):
//  1. Exact match with preferred currency → credit primary balance
//  2. Different currency (even XOF/XAF from different countries) → credit secondary wallet
//
// After any secondary wallet operation, zero-balance wallets are cleaned up.
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

  // Rule 1: Exact match with preferred currency → credit primary balance
  if (paymentCurrency === preferredCurrency) {
    await storage.updateUserBalance(userId, amount);
    return;
  }

  // Rule 2: Different currency → credit secondary wallet (specific code like XOFB, XOFF, XAFG, etc.)
  console.log(`[walletHelper] Crediting secondary wallet ${paymentCurrency} for user ${userId}: +${amount}`);
  await storage.upsertWallet(userId, paymentCurrency, amount);

  // Cleanup any zero-balance secondary wallets
  await cleanupEmptyWallets(userId);
}
