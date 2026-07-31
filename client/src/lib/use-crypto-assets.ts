/**
 * Dynamic IziChange asset list.
 * Fetches GET /api/crypto/assets (proxy to IziChange /v1/assets, cached 1h server-side).
 * Falls back to the static CRYPTO_COIN_LIST if the API is not configured or unreachable.
 */
import { useQuery } from "@tanstack/react-query";
import { CRYPTO_COIN_LIST, coinLogoUrl } from "./crypto-assets";

export interface DynCryptoNet {
  id: string;
  label: string;
  assetCode: string;
  memoRequired: boolean;
  memoType: string | null;
}

export interface DynCryptoCoin {
  name: string;
  networks: DynCryptoNet[];
}

export type DynCoinMap = Record<string, DynCryptoCoin>;

/** Build the static fallback in DynCoinMap format */
function staticFallback(): DynCoinMap {
  const out: DynCoinMap = {};
  for (const [code, def] of Object.entries(CRYPTO_COIN_LIST)) {
    out[code] = {
      name: def.name,
      networks: def.networks.map(n => ({
        id: n.id,
        label: n.label,
        assetCode: n.assetCode,
        memoRequired: n.assetCode === "XRP" || n.assetCode.endsWith(".TON") || n.assetCode === "XLM",
        memoType: (n.assetCode === "XRP" ? "tag" : n.assetCode.endsWith(".TON") || n.assetCode === "XLM" ? "memo" : null),
      })),
    };
  }
  return out;
}

/**
 * Returns the full IziChange crypto asset list as a DynCoinMap.
 * Falls back to the static list while loading or on error.
 */
export function useIziAssets(): { coins: DynCoinMap; isLoading: boolean } {
  const { data, isLoading } = useQuery<DynCoinMap>({
    queryKey: ["/api/crypto/assets"],
    staleTime: 60 * 60 * 1000, // 1 hour — matches server cache
    gcTime: 60 * 60 * 1000,
    retry: 1,
  });

  if (data && Object.keys(data).length > 0) {
    return { coins: data, isLoading: false };
  }

  return { coins: staticFallback(), isLoading };
}

export { coinLogoUrl };
