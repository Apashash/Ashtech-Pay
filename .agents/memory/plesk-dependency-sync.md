---
name: Plesk dependency sync
description: How to interpret dependency errors that persist after the repository lockfile is fixed.
---

Plesk's NPM panel installs from its configured application root and branch, not directly from the Replit workspace. A dependency error that names a package removed from the current repository means Plesk is using a stale or different checkout, lockfile, or node_modules tree.

**Why:** The repository can have a clean lockfile while Plesk continues resolving an old transitive dependency from `/data/vhosts/.../httpdocs`.

**How to apply:** Verify the Plesk Git source, branch, application root, and last deployed revision before changing application code. Do not rely on a repository `preinstall` script to repair an `ENOTEMPTY` rename: npm may fail during node_modules reconciliation before lifecycle scripts run. The remote app root must receive the new package metadata and have its stale installation tree removed or replaced with a clean `npm ci`.

Plesk can also serve a mixed release: the browser may receive freshly uploaded `dist/public` assets while Passenger still runs an older `dist/index.cjs`. Validate a representative API behavior, not only the client bundle, before declaring production synchronized.

**Why:** The payment-link page showed the new client error text, but the live POST still followed the old server order and failed on the database insert before reaching the current provider validation.

**How to apply:** After every external deployment, compare a safe API response with the current server behavior and restart Passenger explicitly; bundle inspection alone is insufficient.