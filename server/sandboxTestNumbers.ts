export const SANDBOX_COLLECT_STATUSES = [
  "success",
  "pending",
  "failed",
  "otp_required",
  "cancelled",
] as const;

export type SandboxCollectStatus = (typeof SANDBOX_COLLECT_STATUSES)[number];

const STATUS_SUFFIXES: Record<SandboxCollectStatus, string> = {
  success: "000000001",
  pending: "000000002",
  failed: "000000003",
  otp_required: "000000004",
  cancelled: "000000005",
};

const STATUS_LABELS: Record<SandboxCollectStatus, string> = {
  success: "Paiement confirmé immédiatement",
  pending: "Paiement accepté, confirmation en attente",
  failed: "Paiement refusé",
  otp_required: "Un OTP est requis",
  cancelled: "Paiement annulé",
};

function digits(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "");
}

function dialDigits(dialCode: unknown): string {
  return digits(dialCode).replace(/^00/, "");
}

/**
 * Sandbox numbers are deliberately outside normal subscriber ranges. They are
 * matched only after the request country has already been resolved, so the
 * same test suffix can be used for every active operator in that country.
 */
export function sandboxPhoneForStatus(
  dialCode: string | null | undefined,
  status: SandboxCollectStatus,
): string {
  const prefix = dialDigits(dialCode);
  if (!prefix) throw new Error("A country dial code is required for sandbox numbers.");
  return `+${prefix}${STATUS_SUFFIXES[status]}`;
}

export function sandboxLocalPhoneForStatus(status: SandboxCollectStatus): string {
  return STATUS_SUFFIXES[status];
}

export function getSandboxCollectScenario(
  phone: unknown,
  dialCode: string | null | undefined,
): SandboxCollectStatus | null {
  const normalizedPhone = digits(phone);
  const prefix = dialDigits(dialCode);
  if (!normalizedPhone || !prefix) return null;

  for (const status of SANDBOX_COLLECT_STATUSES) {
    const suffix = STATUS_SUFFIXES[status];
    const fullNumber = `${prefix}${suffix}`;
    if (normalizedPhone === fullNumber || normalizedPhone === suffix) {
      return status;
    }
  }
  return null;
}

export function sandboxStatusLabel(status: SandboxCollectStatus): string {
  return STATUS_LABELS[status];
}

export function isSandboxTestTransaction(
  transaction: {
    type?: unknown;
    source?: unknown;
    metadata?: unknown;
  } | null | undefined,
): boolean {
  if (!transaction) return false;
  if (transaction.type === "sandbox_test" || transaction.source === "sandbox") return true;

  let metadata = transaction.metadata;
  if (typeof metadata === "string") {
    try {
      metadata = JSON.parse(metadata);
    } catch {
      return false;
    }
  }

  return !!metadata &&
    typeof metadata === "object" &&
    !Array.isArray(metadata) &&
    (metadata as Record<string, unknown>).sandboxTest === true;
}