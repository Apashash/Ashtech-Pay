type ProviderErrorRecord = Record<string, unknown>;

export interface ProviderErrorPayloadOptions {
  error: string;
  message?: unknown;
  fallback: string;
  provider?: string;
  raw?: unknown;
  providerCode?: unknown;
  providerStatus?: unknown;
  sensitiveValues?: unknown[];
}

function asRecord(value: unknown): ProviderErrorRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as ProviderErrorRecord
    : null;
}

function nonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    const result = nonEmptyString(value);
    if (result) return result;
  }
  return undefined;
}

function providerCodeString(...values: unknown[]): string | undefined {
  for (const value of values) {
    const candidate = nonEmptyString(value);
    if (candidate && /^[A-Za-z0-9][A-Za-z0-9_.:-]{1,79}$/.test(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

export function extractProviderErrorMessage(raw: unknown): string | undefined {
  const root = asRecord(raw);
  const data = asRecord(root?.data);
  const error = asRecord(root?.error);
  const nestedData = asRecord(data?.data);

  return firstString(
    root?.providerMessage,
    root?.message,
    root?.errorMessage,
    root?.failureReason,
    root?.failureCause,
    root?.reason,
    root?.description,
    root?.detail,
    typeof root?.error === "string" ? root.error : undefined,
    data?.providerMessage,
    data?.message,
    data?.errorMessage,
    data?.failureReason,
    data?.failureCause,
    data?.reason,
    data?.description,
    data?.detail,
    typeof data?.error === "string" ? data.error : undefined,
    error?.message,
    error?.description,
    nestedData?.providerMessage,
    nestedData?.message,
    nestedData?.errorMessage,
    nestedData?.failureReason,
    nestedData?.failureCause,
    nestedData?.description,
    nestedData?.detail,
  );
}

function normalizeStatus(value: unknown): number | string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const stringValue = nonEmptyString(value);
  if (!stringValue) return undefined;
  return /^\d+$/.test(stringValue) ? Number(stringValue) : stringValue;
}

function redactSensitiveText(message: string, sensitiveValues: unknown[] = []): string {
  let safeMessage = message;

  for (const value of sensitiveValues) {
    const sensitive = nonEmptyString(value);
    if (sensitive && sensitive.length >= 4) {
      safeMessage = safeMessage.split(sensitive).join("[redacted]");
    }
  }

  // Do not expose the upstream provider's brand in merchant-facing messages.
  safeMessage = safeMessage.replace(/\b(?:Afriba\s*Pay|Pix\s*Pay|Pawa\s*Pay|Izi\s*Change)\b/gi, "le fournisseur de paiement");

  // Provider messages occasionally echo a destination phone number or an
  // identifier. Never forward long digit sequences from an upstream message.
  return safeMessage.replace(
    /(?<!\d)\+?\d(?:[\d\s().-]*\d){7,}(?!\d)/g,
    "[redacted]",
  );
}

export function extractProviderErrorDetails(raw: unknown): {
  providerCode?: string;
  providerStatus?: number | string;
} {
  const root = asRecord(raw);
  const data = asRecord(root?.data);
  const error = asRecord(root?.error);
  const nestedData = asRecord(data?.data);

  const providerCode = providerCodeString(
    root?.code,
    root?.errorCode,
    root?.error_code,
    error?.code,
    typeof root?.error === "string" ? root.error : undefined,
    data?.code,
    data?.errorCode,
    data?.error_code,
    typeof data?.error === "string" ? data.error : undefined,
    nestedData?.code,
    nestedData?.errorCode,
    nestedData?.error_code,
  );

  const providerStatus = normalizeStatus(
    root?.provider_status ??
    root?.http_status ??
    root?.status_code ??
    root?.statut_code ??
    data?.provider_status ??
    data?.http_status ??
    data?.status_code ??
    data?.statut_code,
  );

  return {
    ...(providerCode ? { providerCode } : {}),
    ...(providerStatus !== undefined ? { providerStatus } : {}),
  };
}

export function buildProviderErrorPayload(
  options: ProviderErrorPayloadOptions,
): Record<string, unknown> {
  const extracted = extractProviderErrorDetails(options.raw);
  const message = redactSensitiveText(
    nonEmptyString(options.message) || extractProviderErrorMessage(options.raw) || options.fallback,
    options.sensitiveValues,
  );
  const providerCode = providerCodeString(options.providerCode, extracted.providerCode);
  const providerStatus = normalizeStatus(options.providerStatus) ?? extracted.providerStatus;

  return {
    error: options.error,
    message,
    ...(providerCode ? { provider_code: providerCode } : {}),
    ...(providerStatus !== undefined ? { provider_status: providerStatus } : {}),
  };
}