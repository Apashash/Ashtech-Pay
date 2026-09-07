const COUNTRY_PHONE_PREFIXES: Record<string, string> = {
  CM: "237", SN: "221", CI: "225", BF: "226", ML: "223",
  GN: "224", BJ: "229", TG: "228", NE: "227", CD: "243",
  CG: "242", CF: "236", TD: "235", GA: "241", GQ: "240",
  MG: "261", RW: "250", KE: "254", TZ: "255", UG: "256",
  GH: "233", NG: "234",
};

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

export function validateMobileMoneyPhone(
  phone: string,
  countryCode: string,
): string | null {
  if (countryCode.toUpperCase() !== "TG") return null;

  const localPhone = toLocalMobileMoneyPhone(phone, countryCode);

  if (!/^\d{8}$/.test(localPhone)) {
    return "Le numéro togolais doit contenir 8 chiffres après +228.";
  }

  return null;
}