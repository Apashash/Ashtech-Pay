const DEBUG_ERROR_VALUES = new Set(["1", "true", "yes", "on"]);

export const shouldExposeDebugErrors =
  process.env.NODE_ENV !== "production" &&
  DEBUG_ERROR_VALUES.has((process.env.DEBUG_DATABASE_ERRORS || "").trim().toLowerCase());

export function formatDebugError(error: unknown): string {
  const value = error as {
    code?: unknown;
    errno?: unknown;
    sqlState?: unknown;
    message?: unknown;
  } | null;
  const code = typeof value?.code === "string" ? value.code : "";
  const errno = typeof value?.errno === "number" || typeof value?.errno === "string"
    ? String(value.errno)
    : "";
  const sqlState = typeof value?.sqlState === "string" ? value.sqlState : "";
  const rawMessage = typeof value?.message === "string"
    ? value.message
    : String(error);
  const message = rawMessage
    .replace(/\b(mysql2?|postgres(?:ql)?):\/\/[^\s"'<>]+/gi, "$1://[redacted]")
    .replace(/((?:password|passwd|pwd)\s*[=:]\s*)[^\s&;,]+/gi, "$1[redacted]");
  const metadata = [
    code && `code=${code}`,
    errno && `errno=${errno}`,
    sqlState && `sqlState=${sqlState}`,
  ].filter(Boolean);
  return `${metadata.length ? `${metadata.join(" ")} ` : ""}${message}`;
}