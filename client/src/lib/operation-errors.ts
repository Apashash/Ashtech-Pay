const ADMIN_BLOCKED_OPERATION_CODES = new Set([
  "WITHDRAWAL_BLOCKED",
  "OPERATOR_DISABLED_BY_ADMIN",
  "OPERATION_DISABLED_BY_ADMIN",
]);

export function isAdminBlockedOperationError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" && ADMIN_BLOCKED_OPERATION_CODES.has(code);
}