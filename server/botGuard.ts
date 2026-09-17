import type { Request, Response, NextFunction } from "express";
import { db } from "./db";
import { platformSettings } from "@shared/schema-runtime";
import { like, eq } from "drizzle-orm";
export { CLEAN_404_HTML, sendClean404 } from "./clean404";
import { sendClean404 } from "./clean404";

// ─── In-memory IP ban store ────────────────────────────────────────────────
// Map<ip, unbanTimestamp (ms)>
const bannedIPs = new Map<string, number>();

// DB key prefix for persisted bot bans
const BOT_BAN_PREFIX = "botban:";

// Nettoyage automatique des bans expirés toutes les heures
setInterval(() => {
  const now = Date.now();
  for (const [ip, until] of bannedIPs) {
    if (now > until) bannedIPs.delete(ip);
  }
}, 60 * 60 * 1000);

// ─── Helper: IP réelle derrière proxy ─────────────────────────────────────
// FIX-6: app.set("trust proxy", 1) dans index.ts rend req.ip fiable.
// Plus besoin de parser X-Forwarded-For manuellement (spoofable sinon).
function getIp(req: Request): string {
  return req.ip || "unknown";
}

// ─── Persist ban to DB (fire-and-forget) ──────────────────────────────────
async function persistBan(ip: string, until: number, path: string): Promise<void> {
  try {
    const key = `${BOT_BAN_PREFIX}${ip}`;
    const value = JSON.stringify({ until, path, bannedAt: Date.now() });
    const existing = await db.select().from(platformSettings).where(eq(platformSettings.key, key)).limit(1);
    if (existing.length > 0) {
      await db.update(platformSettings).set({ value, updatedAt: new Date() }).where(eq(platformSettings.key, key));
    } else {
      await db.insert(platformSettings).values({ key, value, description: "Bot honeypot ban (auto)" });
    }
  } catch (err: any) {
    console.warn("[BotGuard] DB persist error:", err?.message);
  }
}

// ─── Remove ban from DB ────────────────────────────────────────────────────
async function removeBanFromDb(ip: string): Promise<void> {
  try {
    await db.delete(platformSettings).where(eq(platformSettings.key, `${BOT_BAN_PREFIX}${ip}`));
  } catch {}
}

// ─── Load persisted bans from DB on startup ───────────────────────────────
export async function hydrateBotBans(): Promise<void> {
  try {
    const rows = await db.select().from(platformSettings).where(like(platformSettings.key, `${BOT_BAN_PREFIX}%`));
    const now = Date.now();
    let loaded = 0;
    for (const row of rows) {
      try {
        const data = JSON.parse(row.value);
        const ip = row.key.slice(BOT_BAN_PREFIX.length);
        if (data.until && now < data.until) {
          bannedIPs.set(ip, data.until);
          loaded++;
        } else {
          // expired — clean up
          await db.delete(platformSettings).where(eq(platformSettings.key, row.key));
        }
      } catch {}
    }
    console.log(`[BotGuard] Hydrated ${loaded} persisted bot ban(s) from DB.`);
  } catch (err: any) {
    console.warn("[BotGuard] Hydration error:", err?.message);
  }
}

// ─── User-Agents de bots connus / outils d'attaque ────────────────────────
const BAD_UA_PATTERNS: RegExp[] = [
  // Outils HTTP bas niveau
  /^curl\//i,
  /^wget\//i,
  /^libwww-perl/i,
  /^lwp-/i,
  /^httpie\//i,
  // Langages de script (accès direct sans navigateur)
  /python-requests/i,
  /python-urllib/i,
  /python-httpx/i,
  /^go-http-client/i,
  /^java\//i,
  /^apache-httpclient/i,
  /^okhttp/i,
  /^node-fetch/i,
  /^axios\//i,
  /^got\//i,
  // Scanners de sécurité / exploitation
  /nikto/i,
  /sqlmap/i,
  /dirbuster/i,
  /dirb\//i,
  /gobuster/i,
  /feroxbuster/i,
  /masscan/i,
  /zgrab/i,
  /nuclei/i,
  /httpx/i,
  /burpsuite/i,
  /burp\s/i,
  /nmap/i,
  /nessus/i,
  /openvas/i,
  /metasploit/i,
  /acunetix/i,
  /havij/i,
  /w3af/i,
  /skipfish/i,
  /wapiti/i,
  /zap\//i, // OWASP ZAP
  // Crawlers de données agressifs
  /scrapy/i,
  /phantomjs/i,
  /headlesschrome/i,
  /shodan/i,
  /censys/i,
  /binaryedge/i,
  /semrushbot/i,
  /ahrefsbot/i,
  /mj12bot/i,
  /dotbot/i,
  /blexbot/i,
  /petalbot/i,
  /serpstatbot/i,
  /dataforseobot/i,
  /turnitinbot/i,
  // Bots IA / LLM scrapers
  /claudebot/i,
  /gptbot/i,
  /ccbot/i,
  /bytespider/i,
  /omgilibot/i,
  /cohere-ai/i,
  /diffbot/i,
];

// ─── Chemins honeypot (jamais accédés par un vrai utilisateur) ─────────────
// Tout bot qui tente ces URLs est banni immédiatement
const HONEYPOT_PATHS: string[] = [
  "/wp-admin",
  "/wp-login.php",
  "/wp-config.php",
  "/phpmyadmin",
  "/pma",
  "/myadmin",
  "/admin.php",
  "/administrator",
  "/.env",
  "/.env.local",
  "/.env.production",
  "/.env.development",
  "/.env.backup",
  "/.git",
  "/.svn",
  "/.ssh",
  "/xmlrpc.php",
  "/setup.php",
  "/install.php",
  "/config.php",
  "/database.php",
  "/etc/passwd",
  "/.htaccess",
  "/.htpasswd",
  "/shell.php",
  "/c99.php",
  "/r57.php",
  "/cmd.php",
  "/eval.php",
  "/webshell.php",
  "/cgi-bin",
  "/manager/html",        // Tomcat manager
  "/solr/admin",          // Solr admin
  "/actuator",            // Spring Boot actuator
  "/console",             // H2/Grails consoles
  "/rest/v1",             // Supabase-style REST — not used by this app
  "/realtime/v1",
  "/storage/v1",
  "/auth/v1",
  "/debug.log",
  "/logs",
  "/internal",
  "/private",
  "/debug",
  "/__debug",
  "/_debug",
  "/trace",
  "/.aws",
  "/.aws/credentials",
  "/.bzr",
  "/.hg",
  "/.gitconfig",
  "/administrator/index.php",
  "/.DS_Store",
  "/backup.zip",
  "/backup.sql",
  "/backup.tar.gz",
  "/dump.sql",
  "/db.sql",
  "/database.sql",
  "/db_backup.sql",
  "/site.tar.gz",
  "/wwwroot.zip",
  "/sftp-config.json",
  "/wp-config.php.bak",
  "/wp-config.php~",
  "/config.php.bak",
  "/config.php~",
  "/backup",
  "/backups",
  "/.idea",
  "/boaform",             // Router exploit path
  "/Autodiscover",        // Exchange exploit
  "/owa",                 // Outlook Web Access
  "/remote/login",        // FortiVPN exploit
  "/api/jsonws",          // Liferay exploit
  "/vendor/phpunit",      // PHPUnit exploit
  "/telescope",           // Laravel Telescope
  "/horizon",             // Laravel Horizon
  "/debug/default/view",  // Yii debug
  "/server-status",       // Apache mod_status
  "/server-info",         // Apache mod_info
  // User/account probe paths — not real routes in this app
  // (real auth routes: /login, /register; account UI: /dashboard/*)
  "/user", "/users", "/user/login", "/user/register", "/user/profile",
  "/profile", "/profiles", "/account", "/accounts",
  "/customers", "/members", "/member",
  // API probe paths — these don't exist in this app; scanners probe them expecting
  // Spring Boot / Django / Rails internals. Return 404 before the UA filter fires.
  "/api/debug",
  "/api/swagger",
  "/api/graphql",
  "/api/internal",
  "/api/private",
  "/graphql",
  "/graphiql",
  "/__graphql",
  "/swagger",
  "/swagger-ui",
  "/swagger-ui.html",
  "/swagger.json",
  "/swagger.yaml",
  "/openapi",
  "/openapi.json",
  "/openapi.yaml",
  "/api-docs",
  "/redoc",
];

// ─── Patterns de chemins suspects (injection, traversal, etc.) ────────────
const SUSPICIOUS_PATH_PATTERNS: RegExp[] = [
  /\.\.\//,                // Path traversal
  /%2e%2e/i,               // Encoded traversal
  /%252e/i,                // Double-encoded traversal
  /union.{0,20}select/i,   // SQL injection
  /<script/i,              // XSS
  /eval\s*\(/i,            // Code injection
  /base64_decode/i,        // PHP obfuscation
  /\/etc\/passwd/i,        // LFI
  /\/proc\/self/i,         // LFI
  /\bselect\b.*\bfrom\b/i, // SQL injection
  /\bdrop\s+table/i,       // SQL injection
  /\binsert\s+into\b/i,    // SQL injection
  /\bexec\s*\(/i,          // Code execution
  /\bsystem\s*\(/i,        // Code execution
];

// ─── API publique: exclure du filtrage UA ─────────────────────────────────
// Webhooks et endpoints appelés par des serveurs (pas des navigateurs)
const API_UA_EXEMPT_PATHS = [
  "/api/afribapay/webhook",
  "/api/pixpay/webhook",
  "/api/pawapay/deposit-callback",
  "/api/pawapay/payout-callback",
  "/api/izichange/webhook", // IziChange payment processor — server-to-server calls
  "/api/pay/",
  "/api/v1/hosted-payment",
  "/api/telegram/webhook",
];

// ─── Fichiers publics: jamais bloqués (même si l'IP est bannie) ───────────
const PUBLIC_FILE_PATHS = [
  "/robots.txt",
  "/favicon.ico",
  "/favicon.png",
  "/sitemap.xml",
  "/manifest.json",
];

// ─── IPs exemptées du ban (loopback, health checks internes) ─────────────
const EXEMPT_IPS = ["127.0.0.1", "::1", "::ffff:127.0.0.1"];

// ─── Exports publics ──────────────────────────────────────────────────────
export function banIp(ip: string, durationMs = 24 * 60 * 60 * 1000): void {
  const until = Date.now() + durationMs;
  bannedIPs.set(ip, until);
  console.warn(`[BotGuard] 🔴 IP bannie pour ${Math.round(durationMs / 3600000)}h`);
}

export function isIpBanned(ip: string): boolean {
  const until = bannedIPs.get(ip);
  if (!until) return false;
  if (Date.now() > until) {
    bannedIPs.delete(ip);
    removeBanFromDb(ip).catch(() => {});
    return false;
  }
  return true;
}

export function getBannedIpCount(): number {
  return bannedIPs.size;
}

// ─── Middleware principal ─────────────────────────────────────────────────
export function botGuard(req: Request, res: Response, next: NextFunction): void {
  const ip = getIp(req);
  const ua = req.headers["user-agent"] || "";
  const uaLower = ua.toLowerCase();
  const rawPath = req.path;
  const pathLower = rawPath.toLowerCase();

  // 0. Fichiers publics essentiels — toujours autorisés (robots.txt, favicon, etc.)
  if (PUBLIC_FILE_PATHS.includes(rawPath)) {
    next();
    return;
  }

  // 0b. IPs de loopback — jamais bannies (health checks, dev local)
  const isLoopback = EXEMPT_IPS.includes(ip);

  // 1. Honeypot trap — AVANT le check de ban IP, pour que les chemins honeypot
  //    retournent toujours 404 même si l'IP est déjà bannie.
  //    Raison : si on check le ban en premier, un scanner déjà banni reçoit 403
  //    pour TOUS ses chemins (y compris les honeypots), révélant au scanner que
  //    ces chemins "existent mais sont interdits" → vulnérabilité HIGH signalée.
  //    En mettant le honeypot en premier, tous ces chemins retournent 404 sans
  //    exception, quelle que soit l'IP.
  const isHoneypot = HONEYPOT_PATHS.some(
    (p) => pathLower === p.toLowerCase() || pathLower.startsWith(p.toLowerCase() + "/")
  );
  if (isHoneypot) {
    console.warn(`[BotGuard] 🍯 Honeypot touché: ${rawPath}`);
    if (!isLoopback) {
      const durationMs = 48 * 60 * 60 * 1000;
      const until = Date.now() + durationMs;
      bannedIPs.set(ip, until);
      persistBan(ip, until, rawPath).catch(() => {});
    }
    sendClean404(res);
    return;
  }

  // 2. IP déjà bannie (sauf loopback) — retourne 404 (silencieux) plutôt que 403,
  //    pour ne pas révéler à l'attaquant que son IP est reconnue et bannie.
  //    Limité aux routes /api : les IP partagées (CGNAT, box 4G/LTE africaines)
  //    peuvent être bannies à cause du trafic d'un autre utilisateur sur la même IP.
  //    Bloquer aussi les pages HTML (ex: /pay/:slug) rendrait le site totalement
  //    inaccessible (écran noir) pour tous les autres clients légitimes derrière
  //    cette IP partagée. On garde donc la protection uniquement sur l'API.
  if (!isLoopback && rawPath.startsWith("/api") && isIpBanned(ip)) {
    sendClean404(res);
    return;
  }

  // 3. Patterns de chemins suspects (injection / traversal) → ban 24h + persist
  const isSuspiciousPath = SUSPICIOUS_PATH_PATTERNS.some((p) => p.test(rawPath));
  if (isSuspiciousPath) {
    console.warn(`[BotGuard] ⚠️ Chemin suspect: ${rawPath}`);
    if (!isLoopback) {
      const durationMs = 24 * 60 * 60 * 1000;
      const until = Date.now() + durationMs;
      bannedIPs.set(ip, until);
      persistBan(ip, until, rawPath).catch(() => {});
    }
    res.status(400).json({ message: "Requête invalide." });
    return;
  }

  // 4. Filtrage par User-Agent sur les routes API (sauf loopback)
  if (!isLoopback && rawPath.startsWith("/api")) {
    const isExempt = API_UA_EXEMPT_PATHS.some((p) => rawPath.startsWith(p));

    if (!isExempt) {
      // UA vide ou trop court → rejet sans ban (peut être un client légitime mal configuré)
      if (!ua || ua.trim().length < 10) {
        res.status(403).json({ message: "Accès refusé." });
        return;
      }

      // UA d'outil malveillant connu → rejet de CETTE requête uniquement (pas de ban IP).
      // Raison : sur les réseaux mobiles africains (CGNAT/LTE), des milliers d'utilisateurs
      // légitimes partagent la même IP publique. Bannir toute l'IP pour un UA suspect
      // bloquerait aussi tous les vrais utilisateurs derrière cette IP (login, paiement, etc.).
      // Chaque requête avec un mauvais UA est de toute façon rejetée individuellement ici,
      // donc un vrai bot reste bloqué à chaque tentative sans punir les autres.
      if (BAD_UA_PATTERNS.some((p) => p.test(uaLower))) {
        console.warn(`[BotGuard] 🤖 Requête bot rejetée (sans ban IP) UA="${ua.slice(0, 80)}"`);
        res.status(403).json({ message: "Accès refusé." });
        return;
      }
    }
  }

  next();
}
