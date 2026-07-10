import express, { type Express } from "express";
import fs from "fs";
import path from "path";

// Persisted on disk so the *server itself* remembers the last known-good
// VITE_ADMIN_PATH even if Passenger fails to pass the env var to process.env
// on a later restart. This protects EVERY client (not just browsers that
// already have it in localStorage) — first-time visits, incognito, cleared
// cache, etc. would otherwise silently fall back to "/admin".
const ADMIN_PATH_CACHE_FILE = path.resolve(process.cwd(), "uploads", ".admin-path-cache");

function resolveAdminPath(): string {
  const envValue = process.env.VITE_ADMIN_PATH;
  if (envValue && envValue !== "/admin") {
    try {
      fs.mkdirSync(path.dirname(ADMIN_PATH_CACHE_FILE), { recursive: true });
      fs.writeFileSync(ADMIN_PATH_CACHE_FILE, envValue, "utf-8");
    } catch (err) {
      console.error("[AdminPath] Impossible d'écrire le cache disque:", (err as Error).message);
    }
    return envValue;
  }

  console.error(
    "[AdminPath] ⚠️ VITE_ADMIN_PATH absent de process.env (Passenger ne l'a probablement pas transmis)."
  );
  try {
    const cached = fs.readFileSync(ADMIN_PATH_CACHE_FILE, "utf-8").trim();
    if (cached && cached !== "/admin" && cached.startsWith("/") && !cached.includes("://")) {
      console.error(`[AdminPath] Utilisation de la dernière valeur connue en cache disque: ${cached}`);
      return cached;
    }
  } catch {
    // No cache file yet — first ever start with a broken env var.
  }

  console.error("[AdminPath] ❌ Aucun cache disque disponible — repli sur \"/admin\" (INSÉCURISÉ).");
  return "/admin";
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(process.cwd(), "dist", "public");
  if (!fs.existsSync(distPath)) {
    // Log the error clearly but DO NOT throw — throwing here crashes the entire process
    // under Phusion Passenger, showing a red "could not be started" error page.
    // Instead, serve a maintenance response on all routes so the process stays alive.
    console.error(
      `[Static] CRITICAL: Build directory not found: ${distPath}. Run "npm run build" before starting in production.`
    );
    app.use("*", (_req, res) => {
      // Explicit Content-Type prevents Safari from downloading the response as a
      // file (document.txt) when no MIME type can be inferred from the URL.
      res.status(503).set("Content-Type", "text/html; charset=utf-8").send(
        "<!DOCTYPE html><html><head><meta charset='UTF-8'><title>Maintenance</title></head>" +
        "<body>Service en maintenance. Veuillez réessayer dans quelques instants.</body></html>"
      );
    });
    return;
  }

  app.use(express.static(distPath));

  const adminPath = resolveAdminPath();
  const adminInjection = `<script>window.__ADMIN_PATH__="${adminPath}"</script>`;

  // Auth-flow pages outside the secret admin prefix that still need
  // the admin path so post-OTP redirects go to the correct URL.
  const ADMIN_AUTH_PATHS = ["/admin-login-otp", "/admin-panel-verify"];

  /**
   * Returns true when the request should receive the admin-path injection.
   *
   * Uses req.originalUrl (query-stripped) instead of req.path because
   * app.use("*") in Express sets req.path to "/" rather than the full path.
   * Boundary-safe: exact match or "<adminPath>/" prefix so "/secret-other"
   * never matches admin path "/secret".
   */
  function isAdminRequest(originalUrl: string): boolean {
    const p = originalUrl.split("?")[0];
    return (
      p === adminPath ||
      p.startsWith(adminPath + "/") ||
      ADMIN_AUTH_PATHS.some(a => p === a || p.startsWith(a + "/"))
    );
  }

  // Serve payment pages without og:image so sharing shows no preview image
  app.get(["/pay/:slug", "/hpay/:id"], (req, res) => {
    const indexPath = path.resolve(distPath, "index.html");
    let html = fs.readFileSync(indexPath, "utf-8");
    if (isAdminRequest(req.originalUrl)) {
      html = html.replace("</head>", `${adminInjection}</head>`);
    }
    html = html
      .replace(/<meta property="og:image"[^>]*>/g, "")
      .replace(/<meta property="og:image:[^"]*"[^>]*>/g, "")
      .replace(/<meta name="twitter:image"[^>]*>/g, "")
      .replace(/<meta name="twitter:card"[^>]*>/g, '<meta name="twitter:card" content="summary" />');
    res.set("Content-Type", "text/html").send(html);
  });

  // fall through to index.html — injecte window.__ADMIN_PATH__ sur TOUTES les pages.
  // Nécessaire car Apache (.htaccess) renvoie vers Node.js via passthrough ; si on
  // n'injectait que sur les pages admin, un refresh sur /dashboard ou / effacerait
  // la valeur en localStorage et le prochain chargement d'une page admin échouerait.
  app.use("*", (req, res) => {
    const indexPath = path.resolve(distPath, "index.html");
    let html = fs.readFileSync(indexPath, "utf-8");
    html = html.replace("</head>", `${adminInjection}</head>`);
    res.set("Content-Type", "text/html").send(html);
  });
}
