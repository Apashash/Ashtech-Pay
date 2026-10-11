import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import crypto from "node:crypto";
import { syncBuiltinESMExports } from "node:module";

// Opt-in: uses only isolated, temporary fixtures in a DEVELOPMENT database.
// Example: REFERRAL_TEST_DB=1 DB_DIALECT=mysql MYSQL_DATABASE_URL=... node --import tsx --test tests/referral-integration.test.ts
test("referral qualification, concurrency, fees, caps and admin cancellation", {
  skip: process.env.REFERRAL_TEST_DB !== "1",
}, async () => {
  if (process.env.NODE_ENV === "production") throw new Error("Development database required");
  const { pool, sessionPool } = await import("../server/db");
  const service = await import("../server/referrals");
  const ids = [0, 1, 2, 3].map(() => `REFTEST${randomUUID()}`);
  const [referrer, invitee, unrelated, admin] = ids;
  const now = new Date(Date.now() - 10000);
  const refs: string[] = [];
  try {
    await service.ensureReferralSchema();
    for (const [index, id] of ids.entries()) {
      await pool.query(`INSERT INTO users (id,username,email,password,full_name,role,kyc_status,is_verified,created_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [id, id, `${id}@example.invalid`, "not-a-login-hash", "Referral test fixture",
        index === 3 ? "admin" : "user", "not_submitted", false, now]);
    }
    // Legacy imported accounts with NULL role remain ordinary customers.
    if (process.env.DB_DIALECT === "mysql") {
      await pool.query("UPDATE users SET role=NULL WHERE id IN ($1,$2)", [referrer, invitee]);
    }
    const { storage } = await import("../server/storage");
    const signup = await storage.createUser({
      username: `ref${randomUUID().replaceAll("-", "").slice(0, 12)}`,
      email: `${randomUUID()}@example.invalid`, password: "not-a-login-hash", fullName: "Signup fixture",
    });
    ids.push(signup.id);
    assert.equal(signup.role, "user");
    await service.ensureReferralAccount(referrer);
    // Real database pagination: stable order for tied timestamps, complete
    // totals, a partial final page and safe clamping of stale page requests.
    for (let index = 0; index < 16; index++) {
      const id = `REFTEST${randomUUID()}`;
      ids.push(id);
      await pool.query(`INSERT INTO users (id,username,email,password,full_name,role,kyc_status,is_verified,created_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [id, id, `${id}@example.invalid`, "not-a-login-hash", "Pagination fixture", "user", "not_submitted", false, now]);
      await pool.query(`INSERT INTO referral_invites (id,referrer_id,invitee_id,created_at)
        VALUES ($1,$2,$3,$4)`, [randomUUID(), unrelated, id, now]);
    }
    const pageOne = await service.referralOverview(unrelated, 1);
    const pageTwo = await service.referralOverview(unrelated, 2);
    assert.deepEqual(pageOne.pagination, { page: 1, pageSize: 15, total: 16, totalPages: 2 });
    assert.equal(pageOne.invited.length, 15);
    assert.equal(pageTwo.invited.length, 1);
    assert.equal(new Set([...pageOne.invited, ...pageTwo.invited].map(person => person.id)).size, 16);
    assert.deepEqual((await service.referralOverview(unrelated, 1)).invited.map(person => person.id), pageOne.invited.map(person => person.id));
    assert.equal((await service.referralOverview(unrelated, 99)).pagination.page, 2);
    assert.equal((await service.referralOverview(unrelated, -1)).pagination.page, 1);
    assert.deepEqual((await service.referralOverview(admin)).pagination, { page: 1, pageSize: 15, total: 0, totalPages: 1 });
    const legacyCode = randomUUID().replaceAll("-", "").slice(0, 20);
    const oldStart = new Date("2020-01-01T00:00:00.000Z");
    const oldExpiry = new Date("2020-01-06T00:00:00.000Z");
    await pool.query("UPDATE referral_accounts SET code=$1,starts_at=$2,expires_at=$3 WHERE user_id=$4",
      [legacyCode, oldStart, oldExpiry, referrer]);
    assert.equal(await service.resolveReferralCode(legacyCode), referrer);
    const migrated = await Promise.all(Array.from({ length: 12 }, () => service.ensureReferralAccount(referrer)));
    const account = migrated[0];
    assert.match(account.code, /^[a-z0-9]{6}$/);
    assert.equal(new Set(migrated.map(row => row.code)).size, 1);
    assert.equal(account.legacy_code, legacyCode);
    assert.equal(new Date(account.starts_at).toISOString(), oldStart.toISOString());
    assert.equal(new Date(account.expires_at).toISOString(), oldExpiry.toISOString());
    assert.equal(await service.resolveReferralCode(account.code), referrer);
    assert.equal(await service.resolveReferralCode(` ${account.code.toUpperCase()} `), referrer);
    assert.equal(await service.resolveReferralCode(legacyCode), referrer);
    await assert.rejects(service.resolveReferralCode("abcdefg"));
    await assert.rejects(service.resolveReferralCode("' OR 1=1 --"));
    // Force a short-code collision inside the atomic signup transaction. The
    // retry must work on PostgreSQL without aborting that transaction.
    const originalRandomInt = crypto.randomInt;
    let forcedCollision = false;
    const rng = mock.method(crypto, "randomInt", ((max: number) => {
      if (max === 36 ** 6 && !forcedCollision) {
        forcedCollision = true;
        return parseInt(account.code, 36);
      }
      return originalRandomInt(max);
    }) as typeof crypto.randomInt);
    syncBuiltinESMExports();
    try {
      const referredSignup = await storage.createUser({
        username: `ref${randomUUID().replaceAll("-", "").slice(0, 12)}`,
        email: `${randomUUID()}@example.invalid`, password: "not-a-login-hash", fullName: "Short code fixture",
      }, unrelated);
      ids.push(referredSignup.id);
      const newAccount = await service.ensureReferralAccount(referredSignup.id);
      assert.equal(forcedCollision, true);
      assert.match(newAccount.code, /^[a-z0-9]{6}$/);
      assert.notEqual(newAccount.code, account.code);
      assert.equal(await service.resolveReferralCode(newAccount.code), referredSignup.id);
    } finally {
      rng.mock.restore();
      syncBuiltinESMExports();
    }
    await assert.rejects(service.attachReferral(referrer, referrer));
    await service.attachReferral(invitee, referrer);
    await assert.rejects(service.attachReferral(invitee, unrelated));
    async function transaction(type: string, status = "completed", source: string | null = null) {
      const id = randomUUID();
      const reference = `REFTEST-${id}`;
      refs.push(reference);
      await pool.query(`INSERT INTO transactions
        (id,user_id,type,amount,status,payment_method,reference,source,created_at,confirmed_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [id, invitee, type, "1000", status, "mobile_money", reference, source, new Date(), new Date()]);
    }
    await transaction("deposit");
    await transaction("withdrawal");
    await transaction("deposit", "completed", "sandbox");
    await transaction("deposit", "completed", "api");
    await transaction("transfer_out");
    await transaction("deposit", "failed");
    await service.reconcileReferral(invitee);
    assert.equal((await service.referralOverview(invitee)).promo, null);
    assert.equal((await service.referralOverview(referrer)).invited[0].completedTransactions, 2);
    await pool.query("UPDATE transactions SET status='failed' WHERE reference=$1", [refs[0]]);
    await service.reconcileReferral(invitee);
    assert.equal((await service.referralOverview(referrer)).invited[0].completedTransactions, 1);
    await pool.query("UPDATE transactions SET status='completed' WHERE reference=$1", [refs[0]]);
    await service.reconcileReferral(invitee);
    // Simulate the normal history retention before KYC is eventually approved.
    await pool.query("DELETE FROM transactions WHERE user_id=$1 AND reference IN ($2,$3)", [invitee, refs[0], refs[1]]);
    await pool.query("UPDATE users SET kyc_status='verified',is_verified=$1 WHERE id=$2", [true, invitee]);
    await service.reconcileReferral(invitee);
    assert.equal((await service.referralOverview(invitee)).promo, null);
    await transaction("deposit");
    await Promise.all(Array.from({ length: 8 }, () => service.reconcileReferral(invitee)));
    const [a, b, c] = await Promise.all(ids.slice(0, 3).map(id => service.referralOverview(id)));
    assert.ok(a.promo && b.promo);
    assert.equal(c.promo, null);
    assert.equal(a.promo.startsAt, b.promo.startsAt);
    assert.equal(new Date(a.promo.expiresAt!).getTime() - new Date(a.promo.startsAt!).getTime(), 120 * 3600000);
    assert.equal(a.invited.length, 1);
    assert.equal(a.invited[0].completedTransactions, 3);
    const notifications = await pool.query("SELECT COUNT(*) AS n FROM user_notifications WHERE user_id IN ($1,$2) AND type='referral_promo_activated'", [referrer, invitee]);
    assert.equal(Number(notifications.rows[0].n), 2);
    const base = { userId: invitee, amount: 1000, currency: "XAF", providerPercent: 1.5, normalFee: 50, maxOperation: 10000 };
    const quote = await service.quoteReferralFee(base);
    assert.equal(quote?.total, 18);
    assert.equal(quote?.margin, 3);
    const abandoned = `REFTEST-ABANDONED-${invitee}`;
    assert.ok(await service.quoteReferralFee({ ...base, reference: abandoned }));
    await service.releaseReferralQuote(abandoned);
    assert.equal(Number((await pool.query("SELECT COUNT(*) AS n FROM referral_usage WHERE reference=$1", [abandoned])).rows[0].n), 0);
    assert.equal(await service.quoteReferralFee({ ...base, providerPercent: null }), null);
    assert.equal(await service.quoteReferralFee({ ...base, amount: 10001 }), null);
    const reserved = await Promise.all(Array.from({ length: 22 }, (_, index) => service.quoteReferralFee({
      ...base, reference: `REFTEST-USAGE-${invitee}-${index}`,
    })));
    assert.equal(reserved.filter(Boolean).length, 20);
    await service.adminReferralAction(invitee, admin, "cancel", "Integration test cancellation");
    assert.equal(await service.quoteReferralFee(base), null);
    assert.equal((await service.referralOverview(invitee)).promo, null);
    await service.reconcileReferral(invitee);
    assert.equal((await service.referralOverview(invitee)).promo, null);
    await assert.rejects(service.adminReferralAction(unrelated, admin, "activate", "Unverified account"));
    const accounts = await service.adminReferralOverview(invitee);
    assert.equal(accounts.accounts.length, 1);
    assert.equal(accounts.accounts[0].qualifyingTransactions.length, 3);
    assert.equal(accounts.accounts[0].qualifyingTransactions.filter(tx => !tx.available).length, 2);
    assert.equal((await pool.query("SELECT balance FROM users WHERE id=$1", [invitee])).rows[0].balance, "0.00");
    await pool.query("UPDATE referral_accounts SET expires_at=$1 WHERE user_id=$2", [new Date(Date.now() - 1000), referrer]);
    assert.equal(await service.quoteReferralFee({ ...base, userId: referrer }), null);
  } finally {
    for (const id of ids) {
      await pool.query("DELETE FROM referral_qualifying_transactions WHERE invitee_id=$1", [id]);
      await pool.query("DELETE FROM referral_events WHERE user_id=$1", [id]);
      await pool.query("DELETE FROM referral_usage WHERE user_id=$1", [id]);
      await pool.query("DELETE FROM user_notifications WHERE user_id=$1", [id]);
      await pool.query("DELETE FROM admin_logs WHERE target_id=$1 OR admin_id=$1", [id]);
      await pool.query("DELETE FROM transactions WHERE user_id=$1", [id]);
      await pool.query("DELETE FROM referral_invites WHERE invitee_id=$1 OR referrer_id=$1", [id]);
      await pool.query("DELETE FROM referral_accounts WHERE user_id=$1", [id]);
    }
    for (const id of ids) await pool.query("DELETE FROM users WHERE id=$1", [id]);
    await pool.end();
    await sessionPool.end();
  }
});
