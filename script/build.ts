import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm } from "fs/promises";

// Modules natifs ou dev-only jamais utilisés au runtime Express — à exclure du bundle.
const EXTERNALS = [
  // Binaires natifs (.node)
  "sharp",
  "bufferutil",
  "utf-8-validate",
  "cpu-features",
  "ssh2",
  "canvas",
  // Modules CSS/build-time tirés par des dépendances transitives — inutiles au runtime
  "lightningcss",
  "@babel/core",
  "@babel/preset-typescript",
  "vite",
  "esbuild",
];

async function buildAll() {
  await rm("dist", { recursive: true, force: true });

  // Force production mode so Replit dev plugins are excluded from the client bundle
  process.env.NODE_ENV = "production";

  console.log("building client...");
  await viteBuild();

  console.log("building server...");
  await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/index.cjs",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    external: EXTERNALS,
    minify: true,
    logLevel: "info",
  });
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
