import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { drizzle as drizzleMysql } from "drizzle-orm/mysql2";
import pg from "pg";
import mysql from "mysql2/promise";
import * as pgSchema from "@shared/schema";
import * as mysqlSchema from "@shared/schema.mysql";

const { Pool } = pg;

const useMysql = process.env.DB_DIALECT?.toLowerCase() === "mysql";
// MySQL is opt-in and never falls back to a PostgreSQL URL. This prevents a
// mistyped migration setting from sending a MySQL client to Supabase.
const databaseUrl = useMysql
  ? process.env.MYSQL_DATABASE_URL || process.env.MYSQL_URL
  : process.env.SUPABASE_DB_URL || process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;

// Log which DB source is used at startup (override the one below)
const _dbSource = useMysql
  ? (process.env.MYSQL_DATABASE_URL ? "MYSQL_DATABASE_URL" : process.env.MYSQL_URL ? "MYSQL_URL" : "missing")
  : process.env.SUPABASE_DB_URL ? "SUPABASE_DB_URL" : process.env.SUPABASE_DATABASE_URL ? "SUPABASE_DATABASE_URL" : "DATABASE_URL";

if (!databaseUrl) {
  throw new Error(
    useMysql ? "MYSQL_DATABASE_URL or MYSQL_URL must be set when DB_DIALECT=mysql." : "DATABASE_URL must be set.",
  );
}

// Log only the configured source — never expose the database host, username,
// or connection-string metadata in workflow logs.
const dbSource = _dbSource;
console.log(`[DB] Using ${dbSource}`);

// Replit's managed PostgreSQL does not require SSL.
// Supabase Transaction pooler uses a self-signed certificate chain — we must
// set rejectUnauthorized:false for pooler.supabase.com connections.
const isLocalDb = databaseUrl.includes("localhost") ||
  databaseUrl.includes("127.0.0.1") ||
  databaseUrl.includes("sslmode=disable") ||
  databaseUrl.includes("heliumdb");
const sslConfig = isLocalDb
  ? undefined
  : { rejectUnauthorized: !databaseUrl.includes("pooler.supabase.com") };

// Max connections per pool, per worker process.
// Supabase free tier: 25 total connections (hard cap).
// Budget per single worker: 8 main + 4 session + 1 SIEM LISTEN = 13 total.
// This leaves 12 connections free for migrations, admin queries and burst.
// With PM2_instances=2: 2 × (5+3) + 2 SIEM = 18 — safe.
// Formula: floor(8 / PM2_workers) main, floor(4 / PM2_workers) session.
//
// NOTE: NODE_APP_INSTANCE is the *index* of the current worker (0, 1, 2...) — NOT the total
// count. Never use it for pool sizing. Use PM2_INSTANCES (set explicitly in ecosystem config).
const PM2_INSTANCES = Math.max(1, parseInt(process.env.PM2_INSTANCES || "1", 10) || 1);
const MAIN_POOL_MAX = Math.max(2, Math.floor(8 / PM2_INSTANCES));
const SESSION_POOL_MAX = Math.max(1, Math.floor(4 / PM2_INSTANCES));
// Keep cold-start probes short so a missing/restarting MySQL server does not
// make Node appear frozen. The retry loop in server/index.ts still keeps
// trying until the database becomes reachable.
const MYSQL_CONNECT_TIMEOUT_MS = Math.max(
  500,
  Math.min(5000, Number(process.env.MYSQL_CONNECT_TIMEOUT_MS || 2000) || 2000),
);

console.log(`[DB] Pool limits — main: ${MAIN_POOL_MAX}, session: ${SESSION_POOL_MAX} (PM2 instances detected: ${PM2_INSTANCES})`);

// Append application_name to the connection string so PostgreSQL triggers
// can distinguish app connections from direct/external DB access.
function addAppName(url: string, name: string): string {
  try {
    const u = new URL(url);
    u.searchParams.set("application_name", name);
    return u.toString();
  } catch {
    // Fallback: append via query string manually
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}application_name=${name}`;
  }
}

const APP_DB_NAME = "ashtech_secure_app";

// Supabase Transaction mode pooler (port 6543) requires simple query protocol
// — no prepared statements. We detect pooler by hostname and set allowExitOnIdle.
const isPooler = (databaseUrl || "").includes("pooler.supabase.com");

type CompatibleQueryResult = { rows: any[]; rowCount: number; fields?: any[] };
type CompatiblePool = {
  query: (...args: any[]) => Promise<CompatibleQueryResult>;
  totalCount: number;
  idleCount: number;
  waitingCount: number;
  on: (event: string, listener: (err: any) => void) => void;
  end?: () => Promise<void>;
};

function normalizeMysqlQuery(query: string, values: any[] = []): { text: string; values: any[] } {
  const ordered: any[] = [];
  const text = query.replace(/\$(\d+)/g, (_match, index: string) => {
    ordered.push(values[Number(index) - 1]);
    return "?";
  });
  return { text, values: ordered.length ? ordered : values };
}

function createMysqlCompatiblePool(url: string, connectionLimit: number): CompatiblePool {
  const rawPool = mysql.createPool({
    uri: url,
    connectionLimit,
    connectTimeout: MYSQL_CONNECT_TIMEOUT_MS,
    waitForConnections: true,
    queueLimit: 0,
    enableKeepAlive: true,
  });
  const wrapper: CompatiblePool = {
    async query(queryOrConfig: any, values?: any[]): Promise<CompatibleQueryResult> {
      const query = typeof queryOrConfig === "string" ? queryOrConfig : queryOrConfig.text;
      const params = values ?? (typeof queryOrConfig === "string" ? [] : queryOrConfig.values ?? []);
      const normalized = normalizeMysqlQuery(query, params);
      const [rows, fields] = await rawPool.query(normalized.text, normalized.values);
      const isRowResult = Array.isArray(rows);
      const rowArray = isRowResult ? rows as any[] : [];
      // mysql2 returns a ResultSetHeader for INSERT/UPDATE/DELETE instead of
      // an array. Preserve affectedRows so callers that use rowCount for
      // atomic claims (including the admin OTP challenge) see the real result.
      const affectedRows = !isRowResult && typeof (rows as any)?.affectedRows === "number"
        ? Number((rows as any).affectedRows)
        : rowArray.length;
      return { rows: rowArray, rowCount: affectedRows, fields: fields as any[] };
    },
    get totalCount() { return connectionLimit; },
    get idleCount() { return connectionLimit; },
    get waitingCount() { return 0; },
    on() { /* mysql2 pool errors are surfaced by query() */ },
    async end() { await rawPool.end(); },
  };
  return wrapper;
}

const pgPool = useMysql ? null : new Pool({
  connectionString: addAppName(databaseUrl, APP_DB_NAME),
  ssl: sslConfig,
  max: MAIN_POOL_MAX,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  // Disable prepared statements for pgBouncer Transaction mode
  ...(isPooler ? { statement_timeout: 0 } : {}),
});
const mysqlPool = useMysql ? mysql.createPool({
  uri: databaseUrl,
  connectionLimit: MAIN_POOL_MAX,
  connectTimeout: MYSQL_CONNECT_TIMEOUT_MS,
  waitForConnections: true,
  queueLimit: 0,
  enableKeepAlive: true,
}) : null;

export const pool: any = useMysql
  ? createMysqlCompatiblePool(databaseUrl, MAIN_POOL_MAX)
  : pgPool;

// ── Error tracking per pool (for /api/admin/pool-status diagnostic) ─────────
export const poolStats = {
  main: {
    max: MAIN_POOL_MAX,
    pm2Instances: PM2_INSTANCES,
    errors: 0,
    lastError: null as string | null,
    lastErrorAt: null as number | null,
    fallbackUsed: 0,
  },
  session: {
    max: SESSION_POOL_MAX,
    pm2Instances: PM2_INSTANCES,
    errors: 0,
    lastError: null as string | null,
    lastErrorAt: null as number | null,
    fallbackToMain: 0,
  },
};

pool.on("error", (err: any) => {
  console.error("[DB] Pool error (main):", err.message);
  poolStats.main.errors++;
  poolStats.main.lastError = err.message;
  poolStats.main.lastErrorAt = Date.now();
});

export const db: ReturnType<typeof drizzlePg> = (useMysql
  ? drizzleMysql(mysqlPool as any, { schema: mysqlSchema, mode: "default" })
  : drizzlePg(pgPool as any, { schema: pgSchema })) as any;

const sessionDatabaseUrl = useMysql
  ? databaseUrl
  : process.env.DIRECT_DATABASE_URL || databaseUrl;
export const sessionPool: any = useMysql
  ? createMysqlCompatiblePool(sessionDatabaseUrl, SESSION_POOL_MAX)
  : new Pool({
      connectionString: sessionDatabaseUrl,
      ssl: sslConfig,
      max: SESSION_POOL_MAX,
      idleTimeoutMillis: 30000,
       connectionTimeoutMillis: MYSQL_CONNECT_TIMEOUT_MS,
    });

sessionPool.on("error", (err: any) => {
  console.error("[DB] Pool error (session):", err.message);
  poolStats.session.errors++;
  poolStats.session.lastError = err.message;
  poolStats.session.lastErrorAt = Date.now();
});

// Test connection at startup
pool.query("SELECT 1").then(() => {
  console.log("[DB] Main pool connection OK");
}).catch((err: any) => {
  console.error("[DB] CRITICAL: Main pool connection FAILED:", err.message);
});
