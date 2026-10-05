export function isPrimaryWalletCurrency(walletCurrency: string, primaryCurrency: string): boolean {
  return walletCurrency.trim().toUpperCase() === primaryCurrency.trim().toUpperCase();
}
