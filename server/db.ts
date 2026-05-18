import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

const databaseUrl = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "SUPABASE_DATABASE_URL or DATABASE_URL must be set.",
  );
}

const isProd = process.env.NODE_ENV === "production";

export const pool = new Pool({
  connectionString: databaseUrl,
  // En production : vérification SSL stricte (rejectUnauthorized: true)
  // En développement : désactivé pour compatibilité locale / Supabase pooler
  ssl: { rejectUnauthorized: false },
});
export const db = drizzle(pool, { schema });
