import { type Express } from "express";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";

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

  // Serve payment pages without og:image so sharing shows no preview image
  app.get(["/pay/:slug", "/hpay/:id"], async (req, res, next) => {
    try {
      const clientTemplate = path.resolve(import.meta.dirname, "..", "client", "index.html");
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(`src="/src/main.tsx"`, `src="/src/main.tsx?v=${nanoid()}"`);
      // Remove og:image and twitter:image so no image preview appears on social share
      template = template
        .replace(/<meta property="og:image"[^>]*>/g, "")
        .replace(/<meta property="og:image:[^"]*"[^>]*>/g, "")
        .replace(/<meta name="twitter:image"[^>]*>/g, "")
        .replace(/<meta name="twitter:card"[^>]*>/g, '<meta name="twitter:card" content="summary" />');
      const page = await vite.transformIndexHtml(req.originalUrl, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });

  const adminPath = process.env.VITE_ADMIN_PATH || "/admin";
  const adminInjection = `<script>window.__ADMIN_PATH__="${adminPath}"</script>`;

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
      // Run Vite's HTML transforms first (plugins may rewrite the template).
      let page = await vite.transformIndexHtml(url, template);

      // Only inject the admin path on admin pages and admin auth-flow pages
      // (OTP/verify). Public pages must never receive this injection —
      // previously it was global, exposing the secret path to scanners.
      // Injected AFTER transformIndexHtml so Vite plugins cannot strip it.
      // Boundary-safe check: exact match or "adminPath/" prefix so a path
      // like "/secret-other" never matches admin path "/secret".
      // Use req.originalUrl (already captured as `url`) instead of req.path —
      // in app.use("*", ...) Express may set req.path to "/" rather than the
      // full request path. Strip the query string for clean comparison.
      const reqPathOnly = url.split("?")[0];
      const ADMIN_AUTH_PATHS = ["/admin-login-otp", "/admin-panel-verify"];
      const isAdminPage =
        reqPathOnly === adminPath ||
        reqPathOnly.startsWith(adminPath + "/") ||
        ADMIN_AUTH_PATHS.some(p => reqPathOnly === p || reqPathOnly.startsWith(p + "/"));
      if (isAdminPage) {
        page = page.replace("</head>", `${adminInjection}</head>`);
      }
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}
