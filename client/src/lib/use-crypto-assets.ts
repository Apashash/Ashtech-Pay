/**
 * Dynamic IziChange asset list.
 * Fetches GET /api/crypto/assets (proxy to IziChange /v1/assets, cached 1h server-side).
 * Falls back to the static CRYPTO_COIN_LIST if the API is not configured or unreachable.
 */
import { useQuery } from "@tanstack/react-query";
import { CRYPTO_COIN_LIST } from "./crypto-assets";

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

// ── Logo helpers ──────────────────────────────────────────────────────────────

const CDN = "https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color";

/**
 * Coin logo from the spothq CDN (SVG via jsdelivr).
 * Falls back gracefully via onError on the <img> element.
 * For compound assetCodes like "USDT.TRC20" we use the coin part only.
 */
export function coinLogoUrl(symbolOrAssetCode: string): string {
  const slug = symbolOrAssetCode.split(".")[0].toLowerCase();
  return `${CDN}/${slug}.png`;
}

/**
 * Network / blockchain chain logo.
 * Maps IziChange blockchainCode values → the chain's native coin logo.
 *
 * TRC20      → trx  (Tron)
 * BEP20/BSC  → bnb  (BNB Chain)
 * ERC20      → eth  (Ethereum)
 * TON        → ton
 * Polygon/POL→ matic
 * SOL        → sol
 * UTXO chains (BTC, LTC, DOGE, …) → same as coin symbol
 */
const NETWORK_COIN: Record<string, string> = {
  TRC20:   "trx",
  BEP20:   "bnb",
  BSC:     "bnb",
  ERC20:   "eth",
  ETH:     "eth",
  TON:     "ton",
  Polygon: "matic",
  POL:     "matic",
  MATIC:   "matic",
  SOL:     "sol",
  BTC:     "btc",
  LTC:     "ltc",
  DOGE:    "doge",
  ADA:     "ada",
  BCH:     "bch",
  XRP:     "xrp",
  XLM:     "xlm",
  TRX:     "trx",
};

export function networkLogoUrl(networkId: string): string {
  const slug = NETWORK_COIN[networkId] ?? networkId.toLowerCase();
  return `${CDN}/${slug}.png`;
}

// ── Static fallback ───────────────────────────────────────────────────────────

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
        memoType: n.assetCode === "XRP" ? "tag"
                : (n.assetCode.endsWith(".TON") || n.assetCode === "XLM") ? "memo"
                : null,
      })),
    };
  }
  return out;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Returns the full IziChange crypto asset list as a DynCoinMap.
 * Falls back to the static list while loading or on error.
 */
export function useIziAssets(): { coins: DynCoinMap; isLoading: boolean } {
  const { data, isLoading, isSuccess } = useQuery<DynCoinMap>({
    queryKey: ["/api/crypto/assets"],
    staleTime: 60 * 60 * 1000, // 1 h — matches server cache
    gcTime:    60 * 60 * 1000,
    retry: 1,
  });
  const { data: disabledData } = useQuery<{ disabled: string[] }>({
    queryKey: ["/api/crypto/disabled-assets"],
    staleTime: 60 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 1,
  });
  const disabled = new Set(disabledData?.disabled ?? []);

  // An empty successful response means the admin disabled every network.
  // Only use the static fallback while loading or when the API failed.
  if (isSuccess && data) {
    return { coins: data, isLoading: false };
  }
  const fallback = staticFallback();
  for (const coin of Object.keys(fallback)) {
    fallback[coin].networks = fallback[coin].networks.filter(net => !disabled.has(net.assetCode));
    if (fallback[coin].networks.length === 0) delete fallback[coin];
  }
  return { coins: fallback, isLoading };
}
