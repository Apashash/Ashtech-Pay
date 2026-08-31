export interface PawaPayFeeUpdateInput {
  pawapayFee?: unknown;
  ashtechMargin?: unknown;
  isActive?: unknown;
  minFee?: unknown;
}

type ExistingFeeValues = {
  pawapayFee?: unknown;
  ashtechMargin?: unknown;
};

function parseNonNegativeRate(value: unknown, label: string): number {
  const parsed = typeof value === "number" ? value : parseFloat(String(value ?? "").trim());
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("Taux invalide");
  }
  return parsed;
}

/**
 * Builds the update sent by the dedicated PawaPay fee route.
 * Undefined fields keep their stored value; explicit zero is preserved.
 */
export function buildPawaPayFeeUpdates(
  input: PawaPayFeeUpdateInput,
  existing: ExistingFeeValues = {},
): Record<string, unknown> {
  const hasProviderFee = input.pawapayFee !== undefined;
  const hasMargin = input.ashtechMargin !== undefined;
  const providerFee = hasProviderFee
    ? parseNonNegativeRate(input.pawapayFee, "pawapayFee")
    : parseNonNegativeRate(existing.pawapayFee ?? 0, "pawapayFee");
  const margin = hasMargin
    ? parseNonNegativeRate(input.ashtechMargin, "ashtechMargin")
    : parseNonNegativeRate(existing.ashtechMargin ?? 0, "ashtechMargin");

  const updates: Record<string, unknown> = {};
  if (hasProviderFee) updates.pawapayFee = String(providerFee);
  if (hasMargin) updates.ashtechMargin = String(margin);
  if (hasProviderFee || hasMargin) updates.feeValue = (providerFee + margin).toFixed(4);
  if (input.isActive !== undefined) updates.isActive = Boolean(input.isActive);
  if (input.minFee !== undefined) updates.minFee = input.minFee ? String(input.minFee) : null;
  return updates;
}