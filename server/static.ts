import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { isSpaRoute } from "./spaRoutes";
import { renderPaymentLinkMeta } from "./paymentLinkMeta";
import { appPath } from "./appPaths";

export function serveStatic(app: Express) {
  const distPath = appPath("dist", "public");
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
  app.use(express.static(distPath, {
    index: false,
    maxAge: "1d",
    setHeaders: (res, filePath) => {
      // Vite fingerprints bundled assets, so they can be cached aggressively.
      // Keep the HTML shell short-lived so deployments become visible quickly.
      if (filePath.includes(`${path.sep}assets${path.sep}`)) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      } else if (path.basename(filePath).toLowerCase() === "index.html") {
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
      }
      if (path.basename(filePath).toLowerCase() === "ashtechpay-checkout.js") {
        // This is the only public cross-origin SDK asset. Without this
        // override Helmet's same-origin CORP header blocks merchant sites
        // from loading the script.
        res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
        res.setHeader("Access-Control-Allow-Origin", "*");
      }
    },
  }));

  // Inject the payment product title/description/image before social crawlers
  // receive the SPA shell.
  app.get(["/pay/:slug", "/hpay/:id"], async (req, res, next) => {
    const indexPath = path.resolve(distPath, "index.html");
    try {
      let html = await fs.promises.readFile(indexPath, "utf-8");
      const isEmbeddedCheckout = req.query.embed === "1";
      if (req.path.startsWith("/pay/")) {
        html = await renderPaymentLinkMeta(req, html, req.params.slug);
      }
      const response = res
        .set("Content-Type", "text/html")
        .set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        .set("Pragma", "no-cache")
        .set("Expires", "0");

      // Direct payment pages remain protected from framing. The explicit
      // embed=1 mode is used by the public checkout SDK and contains no
      // authenticated dashboard content.
      if (isEmbeddedCheckout) {
        response.removeHeader("X-Frame-Options");
        response.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
        const currentCsp = response.getHeader("Content-Security-Policy");
        if (typeof currentCsp === "string" && currentCsp.trim()) {
          const withoutFrameAncestors = currentCsp
            .replace(/(?:^|;)frame-ancestors[^;]*/i, "")
            .replace(/;;+/g, ";")
            .replace(/^;|;$/g, "");
          response.setHeader(
            "Content-Security-Policy",
            `${withoutFrameAncestors};frame-ancestors *`,
          );
        } else {
          response.setHeader("Content-Security-Policy", "frame-ancestors *");
        }
      }

      response.send(html);
    } catch (error) {
      next(error);
    }
  });

  // fall through to index.html (SPA)
  // Le statut est déjà posé par le middleware spaRoute dans index.ts (404 pour
  // chemins inconnus, 200 pour les vraies routes). On se contente de servir
  // index.html sans modifier le code retour.
  app.use("*", (_req, res) => {
    const indexPath = path.resolve(distPath, "index.html");
    res
      .set("Content-Type", "text/html")
      .set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
      .set("Pragma", "no-cache")
      .set("Expires", "0")
      .sendFile(indexPath);
  });
}
