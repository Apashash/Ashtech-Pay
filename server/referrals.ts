import { randomInt, randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { db, pool } from "./db";
import { sendPushNotification } from "./push";
import { REFERRAL_RULES, referralFee, referralPromoActive } from "@shared/referral-policy";
import { qualifyingTransactions } from "./referral-eligibility";

// Service-owned tables: no new FK on legacy imported Plesk user schemas.
// All user-controlled values are bound parameters, never interpolated SQL.
let schemaPromise: Promise<void> | undefined;
export function ensureReferralSchema(): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      const date = process.env.DB_DIALECT?.toLowerCase() === "mysql" ? "DATETIME(3)" : "TIMESTAMP";
      for (const statement of [
        `CREATE TABLE IF NOT EXISTS referral_accounts (
          user_id VARCHAR(191) PRIMARY KEY, code VARCHAR(32) NOT NULL UNIQUE,
          starts_at ${date}, expires_at ${date}, cancelled_at ${date})`,
        `CREATE TABLE IF NOT EXISTS referral_invites (
          id VARCHAR(191) PRIMARY KEY, referrer_id VARCHAR(191) NOT NULL,
          invitee_id VARCHAR(191) NOT NULL UNIQUE, created_at ${date} NOT NULL,
          qualified_at ${date})`,
        `CREATE TABLE IF NOT EXISTS referral_usage (
          reference VARCHAR(191) PRIMARY KEY, user_id VARCHAR(191) NOT NULL,
          starts_at ${date} NOT NULL, created_at ${date} NOT NULL,
          currency VARCHAR(16) NOT NULL, amount DECIMAL(20,2) NOT NULL)`,
        `CREATE TABLE IF NOT EXISTS referral_events (
          id VARCHAR(191) PRIMARY KEY, user_id VARCHAR(191) NOT NULL,
          expires_at ${date} NOT NULL, push_claimed_at ${date})`,
        `CREATE TABLE IF NOT EXISTS referral_qualifying_transactions (
          transaction_id VARCHAR(191) PRIMARY KEY, invitee_id VARCHAR(191) NOT NULL,
          reference VARCHAR(191), type VARCHAR(32) NOT NULL, confirmed_at ${date} NOT NULL)`,
      ]) await pool.query(statement);
      // Keep previously shared 20-character codes valid when shortening them.
      try {
        await pool.query("ALTER TABLE referral_accounts ADD COLUMN legacy_code VARCHAR(32) NULL");
      } catch (error: any) {
        if (!["42701", "ER_DUP_FIELDNAME"].includes(error.code)) throw error;
      }
      try {
        await pool.query("CREATE UNIQUE INDEX referral_accounts_legacy_code_idx ON referral_accounts (legacy_code)");
      } catch (error: any) {
        if (!["42P07", "ER_DUP_KEYNAME"].includes(error.code)) throw error;
      }
      // Indexes are idempotent across MySQL/MariaDB/Postgres versions.
      for (const [name, table, columns] of [
        ["referral_invites_referrer_idx", "referral_invites", "referrer_id"],
        ["referral_usage_account_idx", "referral_usage", "user_id, starts_at"],
        ["referral_events_push_idx", "referral_events", "push_claimed_at, expires_at"],
        ["referral_qualifying_invitee_idx", "referral_qualifying_transactions", "invitee_id"],
      ]) {
        try { await pool.query(`CREATE INDEX ${name} ON ${table} (${columns})`); }
        catch (error: any) {
          if (!["42P07", "ER_DUP_KEYNAME"].includes(error.code)) throw error;
        }
      }
    })().catch(error => { schemaPromise = undefined; throw error; });
  }
  return schemaPromise;
}

function rows(result: any): any[] {
  if (Array.isArray(result)) return Array.isArray(result[0]) ? result[0] : result;
  return result.rows || [];
}
function iso(value: any): string | null { return value ? new Date(value).toISOString() : null; }
// Legacy transaction timestamps may have only second precision.
// A newly registered user's same-second transactions still belong to the invitation.
function invitationTime() { return new Date(Math.floor(Date.now() / 1000) * 1000); }
// Imported MySQL accounts may have NULL instead of the ordinary user default.
// This does not grant admin privileges; every administrative gate remains separate.
function isClientRole(role: unknown) { return role == null || role === "user"; }
const promoMessage = "Vos frais sont réduits pendant cinq jours sur vos dépôts et retraits Mobile Money admissibles, dans la limite des plafonds : coût de traitement réel + 0,3 %. Ce gain n'est pas un versement d'argent. Consultez Parrainage & gains pour les conditions et la date de fin.";
function newReferralCode() { return randomInt(36 ** 6).toString(36).padStart(6, "0"); }

export async function ensureReferralAccount(userId: string) {
  await ensureReferralSchema();
  for (let attempt = 0; attempt < 20; attempt++) {
    const existing = await pool.query("SELECT * FROM referral_accounts WHERE user_id=$1", [userId]);
    const account = existing.rows[0];
    if (account && /^[a-z0-9]{6}$/.test(account.code)) return account;
    try {
      if (account) {
        // Compare-and-set changes code and alias together, without touching the
        // promotion dates or attribution. Concurrent readers converge on one code.
        await pool.query(`UPDATE referral_accounts
          SET legacy_code=COALESCE(legacy_code,code), code=$1 WHERE user_id=$2 AND code=$3`,
        [newReferralCode(), userId, account.code]);
      } else {
        await pool.query("INSERT INTO referral_accounts (user_id, code) VALUES ($1,$2)",
          [userId, newReferralCode()]);
      }
    } catch (error: any) {
      if (!["23505", "ER_DUP_ENTRY"].includes(error.code)) throw error;
    }
  }
  const result = await pool.query("SELECT * FROM referral_accounts WHERE user_id=$1", [userId]);
  if (!result.rows[0] || !/^[a-z0-9]{6}$/.test(result.rows[0].code)) throw new Error("Impossible de créer le code de parrainage");
  return result.rows[0];
}

export async function resolveReferralCode(value: unknown): Promise<string | null> {
  if (value == null || value === "") return null;
  if (typeof value !== "string") throw new Error("Code de parrainage invalide");
  const code = value.trim().toLowerCase();
  if (!/^(?:[a-z0-9]{6}|[a-f0-9]{20})$/.test(code)) throw new Error("Code de parrainage invalide");
  await ensureReferralSchema();
  const result = await pool.query(`SELECT a.user_id FROM referral_accounts a
    JOIN users u ON u.id=a.user_id WHERE (a.code=$1 OR a.legacy_code=$1)
    AND (u.role='user' OR u.role IS NULL) AND u.is_banned=$2`,
  [code, false]);
  if (!result.rows[0]) throw new Error("Code de parrainage indisponible");
  return result.rows[0].user_id;
}

export async function attachReferral(inviteeId: string, referrerId: string | null) {
  if (!referrerId) return;
  if (inviteeId === referrerId) throw new Error("Auto-parrainage interdit");
  await ensureReferralAccount(inviteeId);
  // No upsert: an existing attribution must never be changed.
  await pool.query(`INSERT INTO referral_invites
    (id, referrer_id, invitee_id, created_at) VALUES ($1,$2,$3,$4)`,
  [randomUUID(), referrerId, inviteeId, invitationTime()]);
}

export async function registerReferral(trx: any, inviteeId: string, referrerId: string) {
  if (inviteeId === referrerId) throw new Error("Auto-parrainage interdit");
  // Do not catch a unique violation inside a PostgreSQL transaction: it would
  // leave the signup transaction aborted. A conflicting code is simply retried.
  let created = false;
  for (let attempt = 0; attempt < 20; attempt++) {
    const code = newReferralCode();
    if (process.env.DB_DIALECT?.toLowerCase() === "mysql") {
      await trx.execute(sql`INSERT INTO referral_accounts (user_id,code)
        VALUES (${inviteeId},${code}) ON DUPLICATE KEY UPDATE user_id=user_id`);
    } else {
      await trx.execute(sql`INSERT INTO referral_accounts (user_id,code)
        VALUES (${inviteeId},${code}) ON CONFLICT DO NOTHING`);
    }
    if (rows(await trx.execute(sql`SELECT user_id FROM referral_accounts WHERE user_id=${inviteeId}`)).length) {
      created = true;
      break;
    }
  }
  if (!created) throw new Error("Impossible de créer le code de parrainage");
  await trx.execute(sql`INSERT INTO referral_invites (id,referrer_id,invitee_id,created_at)
    VALUES (${randomUUID()},${referrerId},${inviteeId},${invitationTime()})`);
}

export function scheduleReferralReconciliation(userId: string) {
  // Never make a settled payment fail because push/referral processing failed.
  // The durable minute reconciliation retries unqualified records.
  void reconcileReferral(userId).catch(error => console.error("[Referral] Activation failed:", error.message));
}

async function activate(trx: any, account: any, now: Date, renew = false) {
  if (!renew && referralPromoActive(account.starts_at, account.expires_at, account.cancelled_at, now.getTime())) return false;
  const expires = new Date(now.getTime() + REFERRAL_RULES.durationDays * 86400000);
  await trx.execute(sql`UPDATE referral_accounts SET starts_at=${now}, expires_at=${expires},
    cancelled_at=NULL WHERE user_id=${account.user_id}`);
  const eventId = randomUUID();
  await trx.execute(sql`INSERT INTO referral_events (id,user_id,expires_at)
    VALUES (${eventId},${account.user_id},${expires})`);
  await trx.execute(sql`INSERT INTO user_notifications
    (id,user_id,type,title,message,is_read,created_at)
    VALUES (${eventId},${account.user_id},'referral_promo_activated',
    'Votre tarif de parrainage est actif',${promoMessage},${false},${now})`);
  return true;
}

/** Shared reconciliation also covers KYC approved after the third transaction. */
export async function reconcileReferral(inviteeId: string) {
  await ensureReferralSchema();
  await db.transaction(async trx => {
    const invite = rows(await trx.execute(sql`SELECT * FROM referral_invites
      WHERE invitee_id=${inviteeId} FOR UPDATE`))[0];
    if (!invite || invite.qualified_at) return;
    const invitee = rows(await trx.execute(sql`SELECT kyc_status,is_verified,is_banned,role
      FROM users WHERE id=${inviteeId}`))[0];
    if (!invitee || invitee.is_banned || !isClientRole(invitee.role)) return;
    const txs = await qualifyingTransactions(trx, inviteeId, invite.created_at);
    if (txs.length < REFERRAL_RULES.requiredTransactions
      || invitee.kyc_status !== "verified" || !invitee.is_verified) return;
    const now = new Date();
    // Stable order prevents races between simultaneous qualifying invitees.
    const accounts = rows(await trx.execute(sql`SELECT a.*,u.is_banned,u.role,u.kyc_status,u.is_verified
      FROM referral_accounts a JOIN users u ON u.id=a.user_id
      WHERE a.user_id IN (${invite.referrer_id},${invite.invitee_id})
      ORDER BY a.user_id FOR UPDATE`));
    const currentInvitee = accounts.find(account => account.user_id === inviteeId);
    if (!currentInvitee || currentInvitee.is_banned || !isClientRole(currentInvitee.role)
      || currentInvitee.kyc_status !== "verified" || !currentInvitee.is_verified) return;
    for (const account of accounts) {
      if (account && !account.is_banned && isClientRole(account.role)) await activate(trx, account, now, true);
    }
    await trx.execute(sql`UPDATE referral_invites SET qualified_at=${now} WHERE id=${invite.id}`);
  });
  void flushReferralPush().catch(error => console.error("[Referral] Push scheduling failed:", error.message));
}

export async function getReferralPromo(userId: string) {
  await ensureReferralSchema();
  const account = (await pool.query("SELECT * FROM referral_accounts WHERE user_id=$1", [userId])).rows[0];
  const now = new Date();
  if (!account || !referralPromoActive(account.starts_at, account.expires_at, account.cancelled_at, now.getTime())) return null;
  return { startsAt: iso(account.starts_at)!, expiresAt: iso(account.expires_at)!,
    remainingSeconds: Math.ceil((new Date(account.expires_at).getTime() - now.getTime()) / 1000) };
}

export async function referralOverview(userId: string, requestedPage = 1) {
  const account = await ensureReferralAccount(userId);
  await reconcileReferral(userId);
  const fresh = (await pool.query("SELECT * FROM referral_accounts WHERE user_id=$1", [userId])).rows[0];
  const pageSize = 15;
  const total = Number((await pool.query(`SELECT COUNT(*) AS total
    FROM referral_invites i JOIN users u ON u.id=i.invitee_id WHERE i.referrer_id=$1`, [userId])).rows[0].total);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(totalPages, Math.max(1, Number.isSafeInteger(requestedPage) ? requestedPage : 1));
  const invitations = (await pool.query(`SELECT i.*,u.username,u.kyc_status,u.is_verified
    FROM referral_invites i JOIN users u ON u.id=i.invitee_id
    WHERE i.referrer_id=$1 ORDER BY i.created_at DESC,i.id DESC LIMIT $2 OFFSET $3`,
    [userId, pageSize, (page - 1) * pageSize])).rows;
  const invited = await db.transaction(async trx => Promise.all(invitations.map(async (i: any) => ({
    id: i.id, username: i.username, createdAt: iso(i.created_at),
    kycVerified: i.kyc_status === "verified" && !!i.is_verified,
    completedTransactions: i.qualified_at ? 3 : Math.min(3, (await qualifyingTransactions(trx, i.invitee_id, i.created_at)).length),
    qualifiedAt: iso(i.qualified_at),
  }))));
  const now = new Date();
  return {
    code: account.code, serverNow: now.toISOString(), invited, rules: REFERRAL_RULES,
    pagination: { page, pageSize, total, totalPages },
    promo: referralPromoActive(fresh.starts_at, fresh.expires_at, fresh.cancelled_at, now.getTime())
      ? { startsAt: iso(fresh.starts_at), expiresAt: iso(fresh.expires_at),
        remainingSeconds: Math.ceil((new Date(fresh.expires_at).getTime() - now.getTime()) / 1000) } : null,
  };
}

export async function adminReferralOverview(search: string) {
  await ensureReferralSchema();
  const result = await pool.query(`SELECT u.id AS user_id,u.username,u.kyc_status,u.is_verified,
    a.code,a.starts_at,a.expires_at,a.cancelled_at,
    i.created_at AS invited_at,i.qualified_at,r.username AS referrer_username
    FROM users u LEFT JOIN referral_accounts a ON a.user_id=u.id
    LEFT JOIN referral_invites i ON i.invitee_id=u.id LEFT JOIN users r ON r.id=i.referrer_id
    WHERE (u.role='user' OR u.role IS NULL) AND (($1<>'' AND (LOWER(u.username) LIKE LOWER($2)
      OR LOWER(u.email) LIKE LOWER($2))) OR ($1='' AND a.user_id IS NOT NULL))
    ORDER BY a.expires_at DESC,u.created_at DESC LIMIT 100`,
  [search, `%${search.replace(/[\\%_]/g, "")}%`]);
  const accounts = await db.transaction(async trx => Promise.all(result.rows.map(async (row: any) => {
    const qualifying = row.invited_at ? await qualifyingTransactions(trx, row.user_id, row.invited_at) : [];
    return {
    userId: row.user_id, username: row.username,
    kycVerified: row.kyc_status === "verified" && !!row.is_verified, code: row.code || "",
    startsAt: iso(row.starts_at), expiresAt: iso(row.expires_at), cancelledAt: iso(row.cancelled_at),
    referrerUsername: row.referrer_username, qualifiedAt: iso(row.qualified_at),
    completedTransactions: row.qualified_at ? 3 : Math.min(3, qualifying.length),
    qualifyingTransactions: qualifying.slice(0, 3).map(tx => ({
      id: tx.id, reference: tx.reference, type: tx.type, confirmedAt: iso(tx.confirmed_at), available: !!tx.current_id,
    })),
  }; })));
  return { accounts, serverNow: new Date().toISOString() };
}

export async function adminReferralAction(userId: string, adminId: string, action: "activate" | "cancel", reason: string) {
  await ensureReferralAccount(userId);
  await db.transaction(async trx => {
    const account = rows(await trx.execute(sql`SELECT a.*,u.kyc_status,u.is_verified,u.is_banned,u.role
      FROM referral_accounts a JOIN users u ON u.id=a.user_id WHERE a.user_id=${userId} FOR UPDATE`))[0];
    if (!account || !isClientRole(account.role)) throw new Error("Compte client introuvable");
    const now = new Date();
    if (action === "activate") {
      if (account.kyc_status !== "verified" || !account.is_verified || account.is_banned) {
        throw new Error("Un compte non suspendu avec KYC vérifié est requis");
      }
      await activate(trx, account, now);
    } else {
      await trx.execute(sql`UPDATE referral_accounts SET cancelled_at=${now} WHERE user_id=${userId}`);
    }
    await trx.execute(sql`INSERT INTO admin_logs
      (id,admin_id,action,target_type,target_id,details,created_at)
      VALUES (${randomUUID()},${adminId},${`referral_${action}`},'user',${userId},
      ${JSON.stringify({ reason, previousStartsAt: iso(account.starts_at), previousExpiresAt: iso(account.expires_at) })},${now})`);
  });
  void flushReferralPush().catch(error => console.error("[Referral] Push scheduling failed:", error.message));
}

export async function releaseReferralQuote(reference: string) {
  // Validation/OTP/provider-configuration failures must not consume the cap.
  // Never free a reservation after a real transaction has been persisted.
  await pool.query(`DELETE FROM referral_usage WHERE reference=$1
    AND NOT EXISTS (SELECT 1 FROM transactions WHERE reference=$1)`, [reference]);
}

export async function quoteReferralFee(input: {
  userId: string; amount: number; currency: string; providerPercent: number | null;
  normalFee: number; maxOperation: number; reference?: string;
}) {
  if (input.providerPercent === null || !Number.isFinite(input.maxOperation) || input.maxOperation <= 0) return null;
  const discounted = referralFee(input.amount, input.providerPercent, input.normalFee);
  if (!discounted || input.amount > input.maxOperation) return null;
  await ensureReferralSchema();
  await reconcileReferral(input.userId);
  return db.transaction(async trx => {
    const account = rows(await trx.execute(sql`SELECT a.*,u.is_banned,u.role
      FROM referral_accounts a JOIN users u ON u.id=a.user_id
      WHERE a.user_id=${input.userId} FOR UPDATE`))[0];
    if (!account || account.is_banned || !isClientRole(account.role)
      || !referralPromoActive(account.starts_at, account.expires_at, account.cancelled_at)) return null;
    // Pending reservations count too; failed operations release capacity.
    // Unattached reservations expire so an interrupted initiation cannot lock a promotion forever.
    const usage = rows(await trx.execute(sql`SELECT ru.amount,ru.currency FROM referral_usage ru
      LEFT JOIN transactions t ON t.reference=ru.reference
      WHERE ru.user_id=${input.userId} AND ru.starts_at=${account.starts_at}
      AND ((t.id IS NOT NULL AND t.status NOT IN ('failed','cancelled','sandbox_test'))
        OR (t.id IS NULL AND ru.created_at>${new Date(Date.now() - 1800000)}))`));
    const volume = usage.filter(u => u.currency === input.currency).reduce((sum, u) => sum + Number(u.amount), 0);
    if (usage.length >= REFERRAL_RULES.maxDiscountedOperations
      || volume + input.amount > input.maxOperation * REFERRAL_RULES.maxVolumeMultiplier) return null;
    if (input.reference) {
      await trx.execute(sql`INSERT INTO referral_usage (reference,user_id,starts_at,created_at,currency,amount)
        VALUES (${input.reference},${input.userId},${account.starts_at},${new Date()},${input.currency},${input.amount})`);
    }
    return { ...discounted, startsAt: iso(account.starts_at), expiresAt: iso(account.expires_at) };
  });
}

let flushing = false;
async function flushReferralPush() {
  if (flushing) return;
  flushing = true;
  try {
    const events = (await pool.query(`SELECT * FROM referral_events
      WHERE push_claimed_at IS NULL AND expires_at>$1 LIMIT 100`, [new Date()])).rows;
    for (const event of events) {
      const claim = await pool.query(`UPDATE referral_events SET push_claimed_at=$1
        WHERE id=$2 AND push_claimed_at IS NULL`, [new Date(), event.id]);
      if (claim.rowCount) {
        await sendPushNotification(event.user_id, {
          title: "Votre tarif de parrainage est actif", body: promoMessage,
          type: "referral_promo_activated", url: "/dashboard/referrals",
        }).catch(error => console.error("[Referral] Push delivery failed:", error.message));
      }
    }
  } finally { flushing = false; }
}

let reconciling = false;
export function startReferralReconciliation() {
  let cursor = "";
  const run = async () => {
    if (reconciling) return;
    reconciling = true;
    try {
      const pending = (await pool.query(`SELECT i.id,i.invitee_id FROM referral_invites i
        JOIN users u ON u.id=i.invitee_id WHERE i.qualified_at IS NULL
        AND u.is_banned=$1 AND i.id>$2 AND
        ((SELECT COUNT(*) FROM referral_qualifying_transactions q WHERE q.invitee_id=i.invitee_id)>0 OR
        (SELECT COUNT(*) FROM transactions t WHERE t.user_id=i.invitee_id
          AND t.status='completed' AND t.type IN ('deposit','withdrawal')
          AND t.payment_method='mobile_money' AND t.created_at>=i.created_at
          AND t.payment_link_id IS NULL AND t.payment_intent_id IS NULL
          AND (t.source IS NULL OR t.source='' OR t.source='dashboard'))>=1)
        ORDER BY i.id LIMIT 500`, [false, cursor])).rows;
      if (pending.length) {
        cursor = pending[pending.length - 1].id;
      }
      if (pending.length < 500) cursor = "";
      for (const row of pending) await reconcileReferral(row.invitee_id);
      await flushReferralPush();
    } catch (error: any) { console.error("[Referral] Reconciliation failed:", error.message); }
    finally { reconciling = false; }
  };
  const timer = setInterval(() => void run(), 60000);
  timer.unref();
  void run();
}
