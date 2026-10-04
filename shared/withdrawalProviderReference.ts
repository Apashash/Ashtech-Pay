export interface WithdrawalProviderReferenceInput {
  reference?: string | null;
  externalReference?: string | null;
  metadata?: unknown;
}

function recordFromMetadata(metadata: unknown): Record<string, unknown> {
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    return metadata as Record<string, unknown>;
  }
  if (typeof metadata === "string") {
    try {
      const parsed: unknown = JSON.parse(metadata);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Ignore malformed legacy metadata and avoid showing an internal ref.
    }
  }
  return {};
}

export function getWithdrawalProviderReference(
  transaction: WithdrawalProviderReferenceInput,
): string | null {
  const metadata = recordFromMetadata(transaction.metadata);
  const savedProviderReference = metadata.providerReference;
  if (typeof savedProviderReference === "string" && savedProviderReference.trim()) {
    return savedProviderReference;
  }

  const externalReference = transaction.externalReference;
  if (!externalReference) return null;

  const internalReference = transaction.reference;
  if (
    internalReference &&
    (externalReference === internalReference ||
      externalReference.startsWith(`${internalReference}-R`))
  ) {
    return null;
  }

  // AfribaPay's order_id is supplied by AshTechPay for lookup; it is not the
  // provider's transaction_id and must not be shown as a provider reference.
  if (String(metadata.paymentProvider || "").toLowerCase() === "afribapay") {
    return null;
  }

  return externalReference;
}