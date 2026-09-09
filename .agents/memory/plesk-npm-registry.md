---
name: Plesk npm registry
description: Prevent Replit-internal package lock URLs from breaking dependency installation on external Plesk servers.
---

External Plesk installs can fail with ENOTFOUND for `package-firewall.replit.local` when package-lock was generated inside Replit. The project npm configuration must select `https://registry.npmjs.org/` and set `replace-registry-host=always` so npm resolves locked tarballs through the public registry.

**Why:** Replit may override the registry through environment variables internally, but those hostnames are not resolvable from Cybrancee/Plesk.

**How to apply:** Verify the project `.npmrc` is deployed with the app and run the install from the project root. Use Node 20.x or Node 22.12+; Node 21 is outside the supported engine ranges of the current toolchain.