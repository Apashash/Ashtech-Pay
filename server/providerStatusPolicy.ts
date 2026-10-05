export const PROVIDER_STATUS_POLL_INTERVALS = [
  { maxAgeMs: 30 * 60 * 1000, intervalMs: 60 * 1000 },
  { maxAgeMs: Number.POSITIVE_INFINITY, intervalMs: 2 * 60 * 1000 },
] as const;

/** Pending transactions are polled forever; after 30 minutes, poll every two minutes. */
export function providerStatusPollIntervalMs(startedAt: number, now = Date.now()): number {
  const ageMs = Math.max(0, now - startedAt);
  return PROVIDER_STATUS_POLL_INTERVALS.find(({ maxAgeMs }) => ageMs < maxAgeMs)?.intervalMs
    ?? PROVIDER_STATUS_POLL_INTERVALS[PROVIDER_STATUS_POLL_INTERVALS.length - 1].intervalMs;
}

export function isProviderStatusPollDue(
  startedAt: number,
  lastCheckedAt: number,
  now = Date.now(),
): boolean {
  if (!Number.isFinite(lastCheckedAt) || lastCheckedAt <= 0) return true;
  return now - lastCheckedAt >= providerStatusPollIntervalMs(startedAt, now);
}

/** Deterministically spreads startup recovery lookups over at most one minute. */
export function recoveredStatusPollLastCheckedAt(
  key: string,
  startedAt: number,
  now = Date.now(),
): number {
  let hash = 2166136261;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const intervalMs = providerStatusPollIntervalMs(startedAt, now);
  const startupSpreadMs = Math.min(60 * 1000, intervalMs - 1);
  const delayMs = (hash >>> 0) % (startupSpreadMs + 1);
  return now - intervalMs + delayMs;
}

/**
 * Small process-local cache that also coalesces concurrent reads for a key.
 * Rejected requests are never cached.
 */
export function createAsyncTtlCache<K, V>(
  ttlMs: number,
  now: () => number = Date.now,
  shouldCache: (value: V) => boolean = () => true,
) {
  const values = new Map<K, { value: V; expiresAt: number }>();
  const inFlight = new Map<K, Promise<V>>();

  return {
    get(key: K, load: () => Promise<V>): Promise<V> {
      const cached = values.get(key);
      if (cached && cached.expiresAt > now()) return Promise.resolve(cached.value);
      if (cached) values.delete(key);

      const pending = inFlight.get(key);
      if (pending) return pending;

      const request = Promise.resolve().then(load);
      inFlight.set(key, request);
      return request
        .then((value) => {
          if (shouldCache(value)) {
            const currentTime = now();
            if (values.size >= 1000) {
              for (const [cachedKey, entry] of values) {
                if (entry.expiresAt <= currentTime) values.delete(cachedKey);
              }
              if (values.size >= 1000) {
                const oldestKey = values.keys().next().value as K | undefined;
                if (oldestKey !== undefined) values.delete(oldestKey);
              }
            }
            values.set(key, { value, expiresAt: currentTime + Math.max(0, ttlMs) });
          }
          return value;
        })
        .finally(() => {
          if (inFlight.get(key) === request) inFlight.delete(key);
        });
    },

    clear(key?: K): void {
      if (key === undefined) {
        values.clear();
        return;
      }
      values.delete(key);
    },
  };
}