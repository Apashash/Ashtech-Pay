import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import { globalLimiter } from "./rateLimiter";
import { botGuard } from "./botGuard";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { startPaymentPoller, recoverPendingDeposits } from "./paymentPoller";
import { startPayoutPoller, recoverPendingPayouts } from "./payoutPoller";
import { startConversionPoller } from "./conversionPoller";
import { seedWithdrawalTransferFees } from "./seedWithdrawalTransferFees";
import { startCleanupScheduler } from "./cleanup";
import { startDailyReportScheduler } from "./dailyReport";
import { hydrateIpBlocker } from "./ipBlocker";
import { hydrateBotBans } from "./botGuard";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { encryptField, hmacField } from "./fieldEncryption";
import { createDbAuditTriggers, startDbWatchdog, purgeOldAdminOtpSessions } from "./dbWatchdog";

const app = express();
const httpServer = createServer(app);
const isProd = process.env.NODE_ENV === "production";

// ── Gestionnaires d'erreurs globaux ──────────────────────────────────────────
// unhandledRejection: log + continue — safe, these are async promise failures.
process.on("unhandledRejection", (reason: unknown) => {
  const msg = reason instanceof Error ? reason.message : String(reason);
  console.error("[CRASH-GUARD] unhandledRejection interceptée:", msg);
});

// uncaughtException: log + EXIT — leaving the process alive after an uncaught
// synchronous exception risks state corruption (broken DB connections, invalid
// memory, deadlocked intervals). Both Passenger and PM2 will restart the process
// automatically, making a clean exit safer than running corrupted.
process.on("uncaughtException", (err: Error) => {
  console.error("[CRASH-GUARD] uncaughtException — redémarrage propre:", err.message, err.stack);
  // Flush logs then exit. Passenger/PM2 will restart the process.
  setTimeout(() => process.exit(1), 300);
});

// ── FIX-1: SESSION_SECRET est obligatoire en production ET en multi-worker PM2 ─
// Sans lui, chaque worker PM2 génère sa propre clé aléatoire (_DEV_TOKEN_SECRET).
// → sessions cookie et Bearer tokens créés sur Worker A sont invalides sur Worker B.
// → déconnexion immédiate après login (singleDeviceKick).
const pm2Count = Math.max(1, parseInt(process.env.PM2_INSTANCES || "1", 10) || 1);
const isMultiWorker = pm2Count > 1;
if ((isProd || isMultiWorker) && !process.env.SESSION_SECRET) {
  console.error("[SECURITY] FATAL: SESSION_SECRET env var must be set in production or multi-worker PM2.");
  console.error("[SECURITY] Without SESSION_SECRET, each PM2 worker uses a different random key.");
  console.error("[SECURITY] This causes immediate logout after login (token cross-worker mismatch).");
  if (isProd) process.exit(1);
  // In dev with PM2: warn loudly but don't exit (allows single-worker dev to work)
  console.error("[SECURITY] WARNING: Running multi-worker without SESSION_SECRET — sessions WILL break across workers!");
}

// ── FIX-6: Trust proxy — nécessaire pour que req.ip soit fiable derrière Replit/Nginx ──
// Sans cela, X-Forwarded-For peut être forgé par le client pour contourner les rate limiters.
const isSecureEnv = process.env.TRUST_PROXY === "true" || !!process.env.REPL_ID;
app.set("trust proxy", isSecureEnv ? 1 : false);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// ── Security: Block access to source code files ───────────────────────────────
// In production: block .ts/.tsx and other source file types.
// In development: only block server-side directories (Vite needs to serve client .ts/.tsx).
app.use((req: Request, res: Response, next: NextFunction) => {
  const p = req.path.toLowerCase();

  const blocked = isProd
    ? (
        p.startsWith("/server/") ||
        p.startsWith("/shared/") ||
        p.startsWith("/node_modules/") ||
        p.startsWith("/.") ||
        p.endsWith(".ts") ||
        p.endsWith(".tsx") ||
        p.endsWith(".env") ||
        p.endsWith(".config.js") ||
        p.endsWith(".config.ts") ||
        p.endsWith("package.json") ||
        p.endsWith("package-lock.json") ||
        p.endsWith("drizzle.config.ts") ||
        p.endsWith(".cjs") ||
        p.endsWith(".map")
      )
    : (
        p.startsWith("/server/") ||
        p.startsWith("/shared/") ||
        p.startsWith("/node_modules/") ||
        p.startsWith("/.") ||
        p.endsWith(".env") ||
        p.endsWith("package-lock.json")
      );

  if (blocked) {
    return res.status(404).end();
  }
  next();
});

// ── Security: Helmet HTTP headers ────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: isProd
      ? {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://challenges.cloudflare.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
            imgSrc: ["'self'", "data:", "blob:", "https:"],
            connectSrc: ["'self'", "https:", "wss:"],
            frameSrc: ["https://challenges.cloudflare.com"],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: isProd ? [] : null,
          },
        }
      : false,
    crossOriginEmbedderPolicy: false,
    hsts: isProd ? { maxAge: 31536000, includeSubDomains: true } : false,
  })
);

// ── Security: Bot guard (UA check, honeypot, path injection, IP ban) ─────────
app.use(botGuard);

// ── Security: Global rate limit (50 req/min/IP on all /api routes) ───────────
app.use(globalLimiter);

// ── Body parsers ──────────────────────────────────────────────────────────────
app.use(
  express.json({
    limit: "2mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: false, limit: "2mb" }));

// ── Security: Remove server identity header ───────────────────────────────────
app.disable("x-powered-by");

// ── Security: Hardened headers for all /api responses (5.6) ──────────────────
// Applies X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Cache-Control
// and a restrictive CSP to every REST endpoint — independent of Helmet's HTML CSP.
app.use("/api", (_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Content-Security-Policy", "default-src 'none'");
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  res.setHeader("Cache-Control", "no-store");
  next();
});

// ── Security: CSRF protection — block state-changing requests from foreign origins ──
// All legitimate requests from the React SPA send X-Requested-With: XMLHttpRequest.
// Cross-origin requests (CSRF attacks via HTML forms, img tags, or XHR from other domains)
// cannot set this custom header without a CORS preflight that the server does not permit.
// Exemptions: GET/HEAD/OPTIONS (read-only), webhooks (use HMAC), Bearer-only paths.
// Paths exempt from CSRF check: external callbacks that don't use browser cookies.
// Use originalUrl (full path) because req.path inside app.use("/api", ...) is relative.
const CSRF_EXEMPT_PREFIXES = [
  "/api/swychr/webhook",
  "/api/nowpayments/webhook",
  "/api/v1/hosted-payment/",
  "/api/payment-links/",         // public pay page uses our own JS, but keep flexible
];
app.use("/api", (req: Request, res: Response, next: NextFunction) => {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
    return next();
  }
  const fullPath = req.originalUrl.split("?")[0];
  if (CSRF_EXEMPT_PREFIXES.some(p => fullPath.startsWith(p))) return next();
  const xrw = req.headers["x-requested-with"];
  if (!xrw || String(xrw).toLowerCase() !== "xmlhttprequest") {
    return res.status(403).json({ message: "Requête non autorisée (CSRF)." });
  }
  next();
});

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    // ── 5.5: Sanitize error responses in production ───────────────────────────
    // Prevents internal error messages and stack traces leaking to clients.
    if (isProd && res.statusCode >= 500 && bodyJson && typeof bodyJson === "object") {
      const sanitized = {
        message: "Une erreur interne s'est produite.",
        ...(bodyJson.error ? { error: "server_error" } : {}),
      };
      capturedJsonResponse = sanitized;
      return originalResJson.apply(res, [sanitized, ...args]);
    }
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      log(logLine);
    }
  });

  next();
});

(async () => {
  // ── Startup migration: ensure new columns exist in production DB ──────────
  try {
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS api_key TEXT UNIQUE`);
    await db.execute(sql`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS notify_url TEXT`);
    await db.execute(sql`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS source TEXT`);
    await db.execute(sql`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMP`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS hosted_page_configs (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL UNIQUE,
        success_url TEXT,
        cancel_url TEXT,
        pk_live TEXT UNIQUE,
        sk_live TEXT UNIQUE,
        hp_live TEXT UNIQUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS hosted_payment_sessions (
        id TEXT PRIMARY KEY,
        merchant_id VARCHAR NOT NULL,
        amount DECIMAL(15,2) NOT NULL,
        currency TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        transaction_id VARCHAR,
        created_at TIMESTAMP DEFAULT NOW(),
        expires_at TIMESTAMP
      )
    `);
    await db.execute(sql`ALTER TABLE hosted_payment_sessions ADD COLUMN IF NOT EXISTS notify_url TEXT`);
    await db.execute(sql`ALTER TABLE payment_links ADD COLUMN IF NOT EXISTS notify_url TEXT`);
    // 5.3 — field encryption: searchable HMAC hash columns for hosted_page_configs and users
    await db.execute(sql`ALTER TABLE hosted_page_configs ADD COLUMN IF NOT EXISTS hp_live_hash TEXT UNIQUE`);
    await db.execute(sql`ALTER TABLE hosted_page_configs ADD COLUMN IF NOT EXISTS notify_url TEXT`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS api_key_hash TEXT UNIQUE`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "session" (
        "sid" varchar NOT NULL COLLATE "default",
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL,
        CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE
      ) WITH (OIDS=FALSE)
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire")`);
    // admin_pending_logins — survives PM2 worker restarts (replaces in-memory Map)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS admin_pending_logins (
        token TEXT PRIMARY KEY,
        user_id VARCHAR NOT NULL,
        otp TEXT NOT NULL,
        expires_at BIGINT NOT NULL,
        attempts INT NOT NULL DEFAULT 0
      )
    `);
    await db.execute(sql`ALTER TABLE operators ADD COLUMN IF NOT EXISTS deposit_payment_provider TEXT`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS token_revoked_before BIGINT DEFAULT 0`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS withdrawal_blocked BOOLEAN DEFAULT FALSE`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS withdrawal_block_reason TEXT`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret TEXT`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN DEFAULT FALSE`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_locked_until BIGINT DEFAULT 0`);
    await db.execute(sql`ALTER TABLE conversion_requests ADD COLUMN IF NOT EXISTS executed_at TIMESTAMP`);
    await db.execute(sql`ALTER TABLE conversion_requests ADD COLUMN IF NOT EXISTS executed_by_id VARCHAR`);
    await db.execute(sql`ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'info'`);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS wallets_user_currency_unique
      ON wallets (user_id, currency)
    `);
    // Ensure admin_logs table exists (may be missing on older production deployments)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS admin_logs (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        admin_id VARCHAR NOT NULL REFERENCES users(id),
        action TEXT NOT NULL,
        target_type TEXT,
        target_id VARCHAR,
        details TEXT,
        ip_address TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_admin_logs_admin_id ON admin_logs(admin_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON admin_logs(created_at)`);
    // Ensure withdrawal_numbers table and withdrawal_number_changes table exist
    // (may be missing on Plesk deployments where drizzle-kit push was not re-run)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS withdrawal_numbers (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL REFERENCES users(id),
        phone_number TEXT NOT NULL,
        operator_name TEXT,
        label TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS withdrawal_number_changes (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL REFERENCES users(id),
        withdrawal_number_id VARCHAR REFERENCES withdrawal_numbers(id),
        action TEXT NOT NULL,
        old_phone_number TEXT,
        old_operator_name TEXT,
        new_phone_number TEXT,
        new_operator_name TEXT,
        new_label TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        admin_id VARCHAR REFERENCES users(id),
        admin_note TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        processed_at TIMESTAMP
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_withdrawal_numbers_user_id ON withdrawal_numbers(user_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_withdrawal_number_changes_user_id ON withdrawal_number_changes(user_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_withdrawal_number_changes_number_id ON withdrawal_number_changes(withdrawal_number_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_withdrawal_number_changes_status ON withdrawal_number_changes(status)`);
    // Ensure all columns exist on withdrawal_number_changes (table may have been created before these columns were added)
    await db.execute(sql`ALTER TABLE withdrawal_number_changes ADD COLUMN IF NOT EXISTS old_phone_number TEXT`);
    await db.execute(sql`ALTER TABLE withdrawal_number_changes ADD COLUMN IF NOT EXISTS old_operator_name TEXT`);
    await db.execute(sql`ALTER TABLE withdrawal_number_changes ADD COLUMN IF NOT EXISTS new_phone_number TEXT`);
    await db.execute(sql`ALTER TABLE withdrawal_number_changes ADD COLUMN IF NOT EXISTS new_operator_name TEXT`);
    await db.execute(sql`ALTER TABLE withdrawal_number_changes ADD COLUMN IF NOT EXISTS new_label TEXT`);
    await db.execute(sql`ALTER TABLE withdrawal_number_changes ADD COLUMN IF NOT EXISTS admin_note TEXT`);
    await db.execute(sql`ALTER TABLE withdrawal_number_changes ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP`);
    // Ensure operator_name column exists on withdrawal_numbers (may be missing on older deployments)
    await db.execute(sql`ALTER TABLE withdrawal_numbers ADD COLUMN IF NOT EXISTS operator_name TEXT`);
    // Ensure audit_logs table exists (security audit trail — login, withdrawal, KYC, role changes…)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR,
        actor_type TEXT NOT NULL DEFAULT 'user',
        action TEXT NOT NULL,
        target_type TEXT,
        target_id VARCHAR,
        details TEXT,
        ip_address TEXT,
        user_agent TEXT,
        success BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC)`);
    console.log("[Migration] Schema columns ready (api_key, notify_url, source, confirmed_at, hosted_page_configs, hosted_payment_sessions, payment_links.notify_url, token_revoked_before, conversion_requests.executed_at/by_id, user_notifications.type, wallets_unique_idx, admin_logs, audit_logs, withdrawal_numbers, withdrawal_number_changes)");

    // ── 5.3 Re-encrypt existing plaintext sensitive fields ────────────────────
    // Only runs when FIELD_ENCRYPTION_KEY is set. Without the key, encryptField()
    // returns plaintext (no "enc:" prefix) — running this loop would re-process
    // ALL rows on EVERY restart, causing 50+ unnecessary DB queries each time.
    if (!process.env.FIELD_ENCRYPTION_KEY) {
      console.log("[Migration] FIELD_ENCRYPTION_KEY not set — skipping re-encryption (cleartext mode)");
    } else
    try {
      // hosted_page_configs: encrypt sk_live, pk_live, hp_live; populate hp_live_hash
      const hpRows = await db.execute(sql`
        SELECT id, sk_live, pk_live, hp_live FROM hosted_page_configs
        WHERE sk_live IS NOT NULL OR pk_live IS NOT NULL OR hp_live IS NOT NULL
      `);
      let hpMigrated = 0;
      for (const row of (hpRows as any).rows ?? []) {
        const updates: Record<string, string | null> = {};
        if (row.sk_live && !row.sk_live.startsWith("enc:"))
          updates.sk_live = encryptField(row.sk_live);
        if (row.pk_live && !row.pk_live.startsWith("enc:"))
          updates.pk_live = encryptField(row.pk_live);
        if (row.hp_live && !row.hp_live.startsWith("enc:")) {
          updates.hp_live = encryptField(row.hp_live);
          updates.hp_live_hash = hmacField(row.hp_live);
        } else if (row.hp_live && !row.hp_live_hash) {
          // Already encrypted but hash missing — backfill not possible without plaintext
          // (will be set on next config save by the merchant)
        }
        if (Object.keys(updates).length > 0) {
          // Use parameterized updates to avoid sql.raw injection risk
          const allowedCols = new Set(["sk_live", "pk_live", "hp_live", "hp_live_hash"]);
          for (const [k] of Object.entries(updates)) {
            if (!allowedCols.has(k)) delete updates[k]; // strip unexpected keys
          }
          const setFragments = Object.entries(updates).map(([k, v]) =>
            v === null ? sql.raw(`${k} = NULL`) : sql`${sql.raw(k)} = ${v}`
          );
          if (setFragments.length > 0) {
            const setPart = sql.join(setFragments, sql.raw(", "));
            await db.execute(sql`UPDATE hosted_page_configs SET ${setPart} WHERE id = ${row.id}`);
          }
          hpMigrated++;
        }
      }
      if (hpMigrated > 0)
        console.log(`[Migration] Re-encrypted ${hpMigrated} hosted_page_configs row(s)`);

      // users: encrypt api_key; populate api_key_hash
      const apiKeyRows = await db.execute(sql`
        SELECT id, api_key FROM users
        WHERE api_key IS NOT NULL AND api_key NOT LIKE 'enc:%'
      `);
      let akMigrated = 0;
      for (const row of (apiKeyRows as any).rows ?? []) {
        const encKey = encryptField(row.api_key);
        const keyHash = hmacField(row.api_key);
        await db.execute(
          sql`UPDATE users SET api_key = ${encKey}, api_key_hash = ${keyHash} WHERE id = ${row.id}`
        );
        akMigrated++;
      }
      if (akMigrated > 0)
        console.log(`[Migration] Re-encrypted ${akMigrated} users.api_key row(s)`);
    } catch (encErr: any) {
      console.warn("[Migration] Re-encryption warning:", encErr?.message);
    }

    // Performance indexes
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_transactions_user_created ON transactions(user_id, created_at DESC)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_payment_links_user_id ON payment_links(user_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_user_notifications_user_id ON user_notifications(user_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone)`);
    console.log("[Migration] Performance indexes ready");

    // ── SIEM: Install PostgreSQL-level audit triggers (VII) ───────────────────
    await createDbAuditTriggers();

    // ── Security: Block direct DB modifications to sensitive columns ──────────
    // Any connection whose application_name != 'ashtech_secure_app' (i.e. not
    // the app server pool) is BLOCKED from changing is_banned, role, or
    // is_verified on the users table. Direct psql / pgAdmin / script access
    // will hit RAISE EXCEPTION and the change will be rolled back.
    await db.execute(sql`
      CREATE OR REPLACE FUNCTION ashtech_guard_sensitive_update()
      RETURNS TRIGGER LANGUAGE plpgsql AS $$
      DECLARE
        app_name TEXT;
      BEGIN
        app_name := current_setting('application_name', true);
        -- Allow only the official app server connection pool
        IF app_name IS DISTINCT FROM 'ashtech_secure_app' THEN
          -- Block any attempt to change is_banned, role, or is_verified
          IF (NEW.is_banned IS DISTINCT FROM OLD.is_banned)
            OR (NEW.role IS DISTINCT FROM OLD.role)
            OR (NEW.is_verified IS DISTINCT FROM OLD.is_verified) THEN
            RAISE EXCEPTION
              '[AshTech Security] Modification directe des colonnes sensibles (is_banned, role, is_verified) bloquée. Utilisez l''interface admin. Source: %', app_name;
          END IF;
        END IF;
        RETURN NEW;
      END;
      $$
    `);
    await db.execute(sql`DROP TRIGGER IF EXISTS ashtech_guard_sensitive ON users`);
    await db.execute(sql`
      CREATE TRIGGER ashtech_guard_sensitive
      BEFORE UPDATE ON users
      FOR EACH ROW EXECUTE FUNCTION ashtech_guard_sensitive_update()
    `);
    console.log("[Security] Sensitive-column guard trigger installed on users table");

    // ── Purge legacy sessions with old adminOtpVerified flag (stops false SIEM alerts)
    await purgeOldAdminOtpSessions();

    try {
      // Each country currency keeps its own distinct wallet (XAFG for Gabon, XOFT for Togo, etc.)
      // No same-family CFA wallet merging — removed intentionally
      const fixTogo = await db.execute(sql`
        UPDATE users SET preferred_currency = 'XOFT'
        WHERE country = 'Togo' AND preferred_currency = 'XOF'
        RETURNING id
      `);
      const fixedTogo = (fixTogo as any).rowCount ?? (fixTogo as any).rows?.length ?? 0;
      if (fixedTogo > 0) console.log(`[Migration] Normalized ${fixedTogo} Togo user(s) preferred_currency XOF → XOFT`);
    } catch (mErr: any) {
      console.warn("[Migration] Togo normalization warning:", mErr?.message);
    }
  } catch (err: any) {
    if (!err?.message?.includes("already exists")) {
      console.warn("[Migration] warning:", err?.message);
    }
  }

  await registerRoutes(httpServer, app);

  // ── Security: Sanitized error handler (no stack traces in production) ─────
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = isProd && status === 500
      ? "Une erreur interne s'est produite."
      : err.message || "Internal Server Error";

    if (status >= 500) {
      console.error("[Error]", isProd ? `${err.message}` : err);
    }
    res.status(status).json({ message });
  });

  if (isProd) {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  // reusePort is useful for PM2 cluster mode but breaks Phusion Passenger
  // (Passenger manages its own socket binding). Only enable when PM2 is detected.
  const useReusePort = !!process.env.PM2_HOME || !!process.env.pm_id;
  httpServer.listen(
    { port, host: "0.0.0.0", ...(useReusePort ? { reusePort: true } : {}) },
    () => {
      log(`serving on port ${port}`);
      startPaymentPoller();
      recoverPendingDeposits().catch(err =>
        console.error("[PaymentPoller] Recovery error:", err)
      );
      startPayoutPoller();
      recoverPendingPayouts().catch(err =>
        console.error("[PayoutPoller] Recovery error:", err)
      );
      startConversionPoller();
      seedWithdrawalTransferFees().catch(err =>
        console.error("[FeesSeed] Error during fee seeding:", err)
      );
      startCleanupScheduler();
      startDailyReportScheduler();
      hydrateIpBlocker().catch(err =>
        console.error("[IpBlocker] Hydration error:", err)
      );
      hydrateBotBans().catch(err =>
        console.error("[BotGuard] Hydration error:", err)
      );
      startDbWatchdog();
    },
  );
})();
