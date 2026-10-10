import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { and, eq, sql } from "drizzle-orm";
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { PgDialect } from "drizzle-orm/pg-core";
import { mysqlTable, varchar, decimal, datetime } from "drizzle-orm/mysql-core";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { randomUUID } from "node:crypto";

// Exercise the actual storage method without initializing unrelated services.
const source = readFileSync("server/storage.ts", "utf8");
const method = source.slice(
  source.indexOf("  async upsertWallet("),
  source.indexOf("  async setWalletBalance("),
);
const compiled = ts.transpile(`({${method}})`, { target: ts.ScriptTarget.ES2022 });
function storageFor(db: any, wallets: any, isMysqlDialect: boolean, pool?: any) {
  return new Function("db", "wallets", "isMysqlDialect", "pool", "sql", "and", "eq", "randomUUID",
    `return ${compiled}`)(db, wallets, isMysqlDialect, pool, sql, and, eq, randomUUID);
}

test("PostgreSQL debit uses one guarded UPDATE and fails closed", async () => {
  const wallets = pgTable("wallets", {
    userId: text("user_id"), currency: text("currency"),
    balance: text("balance"), updatedAt: timestamp("updated_at"),
  });
  let rows: any[] = [];
  let calls = 0;
  const db = {
    update: () => ({ set: (values: any) => ({ where: (condition: any) => {
      calls++;
      const dialect = new PgDialect();
      const query = dialect.sqlToQuery(condition);
      assert.match(query.sql, /"balance"::numeric >= .*::numeric/);
      assert.deepEqual(query.params, ["user", "XOFC", "100.00"]);
      assert.match(dialect.sqlToQuery(values.balance).sql, /::numeric - .*::numeric/);
      return { returning: async () => rows };
    } }) }),
  };
  const storage = storageFor(db, wallets, false);
  await assert.rejects(storage.upsertWallet("user", "XOFC", -100), /Solde insuffisant/);
  rows = [{ balance: "0.00" }];
  assert.deepEqual(await storage.upsertWallet("user", "XOFC", -100), rows[0]);
  assert.equal(calls, 2);
  for (const value of [NaN, Infinity, -Infinity, -0.001]) {
    await assert.rejects(storage.upsertWallet("user", "XOFC", value), /Montant invalide/);
  }
  assert.equal(calls, 2);
});

test("MySQL rejects unknown mutation results rather than confirming a debit", async () => {
  const wallets = pgTable("wallets", {
    userId: text("user_id"), currency: text("currency"), balance: text("balance"),
  });
  const db = { update: () => ({ set: () => ({ where: async () => [{}] }) }) };
  await assert.rejects(storageFor(db, wallets, true).upsertWallet("user", "XOFC", -100),
    /WALLET_DEBIT_UNCONFIRMED/);
});

test("MySQL competing payout/conversion debits cannot spend the same funds", {
  skip: !process.env.WALLET_TEST_MYSQL_SOCKET,
}, async () => {
  const pool = mysql.createPool({
    socketPath: process.env.WALLET_TEST_MYSQL_SOCKET, user: "root", connectionLimit: 4,
  });
  const database = `wallet_test_${randomUUID().replaceAll("-", "")}`;
  try {
    await pool.query(`CREATE DATABASE \`${database}\``);
    // Fully qualified isolated table: never touches application balances.
    await pool.query(`CREATE TABLE \`${database}\`.wallets (
      user_id varchar(64), currency varchar(16), balance decimal(30,10),
      updated_at datetime, PRIMARY KEY(user_id, currency)) ENGINE=InnoDB`);
    const testPool = mysql.createPool({
      socketPath: process.env.WALLET_TEST_MYSQL_SOCKET, user: "root",
      database, connectionLimit: 4,
    });
    try {
      const wallets = mysqlTable("wallets", {
        userId: varchar("user_id", { length: 64 }),
        currency: varchar("currency", { length: 16 }),
        balance: decimal("balance", { precision: 30, scale: 10 }),
        updatedAt: datetime("updated_at"),
      });
      const db = drizzle(testPool);
      const storage = storageFor(db, wallets, true, testPool);
      storage.getWallet = async (userId: string, currency: string) =>
        (await db.select().from(wallets).where(and(
          eq(wallets.userId, userId), eq(wallets.currency, currency),
        )))[0];
      await assert.rejects(storage.upsertWallet("missing", "XOFC", -100), /Solde insuffisant/);
      await db.insert(wallets).values({ userId: "user", currency: "XOFC", balance: "100" });
      // Same conditional SQL as createConversionAndDebit, in a transaction.
      const conversion = () => db.transaction(async (trx) => {
        const [result] = await trx.update(wallets)
          .set({ balance: sql`CAST(${wallets.balance} AS DECIMAL(30,10)) - 100` })
          .where(and(eq(wallets.userId, "user"), eq(wallets.currency, "XOFC"),
            sql`CAST(${wallets.balance} AS DECIMAL(30,10)) >= 100`));
        if (!result.affectedRows) throw new Error("INSUFFICIENT_WALLET_BALANCE");
      });
      for (let i = 0; i < 20; i++) {
        await db.update(wallets).set({ balance: "100" });
        const results = await Promise.allSettled(i % 2
          ? [conversion(), storage.upsertWallet("user", "XOFC", -100)]
          : [storage.upsertWallet("user", "XOFC", -100), conversion()]);
        assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
        const failure = results.find(r => r.status === "rejected") as PromiseRejectedResult;
        assert.match(failure.reason.message, /Solde insuffisant|INSUFFICIENT_WALLET_BALANCE/);
        assert.equal(Number((await storage.getWallet("user", "XOFC")).balance), 0);
      }
      // Reproduce the exact stale-precheck attack ordering deterministically.
      await db.update(wallets).set({ balance: "100" });
      assert.equal(Number((await storage.getWallet("user", "XOFC")).balance), 100);
      await conversion();
      await assert.rejects(storage.upsertWallet("user", "XOFC", -100), /Solde insuffisant/);
      await db.update(wallets).set({ balance: "100" });
      await storage.upsertWallet("user", "XOFC", -100);
      await assert.rejects(conversion(), /INSUFFICIENT_WALLET_BALANCE/);
    } finally {
      await testPool.end();
    }
  } finally {
    await pool.query(`DROP DATABASE IF EXISTS \`${database}\``);
    await pool.end();
  }
});
