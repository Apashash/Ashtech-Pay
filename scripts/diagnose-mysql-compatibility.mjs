#!/usr/bin/env node

/**
 * Read-only MySQL/Plesk compatibility diagnostic.
 *
 * Usage from the application root:
 *   node scripts/diagnose-mysql-compatibility.mjs
 *
 * The script never mutates the database. It only runs SELECT and SHOW
 * statements, and deliberately does not print the connection URL.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import mysql from "mysql2/promise";

const root = process.cwd();

function loadDotEnv() {
  const envPath = path.join(root, ".env");
  if (!fs.existsSync(envPath)) return;
  for (const rawLine of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
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
}

loadDotEnv();

const databaseUrl =
  process.env.MYSQL_DATABASE_URL ||
  process.env.MYSQL_PLESK_DATABASE_URL ||
  process.env.MYSQL_URL;

if (!databaseUrl) {
  console.error(
    "Aucune URL MySQL trouvée. Définissez MYSQL_DATABASE_URL dans l'environnement Plesk.",
  );
  process.exit(2);
}

const tables = [
  "users",
  "wallets",
  "transactions",
  "payment_links",
  "countries",
  "operators",
];

function printSection(title) {
  console.log(`\n${"=".repeat(78)}\n${title}\n${"=".repeat(78)}`);
}

function printRows(rows) {
  if (!rows.length) {
    console.log("(aucun résultat)");
    return;
  }
  console.log(JSON.stringify(rows, null, 2));
}

function describeError(error) {
  return [
    error?.code ? `code=${error.code}` : "",
    error?.errno !== undefined ? `errno=${error.errno}` : "",
    error?.sqlState ? `sqlState=${error.sqlState}` : "",
    error?.message ? `message=${error.message}` : String(error),
  ]
    .filter(Boolean)
    .join(" ");
}

async function runProbe(connection, label, query) {
  try {
    const [rows] = await connection.query(query);
    console.log(`\n[PASS] ${label}`);
    if (Array.isArray(rows)) printRows(rows);
    else console.log(JSON.stringify(rows, null, 2));
  } catch (error) {
    console.log(`\n[FAIL] ${label}`);
    console.log(describeError(error));
  }
}

let connection;
try {
  connection = await mysql.createConnection({
    uri: databaseUrl,
    connectTimeout: 5000,
    enableKeepAlive: true,
  });

  printSection("CONNEXION");
  await runProbe(
    connection,
    "Connexion et version MySQL",
    "SELECT DATABASE() AS database_name, VERSION() AS mysql_version",
  );

  printSection("TABLES PRÉSENTES");
  await runProbe(
    connection,
    "Tables principales",
    `SELECT TABLE_NAME, ENGINE, TABLE_COLLATION
       FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME IN (${tables.map((table) => `'${table}'`).join(", ")})
      ORDER BY TABLE_NAME`,
  );

  for (const table of tables) {
    printSection(`STRUCTURE : ${table}`);
    await runProbe(connection, `SHOW CREATE TABLE ${table}`, `SHOW CREATE TABLE \`${table}\``);
    await runProbe(
      connection,
      `Colonnes : ${table}`,
      `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA
         FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = '${table}'
        ORDER BY ORDINAL_POSITION`,
    );
    await runProbe(
      connection,
      `Index et contraintes : ${table}`,
      `SELECT INDEX_NAME, NON_UNIQUE, SEQ_IN_INDEX, COLUMN_NAME, NON_UNIQUE
         FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = '${table}'
        ORDER BY INDEX_NAME, SEQ_IN_INDEX`,
    );
  }

  printSection("REQUÊTES REPRÉSENTATIVES DES ERREURS");
  await runProbe(
    connection,
    "Statistiques utilisateurs",
    `SELECT COUNT(*) AS total_users,
            SUM(CASE WHEN is_banned = 1 THEN 1 ELSE 0 END) AS banned_users,
            SUM(CASE WHEN api_enabled = 1 THEN 1 ELSE 0 END) AS api_enabled_users
       FROM users`,
  );
  await runProbe(
    connection,
    "Statistiques transactions MySQL",
      `SELECT type, status, currency,
            COALESCE(SUM(CAST(amount AS DECIMAL(30, 10))), 0) AS total_amount,
            COALESCE(SUM(CAST(fee_amount AS DECIMAL(30, 10))), 0) AS total_fee,
            COUNT(*) AS transaction_count
       FROM transactions
      GROUP BY type, status, currency
      LIMIT 100`,
  );
  await runProbe(
    connection,
    "Lecture wallets",
    "SELECT id, user_id, currency, balance FROM wallets ORDER BY created_at DESC LIMIT 5",
  );
  await runProbe(
    connection,
    "Lecture pays/opérateurs",
    `SELECT c.id AS country_id, c.code AS country_code,
            o.id AS operator_id, o.name AS operator_name,
            o.is_active, o.is_in_maintenance
       FROM countries c
       LEFT JOIN operators o ON o.country_id = c.id
      ORDER BY c.code, o.name
      LIMIT 100`,
  );
  await runProbe(
    connection,
    "Lecture payment links",
    "SELECT id, user_id, title, is_active, click_count FROM payment_links ORDER BY created_at DESC LIMIT 5",
  );

  printSection("FIN DU DIAGNOSTIC");
  console.log(
    "Diagnostic terminé. Les lignes [FAIL] et les structures absentes sont les éléments à corriger.",
  );
} catch (error) {
  console.error("\n[CONNEXION IMPOSSIBLE]");
  console.error(describeError(error));
  process.exitCode = 1;
} finally {
  await connection?.end().catch(() => {});
}