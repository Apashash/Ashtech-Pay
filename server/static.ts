import express, { type Express } from "express";
import fs from "fs";
import path from "path";

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

  const adminPath = process.env.VITE_ADMIN_PATH || "/admin";
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

  // fall through to index.html — only inject admin path on admin/auth-flow pages
  app.use("*", (req, res) => {
    const indexPath = path.resolve(distPath, "index.html");
    let html = fs.readFileSync(indexPath, "utf-8");
    if (isAdminRequest(req.originalUrl)) {
      html = html.replace("</head>", `${adminInjection}</head>`);
    }
    res.set("Content-Type", "text/html").send(html);
  });
}
