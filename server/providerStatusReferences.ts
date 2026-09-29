export type PayoutStatusProvider = "afribapay" | "pixpay" | "pawapay" | "izichange";

/**
 * Resolve a provider status lookup ID from the current persisted transaction.
 * PawaPay and IziChange require their provider IDs and must never fall back to
 * an AshTech transaction reference.
 */
export function resolvePayoutStatusLookupReference(
  provider: PayoutStatusProvider,
  transaction: { reference?: string | null; externalReference?: string | null },
  iziPayoutId?: string | null,
): string | null {
  if (provider === "pawapay") {
    return transaction.externalReference?.trim() || null;
  }
  if (provider === "izichange") {
    return iziPayoutId?.trim() || null;
  }
  return transaction.externalReference?.trim()
    || transaction.reference?.trim()
    || null;
}