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

// Convert an XAF amount to the target currency using admin rates
export function convertFromXAF(amountXAF: number, targetCurrency: string, fxRates: Record<string, number>): number {
  const target = normalizeCurrency(targetCurrency);
  if (target === "XAF" || target === "XOF") return amountXAF; // CFA franc: 1:1
  const xafRate = fxRates["XAF"] || 585;
  const targetRate = fxRates[target] || xafRate;
  return amountXAF * (targetRate / xafRate);
}

// Convert any currency amount to XAF using admin rates
export function convertToXAF(amount: number, fromCurrency: string, fxRates: Record<string, number>): number {
  const from = normalizeCurrency(fromCurrency);
  if (from === "XAF" || from === "XOF") return amount; // CFA franc: 1:1
  const xafRate = fxRates["XAF"] || 585;
  const fromRate = fxRates[from] || xafRate;
  return amount * (xafRate / fromRate);
}

// Convert between two arbitrary currencies via XAF as pivot
export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  fxRates: Record<string, number>
): number {
  const fromNorm = normalizeCurrency(fromCurrency);
  const toNorm = normalizeCurrency(toCurrency);
  if (fromNorm === toNorm) return amount;
  const amountInXAF = convertToXAF(amount, fromNorm, fxRates);
  return convertFromXAF(amountInXAF, toNorm, fxRates);
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
//  1. Both payment currency and preferred currency are CFA francs → credit primary balance (1:1 parity)
//  2. Payment currency matches preferred currency → credit primary balance (no conversion)
//  3. Different non-CFA currency → credit (or auto-create) a secondary wallet in payment currency
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
  const normalizedPayment = normalizeCurrency(paymentCurrency);
  const normalizedPreferred = normalizeCurrency(preferredCurrency);

  // Rule 1: Both currencies are CFA francs → credit primary balance
  if (CFA_CURRENCIES.has(paymentCurrency) && CFA_CURRENCIES.has(preferredCurrency)) {
    await storage.updateUserBalance(userId, amount);
    return;
  }

  // Rule 2: Same currency as preferred → credit primary balance
  if (normalizedPayment === normalizedPreferred) {
    await storage.updateUserBalance(userId, amount);
    return;
  }

  // Rule 3: Different currency → credit secondary wallet (auto-create if needed)
  console.log(`[walletHelper] Crediting secondary wallet ${normalizedPayment} for user ${userId}: +${amount}`);
  await storage.upsertWallet(userId, normalizedPayment, amount);

  // Cleanup any zero-balance secondary wallets
  await cleanupEmptyWallets(userId);
}
