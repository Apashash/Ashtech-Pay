export type PublicPaymentState =
  | "completed"
  | "failed"
  | "redirect"
  | "preauthorisation"
  | "confirm_phone"
  | "wait_provider";

const AUTH_TYPES = new Set(["PREAUTH", "PROVIDER_AUTH", "REDIRECT_AUTH"]);

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function safeString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function buildPublicPaymentStatus(input: {
  status: string;
  reference: string | null;
  description?: string | null;
  metadata?: unknown;
}) {
  const metadata = asRecord(input.metadata) || {};
  const authorizationUrl = safeString(metadata.authorizationUrl);
  const nextStep = safeString(metadata.nextStep);
  const authTypeValue = safeString(metadata.authType);
  const authType = authTypeValue && AUTH_TYPES.has(authTypeValue) ? authTypeValue : null;
  const storedFailure = asRecord(metadata.failureReason);
  const failureReason = storedFailure
    ? {
        failureCode: safeString(storedFailure.failureCode),
        failureMessage: safeString(storedFailure.failureMessage),
      }
    : null;

  const state: PublicPaymentState = input.status === "completed"
    ? "completed"
    : input.status === "failed"
      ? "failed"
      : authorizationUrl
        ? "redirect"
        : authType === "PREAUTH"
          ? "preauthorisation"
          : authType === "PROVIDER_AUTH"
            ? "confirm_phone"
            : "wait_provider";

  return {
    status: input.status,
    state,
    reference: input.reference,
    description: input.status === "failed"
      ? safeString(input.description) || failureReason?.failureMessage || null
      : undefined,
    failureReason: input.status === "failed" ? failureReason : null,
    authorizationUrl,
    nextStep,
    authType,
    // Kept for compatibility with older checkout clients. Provider requests
    // are intentionally never made by the public status endpoint anymore.
    providerStatusUnavailable: false,
  };
}