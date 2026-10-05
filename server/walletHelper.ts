import crypto from "crypto";
import { storage } from "./storage";
import { ALL_FX_CURRENCIES } from "@shared/schema-runtime";
import { notifyConversionStarted } from "./telegram";

// CFA franc currencies — XAF, XOF, and country-specific wallet variants
// All have the same value (1 XAF = 1 XOF, both pegged to EUR at same rate)
export const CFA_CURRENCIES = new Set([
  "XAF", "XAFC", "XAFG", "XAFCF", "XAFTD",                       // Central African CFA (BEAC)
  "XOF", "XOFC", "XOFF", "XOFN", "XOFB", "XOFT", "XOFS", "XOFM", "XOFGW", // West African CFA (BCEAO)
]);

export const DEFAULT_CONVERSION_MINIMUM_XAF = 500;

export async function getConversionMinimumXaf(): Promise<number> {
  const setting = await storage.getSetting("conversion_minimum_xaf");
  if (!setting) return DEFAULT_CONVERSION_MINIMUM_XAF;
  const minimum = Number(setting.value);
  if (!Number.isSafeInteger(minimum) || minimum <= 0) {
    throw new Error("INVALID_CONVERSION_MINIMUM_XAF");
  }
  return minimum;
}

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

export function minimumConversionAmountInCurrency(
  minimumXaf: number,
  currency: string,
  fxRates: Record<string, number>,
): number {
  const amount = convertFromXAF(minimumXaf, currency, fxRates);
  return Math.ceil(Math.max(0, amount - 1e-9) * 100) / 100;
}

export function minimumConversionErrorMessage(
  minimumXaf: number,
  currency: string,
  fxRates: Record<string, number>,
): string {
  const localMinimum = minimumConversionAmountInCurrency(minimumXaf, currency, fxRates);
  return `Le minimum de conversion est de ${minimumXaf.toLocaleString("fr-FR")} FCFA, soit au moins ${localMinimum.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} ${currency}.`;
}

// West African CFA family (BCEAO) — XOF and all country-specific variants are 1:1
const XOF_FAMILY = new Set(["XOF", "XOFC", "XOFF", "XOFN", "XOFB", "XOFT", "XOFS", "XOFM", "XOFGW"]);
// Central African CFA family (BEAC) — XAF and country-specific variants are 1:1
const XAF_FAMILY = new Set(["XAF", "XAFC", "XAFG", "XAFCF", "XAFTD"]);

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
  } else {
    // Rule 2: Any other currency → own secondary wallet
    console.log(`[walletHelper] Crediting secondary wallet ${paymentCurrency} for user ${userId}: +${amount}`);
    await storage.upsertWallet(userId, paymentCurrency, amount);
  }

  // After crediting, check if the user has an auto-conversion rule set up
  // for the currency they just received money in — if so, auto-convert it.
  await maybeAutoConvert(userId, paymentCurrency, amount).catch((err) => {
    console.error(`[AutoConversion] Unhandled error for user ${userId}:`, err?.message || err);
  });
}

function generateAutoConversionReference(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `ASHPAY-CONV-${timestamp}-${random}`;
}

// If the user has an active auto-conversion rule for `creditedCurrency`,
// automatically debit the just-credited amount and schedule a conversion
// to the rule's target currency (executed by the existing conversionPoller,
// exactly like a manual conversion).
export async function maybeAutoConvert(
  userId: string,
  creditedCurrency: string,
  creditedAmount: number
): Promise<string | null> {
  const rule = await storage.getAutoConversionRuleByCurrency(userId, creditedCurrency);
  if (!rule || rule.toCurrency === creditedCurrency) return null;

  const user = await storage.getUser(userId);
  if (!user) return null;
  const userPrimary = user.preferredCurrency || "XAF";

  // Re-check actual available balance for the credited currency (in case of
  // concurrent debits happening between the credit and this check).
  let available: number;
  if (creditedCurrency === userPrimary) {
    available = parseFloat(user.balance);
  } else {
    const w = await storage.getWallet(userId, creditedCurrency);
    available = w ? parseFloat(w.balance) : 0;
  }
  const amountToConvert = Math.min(creditedAmount, available);
  if (amountToConvert <= 0) return null;

  const pairKey = getConversionPairKey(creditedCurrency, rule.toCurrency);
  const PAIR_DEFAULTS: Record<string, [number, number]> = {
    xaf_xaf: [0, 0], xof_xof: [0, 0],
    xof_xaf: [1, 1], xaf_xof: [1, 1],
    cdf_cfa: [3, 2], cfa_cdf: [3, 2],
    cfa_usdt: [1, 1], usdt_cfa: [1, 1],
  };
  const [defProvider, defAshtech] = (pairKey && PAIR_DEFAULTS[pairKey]) ? PAIR_DEFAULTS[pairKey] : [1, 1];
  const [providerFeeSetting, ashtechFeeSetting] = pairKey
    ? await Promise.all([
        storage.getSetting(`conversion_provider_fee_${pairKey}`),
        storage.getSetting(`conversion_ashtech_fee_${pairKey}`),
      ])
    : [null, null];
  const providerFeePercent = providerFeeSetting ? parseFloat(providerFeeSetting.value) : defProvider;
  const ashtechFeePercent  = ashtechFeeSetting  ? parseFloat(ashtechFeeSetting.value)  : defAshtech;
  const totalFeePercent = providerFeePercent + ashtechFeePercent;

  const providerFeeAmount = (amountToConvert * providerFeePercent) / 100;
  const ashtechFeeAmount = (amountToConvert * ashtechFeePercent) / 100;
  const totalFeeAmount = providerFeeAmount + ashtechFeeAmount;
  const amountAfterFee = amountToConvert - totalFeeAmount;

  const fxRates = await loadFxRates();
  const minimumXaf = await getConversionMinimumXaf();
  if (convertToXAF(amountToConvert, creditedCurrency, fxRates) < minimumXaf - 1e-7) {
    console.log(`[AutoConversion] Skipping ${userId} ${creditedCurrency}->${rule.toCurrency}: amount is below ${minimumXaf} XAF minimum`);
    return null;
  }
  const amountInXAF = convertToXAF(amountAfterFee, creditedCurrency, fxRates);
  const receivedAmount = convertFromXAF(amountInXAF, rule.toCurrency, fxRates);

  if (!isFinite(receivedAmount) || receivedAmount <= 0) {
    console.error(`[AutoConversion] Invalid computed amount for user ${userId}: ${creditedCurrency}->${rule.toCurrency}`);
    return null;
  }

  const delaySeconds = Math.floor(Math.random() * (15 - 5 + 1)) + 5;
  const executeAt = Date.now() + delaySeconds * 1000;
  const reference = generateAutoConversionReference();
  const transactionId = crypto.randomUUID();
  const conversionId = crypto.randomUUID();
  let transaction: any;
  let convReq: any;
  try {
    ({ transaction, conversionRequest: convReq } = await storage.createConversionAndDebit(
      {
        id: transactionId,
        userId,
        type: "conversion",
        amount: amountToConvert.toFixed(2),
        currency: creditedCurrency,
        status: "pending",
        description: `Conversion automatique ${amountToConvert.toFixed(2)} ${creditedCurrency} → ${receivedAmount.toFixed(2)} ${rule.toCurrency} (règle auto)`,
        reference,
        feeAmount: totalFeeAmount.toFixed(2),
        ashtechFeeAmount: ashtechFeeAmount.toFixed(2),
        totalAmount: receivedAmount.toFixed(2),
        recipientCountry: rule.toCurrency,
        ...(rule.notifyUrl ? { source: "api", notifyUrl: rule.notifyUrl } : {}),
        ...(rule.notifyUrl ? { metadata: { conversionId, automatic: true } } : {}),
      } as any,
      {
        id: conversionId,
        userId,
        fromCurrency: creditedCurrency,
        toCurrency: rule.toCurrency,
        fromAmount: amountToConvert.toFixed(2),
        toAmount: receivedAmount.toFixed(2),
        status: "pending",
        notes: JSON.stringify({
          executeAt,
          txId: transactionId,
          feeAmount: totalFeeAmount.toFixed(2),
          feePercent: `${providerFeePercent}% opérateurs + ${ashtechFeePercent}% Ashtech = ${totalFeePercent}`,
          fromAmount: amountToConvert.toFixed(2),
          toAmount: receivedAmount.toFixed(2),
          auto: true,
        }),
      } as any,
      amountToConvert,
      creditedCurrency,
    ));
  } catch (debitErr: any) {
    console.error(`[AutoConversion] Atomic debit/request failed for user ${userId}:`, debitErr.message);
    return null;
  }

  await storage.createUserNotification({
    userId,
    title: "Conversion automatique en cours...",
    message: `Vous avez reçu ${amountToConvert.toFixed(2)} ${creditedCurrency}. Conversion automatique vers ${rule.toCurrency} en cours.`,
    transactionId: transaction.id,
    type: "info",
  }).catch((error) => console.error("[AutoConversion] Notification failed:", error?.message || error));

  console.log(`[AutoConversion] ${reference} — user ${userId}: ${amountToConvert} ${creditedCurrency} → ${receivedAmount.toFixed(2)} ${rule.toCurrency} in ${delaySeconds}s`);

  notifyConversionStarted({
    userName: user.fullName || user.username,
    userEmail: user.email || "",
    fromAmount: amountToConvert.toFixed(2),
    fromCurrency: creditedCurrency,
    toAmount: receivedAmount.toFixed(2),
    toCurrency: rule.toCurrency,
    feeAmount: totalFeeAmount.toFixed(2),
    feePercent: `${providerFeePercent}% opérateurs + ${ashtechFeePercent}% Ashtech = ${totalFeePercent}`,
    reference: transaction.reference || "",
    userCountry: user.country || "",
    estimatedSeconds: delaySeconds,
    conversionId: convReq.id,
  }).catch(() => {});
  return convReq.id;
}
