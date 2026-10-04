import { getPayoutProviderCountryCodes, PAYOUT_PROVIDER_LABELS, type PayoutProvider } from "@shared/provider-countries";

type CountryOption = {
  code: string;
  name: string;
  flag?: string | null;
};

export function ProviderCountryCoverage({
  provider,
  countries = [],
}: {
  provider: PayoutProvider;
  countries?: CountryOption[];
}) {
  const supportedCodes = getPayoutProviderCountryCodes(provider);
  const supportedCountries = supportedCodes.map(code => ({
    code,
    country: countries.find(country => country.code.toUpperCase() === code),
  }));

  return (
    <details className="rounded-md border px-3 py-2 text-xs">
      <summary className="cursor-pointer font-medium text-muted-foreground">
        Pays pris en charge par {PAYOUT_PROVIDER_LABELS[provider]} ({supportedCodes.length})
      </summary>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {supportedCountries.map(({ code, country }) => (
          <span
            key={code}
            className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1"
            title={code}
          >
            {country?.flag && <span aria-hidden="true">{country.flag}</span>}
            {country?.name || code}
            <span className="text-muted-foreground">({code})</span>
          </span>
        ))}
      </div>
    </details>
  );
}