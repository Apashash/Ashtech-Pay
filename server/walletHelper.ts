import { storage } from "./storage";
import { ALL_FX_CURRENCIES } from "@shared/schema";

// CFA franc currencies — XAF and XOF and all Swychr country-specific variants
// All have the same value (1 XAF = 1 XOF, both pegged to EUR at same rate)
export const CFA_CURRENCIES = new Set([
  "XAF", "XAFC", "XAFG",                                         // Central African CFA (BEAC)
  "XOF", "XOFC", "XOFF", "XOFN", "XOFB", "XOFT", "XOFS", "XOFM", // West African CFA (BCEAO)
]);

// Normalize Swychr country-specific CFA codes to standard codes
// NOTE: We keep specific codes like XOFT if the user's preferred currency is XOFT
export function normalizeCurrency(currency: string, preferredCurrency?: string): string {
  if (preferredCurrency && currency !== preferredCurrency) {
    // If the payment is XOFT and user prefers XOFT, keep it.
    // If payment is XOF and user prefers XOFT, we might want to keep it as XOF or map it.
    // The user specifically wants XOFT to be the main account for Togo.
    if (["XOF", "XOFC", "XOFF", "XOFN", "XOFB", "XOFT", "XOFS", "XOFM"].includes(currency) && 
        ["XOF", "XOFC", "XOFF", "XOFN", "XOFB", "XOFT", "XOFS", "XOFM"].includes(preferredCurrency)) {
      return preferredCurrency;
    }
    if (["XAF", "XAFC", "XAFG"].includes(currency) && 
        ["XAF", "XAFC", "XAFG"].includes(preferredCurrency)) {
      return preferredCurrency;
    }
  }

  // Fallback to standard normalization if no preferred match
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

// Convert an amount to the target currency using admin rates (USD as pivot)
export function convertFromXAF(amountXAF: number, targetCurrency: string, fxRates: Record<string, number>): number {
  if (targetCurrency === "XAF") return amountXAF;
  
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
  
  // 1. Convert Source to USD
  const fromRate = fxRates[fromCurrency];
  const amountUSD = fromRate ? (amount / fromRate) : amount;

  // 2. Convert USD to Target
  const targetRate = fxRates[toCurrency];
  return targetRate ? (amountUSD * targetRate) : amountUSD;
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
//  1. Normalize payment currency (e.g., XOFT -> XOF)
//  2. Exact match with preferred currency (normalized) → credit primary balance
//  3. Different currency → credit secondary wallet
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
  const normalizedPayment = normalizeCurrency(paymentCurrency, preferredCurrency);

  // Rule 1: Match normalized currencies → credit primary balance
  if (normalizedPayment === preferredCurrency) {
    await storage.updateUserBalance(userId, amount);
    return;
  }

  // Rule 2: Different currency → credit secondary wallet using normalized code
  console.log(`[walletHelper] Crediting secondary wallet ${normalizedPayment} for user ${userId}: +${amount}`);
  await storage.upsertWallet(userId, normalizedPayment, amount);

  // Cleanup any zero-balance secondary wallets
  await cleanupEmptyWallets(userId);
}
