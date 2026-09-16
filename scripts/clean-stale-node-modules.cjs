const fs = require("node:fs");
const path = require("node:path");

const nodeModulesPath = path.join(process.cwd(), "node_modules");

if (!fs.existsSync(nodeModulesPath)) {
  process.exit(0);
}

for (const entry of fs.readdirSync(nodeModulesPath, { withFileTypes: true })) {
  const isLegacyGoogleDirectory =
    entry.name === "google-auth-library" ||
    entry.name.startsWith(".google-auth-library-");
  const isNpmInterruptedRename =
    entry.name.startsWith(".") &&
    entry.name !== ".bin" &&
    entry.name !== ".package-lock.json" &&
    /^\.[a-z0-9@][a-z0-9._-]*-[a-z0-9_-]{5,}$/i.test(entry.name);

  if (!isLegacyGoogleDirectory && !isNpmInterruptedRename) {
    continue;
  }

  const entryPath = path.join(nodeModulesPath, entry.name);
  fs.rmSync(entryPath, { recursive: true, force: true });
  console.log(`[preinstall] Removed stale npm directory ${entry.name}`);
}