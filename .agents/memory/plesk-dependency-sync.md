---
name: Plesk dependency sync
description: How to interpret dependency errors that persist after the repository lockfile is fixed.
---

Plesk's NPM panel installs from its configured application root and branch, not directly from the Replit workspace. A dependency error that names a package removed from the current repository means Plesk is using a stale or different checkout, lockfile, or node_modules tree.

**Why:** The repository can have a clean lockfile while Plesk continues resolving an old transitive dependency from `/data/vhosts/.../httpdocs`.

**How to apply:** Verify the Plesk Git source, branch, application root, and last deployed revision before changing application code. Do not rely on a repository `preinstall` script to repair an `ENOTEMPTY` rename: npm may fail during node_modules reconciliation before lifecycle scripts run. The remote app root must receive the new package metadata and have its stale installation tree removed or replaced with a clean `npm ci`.