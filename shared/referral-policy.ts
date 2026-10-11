export const REFERRAL_RULES = {
  durationDays: 5,
  requiredTransactions: 3,
  marginPercent: 0.3,
  maxDiscountedOperations: 20,
  maxVolumeMultiplier: 5,
} as const;

export function referralPromoActive(
  startsAt: Date | string | null,
  expiresAt: Date | string | null,
  cancelledAt: Date | string | null,
  now = Date.now(),
): boolean {
  return !cancelledAt && !!startsAt && !!expiresAt
    && new Date(startsAt).getTime() <= now && new Date(expiresAt).getTime() > now;
}

/** A promotion must never make the normal price more expensive. */
export function referralFee(amount: number, providerPercent: number, normalFee: number) {
  if (![amount, providerPercent, normalFee].every(Number.isFinite)
    || amount <= 0 || providerPercent < 0 || normalFee < 0) {
    throw new Error("Tarification de parrainage invalide");
  }
  const providerFee = Math.round(amount * providerPercent) / 100;
  const margin = Math.round(amount * REFERRAL_RULES.marginPercent) / 100;
  const total = Math.round((providerFee + margin) * 100) / 100;
  return total < normalFee ? { total, margin, providerFee } : null;
}

export function isReferralTransaction(tx: {
  type: string; status: string; paymentMethod?: string | null; source?: string | null;
  paymentLinkId?: string | null; paymentIntentId?: string | null;
  metadata?: Record<string, unknown> | null;
}): boolean {
  return ["deposit", "withdrawal"].includes(tx.type)
    && tx.status === "completed" && tx.paymentMethod === "mobile_money"
    && !tx.paymentLinkId && !tx.paymentIntentId
    && (!tx.source || tx.source === "dashboard")
    && !tx.metadata?.sandbox && !tx.metadata?.simulation
    && !tx.metadata?.refunded && !tx.metadata?.refundProcessed;
}
