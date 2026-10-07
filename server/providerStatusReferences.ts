export type PayoutStatusProvider = "afribapay" | "pixpay" | "pawapay" | "izichange";

export interface ProviderPayoutAttemptFailure {
  success: false;
  message?: unknown;
  providerMessage?: unknown;
  providerCode?: unknown;
  providerStatus?: unknown;
  httpStatus?: unknown;
  status?: unknown;
  raw?: unknown;
}

export function normalizePayoutStatusProvider(value: unknown): PayoutStatusProvider | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return normalized === "afribapay" || normalized === "pixpay" ||
    normalized === "pawapay" || normalized === "izichange"
    ? normalized
    : null;
}

export function resolvePayoutStatusProvider(...candidates: unknown[]): PayoutStatusProvider | null {
  for (const candidate of candidates) {
    const provider = normalizePayoutStatusProvider(candidate);
    if (provider) return provider;
  }
  return null;
}

/**
 * A retry is safe only when the provider returned a response that explicitly
 * rejects this attempt for insufficient provider funds. Network/timeout/5xx,
 * NOT_FOUND, and generic failures are deliberately not retryable.
 */
export function isExplicitInsufficientPayoutBalance(
  provider: PayoutStatusProvider,
  result: ProviderPayoutAttemptFailure,
): boolean {
  if (result.success !== false) return false;

  const raw = result.raw && typeof result.raw === "object"
    ? result.raw as Record<string, any>
    : undefined;
  const rawData = raw?.data && typeof raw.data === "object" ? raw.data : undefined;
  const rawError = raw?.error && typeof raw.error === "object" ? raw.error : undefined;
  const rawDataError = rawData?.error && typeof rawData.error === "object" ? rawData.error : undefined;
  const providerCode = String(
    result.providerCode ??
    raw?.code ??
    raw?.error_code ??
    raw?.statut_code ??
    rawError?.code ??
    rawData?.code ??
    rawData?.statut_code ??
    rawDataError?.code ??
    "",
  ).trim().toUpperCase();
  const providerMessage = [
    result.message,
    result.providerMessage,
    raw?.message,
    typeof raw?.error === "string" ? raw.error : rawError?.message,
    rawData?.message,
    typeof rawData?.error === "string" ? rawData.error : rawDataError?.message,
  ].filter((value) => typeof value === "string").join(" ").toLowerCase();
  const providerStatus = result.providerStatus == null ? Number.NaN : Number(result.providerStatus);
  const transportStatus = result.httpStatus == null
    ? Number((result.status as any)?.httpStatus)
    : Number(result.httpStatus);
  const responseStatus = Number.isFinite(transportStatus) ? transportStatus : providerStatus;
  const resultState = String(
    result.status ??
    raw?.status ??
    raw?.state ??
    raw?.statut_code ??
    rawData?.status ??
    rawData?.state ??
    rawData?.statut_code ??
    "",
  ).trim().toLowerCase();

  const hasResponse =
    raw !== undefined ||
    providerCode.length > 0 ||
    Number.isFinite(responseStatus);
  if (!hasResponse) return false;
  if (
    responseStatus === 404 ||
    responseStatus === 408 ||
    responseStatus === 409 ||
    responseStatus === 429 ||
    responseStatus >= 500
  ) return false;

  const insufficientCode = /(?:^|[^A-Z])(INSUFFICIENT(?:[_ -]?(?:PROVIDER|WALLET))?[_ -]?(?:BALANCE|FUNDS)|BALANCE[_ -]?(?:INSUFFICIENT|LOW)|LOW[_ -]?BALANCE|NO[_ -]?(?:BALANCE|FUNDS)|NOT[_ -]?ENOUGH[_ -]?FUNDS)(?:$|[^A-Z])/.test(providerCode);
  const insufficientMessage =
    /insufficient.{0,40}(balance|funds)|(?:balance|funds).{0,40}insufficient|low.{0,20}balance|(?:balance|funds).{0,20}(too low|low)|not enough.{0,30}(balance|funds)|solde.{0,40}(insuff|trop bas|faible)|insuff.{0,40}solde|fonds.{0,40}insuff/.test(providerMessage);
  if (!insufficientCode && !insufficientMessage) return false;
  if (["not_found", "not found", "notfound"].includes(resultState)) return false;
  if (
    ["pending", "pending1", "pending2", "pending3", "processing", "accepted", "created", "queued", "in_progress", "unknown"].includes(resultState) ||
    (resultState === "error" && !insufficientCode)
  ) return false;

  const isHttpRejection = [400, 402, 422].includes(responseStatus);
  const isApplicationRejection =
    ["failed", "rejected"].includes(resultState) &&
    (responseStatus === 200 || !Number.isFinite(responseStatus));

  // IziChange errors carry explicit HTTP status/code fields rather than a raw
  // body, so only an explicit payment/validation rejection is retryable.
  if (provider === "izichange") return isHttpRejection;

  // Some provider APIs return application-level rejection bodies over HTTP
  // 200. Accept those only when the body itself marks the payout rejected.
  const hasErrorEnvelope = !!(
    rawError ||
    rawDataError ||
    raw?.success === false ||
    rawData?.success === false
  );
  const pixPayApplicationRejection =
    provider === "pixpay" &&
    raw?.statut_code != null &&
    Number(raw.statut_code) !== 200;
  return isHttpRejection || isApplicationRejection || (
    responseStatus === 200 && hasErrorEnvelope
  ) || pixPayApplicationRejection;
}

export function canRetryPayoutWithProvider(
  metadata: Record<string, unknown> | null | undefined,
  provider: string,
): boolean {
  return metadata?.payoutRetrySafe === true &&
    metadata.payoutRetryProvider === provider;
}

export function isPixPayPayoutProvider(metadata?: Record<string, unknown> | null): boolean {
  return metadata?.paymentProvider === "pixpay" ||
    metadata?.pendingPayoutProvider === "pixpay";
}

export function isPixPayManualPayoutProcessable(
  provider: string,
  currentStatus: string,
  metadata?: Record<string, unknown> | null,
): boolean {
  return provider === "pixpay" &&
    currentStatus === "pending_manual" &&
    isPixPayPayoutProvider(metadata);
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

function payoutMetadataRecord(metadata: unknown): Record<string, unknown> {
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
      // Malformed legacy metadata cannot authorize a provider lookup.
    }
  }
  return {};
}

/**
 * Resolve a provider status lookup ID from the current persisted transaction.
 * AfribaPay, PawaPay, and IziChange require confirmed provider IDs and must
 * never fall back to an AshTech transaction reference.
 */
export function resolvePayoutStatusLookupReference(
  provider: PayoutStatusProvider,
  transaction: {
    reference?: string | null;
    externalReference?: string | null;
    metadata?: unknown;
  },
  iziPayoutId?: string | null,
): string | null {
  if (provider === "afribapay") {
    const transactionId = payoutMetadataRecord(transaction.metadata).afribapayStatusTransactionId;
    return typeof transactionId === "string" && transactionId.trim()
      ? transactionId.trim()
      : null;
  }
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