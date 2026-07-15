import crypto from "crypto";

const NOWPAYMENTS_API_KEY = process.env.NOWPAYMENTS_API_KEY || "";
const NOWPAYMENTS_IPN_SECRET = process.env.NOWPAYMENTS_IPN_SECRET || "";
const BASE_URL = "https://api.nowpayments.io/v1";

export interface NowPaymentsInvoiceParams {
  priceAmount: number;
  priceCurrency: string;
  payCurrency: string;
  orderId: string;
  orderDescription: string;
  ipnCallbackUrl: string;
  successUrl: string;
  cancelUrl: string;
}

export interface NowPaymentsPaymentParams {
  priceAmount: number;
  priceCurrency: string;
  payCurrency: string;
  orderId: string;
  orderDescription: string;
  ipnCallbackUrl: string;
}

export interface NowPaymentsPaymentResult {
  payment_id: string;
  payment_status: string;
  pay_address: string;
  pay_amount: number;
  pay_currency: string;
  price_amount: number;
  price_currency: string;
  order_id: string;
  expiration_estimate_date: string;
}

export async function createNowPaymentsPayment(params: NowPaymentsPaymentParams): Promise<NowPaymentsPaymentResult> {
  if (!NOWPAYMENTS_API_KEY) {
    throw new Error("NOWPAYMENTS_API_KEY non configurée. Contactez l'administrateur.");
  }
  const body = {
    price_amount: params.priceAmount,
    price_currency: params.priceCurrency,
    pay_currency: params.payCurrency,
    order_id: params.orderId,
    order_description: params.orderDescription,
    ipn_callback_url: params.ipnCallbackUrl,
  };

  const res = await fetch(`${BASE_URL}/payment`, {
    method: "POST",
    headers: {
      "x-api-key": NOWPAYMENTS_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`NowPayments payment error (${res.status}): ${errText}`);
  }

  return res.json();
}

export async function createNowPaymentsInvoice(params: NowPaymentsInvoiceParams): Promise<{ id: string; invoice_url: string; order_id: string }> {
  if (!NOWPAYMENTS_API_KEY) {
    throw new Error("NOWPAYMENTS_API_KEY non configurée. Contactez l'administrateur.");
  }
  const body = {
    price_amount: params.priceAmount,
    price_currency: params.priceCurrency,
    pay_currency: params.payCurrency,
    order_id: params.orderId,
    order_description: params.orderDescription,
    ipn_callback_url: params.ipnCallbackUrl,
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
  };

  const res = await fetch(`${BASE_URL}/invoice`, {
    method: "POST",
    headers: {
      "x-api-key": NOWPAYMENTS_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`NowPayments invoice error (${res.status}): ${errText}`);
  }

  return res.json();
}

export async function getNowPaymentsPaymentStatus(paymentId: string): Promise<{
  payment_id: string;
  payment_status: string;
  actually_paid: number;
  pay_currency: string;
  price_amount: number;
  price_currency: string;
  order_id: string;
}> {
  const res = await fetch(`${BASE_URL}/payment/${paymentId}`, {
    headers: { "x-api-key": NOWPAYMENTS_API_KEY },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`NowPayments status error (${res.status}): ${errText}`);
  }

  return res.json();
}

function sortObjectDeep(obj: any): any {
  if (Array.isArray(obj)) return obj.map(sortObjectDeep);
  if (obj !== null && typeof obj === "object") {
    return Object.keys(obj).sort().reduce((acc: any, key) => {
      acc[key] = sortObjectDeep(obj[key]);
      return acc;
    }, {});
  }
  return obj;
}

export function verifyNowPaymentsIpn(rawBody: Record<string, any>, signature: string): boolean {
  try {
    if (!NOWPAYMENTS_IPN_SECRET || !signature) return false;
    const sorted = JSON.stringify(sortObjectDeep(rawBody));
    const hmac = crypto.createHmac("sha512", NOWPAYMENTS_IPN_SECRET);
    hmac.update(sorted);
    const computed = hmac.digest("hex");
    return computed === signature.toLowerCase();
  } catch {
    return false;
  }
}

// NowPayments statuses: waiting, confirming, confirmed, sending, partially_paid, finished, failed, refunded, expired
export function mapNowPaymentsStatus(status: string): "pending" | "completed" | "failed" {
  if (["finished", "confirmed", "sending"].includes(status)) return "completed";
  if (["failed", "refunded", "expired"].includes(status)) return "failed";
  return "pending";
}

export interface NowPaymentsCurrencyOption {
  ticker: string;
  label: string;
  network: string;
  logoUrl: string;
}

// Friendly labels for the most common NowPayments tickers. Any ticker not
// listed here still shows up (uppercased) so new networks NowPayments adds
// are never hidden from the picker.
const NOWPAYMENTS_TICKER_LABELS: Record<string, { label: string; network: string }> = {
  usdttrc20: { label: "USDT", network: "Tron (TRC20)" },
  usdterc20: { label: "USDT", network: "Ethereum (ERC20)" },
  usdtbsc: { label: "USDT", network: "BNB Smart Chain (BEP20)" },
  usdtsol: { label: "USDT", network: "Solana" },
  usdtmatic: { label: "USDT", network: "Polygon" },
  usdtton: { label: "USDT", network: "TON" },
  usdcerc20: { label: "USDC", network: "Ethereum (ERC20)" },
  usdcbsc: { label: "USDC", network: "BNB Smart Chain (BEP20)" },
  usdcmatic: { label: "USDC", network: "Polygon" },
  usdcsol: { label: "USDC", network: "Solana" },
  btc: { label: "BTC", network: "Bitcoin" },
  eth: { label: "ETH", network: "Ethereum" },
  bnbbsc: { label: "BNB", network: "BNB Smart Chain" },
  bnbmainnet: { label: "BNB", network: "BNB Chain" },
  trx: { label: "TRX", network: "Tron" },
  ltc: { label: "LTC", network: "Litecoin" },
  doge: { label: "DOGE", network: "Dogecoin" },
  sol: { label: "SOL", network: "Solana" },
  ton: { label: "TON", network: "TON" },
  matic: { label: "MATIC", network: "Polygon" },
  xrp: { label: "XRP", network: "Ripple" },
  ada: { label: "ADA", network: "Cardano" },
  dot: { label: "DOT", network: "Polkadot" },
  shib: { label: "SHIB", network: "Ethereum" },
  usdc: { label: "USDC", network: "Ethereum (ERC20)" },
  busd: { label: "BUSD", network: "BNB Smart Chain (BEP20)" },
  busdbsc: { label: "BUSD", network: "BNB Smart Chain (BEP20)" },
  busdmatic: { label: "BUSD", network: "Polygon" },
};

// Maps a ticker to the base coin symbol used to look up a logo image. Most
// tickers are "<coin><network suffix>" (e.g. usdtbsc -> usdt); this table
// only needs entries where that simple prefix guess would be wrong.
const TICKER_LOGO_SYMBOL: Record<string, string> = {
  bnbbsc: "bnb",
  bnbmainnet: "bnb",
};

// Two CDNs cover the full set: jsdelivr mirrors the spothq/cryptocurrency-icons
// svg set (most coins), coincap has a few this set is missing (busd, ton, shib).
const COINCAP_LOGO_SYMBOLS = new Set(["busd", "ton", "shib"]);

function getLogoUrl(baseSymbol: string): string {
  if (COINCAP_LOGO_SYMBOLS.has(baseSymbol)) {
    return `https://assets.coincap.io/assets/icons/${baseSymbol}@2x.png`;
  }
  return `https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/svg/color/${baseSymbol}.svg`;
}

function getBaseLogoSymbol(ticker: string): string {
  if (TICKER_LOGO_SYMBOL[ticker]) return TICKER_LOGO_SYMBOL[ticker];
  // Strip a known network suffix so e.g. "usdttrc20" -> "usdt", "usdcmatic" -> "usdc".
  const prefixMatch = ticker.match(/^(usdt|usdc|busd)/);
  if (prefixMatch) return prefixMatch[1];
  return ticker;
}

function buildCurrencyOption(rawTicker: string): NowPaymentsCurrencyOption {
  const ticker = rawTicker.toLowerCase();
  const known = NOWPAYMENTS_TICKER_LABELS[ticker];
  return {
    ticker,
    label: known?.label || ticker.toUpperCase(),
    network: known?.network || ticker.toUpperCase(),
    logoUrl: getLogoUrl(getBaseLogoSymbol(ticker)),
  };
}

// Ledger crediting only ever records "USDT" (1:1 parity). We can only trust
// that parity for USD-pegged stablecoins — for a floating asset (BTC, ETH, ...)
// the amount NowPayments reports as "actually_paid" is denominated in that
// coin, not USD, so we must use price_amount (USD) for crediting instead.
export function isStableTicker(ticker: string): boolean {
  const t = ticker.toLowerCase();
  return t.startsWith("usdt") || t.startsWith("usdc") || t === "dai" || t.startsWith("busd");
}

// Tickers allowed for deposit/payment beyond stablecoins.
// For these, NowPayments receives price_currency="usd" and handles
// the crypto conversion internally; the IPN credits price_amount (USD).
const SUPPORTED_NON_STABLE_TICKERS = new Set([
  "trx", "ton", "btc", "eth", "ltc", "sol", "xrp", "doge",
  "bnbbsc", "bnbmainnet", "matic", "ada", "dot", "shib",
]);

export function isSupportedCrypto(ticker: string): boolean {
  const t = ticker.toLowerCase();
  return isStableTicker(t) || SUPPORTED_NON_STABLE_TICKERS.has(t);
}

// Extracts a flat list of ticker strings from whatever shape NowPayments
// returns (plain string array, or array/object of currency objects).
function extractTickers(payload: any): string[] {
  const raw = payload?.selectedCurrencies ?? payload?.currencies ?? payload;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item: any) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") return item.code || item.ticker || item.currency || null;
      return null;
    })
    .filter((t: any): t is string => typeof t === "string" && t.length > 0);
}

export async function getMinAmount(currencyFrom: string, currencyTo: string): Promise<number | null> {
  if (!NOWPAYMENTS_API_KEY) return null;
  try {
    const params = new URLSearchParams({
      currency_from: currencyFrom.toLowerCase(),
      currency_to: currencyTo.toLowerCase(),
    });
    const res = await fetch(`${BASE_URL}/min-amount?${params}`, {
      headers: { "x-api-key": NOWPAYMENTS_API_KEY },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return parseFloat(data.min_amount) || null;
  } catch {
    return null;
  }
}

export async function getEstimatedPrice(amount: number, currencyFrom: string, currencyTo: string): Promise<number | null> {
  if (!NOWPAYMENTS_API_KEY) return null;
  try {
    const params = new URLSearchParams({
      amount: amount.toString(),
      currency_from: currencyFrom.toLowerCase(),
      currency_to: currencyTo.toLowerCase(),
    });
    const res = await fetch(`${BASE_URL}/estimate?${params}`, {
      headers: { "x-api-key": NOWPAYMENTS_API_KEY },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return parseFloat(data.estimated_amount) || null;
  } catch {
    return null;
  }
}

let currenciesCache: { at: number; data: NowPaymentsCurrencyOption[] } | null = null;
const CURRENCIES_CACHE_TTL_MS = 10 * 60 * 1000;

// Returns the crypto currencies the merchant account can accept, falling
// back to the full platform currency list, and finally to a safe default
// of USDT-TRC20 only if NowPayments is unreachable/misconfigured.
export async function getNowPaymentsCurrencies(): Promise<NowPaymentsCurrencyOption[]> {
  if (currenciesCache && Date.now() - currenciesCache.at < CURRENCIES_CACHE_TTL_MS) {
    return currenciesCache.data;
  }
  if (!NOWPAYMENTS_API_KEY) {
    return [buildCurrencyOption("usdttrc20")];
  }

  const endpoints = [`${BASE_URL}/merchant/coins`, `${BASE_URL}/currencies`];
  for (const url of endpoints) {
    try {
      const res = await fetch(url, { headers: { "x-api-key": NOWPAYMENTS_API_KEY } });
      if (!res.ok) continue;
      const json = await res.json();
      const tickers = extractTickers(json).filter(isSupportedCrypto);
      if (tickers.length > 0) {
        const options = tickers.map(buildCurrencyOption).sort((a, b) => a.label.localeCompare(b.label));
        currenciesCache = { at: Date.now(), data: options };
        return options;
      }
    } catch {
      // try next endpoint
    }
  }

  const fallback = [buildCurrencyOption("usdttrc20")];
  currenciesCache = { at: Date.now(), data: fallback };
  return fallback;
}
