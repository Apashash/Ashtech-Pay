import { useQuery } from "@tanstack/react-query";
import { ALL_FX_CURRENCIES } from "@shared/schema";

type ExchangeRates = Record<string, number>;

// Default XAF-direct rates (how many XAF = 1 unit of currency)
// Computed from ALL_FX_CURRENCIES USD-pivot defaults: xaf_direct = 585 / usd_pivot_rate
const XAF_PER_USD = 585;
const DEFAULT_RATES: ExchangeRates = {};
ALL_FX_CURRENCIES.forEach(c => {
  DEFAULT_RATES[c.code] = XAF_PER_USD / c.defaultRate;
});
// CFA variants are always 1:1 with XAF
const CFA_CODES = ["XAF","XAFC","XAFG","XOF","XOFC","XOFF","XOFN","XOFB","XOFT","XOFS","XOFM"];
CFA_CODES.forEach(code => { DEFAULT_RATES[code] = 1; });

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
