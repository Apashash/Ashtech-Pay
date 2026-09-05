const COUNTRY_PHONE_PREFIXES: Record<string, string> = {
  CM: "237", SN: "221", CI: "225", BF: "226", ML: "223",
  GN: "224", BJ: "229", TG: "228", NE: "227", CD: "243",
  CG: "242", CF: "236", TD: "235", GA: "241", GQ: "240",
  MG: "261", RW: "250", KE: "254", TZ: "255", UG: "256",
  GH: "233", NG: "234",
};

function normalizedOperatorName(operatorName: string): string {
  return operatorName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function toLocalMobileMoneyPhone(phone: string, countryCode: string): string {
  let digits = phone.replace(/\D/g, "");
  const countryPrefix = COUNTRY_PHONE_PREFIXES[countryCode.toUpperCase()];

  if (digits.startsWith("00")) digits = digits.slice(2);
  if (countryPrefix && digits.startsWith(countryPrefix)) {
    digits = digits.slice(countryPrefix.length);
  }
  if (digits.startsWith("0") && digits.length > 8) {
    digits = digits.slice(1);
  }

  return digits;
}

/**
 * Togo's two mobile-money brands use different number ranges:
 * - Flooz/Moov: 70–79xxxxxx
 * - T-Money/Togocel: 90–99xxxxxx
 *
 * Return a user-facing error only when the selected operator is one of these
 * brands and the number is clearly assigned to the other one.
 */
export function validateMobileMoneyPhone(
  phone: string,
  countryCode: string,
  operatorName: string,
): string | null {
  if (countryCode.toUpperCase() !== "TG") return null;

  const localPhone = toLocalMobileMoneyPhone(phone, countryCode);
  const operator = normalizedOperatorName(operatorName);
  const isTMoney = operator.includes("tmoney") || operator.includes("togocel");
  const isFlooz = operator.includes("flooz") || operator.includes("moov");

  if (!/^\d{8}$/.test(localPhone)) {
    return "Le numéro togolais doit contenir 8 chiffres après +228.";
  }

  if (isTMoney && localPhone.startsWith("7")) {
    return "Ce numéro commence par 7 et correspond à Flooz (Moov). Sélectionnez Flooz (Moov) ou saisissez un numéro T-Money commençant par 9.";
  }

  if (isFlooz && localPhone.startsWith("9")) {
    return "Ce numéro commence par 9 et correspond à T-Money. Sélectionnez T-Money ou saisissez un numéro Flooz (Moov) commençant par 7.";
  }

  return null;
}