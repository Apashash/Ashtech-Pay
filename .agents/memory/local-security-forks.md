---
name: Local dependency security forks
description: When to use locally maintained dependency fixes and pitfalls of npm local-file overrides.
---

Use a clearly identified local fork when a dependency advisory has no upstream
patched release; do not invent a fixed upstream version or merely rename
unmodified vulnerable source.

**Why:** A version-only update cannot resolve an advisory that affects the latest
published release. Recursion vulnerabilities can also be reached through direct
AST inputs, bypassing string parsing.

**How to apply:** Preserve the upstream license and public API, bound parsing
depth and validate caller-supplied ASTs without recursion. Test the actual
transitive consumers as well as the fork itself.

For npm local-directory dependencies, use `install-links=true` consistently in
the project's npm configuration and a direct file dependency referenced by
`$dependency` in overrides.

**Why:** npm 10 local-file overrides without packed installs can resolve relative
paths under transitive parents, leaving broken links; the chosen install-links
setting also affects npm's assessment of lockfile validity.

**How to apply:** Keep npm and pnpm locks synchronized, verify clean installs,
and do not preserve broken relative links from an earlier generated lock.

On Replit, post-merge npm installs must override `replace-registry-host` to
`npmjs` for that command while retaining the configured registry and the
Plesk `.npmrc` setting.

**Why:** `replace-registry-host=always` can rewrite a local `file:vendor/...`
dependency into an HTTP registry request, producing a misleading 404.

**How to apply:** Use `npm_config_replace_registry_host=npmjs` on the Replit
post-merge install command; do not rewrite lockfile URLs or bypass the registry.
