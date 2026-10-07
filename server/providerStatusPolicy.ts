const SECOND = 1000;
const MINUTE = 60 * SECOND;

export const PROVIDER_STATUS_POLL_INTERVALS = [
  { maxAgeMs: 10 * MINUTE, intervalMs: 3 * MINUTE },
  { maxAgeMs: Number.POSITIVE_INFINITY, intervalMs: 30 * MINUTE },
] as const;

export const AFRIBAPAY_PAYOUT_STATUS_POLL_INTERVALS = [
  { maxAgeMs: 10 * MINUTE, intervalMs: MINUTE },
  { maxAgeMs: Number.POSITIVE_INFINITY, intervalMs: 10 * MINUTE },
] as const;

/** Callbacks settle payouts promptly; these lower-frequency checks are reconciliation only. */
export function providerStatusPollIntervalMs(
  startedAt: number,
  now = Date.now(),
  provider?: string,
): number {
  const ageMs = Math.max(0, now - startedAt);
  const intervals = provider === "afribapay"
    ? AFRIBAPAY_PAYOUT_STATUS_POLL_INTERVALS
    : PROVIDER_STATUS_POLL_INTERVALS;
  return intervals.find(({ maxAgeMs }) => ageMs < maxAgeMs)?.intervalMs
    ?? intervals[intervals.length - 1].intervalMs;
}

export function isProviderStatusPollDue(
  startedAt: number,
  lastCheckedAt: number,
  now = Date.now(),
  provider?: string,
): boolean {
  if (!Number.isFinite(lastCheckedAt) || lastCheckedAt <= 0) return true;
  if (lastCheckedAt > now) return false;
  if (provider !== "afribapay") {
    return now - lastCheckedAt >= providerStatusPollIntervalMs(startedAt, now, provider);
  }

  // AfribaPay gets a check at each phase boundary as well as after each interval.
  // That prevents a last 5-second/5-minute check just before a boundary from
  // pushing the new phase's first check late.
  const ageAtLastCheck = Math.max(0, lastCheckedAt - startedAt);
  const phase = AFRIBAPAY_PAYOUT_STATUS_POLL_INTERVALS.find(
    ({ maxAgeMs }) => ageAtLastCheck < maxAgeMs,
  ) ?? AFRIBAPAY_PAYOUT_STATUS_POLL_INTERVALS[AFRIBAPAY_PAYOUT_STATUS_POLL_INTERVALS.length - 1];
  const intervalDeadline = lastCheckedAt + phase.intervalMs;
  const phaseBoundaryDeadline = Number.isFinite(phase.maxAgeMs)
    ? startedAt + phase.maxAgeMs
    : Number.POSITIVE_INFINITY;
  return now >= Math.min(intervalDeadline, phaseBoundaryDeadline);
}

/** Deterministically spreads startup recovery lookups over at most one minute. */
export function recoveredStatusPollLastCheckedAt(
  key: string,
  startedAt: number,
  now = Date.now(),
  provider?: string,
): number {
  let hash = 2166136261;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const intervalMs = providerStatusPollIntervalMs(startedAt, now, provider);
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