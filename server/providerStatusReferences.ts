export type PayoutStatusProvider = "afribapay" | "pixpay" | "pawapay" | "izichange";

export function normalizePayoutStatusProvider(value: unknown): PayoutStatusProvider | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return normalized === "afribapay" || normalized === "pixpay" ||
    normalized === "pawapay" || normalized === "izichange"
    ? normalized
    : null;
}

export function shouldUseManualPayoutStatusOverride(input: {
  transactionType: string;
  currentStatus: string;
  requestedStatus: string;
  externalReference?: string | null;
  forceManual?: boolean;
}): boolean {
  return (
    (input.transactionType === "withdrawal" || input.transactionType === "transfer_out") &&
    ["pending", "pending_manual", "processing"].includes(input.currentStatus) &&
    (input.forceManual === true || !!input.externalReference?.trim() || input.currentStatus === "processing") &&
    ["completed", "failed", "cancelled"].includes(input.requestedStatus)
  );
}

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