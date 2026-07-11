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

  // index:false empêche express.static de servir dist/public/index.html
  // automatiquement sur "/" (comportement par défaut d'Express), pour que
  // la route /pay et /hpay ci-dessous (sans og:image) puissent s'appliquer.
  app.use(express.static(distPath, { index: false }));

  // Serve payment pages without og:image so sharing shows no preview image
  app.get(["/pay/:slug", "/hpay/:id"], (req, res) => {
    const indexPath = path.resolve(distPath, "index.html");
    let html = fs.readFileSync(indexPath, "utf-8");
    html = html
      .replace(/<meta property="og:image"[^>]*>/g, "")
      .replace(/<meta property="og:image:[^"]*"[^>]*>/g, "")
      .replace(/<meta name="twitter:image"[^>]*>/g, "")
      .replace(/<meta name="twitter:card"[^>]*>/g, '<meta name="twitter:card" content="summary" />');
    res.set("Content-Type", "text/html").send(html);
  });

  // fall through to index.html (SPA)
  app.use("*", (_req, res) => {
    const indexPath = path.resolve(distPath, "index.html");
    res.set("Content-Type", "text/html").sendFile(indexPath);
  });
}
