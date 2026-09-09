import fs from "fs";
import path from "path";
import { appPath } from "./appPaths";

// ── Logger avec rotation quotidienne ─────────────────────────────────────────
// En dev  : forwarde vers console (comportement identique à avant)
// En prod : écrit dans logs/YYYY-MM-DD.log, rotation quotidienne, 7 jours max
//
// Redaction automatique en production :
//   - Adresses IP  (IPv4 + IPv6)
//   - Adresses email
//   - Numéros de téléphone (formats internationaux)
// ─────────────────────────────────────────────────────────────────────────────

const isProd = process.env.NODE_ENV === "production";
const LOGS_DIR = appPath("logs");
const MAX_DAYS = 7;

// ── Patterns de redaction ─────────────────────────────────────────────────────
const REDACT_PATTERNS: Array<[RegExp, string]> = [
  // IPv4
  [/\b(\d{1,3}\.){3}\d{1,3}\b/g, "[ip]"],
  // IPv6 (simplified)
  [/\b([0-9a-fA-F]{1,4}:){3,7}[0-9a-fA-F]{1,4}\b/g, "[ip6]"],
  // Email
  [/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, "[email]"],
  // Phone numbers: +237 6XX XX XX XX / 00237... / 6XX XX XX XX
  [/(?:\+|00)[1-9]\d{6,14}/g, "[phone]"],
  [/\b[6-9]\d{8}\b/g, "[phone]"],
];

function redact(text: string): string {
  let out = text;
  for (const [pattern, replacement] of REDACT_PATTERNS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

// ── Rotation et nettoyage ─────────────────────────────────────────────────────
function getLogFilePath(): string {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return path.join(LOGS_DIR, `${date}.log`);
}

function purgeOldLogs() {
  try {
    if (!fs.existsSync(LOGS_DIR)) return;
    const files = fs.readdirSync(LOGS_DIR)
      .filter(f => /^\d{4}-\d{2}-\d{2}\.log$/.test(f))
      .sort();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - MAX_DAYS);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    for (const f of files) {
      const dateStr = f.replace(".log", "");
      if (dateStr < cutoffStr) {
        fs.unlinkSync(path.join(LOGS_DIR, f));
      }
    }
  } catch {
    // non-fatal
  }
}

// ── Écriture ──────────────────────────────────────────────────────────────────
let _currentDay = "";
let _stream: fs.WriteStream | null = null;

function getStream(): fs.WriteStream {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== _currentDay || !_stream) {
    if (_stream) {
      try { _stream.end(); } catch { /* ignore */ }
    }
    if (!fs.existsSync(LOGS_DIR)) {
      fs.mkdirSync(LOGS_DIR, { recursive: true });
    }
    _stream = fs.createWriteStream(getLogFilePath(), { flags: "a", encoding: "utf-8" });
    _currentDay = today;
    // Purge old logs on day rollover
    purgeOldLogs();
  }
  return _stream;
}

function writeLog(level: string, args: unknown[]) {
  const timestamp = new Date().toISOString();
  const raw = args.map(a =>
    a instanceof Error ? `${a.message}\n${a.stack ?? ""}` :
    typeof a === "object" ? JSON.stringify(a) : String(a)
  ).join(" ");
  const line = redact(`[${timestamp}] [${level}] ${raw}\n`);
  try {
    getStream().write(line);
  } catch {
    // If file write fails, fall back silently — don't crash the server
  }
}

// ── Remplacement des méthodes console en production ──────────────────────────
export function installProductionLogger() {
  if (!isProd) return; // dev: laisse console intact

  const _origLog   = console.log.bind(console);
  const _origInfo  = console.info.bind(console);
  const _origWarn  = console.warn.bind(console);
  const _origError = console.error.bind(console);

  console.log = (...args: unknown[]) => {
    writeLog("INFO", args);
    // Suppress stdout in prod — logs go to file only
  };
  console.info = (...args: unknown[]) => {
    writeLog("INFO", args);
  };
  console.warn = (...args: unknown[]) => {
    writeLog("WARN", args);
    // Warnings also go to stderr so Passenger/PM2 catches them
    _origWarn(...args);
  };
  console.error = (...args: unknown[]) => {
    writeLog("ERROR", args);
    _origError(...args);
  };

  // Initial purge on startup
  purgeOldLogs();

  // Daily rotation check — runs every hour, lightweight
  setInterval(() => {
    const today = new Date().toISOString().slice(0, 10);
    if (today !== _currentDay) {
      getStream(); // triggers day rollover + purge
    }
  }, 60 * 60 * 1000).unref();

  _origLog(`[Logger] Production logger actif — logs dans ${LOGS_DIR} (rotation ${MAX_DAYS}j, redaction PII)`);
}
