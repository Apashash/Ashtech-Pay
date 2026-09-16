#!/usr/bin/env node

/**
 * One-time, explicitly confirmed Supabase -> MySQL replacement.
 *
 * This is intentionally a command, not a server-start hook. A Plesk restart
 * must never be able to repeat a destructive data migration automatically.
 *
 * Required:
 *   SUPABASE_DATABASE_URL or SUPABASE_DB_URL
 *   MYSQL_PLESK_DATABASE_URL, MYSQL_DATABASE_URL, or MYSQL_URL
 *   MIGRATE_SUPABASE_TO_MYSQL=REPLACE_MYSQL_FROM_SUPABASE
 *
 * The target must have mysqldump available so the current MySQL database is
 * backed up before any table is dropped.
 */

import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import mysql from "mysql2/promise";

function loadDotEnv() {
  const envPath = path.resolve(".env");
  return readFile(envPath, "utf8")
    .then((contents) => {
      for (const rawLine of contents.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) continue;
        const separator = line.indexOf("=");
        if (separator < 1) continue;
        const key = line.slice(0, separator).trim();
        if (!key || process.env[key] !== undefined) continue;
        let value = line.slice(separator + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        process.env[key] = value;
      }
    })
    .catch(() => {});
}

const CONFIRMATION = "REPLACE_MYSQL_FROM_SUPABASE";
const TARGET_TABLES = [
  "admin_logs",
  "admin_pending_logins",
  "api_otp_sessions",
  "audit_logs",
  "auto_conversion_rules",
  "conversion_requests",
  "countries",
  "dismissed_global_messages",
  "fees",
  "global_messages",
  "hosted_page_configs",
  "hosted_payment_sessions",
  "kyc_submissions",
  "merchant_webhook_deliveries",
  "operators",
  "payment_intents",
  "payment_links",
  "platform_settings",
  "push_subscriptions",
  "session",
  "support_tickets",
  "ticket_messages",
  "transactions",
  "user_notifications",
  "users",
  "wallets",
  "withdrawal_number_changes",
  "withdrawal_numbers",
];

const quoteIdentifier = (value) => `\`${String(value).replaceAll("`", "``")}\``;

function getRequiredEnv(names, label) {
  for (const name of names) {
    if (process.env[name]) return { name, value: process.env[name] };
  }
  throw new Error(`${label} is missing. Set ${names.join(" or ")}.`);
}

function parseMysqlUrl(raw, envName) {
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`${envName} is not a valid MySQL URL.`);
  }

  if (!["mysql:", "mysql2:"].includes(parsed.protocol)) {
    throw new Error(`${envName} must use mysql://.`);
  }

  const database = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
  if (!database) throw new Error(`${envName} does not contain a database name.`);
  if (!parsed.hostname) throw new Error(`${envName} does not contain a MySQL host.`);

  return {
    raw,
    host: parsed.hostname.replace(/^\[|\]$/g, ""),
    port: parsed.port || "3306",
    user: decodeURIComponent(parsed.username || ""),
    password: decodeURIComponent(parsed.password || ""),
    database,
  };
}

function runProcess(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: options.env || process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderr = "";
    const output = options.outputPath ? createWriteStream(options.outputPath) : null;
    if (output) child.stdout.pipe(output);
    else child.stdout.pipe(process.stdout);
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      if (options.forwardStderr) process.stderr.write(chunk);
    });

    child.once("error", (error) => {
      output?.destroy();
      reject(error);
    });
    child.once("close", async (code) => {
      if (output) {
        await new Promise((done) => output.once("close", done));
      }
      if (code === 0) resolve();
      else reject(new Error(`${command} failed with exit code ${code}: ${stderr.trim()}`));
    });
  });
}

function safeErrorMessage(error) {
  const code = error?.code ? ` [${error.code}]` : "";
  const message = error instanceof Error ? error.message : String(error);
  return `${message
    .replace(/mysql(?:2)?:\/\/[^\s'"]+/gi, "mysql://[redacted]")
    .replace(/postgres(?:ql)?:\/\/[^\s'"]+/gi, "postgresql://[redacted]")}${code}`;
}

function dropSql() {
  return [
    "SET SESSION FOREIGN_KEY_CHECKS = 0;",
    ...TARGET_TABLES.map((table) => `DROP TABLE IF EXISTS ${quoteIdentifier(table)};`),
  ].join("\n");
}

async function main() {
  await loadDotEnv();
  if (process.env.MIGRATE_SUPABASE_TO_MYSQL !== CONFIRMATION) {
    throw new Error(
      `Migration is protected. Set MIGRATE_SUPABASE_TO_MYSQL=${CONFIRMATION} only for the one-time migration.`,
    );
  }

  const source = getRequiredEnv(
    ["SUPABASE_DB_URL", "SUPABASE_DATABASE_URL"],
    "Supabase source connection",
  );
  const targetEnv = getRequiredEnv(
    ["MYSQL_PLESK_DATABASE_URL", "MYSQL_DATABASE_URL", "MYSQL_URL"],
    "MySQL target connection",
  );
  const target = parseMysqlUrl(targetEnv.value, targetEnv.name);

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = path.resolve("backups");
  const backupPath = path.join(
    backupDir,
    `ashtechpay-before-supabase-migration-${timestamp}.sql`,
  );
  const workDir = await mkdtemp(path.join(os.tmpdir(), "ashtechpay-migration-"));
  const dumpPath = path.join(workDir, "supabase-to-mysql.sql");
  const reportPath = `${dumpPath}.report.json`;
  let connection;

  try {
    await mkdir(backupDir, { recursive: true });
    console.log("1/5 Creating the MySQL backup...");
    const backupEnv = {
      ...process.env,
      MYSQL_PWD: target.password,
    };
    await runProcess(
      "mysqldump",
      [
        "--protocol=TCP",
        "--host",
        target.host,
        "--port",
        target.port,
        "--user",
        target.user,
        "--single-transaction",
        "--skip-lock-tables",
        "--routines",
        "--triggers",
        "--events",
        "--hex-blob",
        "--no-tablespaces",
        target.database,
      ],
      { env: backupEnv, outputPath: backupPath },
    );
    console.log(`Backup created: ${backupPath}`);

    console.log("2/5 Exporting Supabase in read-only mode...");
    await runProcess(
      process.execPath,
      [
        path.resolve("scripts/export-supabase-to-mysql.mjs"),
        "--output",
        dumpPath,
      ],
      { env: { ...process.env, [source.name]: source.value }, forwardStderr: true },
    );

    const dumpSql = await readFile(dumpPath, "utf8");
    const report = JSON.parse(await readFile(reportPath, "utf8"));
    if (!Array.isArray(report.tables) || report.tables.length === 0) {
      throw new Error("The Supabase export contains no tables.");
    }

    console.log("3/5 Connecting to the MySQL target...");
    connection = await mysql.createConnection({
      uri: target.raw,
      multipleStatements: true,
      connectTimeout: 10000,
    });
    await connection.query("SELECT 1");

    console.log("4/5 Replacing the MySQL data...");
    await connection.query(dropSql());
    await connection.query(dumpSql);

    // The dump turns checks back on. Explicitly restore them if a SQL error
    // occurred after the drop phase so the connection is never left unsafe.
    await connection.query("SET SESSION FOREIGN_KEY_CHECKS = 1");

    console.log("5/5 Verifying row counts...");
    const mismatches = [];
    for (const item of report.tables) {
      const table = String(item.table);
      if (!TARGET_TABLES.includes(table)) continue;
      const [rows] = await connection.query(
        `SELECT COUNT(*) AS row_count FROM ${quoteIdentifier(table)}`,
      );
      const actual = Number(rows[0]?.row_count || 0);
      const expected = Number(item.rows || 0);
      if (actual !== expected) mismatches.push(`${table}: expected ${expected}, got ${actual}`);
    }
    if (mismatches.length) {
      throw new Error(`Row-count verification failed: ${mismatches.join("; ")}`);
    }

    console.log(
      `Migration completed: ${report.tables.length} tables, ${report.tables.reduce((sum, item) => sum + Number(item.rows || 0), 0)} rows.`,
    );
    console.log(`Keep the backup until the application has been validated: ${backupPath}`);
  } finally {
    if (connection) {
      await connection.query("SET SESSION FOREIGN_KEY_CHECKS = 1").catch(() => {});
      await connection.end().catch(() => {});
    }
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

try {
  await main();
} catch (error) {
  console.error(`Migration stopped safely: ${safeErrorMessage(error)}`);
  process.exitCode = 1;
}