const fs = require("node:fs");
const path = require("node:path");

const nodeModulesPath = path.join(process.cwd(), "node_modules");

if (!fs.existsSync(nodeModulesPath)) {
  process.exit(0);
}

for (const entry of fs.readdirSync(nodeModulesPath, { withFileTypes: true })) {
  if (
    entry.name !== "google-auth-library" &&
    !entry.name.startsWith(".google-auth-library-")
  ) {
    continue;
  }

  const entryPath = path.join(nodeModulesPath, entry.name);
  fs.rmSync(entryPath, { recursive: true, force: true });
  console.log(`[preinstall] Removed stale ${entry.name}`);
}