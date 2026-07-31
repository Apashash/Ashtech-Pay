/** Minimum gross crypto amount accepted by the Pay-In flows. */
export const MIN_CRYPTO_USDT = 1;

/**
 * Returns the amount of the selected coin worth one USDT.
 * Prices are expressed in USD and USDT is treated as 1 USD.
 */
export function minimumCryptoAmount(priceUsd: number): number {
  return priceUsd > 0 ? MIN_CRYPTO_USDT / priceUsd : 0;
}

export function formatCryptoAmount(amount: number): string {
  if (amount >= 1) return amount.toFixed(2);
  if (amount >= 0.01) return amount.toFixed(4);
  return amount.toFixed(8);
}