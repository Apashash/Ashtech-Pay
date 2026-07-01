export const RATE_LIMIT_KEY = "ashtech_rate_limit_until";

export function getBlockedUntil(): number | null {
  try {
    const v = localStorage.getItem(RATE_LIMIT_KEY);
    if (!v) return null;
    const ts = parseInt(v, 10);
    if (ts > Date.now()) return ts;
    localStorage.removeItem(RATE_LIMIT_KEY);
  } catch {}
  return null;
}

export const GEO_BYPASS_PATHS = ["/pay/", "/hpay/", "/checkout/", import.meta.env.VITE_ADMIN_PATH as string];
export const GEO_CACHE_KEY = "ashtech_geo_cache";
export const GEO_CACHE_TTL = 10 * 60 * 1000;

export function getGeoCache(): { country: string; countryName: string; isAfrica: boolean } | null {
  try {
    const raw = localStorage.getItem(GEO_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.ts > GEO_CACHE_TTL) {
      localStorage.removeItem(GEO_CACHE_KEY);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

export function setGeoCache(data: { country: string; countryName: string; isAfrica: boolean }) {
  try {
    localStorage.setItem(GEO_CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
  } catch {}
}
