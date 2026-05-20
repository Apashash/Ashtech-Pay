import type { Request, Response, NextFunction } from "express";

// ─── In-memory IP ban store ────────────────────────────────────────────────
// Map<ip, unbanTimestamp (ms)>
const bannedIPs = new Map<string, number>();

// Nettoyage automatique des bans expirés toutes les heures
setInterval(() => {
  const now = Date.now();
  for (const [ip, until] of bannedIPs) {
    if (now > until) bannedIPs.delete(ip);
  }
}, 60 * 60 * 1000);

// ─── Helper: IP réelle derrière proxy ─────────────────────────────────────
function getIp(req: Request): string {
  const fwd = req.headers["x-forwarded-for"];
  if (fwd) {
    const raw = Array.isArray(fwd) ? fwd[0] : fwd;
    return raw.split(",")[0].trim();
  }
  return req.ip || "unknown";
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
  "/.git",
  "/.svn",
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
  "/.DS_Store",
  "/backup.zip",
  "/backup.sql",
  "/dump.sql",
  "/db.sql",
  "/database.sql",
  "/site.tar.gz",
  "/wwwroot.zip",
  "/sftp-config.json",
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
  "/api/swychr/webhook",
  "/api/afribapay/webhook",
  "/api/pixpay/webhook",
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
  bannedIPs.set(ip, Date.now() + durationMs);
  console.warn(`[BotGuard] 🔴 IP bannie: ${ip} pour ${Math.round(durationMs / 3600000)}h`);
}

export function isIpBanned(ip: string): boolean {
  const until = bannedIPs.get(ip);
  if (!until) return false;
  if (Date.now() > until) {
    bannedIPs.delete(ip);
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

  // 1. IP déjà bannie (sauf loopback)
  if (!isLoopback && isIpBanned(ip)) {
    res.status(403).json({ message: "Accès refusé." });
    return;
  }

  // 2. Honeypot trap — ban 48h immédiat (sauf loopback)
  const isHoneypot = HONEYPOT_PATHS.some(
    (p) => pathLower === p.toLowerCase() || pathLower.startsWith(p.toLowerCase() + "/")
  );
  if (isHoneypot) {
    if (!isLoopback) banIp(ip, 48 * 60 * 60 * 1000);
    console.warn(`[BotGuard] 🍯 Honeypot touché: ${ip} → ${rawPath}`);
    res.status(404).send("Not Found");
    return;
  }

  // 3. Patterns de chemins suspects (injection / traversal) → ban 24h
  const isSuspiciousPath = SUSPICIOUS_PATH_PATTERNS.some((p) => p.test(rawPath));
  if (isSuspiciousPath) {
    if (!isLoopback) banIp(ip, 24 * 60 * 60 * 1000);
    console.warn(`[BotGuard] ⚠️ Chemin suspect: ${ip} → ${rawPath}`);
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

      // UA d'outil malveillant connu → ban 12h
      if (BAD_UA_PATTERNS.some((p) => p.test(uaLower))) {
        banIp(ip, 12 * 60 * 60 * 1000);
        console.warn(`[BotGuard] 🤖 Bot bloqué: ${ip} UA="${ua.slice(0, 80)}"`);
        res.status(403).json({ message: "Accès refusé." });
        return;
      }
    }
  }

  next();
}
