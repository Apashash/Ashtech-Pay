import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import dns from "dns";
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
const PM2_INSTANCES = parseInt(process.env.PM2_INSTANCES || process.env.NODE_APP_INSTANCE || "1", 10) || 1;
const MAIN_POOL_MAX = Math.max(2, Math.floor(15 / PM2_INSTANCES));
const SESSION_POOL_MAX = Math.max(1, Math.floor(8 / PM2_INSTANCES));

console.log(`[DB] Pool limits — main: ${MAIN_POOL_MAX}, session: ${SESSION_POOL_MAX} (PM2 instances detected: ${PM2_INSTANCES})`);

// Append application_name to the connection string
function addAppName(url: string, name: string): string {
  try {
    const u = new URL(url);
    u.searchParams.set("application_name", name);
    return u.toString();
  } catch {
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}application_name=${name}`;
  }
}

// Replace hostname in URL with its IPv4 address to avoid IPv6 issues on Replit
async function resolveToIPv4(url: string): Promise<string> {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname;
    // Skip resolution for IP addresses or localhost
    if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname) || hostname === "localhost") {
      return url;
    }
    const addresses = await new Promise<string[]>((resolve, reject) => {
      dns.resolve4(hostname, (err, addrs) => {
        if (err) reject(err);
        else resolve(addrs);
      });
    });
    if (addresses.length > 0) {
      parsed.hostname = addresses[0];
      console.log(`[DB] Resolved ${hostname} → ${addresses[0]} (IPv4 forced)`);
      return parsed.toString();
    }
  } catch (err: any) {
    console.warn(`[DB] IPv4 resolution failed for host, using original URL: ${err.message}`);
  }
  return url;
}

const APP_DB_NAME = "ashtech_secure_app";

// Build pools after resolving hostname to IPv4
async function buildPools() {
  const resolvedUrl = await resolveToIPv4(databaseUrl!);
  const mainUrl = addAppName(resolvedUrl, APP_DB_NAME);

  const mainPool = new Pool({
    connectionString: mainUrl,
    ssl: sslConfig,
    max: MAIN_POOL_MAX,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 8000,
  });

  mainPool.on("error", (err) => {
    console.error("[DB] Pool error (main):", err.message);
  });

  const sessionDatabaseUrl = process.env.DIRECT_DATABASE_URL || resolvedUrl;
  const sessPool = new Pool({
    connectionString: sessionDatabaseUrl,
    ssl: sslConfig,
    max: SESSION_POOL_MAX,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 8000,
  });

  sessPool.on("error", (err) => {
    console.error("[DB] Pool error (session):", err.message);
  });

  // Test connection at startup
  mainPool.query("SELECT 1").then(() => {
    console.log("[DB] Main pool connection OK");
  }).catch((err) => {
    console.error("[DB] CRITICAL: Main pool connection FAILED:", err.message);
  });

  return { mainPool, sessPool };
}

// We export lazily-initialized pools. The pools are ready before any route
// handler runs because the server awaits the top-level async IIFE in index.ts.
let _pool: pg.Pool;
let _sessionPool: pg.Pool;
let _db: ReturnType<typeof drizzle<typeof schema>>;

export const poolReady = buildPools().then(({ mainPool, sessPool }) => {
  _pool = mainPool;
  _sessionPool = sessPool;
  _db = drizzle(mainPool, { schema });
});

export const pool: pg.Pool = new Proxy({} as pg.Pool, {
  get(_target, prop) {
    return (_pool as any)[prop];
  },
});

export const sessionPool: pg.Pool = new Proxy({} as pg.Pool, {
  get(_target, prop) {
    return (_sessionPool as any)[prop];
  },
});

export const db: ReturnType<typeof drizzle<typeof schema>> = new Proxy({} as any, {
  get(_target, prop) {
    return (_db as any)[prop];
  },
});
