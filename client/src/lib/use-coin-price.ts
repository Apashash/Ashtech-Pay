/**
 * Fetches the USDT spot price of a crypto coin from our server proxy
 * (Binance public API, 5-min cache server-side).
 *
 * Stablecoins (USDT, USDC, BUSD…) always return priceUsd = 1 without a network call.
 */
import { useQuery } from "@tanstack/react-query";

const STABLE = new Set(["USDT", "USDC", "BUSD", "TUSD", "DAI", "USDP", "FRAX", "USDD"]);

export function useCoinPrice(symbol: string): { priceUsd: number; isLoading: boolean } {
  const upper = symbol.toUpperCase();
  const isStable = STABLE.has(upper);

  const { data, isLoading } = useQuery<{ symbol: string; priceUsd: number }>({
    queryKey: [`/api/crypto/price/${upper}`],
    enabled: !isStable,
    staleTime: 5 * 60 * 1000, // 5 min — matches server cache
    gcTime:    5 * 60 * 1000,
    retry: 1,
  });

  if (isStable) return { priceUsd: 1, isLoading: false };
  return { priceUsd: data?.priceUsd ?? 0, isLoading };
}
