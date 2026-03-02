import { useQuery } from "@tanstack/react-query";
import { ALL_FX_CURRENCIES } from "@shared/schema";

type ExchangeRates = Record<string, number>;

// Build default rates from ALL_FX_CURRENCIES (admin panel currencies)
const DEFAULT_RATES: ExchangeRates = {};
ALL_FX_CURRENCIES.forEach(c => { DEFAULT_RATES[c.code] = c.defaultRate; });

export function useExchangeRates() {
  const { data: rates } = useQuery<ExchangeRates>({
    queryKey: ["/api/public/exchange-rates"],
    queryFn: async () => {
      const res = await fetch("/api/public/exchange-rates");
      if (!res.ok) return DEFAULT_RATES;
      return res.json();
    },
    staleTime: 60000,
  });

  const activeRates = rates || DEFAULT_RATES;

  const getRate = (currency: string): number => {
    return activeRates[currency] ?? DEFAULT_RATES[currency] ?? 1;
  };

  return { rates: activeRates, getRate };
}
