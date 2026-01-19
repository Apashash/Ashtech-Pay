import { useQuery } from "@tanstack/react-query";
import { EXCHANGE_RATES, type SupportedCurrency } from "@shared/schema";

type ExchangeRates = Record<string, number>;

export function useExchangeRates() {
  const { data: rates } = useQuery<ExchangeRates>({
    queryKey: ["/api/public/exchange-rates"],
    queryFn: async () => {
      const res = await fetch("/api/public/exchange-rates");
      if (!res.ok) return EXCHANGE_RATES;
      return res.json();
    },
    staleTime: 60000,
  });

  const getRate = (currency: SupportedCurrency): number => {
    if (rates && rates[currency] !== undefined) {
      return rates[currency];
    }
    return EXCHANGE_RATES[currency] || 1;
  };

  return { rates: rates || EXCHANGE_RATES, getRate };
}
