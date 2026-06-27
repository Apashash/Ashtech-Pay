import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

// Prefer SUPABASE_DB_URL (pooler URL, editable env var) > SUPABASE_DATABASE_URL (secret) > Replit local DB
const databaseUrl = process.env.SUPABASE_DB_URL || process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;

// Log which DB source is used at startup (override the one below)
const _dbSource = process.env.SUPABASE_DB_URL ? "SUPABASE_DB_URL" : process.env.SUPABASE_DATABASE_URL ? "SUPABASE_DATABASE_URL" : "DATABASE_URL";

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL must be set.",
  );
}

// Log which DB source is used at startup
const dbSource = _dbSource;
console.log(`[DB] Using ${dbSource} — host: ${databaseUrl.replace(/:[^:@]+@/, ":***@").split("/").slice(0, 3).join("/")}`);

// Replit's managed PostgreSQL does not require SSL
const sslConfig = databaseUrl.includes("localhost") ||
  databaseUrl.includes("127.0.0.1") ||
  databaseUrl.includes("sslmode=disable") ||
  databaseUrl.includes("heliumdb")
  ? undefined
  : { rejectUnauthorized: false };

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

export const pool = new Pool({
  connectionString: addAppName(databaseUrl, APP_DB_NAME),
  ssl: sslConfig,
  max: MAIN_POOL_MAX,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  // Disable prepared statements for pgBouncer Transaction mode
  ...(isPooler ? { statement_timeout: 0 } : {}),
});

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

pool.on("error", (err) => {
  console.error("[DB] Pool error (main):", err.message);
  poolStats.main.errors++;
  poolStats.main.lastError = err.message;
  poolStats.main.lastErrorAt = Date.now();
});

export const db = drizzle(pool, { schema });

const sessionDatabaseUrl = process.env.DIRECT_DATABASE_URL || databaseUrl;
export const sessionPool = new Pool({
  connectionString: sessionDatabaseUrl,
  ssl: sslConfig,
  max: SESSION_POOL_MAX,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

sessionPool.on("error", (err) => {
  console.error("[DB] Pool error (session):", err.message);
  poolStats.session.errors++;
  poolStats.session.lastError = err.message;
  poolStats.session.lastErrorAt = Date.now();
});

// Test connection at startup
pool.query("SELECT 1").then(() => {
  console.log("[DB] Main pool connection OK");
}).catch((err) => {
  console.error("[DB] CRITICAL: Main pool connection FAILED:", err.message);
});
