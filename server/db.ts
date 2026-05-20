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

export const pool = new Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
});
export const db = drizzle(pool, { schema });

// Pool dédié au session store — utilise DIRECT_DATABASE_URL si disponible
// (connexion directe Supabase port 5432, pas le pooler PgBouncer port 6543)
// Sur Plesk : définir DIRECT_DATABASE_URL avec l'URL directe Supabase pour éviter
// les incompatibilités entre connect-pg-simple et PgBouncer en mode "transaction".
const sessionDatabaseUrl = process.env.DIRECT_DATABASE_URL || databaseUrl;
export const sessionPool = new Pool({
  connectionString: sessionDatabaseUrl,
  ssl: { rejectUnauthorized: false },
  max: 5,
});
