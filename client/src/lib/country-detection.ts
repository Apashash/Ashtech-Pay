const TIMEZONE_COUNTRIES: Record<string, string> = {
  "Africa/Abidjan": "CI",
  "Africa/Bamako": "ML",
  "Africa/Bangui": "CF",
  "Africa/Bissau": "GW",
  "Africa/Brazzaville": "CG",
  "Africa/Douala": "CM",
  "Africa/Kinshasa": "CD",
  "Africa/Lome": "TG",
  "Africa/Libreville": "GA",
  "Africa/Malabo": "GQ",
  "Africa/Ndjamena": "TD",
  "Africa/Niamey": "NE",
  "Africa/Porto-Novo": "BJ",
  "Africa/Ouagadougou": "BF",
  "Africa/Dakar": "SN",
};

const LOCALE_COUNTRIES: Record<string, string> = {
  BJ: "BJ",
  BF: "BF",
  CF: "CF",
  CI: "CI",
  CM: "CM",
  CD: "CD",
  CG: "CG",
  GA: "GA",
  GQ: "GQ",
  GW: "GW",
  ML: "ML",
  NE: "NE",
  SN: "SN",
  TD: "TD",
  TG: "TG",
};

export function getBrowserCountryCode(): string | undefined {
  if (typeof window === "undefined") return undefined;

  const languages = navigator.languages?.length
    ? navigator.languages
    : [navigator.language];
  for (const language of languages) {
    const region = language.split("-")[1]?.toUpperCase();
    if (region && LOCALE_COUNTRIES[region]) return LOCALE_COUNTRIES[region];
  }

  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const timezoneCountry = TIMEZONE_COUNTRIES[timezone];
    if (timezoneCountry) return timezoneCountry;
  } catch {
    // Continue with the locale fallback.
  }

  return undefined;
}

export async function getCloudflareCountryCode(): Promise<string | undefined> {
  if (typeof window === "undefined") return undefined;

  try {
    const response = await fetch("/cdn-cgi/trace", { cache: "no-store" });
    if (!response.ok) return undefined;
    const trace = await response.text();
    const country = trace
      .split(/\r?\n/)
      .find(line => line.startsWith("loc="))
      ?.slice(4)
      .trim()
      .toUpperCase();
    return country && /^[A-Z]{2}$/.test(country) ? country : undefined;
  } catch {
    return undefined;
  }
}