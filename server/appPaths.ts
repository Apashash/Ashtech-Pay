import fs from "fs";
import path from "path";

/**
 * Resolve paths from the deployed application root rather than assuming that
 * Passenger's current working directory is the project directory.
 *
 * Plesk normally sets cwd correctly, but Passenger can start a Node process
 * with a different cwd depending on the subscription and startup settings.
 * The compiled entry point is dist/index.cjs, so its parent directory gives
 * us a stable project root in production. Development keeps process.cwd().
 */
function resolveAppRoot(): string {
  const cwd = process.cwd();
  const entry = process.argv[1] ? path.resolve(process.argv[1]) : "";
  const entryDir = entry ? path.dirname(entry) : "";
  const candidate = path.basename(entryDir) === "dist"
    ? path.resolve(entryDir, "..")
    : cwd;

  if (fs.existsSync(path.join(candidate, "package.json"))) {
    return candidate;
  }
  return cwd;
}

export const APP_ROOT = resolveAppRoot();

export function appPath(...segments: string[]): string {
  return path.join(APP_ROOT, ...segments);
}