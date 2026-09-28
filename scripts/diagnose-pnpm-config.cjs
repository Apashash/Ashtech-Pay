const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const cwd = process.cwd();
console.log("pnpm install diagnostics (no environment values are read)");
console.log(`cwd: ${cwd}`);
console.log(`node: ${process.version}`);

for (const file of ["package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml"]) {
  console.log(`${file}: ${fs.existsSync(path.join(cwd, file)) ? "present" : "missing"}`);
}

for (const args of [
  ["--version"],
  ["config", "get", "onlyBuiltDependencies", "--json"],
]) {
  const result = spawnSync("pnpm", args, { cwd, encoding: "utf8" });
  const label = args[0] === "--version" ? "pnpm version" : "approved build scripts";
  const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();

  console.log(`${label}: ${result.error?.message || output || `exit ${result.status}`}`);
}