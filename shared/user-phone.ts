export type PhoneInputResult =
  | { ok: true; phone: string | null }
  | { ok: false };

export type UserPhoneInputResult = PhoneInputResult;

const PHONE_PRESENTATION_CHARS = /^[+\d\s().-]+$/;

/**
 * Validate and normalize a phone value before persisting or forwarding it.
 * Common formatting is accepted, but letters and other arbitrary characters
 * are rejected instead of being silently stripped or stored.
 */
export function parsePhoneInput(input: unknown): PhoneInputResult {
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

export const parseUserPhoneInput = parsePhoneInput;