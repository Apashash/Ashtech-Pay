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
      res.status(503).send(
        "Service en maintenance. Veuillez réessayer dans quelques instants. (Build manquant)"
      );
    });
    return;
  }

  app.use(express.static(distPath));

  const adminPath = process.env.VITE_ADMIN_PATH || "/admin";
  const adminInjection = `<script>window.__ADMIN_PATH__="${adminPath}"</script>`;

  function injectAdminPath(html: string): string {
    return html.replace("</head>", `${adminInjection}</head>`);
  }

  // Serve payment pages without og:image so sharing shows no preview image
  app.get(["/pay/:slug", "/hpay/:id"], (_req, res) => {
    const indexPath = path.resolve(distPath, "index.html");
    let html = fs.readFileSync(indexPath, "utf-8");
    html = injectAdminPath(html)
      .replace(/<meta property="og:image"[^>]*>/g, "")
      .replace(/<meta property="og:image:[^"]*"[^>]*>/g, "")
      .replace(/<meta name="twitter:image"[^>]*>/g, "")
      .replace(/<meta name="twitter:card"[^>]*>/g, '<meta name="twitter:card" content="summary" />');
    res.set("Content-Type", "text/html").send(html);
  });

  // fall through to index.html — inject admin path at runtime
  app.use("*", (_req, res) => {
    const indexPath = path.resolve(distPath, "index.html");
    const html = injectAdminPath(fs.readFileSync(indexPath, "utf-8"));
    res.set("Content-Type", "text/html").send(html);
  });
}
