/**
 * dbWatchdog.ts — Database-level intrusion detection for AshTech Pay
 *
 * Two complementary mechanisms:
 *
 * 1. PostgreSQL LISTEN/NOTIFY — A dedicated PG client subscribes to the
 *    "ashtech_db_audit" channel. DB-level triggers on sensitive tables send
 *    pg_notify() for every INSERT/UPDATE/DELETE, even when the change was made
 *    directly via SQL, compromised credentials, or any path bypassing the web app.
 *
 * 2. Integrity Watchdog — Runs every 5 minutes and checks for:
 *    - Unexpected privilege escalations (new admin/finance role without admin_log entry)
 *    - Admin log deletions (audit log count decreasing)
 *    - Session table anomalies (adminOtpVerified flag injected into JSONB)
 *    - Unexpected bulk creation of hosted_page_configs (API key mass generation)
 *
 * Both mechanisms send real-time Telegram alerts and log to the server console.
 */

import pg from "pg";
import { sendMessage } from "./telegram";
import { db } from "./db";
import { sql } from "drizzle-orm";

const { Client } = pg;

const NOTIFY_CHANNEL = "ashtech_db_audit";
const WATCHDOG_INTERVAL_MS = 5 * 60 * 1000;
const ALERT_COOLDOWN_MS = 60 * 1000;

interface WatchdogSnapshot {
  adminCount: number;
  adminLogCount: number;
  hostedConfigCount: number;
  takenAt: Date;
}

let previousSnapshot: WatchdogSnapshot | null = null;
const alertCooldown = new Map<string, number>();

function throttledAlert(key: string, message: string): void {
  const last = alertCooldown.get(key) || 0;
  if (Date.now() - last < ALERT_COOLDOWN_MS) return;
  alertCooldown.set(key, Date.now());
  const timestamp = new Date().toLocaleString("fr-FR", { timeZone: "Africa/Douala" });
  const full = `🚨 <b>[SIEM] Anomalie DB détectée</b>\n\n${message}\n\n🕐 ${timestamp}`;
  console.error("[SIEM]", message.replace(/<[^>]+>/g, "").replace(/\n/g, " "));
  sendMessage(full).catch(() => {});
}

async function startListenClient(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL;
  if (!databaseUrl) return;

  const sslConfig =
    databaseUrl.includes("localhost") ||
    databaseUrl.includes("127.0.0.1") ||
    databaseUrl.includes("sslmode=disable") ||
    databaseUrl.includes("heliumdb")
      ? undefined
      : { rejectUnauthorized: false };

  const reconnect = async () => {
    const client = new Client({ connectionString: databaseUrl, ssl: sslConfig as any });

    client.on("error", (err: Error) => {
      console.warn("[SIEM] PG listen client error — reconnecting in 15s:", err.message);
      client.end().catch(() => {});
      setTimeout(reconnect, 15_000);
    });

    client.on("notification", (msg: any) => {
      if (msg.channel !== NOTIFY_CHANNEL) return;
      try {
        const payload = JSON.parse(msg.payload || "{}");
        const op: string = payload.op || "UNKNOWN";
        const table: string = payload.table || "unknown";
        const id: string | undefined = payload.id;
        const changedCols: string[] = payload.changed_cols || [];

        // Tables and operations we care about — skip high-frequency application-level ops
        const watchedTables: Record<string, string[]> = {
          users: ["INSERT", "UPDATE", "DELETE"],
          session: ["INSERT", "UPDATE", "DELETE"],
          hosted_page_configs: ["INSERT", "UPDATE", "DELETE"],
          admin_logs: ["DELETE"],
          kyc_submissions: ["DELETE"],
        };

        const watchedOps = watchedTables[table];
        if (!watchedOps || !watchedOps.includes(op)) return;

        // Suppress heartbeat-only user updates (last_seen_at, last_login_at, etc.)
        if (table === "users" && op === "UPDATE" && changedCols.length > 0) {
          const heartbeatCols = new Set([
            "last_seen_at", "last_login_at", "reset_token", "reset_token_expiry",
            // Startup migration: re-encryption of api_key field
            "api_key", "api_key_hash",
          ]);
          if (changedCols.every((c) => heartbeatCols.has(c))) return;
        }

        // Suppress startup migration updates on hosted_page_configs (field re-encryption)
        if (table === "hosted_page_configs" && op === "UPDATE" && changedCols.length > 0) {
          const migrationCols = new Set(["sk_live", "pk_live", "hp_live", "hp_live_hash"]);
          if (changedCols.every((c) => migrationCols.has(c))) return;
        }

        // Suppress ALL session table UPDATEs — connect-pg-simple legitimately updates
        // expire (and sess) on every active session every ~60s. The trigger fires even
        // when changedCols is empty (no diff detected). Alerting on session UPDATEs
        // produces only noise. Real threats (admin flag injection into sess JSONB,
        // mass DELETE) are caught by the 5-min integrity watchdog or via INSERT/DELETE below.
        if (table === "session" && op === "UPDATE") return;

        const colsLine =
          changedCols.length > 0
            ? `\nColonnes modifiées: <code>${changedCols.join(", ")}</code>`
            : "";

        throttledAlert(
          `notify:${table}:${op}`,
          `⚡ <b>Mutation DB directe détectée</b>\n` +
            `Table: <code>${table}</code>\n` +
            `Opération: <code>${op}</code>` +
            (id ? `\nID: <code>${id.slice(0, 24)}</code>` : "") +
            colsLine +
            `\n\n⚠️ Cette opération a été effectuée <b>hors interface web</b> (trigger PostgreSQL).`
        );
      } catch {
        console.warn("[SIEM] Malformed pg_notify payload:", msg.payload?.slice?.(0, 200));
      }
    });

    try {
      await client.connect();
      await client.query(`LISTEN "${NOTIFY_CHANNEL}"`);
      console.log(`[SIEM] Listening on pg channel "${NOTIFY_CHANNEL}"`);
    } catch (err: any) {
      console.warn("[SIEM] LISTEN connect failed — retrying in 15s:", err?.message);
      await client.end().catch(() => {});
      setTimeout(reconnect, 15_000);
    }
  };

  reconnect();
}

async function takeSnapshot(): Promise<WatchdogSnapshot | null> {
  try {
    const adminRes = await db.execute(
      sql`SELECT COUNT(*)::int AS cnt FROM users WHERE role IN ('admin','finance','support')`
    );
    const logRes = await db.execute(sql`SELECT COUNT(*)::int AS cnt FROM admin_logs`);
    const hpRes = await db.execute(sql`SELECT COUNT(*)::int AS cnt FROM hosted_page_configs`);

    return {
      adminCount: (adminRes.rows as any[])[0]?.cnt ?? 0,
      adminLogCount: (logRes.rows as any[])[0]?.cnt ?? 0,
      hostedConfigCount: (hpRes.rows as any[])[0]?.cnt ?? 0,
      takenAt: new Date(),
    };
  } catch (err: any) {
    console.warn("[SIEM] Snapshot failed:", err?.message);
    return null;
  }
}

/**
 * On startup: purge any old sessions that still contain the legacy adminOtpVerified flag.
 * These are leftover from a previous code version and generate false SIEM alerts.
 * The new code stores OTP verification as _avs (timestamp) in session, never adminOtpVerified.
 */
export async function purgeOldAdminOtpSessions(): Promise<void> {
  try {
    const result = await db.execute(sql`
      DELETE FROM session
      WHERE sess::text ILIKE '%adminOtpVerified%'
    `);
    const deleted = (result as any).rowCount ?? 0;
    if (deleted > 0) {
      console.log(`[SIEM] Purged ${deleted} legacy session(s) with adminOtpVerified flag`);
    }
  } catch {
    // session table may not exist — silently skip
  }
}

async function checkSessionAnomalies(): Promise<void> {
  try {
    // Check for legacy adminOtpVerified flag — this should no longer exist after purge.
    // If detected here it means someone injected it manually (privilege escalation attempt).
    const res = await db.execute(sql`
      SELECT sid
      FROM session
      WHERE sess::text ILIKE '%adminOtpVerified%'
      LIMIT 5
    `);
    const rows = res.rows as any[];
    if (rows.length > 0) {
      // Auto-delete these suspicious sessions immediately
      await db.execute(sql`DELETE FROM session WHERE sess::text ILIKE '%adminOtpVerified%'`);
      throttledAlert(
        "session:adminOtpVerified",
        `🔐 <b>Flag adminOtpVerified injecté dans la table session</b>\n` +
          `${rows.length} session(s) contenant ce flag ont été supprimées automatiquement.\n` +
          `SIDs: ${rows.map((r) => String(r.sid || "").slice(0, 12) + "…").join(", ")}\n\n` +
          `⚠️ Tentative possible d'injection de privilège admin.`
      );
    }
  } catch {
    // session table may not exist in dev — silently skip
  }
}

async function checkPrivilegeEscalation(
  prev: WatchdogSnapshot,
  curr: WatchdogSnapshot
): Promise<void> {
  if (curr.adminCount <= prev.adminCount) return;

  try {
    const recentRes = await db.execute(sql`
      SELECT id, role, username, email
      FROM users
      WHERE role IN ('admin','finance','support')
      ORDER BY created_at DESC
      LIMIT 10
    `);
    const logRes = await db.execute(sql`
      SELECT target_id FROM admin_logs
      WHERE action ILIKE '%role%' OR action ILIKE '%privilege%' OR action ILIKE '%promote%'
      ORDER BY created_at DESC
      LIMIT 30
    `);

    const loggedIds = new Set((logRes.rows as any[]).map((r) => r.target_id));
    const unlogged = (recentRes.rows as any[]).filter((u) => !loggedIds.has(u.id));

    throttledAlert(
      "priv:escalation",
      `🔴 <b>Élévation de privilège non journalisée</b>\n` +
        `Admins/finance/support: ${prev.adminCount} → ${curr.adminCount}\n` +
        (unlogged.length > 0
          ? `Comptes suspects: ${unlogged
              .map((u) => `<code>${u.username || u.email}</code> (${u.role})`)
              .join(", ")}`
          : `Aucune entrée correspondante dans admin_logs.`)
    );
  } catch (err: any) {
    console.warn("[SIEM] Escalation check error:", err?.message);
  }
}

async function runWatchdog(): Promise<void> {
  const curr = await takeSnapshot();
  if (!curr) return;

  if (previousSnapshot) {
    const prev = previousSnapshot;

    // 1. Audit log deletion
    if (curr.adminLogCount < prev.adminLogCount) {
      throttledAlert(
        "adminlog:deletion",
        `🗑️ <b>Suppression de logs d'audit détectée</b>\n` +
          `admin_logs: ${prev.adminLogCount} → ${curr.adminLogCount}\n` +
          `(${prev.adminLogCount - curr.adminLogCount} entrée(s) supprimée(s))`
      );
    }

    // 2. Privilege escalation
    await checkPrivilegeEscalation(prev, curr);

    // 3. Bulk API config creation
    if (curr.hostedConfigCount > prev.hostedConfigCount + 3) {
      throttledAlert(
        "hpc:spike",
        `📋 <b>Création massive de configs API marchands</b>\n` +
          `hosted_page_configs: ${prev.hostedConfigCount} → ${curr.hostedConfigCount}`
      );
    }
  }

  // 4. Session JSONB anomaly (every run)
  await checkSessionAnomalies();

  previousSnapshot = curr;
}

/**
 * Installs PostgreSQL audit trigger function + triggers on sensitive tables.
 * Called once during server startup. Idempotent (CREATE OR REPLACE + DROP IF EXISTS).
 * Sends pg_notify on every INSERT/UPDATE/DELETE — column names only, no values (no PII leak).
 */
export async function createDbAuditTriggers(): Promise<void> {
  try {
    await db.execute(sql.raw(`
      CREATE OR REPLACE FUNCTION ashtech_audit_notify() RETURNS TRIGGER AS $$
      DECLARE
        payload TEXT;
        changed_cols TEXT[];
        col TEXT;
        row_id TEXT;
        rec JSONB;
      BEGIN
        -- Use to_jsonb() for dynamic field access so this trigger works on tables
        -- whose PK is not named "id" (e.g. the "session" table uses "sid").
        IF TG_OP = 'DELETE' THEN
          rec := to_jsonb(OLD);
        ELSE
          rec := to_jsonb(NEW);
        END IF;
        row_id := COALESCE(rec ->> 'id', rec ->> 'sid', 'unknown');

        IF TG_OP = 'UPDATE' THEN
          changed_cols := ARRAY[]::TEXT[];
          FOR col IN
            SELECT column_name FROM information_schema.columns
            WHERE table_name = TG_TABLE_NAME AND table_schema = TG_TABLE_SCHEMA
          LOOP
            IF (to_jsonb(OLD) -> col) IS DISTINCT FROM (to_jsonb(NEW) -> col) THEN
              changed_cols := array_append(changed_cols, col);
            END IF;
          END LOOP;
          payload := json_build_object(
            'op', TG_OP,
            'table', TG_TABLE_NAME,
            'id', row_id,
            'changed_cols', changed_cols
          )::TEXT;
        ELSE
          payload := json_build_object(
            'op', TG_OP,
            'table', TG_TABLE_NAME,
            'id', row_id
          )::TEXT;
        END IF;

        IF length(payload) > 7900 THEN
          payload := left(payload, 7900) || '"}';
        END IF;

        PERFORM pg_notify('ashtech_db_audit', payload);
        RETURN COALESCE(NEW, OLD);
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `));

    const tables = ["users", "session", "hosted_page_configs", "admin_logs", "kyc_submissions"];

    for (const table of tables) {
      const trig = `ashtech_audit_${table}`;
      await db.execute(sql.raw(`DROP TRIGGER IF EXISTS "${trig}" ON "${table}"`));
      await db.execute(sql.raw(`
        CREATE TRIGGER "${trig}"
        AFTER INSERT OR UPDATE OR DELETE ON "${table}"
        FOR EACH ROW EXECUTE FUNCTION ashtech_audit_notify()
      `));
    }

    console.log("[SIEM] PostgreSQL audit triggers installed on:", tables.join(", "));
  } catch (err: any) {
    console.warn("[SIEM] Failed to install audit triggers:", err?.message);
  }
}

export function startDbWatchdog(): void {
  console.log("[SIEM] DB Watchdog starting — pg_notify listener + integrity checks every 5 min");
  startListenClient().catch((err: any) =>
    console.warn("[SIEM] pg_notify listener failed:", err?.message)
  );
  // First pass after 30s (let startup migrations complete), then every 5 min
  setTimeout(async () => {
    await runWatchdog();
    setInterval(runWatchdog, WATCHDOG_INTERVAL_MS);
  }, 30_000);
}
