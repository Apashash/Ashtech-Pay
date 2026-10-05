---
name: Replit package firewall misses patched tarballs
description: Handle package update failures when the managed registry cannot serve a safe patched version.
---

If `installLanguagePackages` receives a 404 for a package tarball from Replit's package firewall, do not force a public registry or hand-edit lockfile URLs/integrity to simulate a successful install. Check the latest compatible release and retry through the managed installer; if it remains unavailable, leave the dependency and lockfiles unchanged and report the blocker.

**Why:** Replit's package firewall is a security boundary. A version published on npm is not necessarily available through the managed installer, and downloading it by another route would bypass that boundary.

**How to apply:** Use this for dependency remediation. Check both package metadata and the project's lockfiles, but distinguish the firewall rule from `.npmrc` settings used for installs on external hosts such as Plesk.
