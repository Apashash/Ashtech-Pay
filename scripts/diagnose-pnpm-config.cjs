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

const packageJsonPath = path.join(cwd, "package.json");
if (fs.existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  console.log(`packageManager field: ${packageJson.packageManager || "not set"}`);
}

const commands = [
  { label: "pnpm version", args: ["--version"] },
  { label: "onlyBuiltDependencies", args: ["config", "get", "onlyBuiltDependencies", "--json"] },
  { label: "ignoredBuiltDependencies", args: ["config", "get", "ignoredBuiltDependencies", "--json"] },
  { label: "strictDepBuilds", args: ["config", "get", "strictDepBuilds", "--json"] },
  { label: "ignoreScripts", args: ["config", "get", "ignoreScripts", "--json"] },
];

for (const { label, args } of commands) {
  const result = spawnSync("pnpm", args, { cwd, encoding: "utf8" });
  const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
  const detail =
    result.error?.message ||
    output ||
    (result.status === 0 ? "(unset)" : `exit ${result.status}`);

  console.log(`${label}: ${detail}`);
}