// ── IziChange WaaS — shared crypto-asset definitions ────────────────────────
// Used by both deposit.tsx (wallet deposit) and payment.tsx (payment links).
//
// ⚠️  IMPORTANT — WaaS attribution rules (from IziChange docs):
//   • UTXO chains (BTC, LTC, DOGE, ADA, BCH) → unique address per sub-wallet → ✅ auto-attributed
//   • Memo chains (XRP, TON, XLM, TRX-memo) → shared address + unique memo  → ✅ auto-attributed via memo
//   • EVM/account chains (BEP20, ERC20, Polygon, Solana) → shared address at
//     MERCHANT level → NOT attributable to a sub-wallet → webhook never fires → ❌ REMOVED
//
// Never add BEP20 / ERC20 / Polygon / Solana networks here — deposits on those
// chains will never be credited to the correct user.

export interface CryptoNet { id: string; label: string; assetCode: string }
export interface CryptoCoinDef { name: string; logoSlug: string; networks: CryptoNet[] }

export const CRYPTO_COIN_LIST: Record<string, CryptoCoinDef> = {
  // ── Stablecoins ─────────────────────────────────────────────────────────────
  USDT:  { name: "Tether USD",         logoSlug: "usdt",  networks: [
    { id: "TRC20",   label: "TRC20 — Tron",             assetCode: "USDT.TRC20" },
    { id: "TON",     label: "TON Network",               assetCode: "USDT.TON" },
  ]},

  // ── UTXO chains (unique address per sub-wallet) ─────────────────────────────
  BTC:   { name: "Bitcoin",            logoSlug: "btc",   networks: [
    { id: "BTC",     label: "Bitcoin",                   assetCode: "BTC" },
  ]},
  LTC:   { name: "Litecoin",           logoSlug: "ltc",   networks: [
    { id: "LTC",     label: "Litecoin",                  assetCode: "LTC" },
  ]},
  DOGE:  { name: "Dogecoin",           logoSlug: "doge",  networks: [
    { id: "DOGE",    label: "Dogecoin",                  assetCode: "DOGE" },
  ]},
  ADA:   { name: "Cardano",            logoSlug: "ada",   networks: [
    { id: "ADA",     label: "Cardano",                   assetCode: "ADA" },
  ]},
  BCH:   { name: "Bitcoin Cash",       logoSlug: "bch",   networks: [
    { id: "BCH",     label: "Bitcoin Cash",              assetCode: "BCH" },
  ]},

  // ── Memo chains (shared address + unique memo → auto-attributed) ────────────
  XRP:   { name: "Ripple XRP",         logoSlug: "xrp",   networks: [
    { id: "XRP",     label: "XRP Ledger",                assetCode: "XRP" },
  ]},
  TON:   { name: "Toncoin",            logoSlug: "ton",   networks: [
    { id: "TON",     label: "TON Network",               assetCode: "TON" },
  ]},
  XLM:   { name: "Stellar",            logoSlug: "xlm",   networks: [
    { id: "XLM",     label: "Stellar",                   assetCode: "XLM" },
  ]},

  // ── TRC20 / Tron (unique address per sub-wallet, not EVM) ───────────────────
  TRX:   { name: "Tron",               logoSlug: "trx",   networks: [
    { id: "TRC20",   label: "Tron (TRC20)",              assetCode: "TRX" },
  ]},

  // ── TON ecosystem ───────────────────────────────────────────────────────────
  DOGS:  { name: "DOGS",               logoSlug: "dogs",  networks: [
    { id: "TON",     label: "TON Network",               assetCode: "DOGS.TON" },
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
