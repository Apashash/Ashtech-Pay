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
import { db } from "./db";
import { sql } from "drizzle-orm";
import { encryptField, hmacField } from "./fieldEncryption";

const app = express();
const httpServer = createServer(app);
const isProd = process.env.NODE_ENV === "production";

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

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
    await db.execute(sql`ALTER TABLE operators ADD COLUMN IF NOT EXISTS deposit_payment_provider TEXT`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS token_revoked_before BIGINT DEFAULT 0`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS withdrawal_blocked BOOLEAN DEFAULT FALSE`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS withdrawal_block_reason TEXT`);
    await db.execute(sql`ALTER TABLE conversion_requests ADD COLUMN IF NOT EXISTS executed_at TIMESTAMP`);
    await db.execute(sql`ALTER TABLE conversion_requests ADD COLUMN IF NOT EXISTS executed_by_id VARCHAR`);
    await db.execute(sql`ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'info'`);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS wallets_user_currency_unique
      ON wallets (user_id, currency)
    `);
    console.log("[Migration] Schema columns ready (api_key, notify_url, source, confirmed_at, hosted_page_configs, hosted_payment_sessions, payment_links.notify_url, token_revoked_before, conversion_requests.executed_at/by_id, user_notifications.type, wallets_unique_idx)");

    // ── 5.3 Re-encrypt existing plaintext sensitive fields ────────────────────
    // Runs at every startup — idempotent because encryptField() skips already-encrypted values.
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
          const setClauses = Object.entries(updates)
            .map(([k, v]) => `${k} = ${v === null ? "NULL" : `'${v}'`}`)
            .join(", ");
          await db.execute(sql.raw(`UPDATE hosted_page_configs SET ${setClauses} WHERE id = '${row.id}'`));
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
        await db.execute(sql.raw(
          `UPDATE users SET api_key = '${encKey}', api_key_hash = '${keyHash}' WHERE id = '${row.id}'`
        ));
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
  httpServer.listen(
    { port, host: "0.0.0.0", reusePort: true },
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
    },
  );
})();
