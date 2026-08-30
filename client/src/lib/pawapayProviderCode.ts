const PAWAPAY_ALPHA3_BY_COUNTRY: Record<string, string> = {
  BJ: "BEN",
  BF: "BFA",
  CD: "COD",
  CI: "CIV",
  CM: "CMR",
  CG: "COG",
  CF: "CAF",
  GA: "GAB",
  GH: "GHA",
  GW: "GNB",
  KE: "KEN",
  LS: "LSO",
  ML: "MLI",
  MW: "MWI",
  MZ: "MOZ",
  NE: "NER",
  NG: "NGA",
  RW: "RWA",
  SN: "SEN",
  SL: "SLE",
  TD: "TCD",
  TG: "TGO",
  TZ: "TZA",
  UG: "UGA",
  ZM: "ZMB",
};

const SPECIAL_PROVIDER_CODES: Record<string, string> = {
  "ET:telebirr": "TELEBIRR_ETH",
  "ET:m-pesa": "MPESA_ETH",
  "GH:mtn mobile money": "MTN_MOMO_GHA",
  "GH:vodafone cash": "VODAFONE_GHA",
  "GH:airteltigo money": "AIRTELTIGO_GHA",
  "KE:m-pesa": "MPESA_KEN",
  "LS:vodacom mpesa": "VODACOM_LSO",
  "LS:ecocash": "ECOCASH_LSO",
  "MW:tnm mpamba": "TNM_MWI",
  "MZ:m-pesa": "MPESA_MOZ",
  "MZ:e-mola": "EMOLA_MOZ",
  "NG:9mobile": "9MOBILE_NGA",
  "NG:glo mobile": "GLO_NGA",
  "SL:afrimoney": "AFRIMONEY_SLE",
  "ZM:zamtel money": "ZAMTEL_ZMB",
};

function normalizeOperatorName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Returns the documented PawaPay provider code for a country/operator pair.
 * A code already stored on the operator remains authoritative; this helper is
 * only used to prefill the admin form when the database value is still empty.
 */
export function guessPawaPayProviderCode(operatorName: string, countryCode: string): string {
  const country = countryCode.toUpperCase();
  const normalizedName = normalizeOperatorName(operatorName);
  const explicit = SPECIAL_PROVIDER_CODES[`${country}:${normalizedName}`];
  if (explicit) return explicit;

  const alpha3 = PAWAPAY_ALPHA3_BY_COUNTRY[country];
  if (!alpha3) return "";

  if (normalizedName.includes("mtn")) return `MTN_MOMO_${alpha3}`;
  if (normalizedName.includes("orange")) return `ORANGE_${alpha3}`;
  if (normalizedName.includes("airtel")) return `AIRTEL_${alpha3}`;
  if (normalizedName.includes("moov") || normalizedName.includes("flooz")) return `MOOV_${alpha3}`;
  if (normalizedName.includes("wave")) return `WAVE_${alpha3}`;
  if (normalizedName.includes("mpesa") || normalizedName.includes("m-pesa")) return `MPESA_${alpha3}`;
  if (normalizedName.includes("free")) return `FREE_${alpha3}`;
  if (normalizedName.includes("tigo")) return `TIGO_${alpha3}`;
  if (normalizedName.includes("tmoney") || normalizedName.includes("t-money")) return `TMONEY_${alpha3}`;
  if (normalizedName.includes("togocel")) return `TOGOCEL_${alpha3}`;
  return "";
}