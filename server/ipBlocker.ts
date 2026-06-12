import { db } from "./db";
import { platformSettings } from "@shared/schema";
import { like, eq } from "drizzle-orm";

const MAX_AUTH_ATTEMPTS = 4;
const AUTH_BLOCK_DURATION_MS = 30 * 60 * 1000;
const KEY_PREFIX = "ipblock:";

interface IpRecord {
  count: number;
  blockedUntil?: number;
  identifier?: string;
  blockedAt?: number;
}

// In-memory cache (fast path) — hydrated from DB on startup
const cache = new Map<string, IpRecord>();

function dbKey(ip: string) { return `${KEY_PREFIX}${ip}`; }

// ── Persist record to DB ──────────────────────────────────────────────────────
async function persist(ip: string, record: IpRecord): Promise<void> {
  try {
    const key = dbKey(ip);
    const value = JSON.stringify(record);
    const existing = await db.select().from(platformSettings).where(eq(platformSettings.key, key)).limit(1);
    if (existing.length > 0) {
      await db.update(platformSettings).set({ value, updatedAt: new Date() }).where(eq(platformSettings.key, key));
    } else {
      await db.insert(platformSettings).values({ key, value, description: "IP rate-limit block (auto)" });
    }
  } catch (err: any) {
    console.error("[IpBlocker] persist error:", err.message);
  }
}

async function remove(ip: string): Promise<void> {
  try {
    await db.delete(platformSettings).where(eq(platformSettings.key, dbKey(ip)));
  } catch (err: any) {
    console.error("[IpBlocker] remove error:", err.message);
  }
}

// ── Hydrate cache from DB on server start ─────────────────────────────────────
export async function hydrateIpBlocker(): Promise<void> {
  try {
    const rows = await db.select().from(platformSettings).where(like(platformSettings.key, `${KEY_PREFIX}%`));
    const now = Date.now();
    let loaded = 0;
    for (const row of rows) {
      try {
        const record: IpRecord = JSON.parse(row.value);
        const ip = row.key.slice(KEY_PREFIX.length);
        if (record.blockedUntil && now < record.blockedUntil) {
          cache.set(ip, record);
          loaded++;
        } else {
          // expired — clean up
          await db.delete(platformSettings).where(eq(platformSettings.key, row.key));
        }
      } catch {}
    }
    console.log(`[IpBlocker] Hydrated ${loaded} active block(s) from DB.`);
  } catch (err: any) {
    console.error("[IpBlocker] hydrate error:", err.message);
  }
}

// ── Periodic cleanup of expired entries ───────────────────────────────────────
setInterval(async () => {
  const now = Date.now();
  for (const [ip, record] of cache.entries()) {
    if (!record.blockedUntil || now > record.blockedUntil + 60_000) {
      cache.delete(ip);
      await remove(ip).catch(() => {});
    }
  }
}, 10 * 60 * 1000);

// ── Public API ─────────────────────────────────────────────────────────────────

export function checkAuthRateLimit(ip: string): { blocked: boolean; retryAfter?: number } {
  const now = Date.now();
  const record = cache.get(ip);
  if (record?.blockedUntil) {
    if (now < record.blockedUntil) return { blocked: true, retryAfter: record.blockedUntil };
    cache.delete(ip);
    remove(ip).catch(() => {});
  }
  return { blocked: false };
}

export async function recordAuthFailure(
  ip: string,
  identifier?: string
): Promise<{ blocked: boolean; retryAfter?: number; attemptsLeft: number }> {
  const now = Date.now();
  const existing = cache.get(ip);

  if (existing?.blockedUntil && now >= existing.blockedUntil) {
    const fresh: IpRecord = { count: 1, identifier };
    cache.set(ip, fresh);
    await persist(ip, fresh);
    return { blocked: false, attemptsLeft: MAX_AUTH_ATTEMPTS - 1 };
  }

  const newCount = (existing?.count || 0) + 1;
  if (newCount >= MAX_AUTH_ATTEMPTS) {
    const blockedUntil = now + AUTH_BLOCK_DURATION_MS;
    const record: IpRecord = {
      count: newCount,
      blockedUntil,
      identifier: identifier || existing?.identifier,
      blockedAt: now,
    };
    cache.set(ip, record);
    await persist(ip, record);
    return { blocked: true, retryAfter: blockedUntil, attemptsLeft: 0 };
  }

  const record: IpRecord = { count: newCount, identifier: identifier || existing?.identifier };
  cache.set(ip, record);
  // Persist chaque tentative en DB → le compteur survit aux redémarrages serveur
  await persist(ip, record);
  return { blocked: false, attemptsLeft: MAX_AUTH_ATTEMPTS - newCount };
}

export async function clearAuthAttempts(ip: string): Promise<void> {
  cache.delete(ip);
  await remove(ip).catch(() => {});
}

export async function unblockByIdentifier(identifier: string): Promise<{ unblocked: number; ips: string[] }> {
  const normalized = identifier.trim().toLowerCase();
  const toUnblock: string[] = [];
  const now = Date.now();
  for (const [ip, record] of cache.entries()) {
    if (!record.blockedUntil || now >= record.blockedUntil) continue;
    const id = (record.identifier || "").toLowerCase();
    if (id === normalized || id.includes(normalized) || normalized.includes(id)) {
      toUnblock.push(ip);
    }
  }
  for (const ip of toUnblock) {
    cache.delete(ip);
    await remove(ip).catch(() => {});
  }
  return { unblocked: toUnblock.length, ips: toUnblock };
}

// ── Manual block with custom duration (e.g. admin IP whitelist violation) ─────
export async function blockIpManually(ip: string, durationMs: number, reason: string): Promise<void> {
  const now = Date.now();
  const blockedUntil = now + durationMs;
  const record: IpRecord = {
    count: MAX_AUTH_ATTEMPTS,
    blockedUntil,
    identifier: reason,
    blockedAt: now,
  };
  cache.set(ip, record);
  await persist(ip, record);
}

export function getBlockedIps(): { ip: string; identifier: string; blockedUntil: number; blockedAt: number }[] {
  const now = Date.now();
  const result: { ip: string; identifier: string; blockedUntil: number; blockedAt: number }[] = [];
  for (const [ip, record] of cache.entries()) {
    if (record.blockedUntil && now < record.blockedUntil) {
      result.push({
        ip,
        identifier: record.identifier || "inconnu",
        blockedUntil: record.blockedUntil,
        blockedAt: record.blockedAt || record.blockedUntil - AUTH_BLOCK_DURATION_MS,
      });
    }
  }
  return result.sort((a, b) => b.blockedAt - a.blockedAt);
}
