import { db } from "./db";
import { platformSettings } from "@shared/schema-runtime";
import { like, eq } from "drizzle-orm";

const MAX_AUTH_ATTEMPTS = 4;
const AUTH_BLOCK_DURATION_MS = 30 * 60 * 1000;
// Pending count entries (not yet blocked) expire after 30 min of inactivity
const PENDING_ENTRY_TTL_MS = 30 * 60 * 1000;
const KEY_PREFIX = "ipblock:";

// ── Shared-IP protection (CGNAT / mobile carrier NAT) ─────────────────────────
// Many users in Africa share one public IP (carrier-grade NAT). Blocking the
// WHOLE IP after only 4 failed logins on ONE account would lock out every other
// customer behind that IP. So:
//  - Per-IDENTIFIER blocking (this account only) still trips after 4 failures —
//    this is what actually stops brute-forcing one account's password.
//  - Per-IP blocking (the whole shared IP) only trips after a much higher
//    threshold, which realistically only happens with a real bot/credential-
//    stuffing attack hitting many different accounts from the same IP.
const MAX_IP_ATTEMPTS = 20;
const IDENT_KEY_PREFIX = "identblock:";

interface IpRecord {
  count: number;
  blockedUntil?: number;
  identifier?: string;
  blockedAt?: number;
  lastAttemptAt?: number;
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

// ── Load a single IP record from DB (used for cache-miss fallback) ─────────────
async function loadFromDb(ip: string): Promise<IpRecord | null> {
  try {
    const key = dbKey(ip);
    const rows = await db.select().from(platformSettings).where(eq(platformSettings.key, key)).limit(1);
    if (rows.length === 0) return null;
    return JSON.parse(rows[0].value) as IpRecord;
  } catch {
    return null;
  }
}

// ── Hydrate cache from DB on server start ─────────────────────────────────────
// FIX: now loads BOTH blocked IPs AND pending count entries (no blockedUntil).
// Previously only blocked IPs were reloaded — pending counts were deleted on
// restart, letting users start fresh after every server restart/worker switch.
export async function hydrateIpBlocker(): Promise<void> {
  try {
    const rows = await db.select().from(platformSettings).where(like(platformSettings.key, `${KEY_PREFIX}%`));
    const now = Date.now();
    let loadedBlocked = 0;
    let loadedPending = 0;
    for (const row of rows) {
      try {
        const record: IpRecord = JSON.parse(row.value);
        const ip = row.key.slice(KEY_PREFIX.length);

        if (record.blockedUntil) {
          // Active block — load if not expired
          if (now < record.blockedUntil) {
            cache.set(ip, record);
            loadedBlocked++;
          } else {
            // Expired block — clean up
            await db.delete(platformSettings).where(eq(platformSettings.key, row.key));
          }
        } else {
          // Pending count (not yet blocked) — keep if recent enough
          const lastAttempt = record.lastAttemptAt ?? 0;
          if (now - lastAttempt < PENDING_ENTRY_TTL_MS) {
            cache.set(ip, record);
            loadedPending++;
          } else {
            // Stale pending entry — clean up
            await db.delete(platformSettings).where(eq(platformSettings.key, row.key));
          }
        }
      } catch {}
    }
    console.log(`[IpBlocker] Hydrated ${loadedBlocked} active block(s) + ${loadedPending} pending counter(s) from DB.`);
  } catch (err: any) {
    console.error("[IpBlocker] hydrate error:", err.message);
  }
}

// ── Periodic cleanup of expired entries ───────────────────────────────────────
setInterval(() => {
  (async () => {
    try {
      const now = Date.now();
      for (const [ip, record] of cache.entries()) {
        const expired = record.blockedUntil
          ? now > record.blockedUntil + 60_000
          : now - (record.lastAttemptAt ?? 0) > PENDING_ENTRY_TTL_MS;
        if (expired) {
          cache.delete(ip);
          await remove(ip).catch(() => {});
        }
      }
    } catch (err: any) {
      console.error("[IpBlocker] Cleanup interval error:", err?.message);
    }
  })();
}, 10 * 60 * 1000);

function identKey(identifier: string) {
  return `${IDENT_KEY_PREFIX}${identifier.trim().toLowerCase()}`;
}

// ── Public API ─────────────────────────────────────────────────────────────────

// Checks ONLY the whole-IP block (high threshold, real bot/credential-stuffing
// signal). Used for generic per-request checks where we don't yet know which
// account is being targeted (e.g. /login page redirect, /api/auth/ping).
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

// Checks the per-ACCOUNT block (low threshold, 4 attempts). This is what
// actually stops someone from brute-forcing one specific account's password,
// without punishing other users who happen to share the same IP.
export function checkIdentifierRateLimit(identifier: string): { blocked: boolean; retryAfter?: number } {
  if (!identifier) return { blocked: false };
  const now = Date.now();
  const key = identKey(identifier);
  const record = cache.get(key);
  if (record?.blockedUntil) {
    if (now < record.blockedUntil) return { blocked: true, retryAfter: record.blockedUntil };
    cache.delete(key);
    remove(key).catch(() => {});
  }
  return { blocked: false };
}

async function bumpRecord(
  key: string,
  maxAttempts: number,
  identifier: string | undefined
): Promise<{ blocked: boolean; retryAfter?: number; attemptsLeft: number }> {
  const now = Date.now();

  // FIX: if not in local cache (e.g. multi-worker PM2 or post-restart), load
  // the count from DB before incrementing — prevents the counter from resetting
  // to 1 just because this worker hasn't seen previous attempts.
  let existing = cache.get(key);
  if (!existing) {
    const dbRecord = await loadFromDb(key);
    if (dbRecord) {
      existing = dbRecord;
      cache.set(key, dbRecord);
    }
  }

  // If a previous block has now expired, start a fresh counter
  if (existing?.blockedUntil && now >= existing.blockedUntil) {
    const fresh: IpRecord = { count: 1, identifier, lastAttemptAt: now };
    cache.set(key, fresh);
    await persist(key, fresh);
    return { blocked: false, attemptsLeft: maxAttempts - 1 };
  }

  const newCount = (existing?.count || 0) + 1;
  if (newCount >= maxAttempts) {
    const blockedUntil = now + AUTH_BLOCK_DURATION_MS;
    const record: IpRecord = {
      count: newCount,
      blockedUntil,
      identifier: identifier || existing?.identifier,
      blockedAt: now,
      lastAttemptAt: now,
    };
    cache.set(key, record);
    await persist(key, record);
    return { blocked: true, retryAfter: blockedUntil, attemptsLeft: 0 };
  }

  const record: IpRecord = {
    count: newCount,
    identifier: identifier || existing?.identifier,
    lastAttemptAt: now,
  };
  cache.set(key, record);
  await persist(key, record);
  return { blocked: false, attemptsLeft: maxAttempts - newCount };
}

// Records a failed auth attempt. Bumps the per-ACCOUNT counter (4 attempts →
// 30 min block on that account only) AND the whole-IP counter (20 attempts →
// 30 min block on the IP — only trips for real distributed attacks). Returns
// whichever block is currently active, preferring the more specific one.
export async function recordAuthFailure(
  ip: string,
  identifier?: string
): Promise<{ blocked: boolean; retryAfter?: number; attemptsLeft: number; scope?: "identifier" | "ip" }> {
  const ipResult = await bumpRecord(ip, MAX_IP_ATTEMPTS, identifier);

  if (identifier) {
    const identResult = await bumpRecord(identKey(identifier), MAX_AUTH_ATTEMPTS, identifier);
    if (identResult.blocked) {
      return { ...identResult, scope: "identifier" };
    }
    if (ipResult.blocked) {
      return { ...ipResult, scope: "ip" };
    }
    // Report whichever counter is closer to tripping, so the UI can warn the user.
    return identResult.attemptsLeft <= ipResult.attemptsLeft
      ? { ...identResult, scope: "identifier" }
      : { ...ipResult, scope: "ip" };
  }

  return { ...ipResult, scope: "ip" };
}

export async function clearAuthAttempts(ip: string, identifier?: string): Promise<void> {
  cache.delete(ip);
  await remove(ip).catch(() => {});
  if (identifier) {
    const key = identKey(identifier);
    cache.delete(key);
    await remove(key).catch(() => {});
  }
}

export async function unblockByIdentifier(identifier: string): Promise<{ unblocked: number; ips: string[] }> {
  const normalized = identifier.trim().toLowerCase();
  const toUnblock: string[] = [];
  const now = Date.now();
  // Always clear the dedicated per-account block, if any.
  const directKey = identKey(normalized);
  if (cache.has(directKey)) toUnblock.push(directKey);
  for (const [key, record] of cache.entries()) {
    if (key === directKey) continue;
    if (!record.blockedUntil || now >= record.blockedUntil) continue;
    const id = (record.identifier || "").toLowerCase();
    if (id === normalized || id.includes(normalized) || normalized.includes(id)) {
      toUnblock.push(key);
    }
  }
  for (const key of toUnblock) {
    cache.delete(key);
    await remove(key).catch(() => {});
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
    lastAttemptAt: now,
  };
  cache.set(ip, record);
  await persist(ip, record);
}

export function getBlockedIps(): { ip: string; identifier: string; blockedUntil: number; blockedAt: number }[] {
  const now = Date.now();
  const result: { ip: string; identifier: string; blockedUntil: number; blockedAt: number }[] = [];
  for (const [key, record] of cache.entries()) {
    if (record.blockedUntil && now < record.blockedUntil) {
      const isIdentifierBlock = key.startsWith(IDENT_KEY_PREFIX);
      result.push({
        ip: isIdentifierBlock ? `compte: ${record.identifier || key.slice(IDENT_KEY_PREFIX.length)}` : key,
        identifier: record.identifier || "inconnu",
        blockedUntil: record.blockedUntil,
        blockedAt: record.blockedAt || record.blockedUntil - AUTH_BLOCK_DURATION_MS,
      });
    }
  }
  return result.sort((a, b) => b.blockedAt - a.blockedAt);
}
