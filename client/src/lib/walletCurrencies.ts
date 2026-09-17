import { ALL_FX_CURRENCIES } from "@shared/schema";

export const CURRENCY_FLAGS: Record<string, string> = {
  XAF: "🇨🇲", XAFC: "🇨🇬", XAFG: "🇬🇦",
  XOF: "🇸🇳", XOFC: "🇨🇮", XOFF: "🇧🇫", XOFN: "🇳🇪", XOFB: "🇧🇯", XOFT: "🇹🇬", XOFS: "🇸🇳", XOFM: "🇲🇱",
  RWF: "🇷🇼", TZS: "🇹🇿", UGX: "🇺🇬", CDF: "🇨🇩", SLE: "🇸🇱",
  GHS: "🇬🇭", KES: "🇰🇪", NGN: "🇳🇬", MWK: "🇲🇼", LSL: "🇱🇸", ZMK: "🇿🇲", ZAR: "🇿🇦", EGP: "🇪🇬", MAD: "🇲🇦",
  ETB: "🇪🇹", MZN: "🇲🇿", ZWE: "🇿🇼", CVE: "🇨🇻", XAFCF: "🇨🇫", XAFTD: "🇹🇩", XOFGW: "🇬🇼",
  USD: "🇺🇸", EUR: "🇪🇺", GBP: "🇬🇧", CHF: "🇨🇭", USDT: "₮", CAD: "🇨🇦", AUD: "🇦🇺", NZD: "🇳🇿",
  INR: "🇮🇳", PKR: "🇵🇰", BDT: "🇧🇩", LRK: "🇱🇰", PHP: "🇵🇭", IDR: "🇮🇩", MYR: "🇲🇾", THB: "🇹🇭",
  VND: "🇻🇳", KRW: "🇰🇷", JPY: "🇯🇵", HKD: "🇭🇰", CHN: "🇨🇳", SAR: "🇸🇦", AED: "🇦🇪", QAR: "🇶🇦",
  KWD: "🇰🇼", BHD: "🇧🇭", ILS: "🇮🇱", TRY: "🇹🇷", SEK: "🇸🇪", NOK: "🇳🇴", DKK: "🇩🇰", PLN: "🇵🇱",
  CZK: "🇨🇿", HUF: "🇭🇺", RON: "🇷🇴", BGN: "🇧🇬", ISK: "🇮🇸", BRL: "🇧🇷", MXN: "🇲🇽", ARS: "🇦🇷",
  CLP: "🇨🇱", COP: "🇨🇴",
};

export const CURRENCY_NAMES: Record<string, string> = {};
ALL_FX_CURRENCIES.forEach((currency) => {
  CURRENCY_NAMES[currency.code] = currency.name;
});

export const CURRENCY_COUNTRIES: Record<string, string> = {
  USD: "États-Unis",
  EUR: "Europe",
  GBP: "Royaume-Uni",
  XAF: "Cameroun",
  XOF: "Afrique de l’Ouest",
  XOFC: "Côte d’Ivoire",
  XOFF: "Burkina Faso",
  XOFN: "Niger",
  XOFB: "Bénin",
  XOFT: "Togo",
  XOFS: "Sénégal",
  XOFM: "Mali",
  XAFC: "Congo Brazzaville",
  XAFG: "Gabon",
  RWF: "Rwanda",
  TZS: "Tanzanie",
  UGX: "Ouganda",
  GHS: "Ghana",
  KES: "Kenya",
  MWK: "Malawi",
  MZN: "Mozambique",
  NGN: "Nigeria",
  ETB: "Éthiopie",
  LSL: "Lesotho",
  SLE: "Sierra Leone",
  ZMW: "Zambie",
  XAFCF: "Centrafrique",
  XAFTD: "Tchad",
  XOFGW: "Guinée-Bissau",
  CDF: "République démocratique du Congo",
  INR: "Inde",
  USDT: "Crypto · Tron",
};