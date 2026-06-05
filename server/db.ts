import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

// Prefer SUPABASE_DATABASE_URL (production data) over Replit's local empty DB
const databaseUrl = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL must be set.",
  );
}

// Log which DB source is used at startup
const dbSource = process.env.SUPABASE_DATABASE_URL ? "SUPABASE_DATABASE_URL" : "DATABASE_URL";
console.log(`[DB] Using ${dbSource} — host: ${databaseUrl.replace(/:[^:@]+@/, ":***@").split("/").slice(0, 3).join("/")}`);

// Replit's managed PostgreSQL does not require SSL
const sslConfig = databaseUrl.includes("localhost") ||
  databaseUrl.includes("127.0.0.1") ||
  databaseUrl.includes("sslmode=disable") ||
  databaseUrl.includes("heliumdb")
  ? undefined
  : { rejectUnauthorized: false };

// Max connections per pool, per worker process.
// Supabase free tier: 25 total connections.
// Formula: floor(25 / PM2_workers / 2_pools) with margin.
// With PM2_instances=2: 2 × (4+2) = 12 — safe.
// With PM2_instances=4: 4 × (3+2) = 20 — safe.
// Default: 3 + 2 = 5 per worker; supports up to 4 PM2 workers safely.
const PM2_INSTANCES = parseInt(process.env.PM2_INSTANCES || process.env.NODE_APP_INSTANCE || "1", 10) || 1;
const MAIN_POOL_MAX = Math.max(2, Math.floor(15 / PM2_INSTANCES));
const SESSION_POOL_MAX = Math.max(1, Math.floor(8 / PM2_INSTANCES));

console.log(`[DB] Pool limits — main: ${MAIN_POOL_MAX}, session: ${SESSION_POOL_MAX} (PM2 instances detected: ${PM2_INSTANCES})`);

export const pool = new Pool({
  connectionString: databaseUrl,
  ssl: sslConfig,
  max: MAIN_POOL_MAX,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on("error", (err) => {
  console.error("[DB] Pool error (main):", err.message);
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
});

// Test connection at startup
pool.query("SELECT 1").then(() => {
  console.log("[DB] Main pool connection OK");
}).catch((err) => {
  console.error("[DB] CRITICAL: Main pool connection FAILED:", err.message);
});
