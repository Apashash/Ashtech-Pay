import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm } from "fs/promises";

// Only native addons that cannot be bundled by esbuild stay external.
// Everything else (pure JS) is bundled into dist/index.cjs so the
// production server can run with just `node dist/index.cjs` — no
// `npm install` needed on the deployment host.
const NATIVE_EXTERNALS = [
  "sharp",
  "bufferutil",
  "utf-8-validate",
  "cpu-features",
  "ssh2",
  "canvas",
];

async function buildAll() {
  await rm("dist", { recursive: true, force: true });

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
    minify: true,
    external: NATIVE_EXTERNALS,
    logLevel: "info",
  });
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
