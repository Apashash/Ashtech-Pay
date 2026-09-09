#!/usr/bin/env node
/**
 * verify-deploy.mjs
 * Checks env vars and verifies /api/public/turnstile-key after deploy.
 * Run: node script/verify-deploy.mjs
 */

const BOLD  = "\x1b[1m";
const GREEN = "\x1b[32m";
const RED   = "\x1b[31m";
const YELLOW= "\x1b[33m";
const CYAN  = "\x1b[36m";
const RESET = "\x1b[0m";

const ok  = (msg) => console.log(`${GREEN}  ✓${RESET} ${msg}`);
const err = (msg) => console.log(`${RED}  ✗${RESET} ${msg}`);
const warn= (msg) => console.log(`${YELLOW}  ⚠${RESET} ${msg}`);
const info= (msg) => console.log(`${CYAN}  →${RESET} ${msg}`);

const REQUIRED = [
  {
    keys: ["SUPABASE_DB_URL", "SUPABASE_DATABASE_URL", "DATABASE_URL"],
    label: "Base de données",
    critical: true,
  },
  { key: "SESSION_SECRET",        label: "Session secret",            critical: true  },
  { key: "TURNSTILE_SITE_KEY",    label: "Turnstile clé publique",    critical: false },
  { key: "TURNSTILE_SECRET_KEY",  label: "Turnstile clé secrète",     critical: false },
  { key: "APP_URL",               label: "URL de l'application",      critical: false },
  { key: "TELEGRAM_BOT_TOKEN",    label: "Telegram bot token",        critical: false },
  { key: "TELEGRAM_CHAT_ID",      label: "Telegram chat ID",          critical: false },
  { key: "RESEND_API_KEY",        label: "Resend (email)",            critical: false },
  { key: "SUPABASE_URL",          label: "Supabase URL",              critical: false },
  { key: "SUPABASE_SERVICE_ROLE_KEY", label: "Supabase service key", critical: false },
  { key: "PIXPAY_API_KEY_XAF",    label: "PixPay XAF",               critical: false },
];

console.log(`\n${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}`);
console.log(`${BOLD}  Ashtech Pay — Vérification de déploiement${RESET}`);
console.log(`${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}\n`);

let missingCritical = 0;
let missingOptional = 0;

console.log(`${BOLD}Variables d'environnement :${RESET}`);
for (const requirement of REQUIRED) {
  const { label, critical } = requirement;
  const keys = requirement.keys || [requirement.key];
  const configuredKey = keys.find((key) => process.env[key]);
  const val = configuredKey ? process.env[configuredKey] : undefined;
  if (val) {
    ok(`${label.padEnd(30)} ${CYAN}[${configuredKey}]${RESET} → configurée`);
  } else if (critical) {
    err(`${label.padEnd(30)} ${CYAN}[${keys.join(" / ")}]${RESET} → MANQUANTE (critique)`);
    missingCritical++;
  } else {
    warn(`${label.padEnd(30)} ${CYAN}[${keys.join(" / ")}]${RESET} → non configurée`);
    missingOptional++;
  }
}

// --- HTTP check on /api/public/turnstile-key ---
console.log(`\n${BOLD}Vérification endpoint Turnstile :${RESET}`);
const port = process.env.PORT || "5000";
const baseUrl = process.env.APP_URL || `http://localhost:${port}`;

try {
  const url = `${baseUrl}/api/public/turnstile-key`;
  info(`GET ${url}`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  const res = await fetch(url, { signal: controller.signal });
  clearTimeout(timeout);

  if (res.ok) {
    const data = await res.json();
    if (data.siteKey) {
      ok(`Endpoint répond — siteKey: ${data.siteKey.slice(0, 10)}…`);
    } else {
      warn("Endpoint répond mais siteKey est vide — TURNSTILE_SITE_KEY absent du serveur");
    }
  } else {
    warn(`Endpoint a répondu avec le statut HTTP ${res.status}`);
  }
} catch (e) {
  if (e.name === "AbortError") {
    warn("Serveur non joignable (timeout 5s) — vérification ignorée");
  } else {
    warn(`Serveur non démarré ou inaccessible — vérification ignorée (${e.message})`);
  }
}

// --- Summary ---
console.log(`\n${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}`);
if (missingCritical > 0) {
  console.log(`${RED}${BOLD}  ÉCHEC — ${missingCritical} variable(s) critique(s) manquante(s)${RESET}`);
  console.log(`  Ajoute-les dans Plesk → Node.js → Variables d'environnement\n`);
  process.exit(1);
} else if (missingOptional > 0) {
  console.log(`${YELLOW}${BOLD}  AVERTISSEMENT — ${missingOptional} variable(s) optionnelle(s) manquante(s)${RESET}`);
  console.log(`  Le déploiement est OK mais certaines fonctionnalités seront désactivées.\n`);
  process.exit(0);
} else {
  console.log(`${GREEN}${BOLD}  SUCCÈS — Toutes les variables sont configurées !${RESET}\n`);
  process.exit(0);
}
