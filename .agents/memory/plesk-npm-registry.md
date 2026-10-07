---
name: Plesk npm registry
description: Prevent Replit-internal package lock URLs from breaking dependency installation on external Plesk servers.
---

External Plesk installs can fail with ENOTFOUND for `package-firewall.replit.local` when package-lock was generated inside Replit. For Plesk, select `https://registry.npmjs.org/` and set `replace-registry-host=always` so internal lockfile URLs resolve through the public registry.

For a Replit-managed npm install, temporarily use `replace-registry-host=npmjs`. The managed registry already serves tarball URLs under its `/npm/` prefix; `always` can rewrite an already-internal URL and duplicate that prefix, causing a 404. Restore `always` after the managed install so Plesk continues to resolve internal lockfile URLs.

**Why:** Replit overrides the registry internally, while those hostnames are not resolvable from Cybrancee/Plesk. The two environments need different host-replacement behavior even though they share the lockfile.

**How to apply:** For Replit package installs, temporarily switch to `npmjs`, install only through the managed package installer, then restore `always` before committing or deploying to Plesk. Verify the project `.npmrc` is deployed with the app. Use Node 20.x or Node 22.12+; Node 21 is outside the supported engine ranges of the current toolchain.