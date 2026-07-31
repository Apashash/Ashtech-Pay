// ── IziChange WaaS — shared crypto-asset definitions ────────────────────────
// Used by both deposit.tsx (wallet deposit) and payment.tsx (payment links).

export interface CryptoNet { id: string; label: string; assetCode: string }
export interface CryptoCoinDef { name: string; logoSlug: string; networks: CryptoNet[] }

export const CRYPTO_COIN_LIST: Record<string, CryptoCoinDef> = {
  USDT:  { name: "Tether USD",         logoSlug: "usdt",  networks: [
    { id: "TRC20",   label: "TRC20 — Tron",             assetCode: "USDT.TRC20" },
    { id: "BEP20",   label: "BEP20 — BSC",               assetCode: "USDT.BEP20" },
    { id: "ERC20",   label: "ERC20 — Ethereum",           assetCode: "USDT.ERC20" },
    { id: "POLYGON", label: "Polygon",                    assetCode: "USDT.POLYGON" },
    { id: "SOL",     label: "Solana",                     assetCode: "USDT.SOL" },
    { id: "TON",     label: "TON",                        assetCode: "USDT.TON" },
  ]},
  USDC:  { name: "USD Coin",           logoSlug: "usdc",  networks: [
    { id: "ERC20",   label: "ERC20 — Ethereum",           assetCode: "USDC.ERC20" },
    { id: "BEP20",   label: "BEP20 — BSC",                assetCode: "USDC.BEP20" },
    { id: "SOL",     label: "Solana",                     assetCode: "USDC.SOL" },
    { id: "POLYGON", label: "Polygon",                    assetCode: "USDC.POLYGON" },
  ]},
  BTC:   { name: "Bitcoin",            logoSlug: "btc",   networks: [
    { id: "BTC",     label: "Bitcoin mainnet",            assetCode: "BTC" },
    { id: "BEP20",   label: "BEP20 — BSC",                assetCode: "BTC.BEP20" },
  ]},
  ETH:   { name: "Ethereum",           logoSlug: "eth",   networks: [
    { id: "ERC20",   label: "ERC20 — Ethereum",           assetCode: "ETH" },
    { id: "BEP20",   label: "BEP20 — BSC",                assetCode: "ETH.BEP20" },
  ]},
  BNB:   { name: "BNB",                logoSlug: "bnb",   networks: [
    { id: "BEP20",   label: "BEP20 — BSC",                assetCode: "BNB" },
  ]},
  SOL:   { name: "Solana",             logoSlug: "sol",   networks: [
    { id: "SOL",     label: "Solana",                     assetCode: "SOL" },
    { id: "BEP20",   label: "BEP20 — BSC",                assetCode: "SOL.BEP20" },
  ]},
  XRP:   { name: "Ripple XRP",         logoSlug: "xrp",   networks: [
    { id: "XRP",     label: "XRP Ledger",                 assetCode: "XRP" },
    { id: "BEP20",   label: "BEP20 — BSC",                assetCode: "XRP.BEP20" },
  ]},
  TON:   { name: "Toncoin",            logoSlug: "ton",   networks: [
    { id: "TON",     label: "TON Network",                assetCode: "TON" },
    { id: "BEP20",   label: "BEP20 — BSC",                assetCode: "TON.BEP20" },
  ]},
  TRX:   { name: "Tron",               logoSlug: "trx",   networks: [
    { id: "TRC20",   label: "Tron (TRC20)",               assetCode: "TRX" },
  ]},
  ADA:   { name: "Cardano",            logoSlug: "ada",   networks: [
    { id: "ADA",     label: "Cardano",                    assetCode: "ADA" },
    { id: "BEP20",   label: "BEP20 — BSC",                assetCode: "ADA.BEP20" },
  ]},
  DOGE:  { name: "Dogecoin",           logoSlug: "doge",  networks: [
    { id: "DOGE",    label: "Dogecoin",                   assetCode: "DOGE" },
    { id: "BEP20",   label: "BEP20 — BSC",                assetCode: "DOGE.BEP20" },
  ]},
  LTC:   { name: "Litecoin",           logoSlug: "ltc",   networks: [
    { id: "LTC",     label: "Litecoin",                   assetCode: "LTC" },
  ]},
  MATIC: { name: "Polygon MATIC",      logoSlug: "matic", networks: [
    { id: "POLYGON", label: "Polygon",                    assetCode: "MATIC" },
  ]},
  XLM:   { name: "Stellar",            logoSlug: "xlm",   networks: [
    { id: "XLM",     label: "Stellar",                    assetCode: "XLM" },
    { id: "BEP20",   label: "BEP20 — BSC",                assetCode: "XLM.BEP20" },
  ]},
  SUI:   { name: "Sui",                logoSlug: "sui",   networks: [
    { id: "SUI",     label: "Sui Network",                assetCode: "SUI" },
  ]},
  BCH:   { name: "Bitcoin Cash",       logoSlug: "bch",   networks: [
    { id: "BCH",     label: "Bitcoin Cash",               assetCode: "BCH" },
    { id: "BEP20",   label: "BEP20 — BSC",                assetCode: "BCH.BEP20" },
  ]},
  DOT:   { name: "Polkadot",           logoSlug: "dot",   networks: [
    { id: "BEP20",   label: "BEP20 — BSC",                assetCode: "DOT.BEP20" },
  ]},
  SHIB:  { name: "Shiba Inu",          logoSlug: "shib",  networks: [
    { id: "ERC20",   label: "ERC20 — Ethereum",           assetCode: "SHIB.ERC20" },
    { id: "BEP20",   label: "BEP20 — BSC",                assetCode: "SHIB.BEP20" },
  ]},
  CAKE:  { name: "PancakeSwap",        logoSlug: "cake",  networks: [
    { id: "BEP20",   label: "BEP20 — BSC",                assetCode: "CAKE.BEP20" },
  ]},
  DOGS:  { name: "DOGS",               logoSlug: "dogs",  networks: [
    { id: "TON",     label: "TON Network",                assetCode: "DOGS.TON" },
  ]},
};

/** Network list as a flat Record (for backward compat with deposit.tsx useEffect) */
export const CRYPTO_NETWORKS = Object.fromEntries(
  Object.entries(CRYPTO_COIN_LIST).map(([k, v]) => [k, v.networks]),
) as Record<string, CryptoNet[]>;

/** Logo URL from Spothq CDN; falls back gracefully via onError */
export function coinLogoUrl(slugOrSymbol: string): string {
  return `https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/${slugOrSymbol.toLowerCase()}.png`;
}

/** Coin+network selector block — reusable JSX snippet factory (exported as a hook-friendly fn) */
export const MEMO_CHAINS = new Set(["XRP", "TON", "XLM", "DOGS"]);
