---
name: Replit package firewall misses patched tarballs
description: Handle package update failures when the managed registry cannot serve a safe patched version.
---

If `installLanguagePackages` receives a 404 for a package tarball from Replit's package firewall, do not force a public registry or hand-edit lockfile URLs/integrity to simulate a successful install. Check the latest compatible release and retry through the managed installer; if it remains unavailable, leave the dependency and lockfiles unchanged and report the blocker. In mixed npm/pnpm workspaces, the managed installer may use npm and follow `package-lock.json`; a safe version present in `pnpm-lock.yaml` does not prove its tarball is available through Replit's npm firewall.

When the installer reports a critical block, distinguish the exact denied tarball from other `npm audit` findings. Audit the lockfile independently, but do not assume fixing a separate advisory will unblock the denied package.

**Why:** Replit's package firewall is a security boundary. A version published on npm is not necessarily available through the managed installer, and downloading it by another route would bypass that boundary.

**How to apply:** Use this for dependency remediation. Check package metadata, lockfiles, the exact installer error, and the audit report separately. Identify which lockfile the managed installer actually uses. Do not transplant resolutions between lockfiles to get around an unavailable tarball. Distinguish the firewall rule from `.npmrc` settings used for installs on external hosts such as Plesk.
