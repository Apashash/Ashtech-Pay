// ── IziChange Direct Charge — static fallback crypto-asset list ──────────────
// Used by both deposit.tsx (wallet deposit) and payment.tsx (payment links)
// as a FALLBACK only when the live /api/crypto/assets endpoint is unreachable.
//
// ✅ Direct Charge (POST /v1/payment-intents/direct) generates a unique address
//    per payment — IziChange attributes via merchantReference, not sub-wallet
//    sharing. Therefore ALL networks (BEP20, ERC20, Polygon, SOL…) are safe.
//
// The live list always takes priority over this static fallback.

export interface CryptoNet { id: string; label: string; assetCode: string }
export interface CryptoCoinDef { name: string; logoSlug: string; networks: CryptoNet[] }

export const CRYPTO_COIN_LIST: Record<string, CryptoCoinDef> = {
  // ── Stablecoins ─────────────────────────────────────────────────────────────
  USDT: { name: "Tether USD", logoSlug: "usdt", networks: [
    { id: "TRC20",   label: "TRC20 (Tron)",          assetCode: "USDT.TRC20"   },
    { id: "BEP20",   label: "BEP20 (BNB Chain)",     assetCode: "USDT.BEP20"   },
    { id: "ERC20",   label: "ERC20 (Ethereum)",      assetCode: "USDT.ERC20"   },
    { id: "TON",     label: "TON Network",            assetCode: "USDT.TON"     },
    { id: "Polygon", label: "Polygon",                assetCode: "USDT.Polygon" },
    { id: "SOL",     label: "Solana",                 assetCode: "USDT.SOL"     },
  ]},
  USDC: { name: "USD Coin", logoSlug: "usdc", networks: [
    { id: "ERC20",   label: "ERC20 (Ethereum)",      assetCode: "USDC.ERC20"   },
    { id: "BEP20",   label: "BEP20 (BNB Chain)",     assetCode: "USDC.BEP20"   },
    { id: "Polygon", label: "Polygon",                assetCode: "USDC.Polygon" },
    { id: "SOL",     label: "Solana",                 assetCode: "USDC.SOL"     },
  ]},

  // ── UTXO chains ──────────────────────────────────────────────────────────────
  BTC:  { name: "Bitcoin",      logoSlug: "btc",  networks: [
    { id: "BTC",     label: "Bitcoin",                assetCode: "BTC"          },
  ]},
  LTC:  { name: "Litecoin",     logoSlug: "ltc",  networks: [
    { id: "LTC",     label: "Litecoin",               assetCode: "LTC"          },
  ]},
  DOGE: { name: "Dogecoin",     logoSlug: "doge", networks: [
    { id: "DOGE",    label: "Dogecoin",               assetCode: "DOGE"         },
  ]},
  ADA:  { name: "Cardano",      logoSlug: "ada",  networks: [
    { id: "ADA",     label: "Cardano",                assetCode: "ADA"          },
  ]},
  BCH:  { name: "Bitcoin Cash", logoSlug: "bch",  networks: [
    { id: "BCH",     label: "Bitcoin Cash",           assetCode: "BCH"          },
  ]},

  // ── EVM chains ───────────────────────────────────────────────────────────────
  ETH:  { name: "Ethereum",     logoSlug: "eth",  networks: [
    { id: "ERC20",   label: "ERC20 (Ethereum)",      assetCode: "ETH.ERC20"    },
    { id: "BEP20",   label: "BEP20 (BNB Chain)",     assetCode: "ETH.BEP20"    },
  ]},
  BNB:  { name: "BNB",          logoSlug: "bnb",  networks: [
    { id: "BEP20",   label: "BEP20 (BNB Chain)",     assetCode: "BNB.BEP20"    },
  ]},
  MATIC:{ name: "Polygon",      logoSlug: "matic",networks: [
    { id: "Polygon", label: "Polygon",                assetCode: "MATIC.Polygon"},
    { id: "BEP20",   label: "BEP20 (BNB Chain)",     assetCode: "MATIC.BEP20"  },
  ]},

  // ── Memo chains ──────────────────────────────────────────────────────────────
  XRP:  { name: "Ripple XRP",   logoSlug: "xrp",  networks: [
    { id: "XRP",     label: "XRP Ledger",             assetCode: "XRP"          },
  ]},
  TON:  { name: "Toncoin",      logoSlug: "ton",  networks: [
    { id: "TON",     label: "TON Network",            assetCode: "TON"          },
  ]},
  XLM:  { name: "Stellar",      logoSlug: "xlm",  networks: [
    { id: "XLM",     label: "Stellar",                assetCode: "XLM"          },
  ]},

  // ── Tron ─────────────────────────────────────────────────────────────────────
  TRX:  { name: "Tron",         logoSlug: "trx",  networks: [
    { id: "TRC20",   label: "Tron (TRC20)",           assetCode: "TRX"          },
  ]},

  // ── Solana ───────────────────────────────────────────────────────────────────
  SOL:  { name: "Solana",       logoSlug: "sol",  networks: [
    { id: "SOL",     label: "Solana",                 assetCode: "SOL"          },
  ]},

  // ── TON ecosystem ────────────────────────────────────────────────────────────
  DOGS: { name: "DOGS",         logoSlug: "dogs", networks: [
    { id: "TON",     label: "TON Network",            assetCode: "DOGS.TON"     },
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

/**
 * Chains that require a MEMO/TAG in addition to the address.
 * If the user doesn't include the memo, IziChange cannot attribute the deposit.
 */
export const MEMO_CHAINS = new Set(["XRP", "TON", "XLM", "DOGS", "USDT_TON"]);

/**
 * Returns true if the given assetCode requires a memo/tag.
 * Covers both coin-level (TON, XRP, XLM) and assetCode-level (USDT.TON, DOGS.TON).
 */
export function requiresMemo(assetCode: string): boolean {
  return (
    assetCode === "XRP" ||
    assetCode === "TON" ||
    assetCode === "XLM" ||
    assetCode.endsWith(".TON")
  );
}
