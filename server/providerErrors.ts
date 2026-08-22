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

  const providerCode = firstString(
    root?.code,
    root?.error_code,
    error?.code,
    typeof root?.error === "string" ? root.error : undefined,
    data?.code,
    data?.error_code,
    typeof data?.error === "string" ? data.error : undefined,
    nestedData?.code,
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
  const message = redactSensitiveText(
    nonEmptyString(options.message) || options.fallback,
    options.sensitiveValues,
  );
  const extracted = extractProviderErrorDetails(options.raw);
  const providerCode = firstString(options.providerCode, extracted.providerCode);
  const providerStatus = normalizeStatus(options.providerStatus) ?? extracted.providerStatus;

  return {
    error: options.error,
    message,
    ...(options.provider ? { provider: options.provider } : {}),
    ...(providerCode ? { provider_code: providerCode } : {}),
    ...(providerStatus !== undefined ? { provider_status: providerStatus } : {}),
  };
}