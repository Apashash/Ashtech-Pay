import { getIziPayApiKey, isIziPayConfigured } from "./izichange";
import { CRYPTO_COIN_LIST } from "../client/src/lib/crypto-assets";

export interface CryptoAssetNetwork {
  id: string;
  label: string;
  assetCode: string;
  memoRequired: boolean;
  memoType: string | null;
}

export interface CryptoAssetCoin {
  name: string;
  networks: CryptoAssetNetwork[];
}

export type CryptoAssetMap = Record<string, CryptoAssetCoin>;

let cache: { coins: CryptoAssetMap; ts: number } | null = null;

export function getStaticCryptoAssets(): CryptoAssetMap {
  const coins: CryptoAssetMap = {};
  for (const [code, coin] of Object.entries(CRYPTO_COIN_LIST)) {
    coins[code] = {
      name: coin.name,
      networks: coin.networks.map(network => ({
        id: network.id,
        label: network.label,
        assetCode: network.assetCode,
        memoRequired:
          network.assetCode === "XRP" ||
          network.assetCode.endsWith(".TON") ||
          network.assetCode === "XLM",
        memoType:
          network.assetCode === "XRP"
            ? "tag"
            : network.assetCode.endsWith(".TON") || network.assetCode === "XLM"
            ? "memo"
            : null,
      })),
    };
  }
  return coins;
}

export function parseDisabledCryptoAssets(value?: string | null): Set<string> {
  try {
    const parsed = JSON.parse(value || "[]");
    return new Set(
      Array.isArray(parsed)
        ? parsed.filter((code): code is string => typeof code === "string")
        : []
    );
  } catch {
    return new Set();
  }
}

export async function fetchCryptoAssets(): Promise<CryptoAssetMap> {
  const now = Date.now();
  if (cache && now - cache.ts < 3_600_000) return cache.coins;
  if (!isIziPayConfigured()) return getStaticCryptoAssets();

  const apiKey = getIziPayApiKey();
  const baseUrl = apiKey.startsWith("sk_test_")
    ? "https://api.sandbox-pay.izichange.com"
    : "https://api.pay.izichange.com";
  const resp = await fetch(`${baseUrl}/v1/assets`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!resp.ok) throw new Error(`IziChange /v1/assets → ${resp.status}`);

  const rawList: any = await resp.json();
  const list: any[] = Array.isArray(rawList)
    ? rawList
    : Array.isArray(rawList?.data)
    ? rawList.data
    : [];

  if (list.length > 0) {
    console.log("[crypto/assets] sample asset:", JSON.stringify(list[0]));
  }

  const coins: CryptoAssetMap = {};
  for (const asset of list) {
    const activeFlag = asset.isActive ?? asset.is_active ?? asset.active ?? true;
    if (activeFlag === false) continue;

    const code = String(
      asset.coinCode || asset.coin_code || asset.coin || asset.symbol ||
      (asset.assetCode || asset.asset_code || "").split(/[._]/)[0] || ""
    );
    if (!code) continue;

    const coinName = String(asset.coinName || asset.coin_name || asset.name || asset.coin || code);
    if (!coins[code]) coins[code] = { name: coinName, networks: [] };

    const netId = String(
      asset.blockchainCode || asset.blockchain_code ||
      asset.network || asset.networkCode || asset.network_code || code
    );
    const netName = String(
      asset.blockchainName || asset.blockchain_name ||
      asset.networkName || asset.network_name || netId
    );
    const netLabel = netName !== netId ? `${netName} (${netId})` : netId;
    const assetCode = String(asset.assetCode || asset.asset_code || `${code}.${netId}`);
    const memoRequired = !!(asset.memoRequired ?? asset.memo_required ?? false);
    const memoType = asset.memoType ?? asset.memo_type ?? null;

    if (!coins[code].networks.some(network => network.id === netId)) {
      coins[code].networks.push({ id: netId, label: netLabel, assetCode, memoRequired, memoType });
    }
  }

  cache = { coins, ts: now };
  console.log(
    `[crypto/assets] Loaded ${list.length} raw assets → ${Object.keys(coins).length} coins ` +
    `(networks: ${Object.values(coins).reduce((sum, coin) => sum + coin.networks.length, 0)})`
  );
  return coins;
}

export function filterCryptoAssets(coins: CryptoAssetMap, disabled: Set<string>): CryptoAssetMap {
  const filtered: CryptoAssetMap = {};
  for (const [code, coin] of Object.entries(coins)) {
    const networks = coin.networks.filter(network => !disabled.has(network.assetCode));
    if (networks.length > 0) filtered[code] = { ...coin, networks };
  }
  return filtered;
}