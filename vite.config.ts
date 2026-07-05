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
        manualChunks: {
          "vendor-react": ["react", "react-dom"],
          "vendor-query": ["@tanstack/react-query"],
          "vendor-ui": ["@radix-ui/react-dialog", "@radix-ui/react-dropdown-menu", "@radix-ui/react-select", "@radix-ui/react-tabs", "@radix-ui/react-toast"],
          "vendor-form": ["react-hook-form", "zod", "@hookform/resolvers"],
          "vendor-charts": ["recharts"],
          "vendor-misc": ["date-fns", "wouter", "lucide-react"],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
  server: {
    allowedHosts: true,
    fs: {
      strict: true,
      // Deny dot-files, config files, and source manifests.
      // Express middleware also blocks these first (returning 404 not 403),
      // but this is a second-layer defence in case a request slips through.
      deny: ["**/.*", "**/package.json", "**/package-lock.json", "**/*.config.ts", "**/*.config.js"],
    },
  },
});
