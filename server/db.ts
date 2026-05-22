import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

const databaseUrl = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL must be set.",
  );
}

// Replit's managed PostgreSQL does not require SSL
const sslConfig = databaseUrl.includes("localhost") || databaseUrl.includes("127.0.0.1")
  ? undefined
  : { rejectUnauthorized: false };

export const pool = new Pool({
  connectionString: databaseUrl,
  ssl: sslConfig,
});
export const db = drizzle(pool, { schema });

const sessionDatabaseUrl = process.env.DIRECT_DATABASE_URL || databaseUrl;
export const sessionPool = new Pool({
  connectionString: sessionDatabaseUrl,
  ssl: sslConfig,
  max: 5,
});
