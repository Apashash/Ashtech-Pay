import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // React core
          if (id.includes("node_modules/react/") || id.includes("node_modules/react-dom/")) {
            return "react";
          }
          // TanStack Query
          if (id.includes("node_modules/@tanstack/")) {
            return "tanstack";
          }
          // Radix UI primitives
          if (id.includes("node_modules/@radix-ui/")) {
            return "radix";
          }
          // Charts / heavy visualisation
          if (id.includes("node_modules/recharts") || id.includes("node_modules/d3-")) {
            return "charts";
          }
          // PDF / canvas (html2canvas, jspdf)
          if (id.includes("node_modules/html2canvas") || id.includes("node_modules/jspdf")) {
            return "pdf";
          }
          // DOMPurify
          if (id.includes("node_modules/dompurify")) {
            return "dompurify";
          }
          // date-fns
          if (id.includes("node_modules/date-fns")) {
            return "date-fns";
          }
          // zod + react-hook-form
          if (id.includes("node_modules/zod") || id.includes("node_modules/react-hook-form") || id.includes("node_modules/@hookform/")) {
            return "forms";
          }
          // lucide icons
          if (id.includes("node_modules/lucide-react")) {
            return "icons";
          }
          // everything else in node_modules → vendor
          if (id.includes("node_modules/")) {
            return "vendor";
          }
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
  server: {
    allowedHosts: true,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
