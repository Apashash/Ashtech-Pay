import { defineConfig } from "drizzle-kit";

const useMysql = process.env.DB_DIALECT?.toLowerCase() === "mysql";
const databaseUrl = useMysql
  ? process.env.MYSQL_DATABASE_URL || process.env.MYSQL_URL
  : process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL;

if (!databaseUrl) {
  throw new Error(useMysql ? "MYSQL_DATABASE_URL or MYSQL_URL must be set" : "DATABASE_URL must be set");
}

export default defineConfig({
  out: "./migrations",
  schema: useMysql ? "./shared/schema.mysql.ts" : "./shared/schema.ts",
  dialect: useMysql ? "mysql" : "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
});
