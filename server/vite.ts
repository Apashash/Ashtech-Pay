import { type Express } from "express";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";
import { isSpaRoute } from "./spaRoutes";
import { renderPaymentLinkMeta } from "./paymentLinkMeta";

const viteLogger = createLogger();

export async function setupVite(server: Server, app: Express) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server, path: "/vite-hmr" },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  // Vite serves files from client/public directly. Handle the merchant SDK
  // explicitly so Helmet's default same-origin CORP policy does not block a
  // cross-origin <script> on a merchant website during development.
  app.get("/ashtechpay-checkout.js", async (_req, res, next) => {
    try {
      const sdkPath = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "public",
        "ashtechpay-checkout.js",
      );
      const sdk = await fs.promises.readFile(sdkPath, "utf-8");
      res
        .set("Content-Type", "text/javascript")
        .set("Cross-Origin-Resource-Policy", "cross-origin")
        .set("Access-Control-Allow-Origin", "*")
        .send(sdk);
    } catch (error) {
      next(error);
    }
  });

  app.use(vite.middlewares);

  // Inject product-specific metadata before social crawlers receive the SPA shell.
  app.get(["/pay/:slug", "/hpay/:id"], async (req, res, next) => {
    try {
      const clientTemplate = path.resolve(import.meta.dirname, "..", "client", "index.html");
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      const isEmbeddedCheckout = req.query.embed === "1";
      template = template.replace(`src="/src/main.tsx"`, `src="/src/main.tsx?v=${nanoid()}"`);
      if (req.path.startsWith("/pay/")) {
        template = await renderPaymentLinkMeta(req, template, req.params.slug);
      }
      const page = await vite.transformIndexHtml(req.originalUrl, template);
      if (isEmbeddedCheckout) {
        res.removeHeader("X-Frame-Options");
        res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
        const currentCsp = res.getHeader("Content-Security-Policy");
        if (typeof currentCsp === "string" && currentCsp.trim()) {
          const withoutFrameAncestors = currentCsp
            .replace(/(?:^|;)frame-ancestors[^;]*/i, "")
            .replace(/;;+/g, ";")
            .replace(/^;|;$/g, "");
          res.setHeader(
            "Content-Security-Policy",
            `${withoutFrameAncestors};frame-ancestors *`,
          );
        } else {
          res.setHeader("Content-Security-Policy", "frame-ancestors *");
        }
      }
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });

  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      // Le statut est déjà posé par le middleware spaRoute dans index.ts (404
      // pour chemins inconnus, 200 pour vraies routes). On préserve ce statut.
      res.set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}
