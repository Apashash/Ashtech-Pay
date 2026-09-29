export type UserPhoneInputResult =
  | { ok: true; phone: string | null }
  | { ok: false };

const PHONE_PRESENTATION_CHARS = /^[+\d\s().-]+$/;

/**
 * Validate and normalize a user's phone before writing it to the users table.
 * Common formatting is accepted, but letters and other arbitrary characters
 * are rejected instead of being silently stripped or stored.
 */
export function parseUserPhoneInput(input: unknown): UserPhoneInputResult {
  if (input === undefined || input === null) {
    return { ok: true, phone: null };
  }

  if (typeof input !== "string") {
    return { ok: false };
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return { ok: true, phone: null };
  }

  if (!PHONE_PRESENTATION_CHARS.test(trimmed)) {
    return { ok: false };
  }

  const compact = trimmed.replace(/[\s().-]/g, "");
  if (!/^\+?\d+$/.test(compact)) {
    return { ok: false };
  }

  const phone = compact.startsWith("+") ? compact.slice(1) : compact;
  return phone ? { ok: true, phone } : { ok: false };
}