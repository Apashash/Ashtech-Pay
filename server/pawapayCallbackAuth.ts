import { timingSafeEqual } from "node:crypto";

// Settings expose a template, never the stored secret. The operator replaces
// this placeholder privately in the provider dashboard, not in public settings.
export function pawaPayCallbackUrlTemplate(endpoint: string): string {
  return `${endpoint}?token=REPLACE_WITH_URL_ENCODED_CALLBACK_SECRET`;
}

/** A provider UUID is public to the payer, not proof of callback origin. */
export function verifyPawaPayCallbackToken(secret: unknown, token: unknown): boolean {
  if (typeof secret !== "string" || !secret.trim() ||
      typeof token !== "string" || !token) return false;
  const expected = Buffer.from(secret);
  const supplied = Buffer.from(token);
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}
