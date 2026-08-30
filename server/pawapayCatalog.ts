import { storage } from "./storage";
import { getPawaPayActiveConfiguration } from "./pawapay";

/**
 * PawaPay's documented country coverage used to bootstrap Ashtech's catalog.
 *
 * The provider code is deliberately stored on the operator row, rather than
 * inferred from its display name at payment time. An admin sync can replace
 * these codes with the account's live /active-conf values.
 */
export const PAWAPAY_COUNTRY_CATALOG = [
  {
    code: "ET", name: "Éthiopie", flag: "🇪🇹", dialCode: "+251", currency: "ETB",
    exchangeRate: "140",
    operators: [
      ["Telebirr", "TELEBIRR_ETH"],
      ["M-Pesa", "MPESA_ETH"],
    ],
  },
  {
    code: "GH", name: "Ghana", flag: "🇬🇭", dialCode: "+233", currency: "GHS",
    exchangeRate: "14",
    operators: [
      ["MTN Mobile Money", "MTN_MOMO_GHA"],
      ["Vodafone Cash", "VODAFONE_GHA"],
      ["AirtelTigo Money", "AIRTELTIGO_GHA"],
    ],
  },
  {
    code: "KE", name: "Kenya", flag: "🇰🇪", dialCode: "+254", currency: "KES",
    exchangeRate: "139",
    operators: [
      ["M-Pesa", "MPESA_KEN"],
      ["Airtel Money", "AIRTEL_KEN"],
    ],
  },
  {
    code: "LS", name: "Lesotho", flag: "🇱🇸", dialCode: "+266", currency: "LSL",
    exchangeRate: "14",
    operators: [
      ["Vodacom Mpesa", "VODACOM_LSO"],
      ["EcoCash", "ECOCASH_LSO"],
    ],
  },
  {
    code: "MW", name: "Malawi", flag: "🇲🇼", dialCode: "+265", currency: "MWK",
    exchangeRate: "1800",
    operators: [
      ["Airtel Money", "AIRTEL_MWI"],
      ["TNM Mpamba", "TNM_MWI"],
    ],
  },
  {
    code: "MZ", name: "Mozambique", flag: "🇲🇿", dialCode: "+258", currency: "MZN",
    exchangeRate: "65",
    operators: [
      ["M-Pesa", "MPESA_MOZ"],
      ["e-Mola", "EMOLA_MOZ"],
    ],
  },
  {
    code: "NG", name: "Nigeria", flag: "🇳🇬", dialCode: "+234", currency: "NGN",
    exchangeRate: "1800",
    operators: [
      ["MTN Mobile Money", "MTN_NGA"],
      ["Airtel Money", "AIRTEL_NGA"],
      ["9Mobile", "9MOBILE_NGA"],
      ["Glo Mobile", "GLO_NGA"],
    ],
  },
  {
    code: "SL", name: "Sierra Leone", flag: "🇸🇱", dialCode: "+232", currency: "SLE",
    exchangeRate: "2850",
    operators: [
      ["Orange Money", "ORANGE_SLE"],
      ["Afrimoney", "AFRIMONEY_SLE"],
    ],
  },
  {
    code: "ZM", name: "Zambie", flag: "🇿🇲", dialCode: "+260", currency: "ZMW",
    exchangeRate: "49",
    operators: [
      ["MTN Mobile Money", "MTN_MOMO_ZMB"],
      ["Airtel Money", "AIRTEL_ZMB"],
      ["Zamtel Money", "ZAMTEL_ZMB"],
    ],
  },
] as const;

/**
 * Add missing PawaPay-only countries without touching existing provider
 * assignments. This makes startup safe and idempotent on existing databases.
 */
export async function seedPawaPayCountries(): Promise<{ countries: number; operators: number }> {
  const existingCountries = await storage.getAllCountries();
  const existingByCode = new Map(existingCountries.map(country => [country.code.toUpperCase(), country]));
  let countriesCreated = 0;
  let operatorsCreated = 0;

  for (const entry of PAWAPAY_COUNTRY_CATALOG) {
    let country = existingByCode.get(entry.code);
    if (!country) {
      country = await storage.createCountry({
        name: entry.name,
        code: entry.code,
        flag: entry.flag,
        dialCode: entry.dialCode,
        currency: entry.currency,
        exchangeRate: entry.exchangeRate,
        isActive: true,
        isActiveForRegistration: true,
        isActiveForDeposit: true,
        isActiveForTransfer: true,
        isActiveForWithdrawal: true,
      } as any);
      existingByCode.set(entry.code, country);
      countriesCreated++;
    }

    const operators = await storage.getOperatorsByCountry(country.id);
    for (const [name, providerCode] of entry.operators) {
      const alreadyExists = operators.some(op => op.name.trim().toLowerCase() === name.toLowerCase());
      if (alreadyExists) continue;
      await storage.createOperator({
        name,
        type: "mobile_money",
        countryId: country.id,
        gateway: "soleapay",
        paymentProvider: "pawapay",
        depositPaymentProvider: "pawapay",
        pawapayProviderCode: providerCode,
        isActive: true,
        isInMaintenance: false,
      } as any);
      operatorsCreated++;
    }
  }

  // Repair only known ambiguous legacy values. Existing custom country
  // settings remain untouched.
  const legacyWallets: Record<string, { legacy: string; canonical: string }> = {
    CF: { legacy: "XAF", canonical: "XAFCF" },
    TD: { legacy: "XAF", canonical: "XAFTD" },
    GW: { legacy: "XOF", canonical: "XOFGW" },
  };
  for (const [code, mapping] of Object.entries(legacyWallets)) {
    const country = existingByCode.get(code);
    if (country && country.currency === mapping.legacy) {
      await storage.updateCountry(country.id, { currency: mapping.canonical } as any);
    }
  }

  return { countries: countriesCreated, operators: operatorsCreated };
}

function countryCodeFromValue(value: unknown): string | undefined {
  const code = String(value || "").trim().toUpperCase();
  if (code.length === 2) return code;
  const alpha3: Record<string, string> = {
    ETH: "ET", GHA: "GH", KEN: "KE", LSO: "LS", MWI: "MW", MOZ: "MZ",
    NGA: "NG", SLE: "SL", ZMB: "ZM",
  };
  return alpha3[code];
}

function operationSet(value: unknown): Set<string> {
  if (!Array.isArray(value)) return new Set();
  return new Set(value.map(item => String(item).toUpperCase()).map(item =>
    item === "COLLECT" ? "DEPOSIT" : item === "PAYOUT" ? "PAYOUT" : item
  ));
}

/**
 * Reconcile configured operator codes with the account's live /active-conf.
 * It never logs the response or credentials and never changes a provider
 * assignment selected by an administrator.
 */
export async function syncPawaPayCatalog(): Promise<{
  countries: number;
  operators: number;
  skipped: number;
}> {
  const configuration: any = await getPawaPayActiveConfiguration({ forceRefresh: true });
  const liveCountries = Array.isArray(configuration?.countries)
    ? configuration.countries
    : Array.isArray(configuration?.data?.countries) ? configuration.data.countries : [];
  const allOperators = await storage.getAllOperators();
  let countries = 0;
  let operators = 0;
  let skipped = 0;
  const allCountries = await storage.getAllCountries();

  for (const liveCountry of liveCountries) {
    const countryCode = countryCodeFromValue(
      liveCountry.countryCode || liveCountry.country || liveCountry.alpha2 || liveCountry.alpha3
    );
    if (!countryCode) {
      skipped++;
      continue;
    }
    countries++;
    const country = allCountries.find(c => c.code.toUpperCase() === countryCode);
    if (!country) {
      skipped++;
      continue;
    }
    const providers = Array.isArray(liveCountry.providers)
      ? liveCountry.providers
      : Array.isArray(liveCountry.providerConfiguration) ? liveCountry.providerConfiguration : [];

    for (const provider of providers) {
      const providerCode = String(provider.provider || provider.providerCode || provider.code || "").trim();
      if (!providerCode) continue;
      const providerName = String(provider.name || provider.displayName || provider.operator || providerCode).trim();
      const ops = operationSet(provider.operationTypes || provider.operations || provider.transactionTypes);
      const candidates = allOperators.filter(op =>
        op.countryId === country.id &&
        op.name.trim().toLowerCase() === providerName.toLowerCase()
      );
      const candidate = candidates[0];
      if (!candidate) continue;
      const updates: any = { pawapayProviderCode: providerCode };
      if (ops.has("DEPOSIT") && candidate.depositPaymentProvider === "pawapay") {
        updates.depositPaymentProvider = "pawapay";
      }
      if (ops.has("PAYOUT") && candidate.paymentProvider === "pawapay") {
        updates.paymentProvider = "pawapay";
      }
      await storage.updateOperator(candidate.id, updates);
      operators++;
    }
  }

  return { countries, operators, skipped };
}