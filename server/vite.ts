import { type Express } from "express";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";
import { isSpaRoute } from "./spaRoutes";
import { renderPaymentLinkMeta, type PaymentLinkMeta } from "./paymentLinkMeta";
import { storage } from "./storage";

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

  app.use(vite.middlewares);

  // Inject product-specific metadata before social crawlers receive the SPA shell.
  app.get(["/pay/:slug", "/hpay/:id"], async (req, res, next) => {
    try {
      const clientTemplate = path.resolve(import.meta.dirname, "..", "client", "index.html");
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(`src="/src/main.tsx"`, `src="/src/main.tsx?v=${nanoid()}"`);
      let isExpiredPaymentLink = false;
      if (req.path.startsWith("/pay/")) {
        const paymentLink = await storage.getPaymentLinkBySlug(req.params.slug);
        isExpiredPaymentLink = Boolean(
          paymentLink?.expiresAt && new Date(paymentLink.expiresAt) < new Date(),
        );
        template = await renderPaymentLinkMeta(
          req,
          template,
          req.params.slug,
          paymentLink as PaymentLinkMeta | undefined,
        );
      }
      const page = await vite.transformIndexHtml(req.originalUrl, template);
      res.status(isExpiredPaymentLink ? 410 : 200).set({ "Content-Type": "text/html" }).end(page);
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
