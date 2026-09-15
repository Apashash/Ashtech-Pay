---
name: Mintlify validation scope
description: Mintlify CLI validation from the mixed application root scans React source files as well as docs.
---

When Mintlify documentation lives beside the main application, root-level CLI
validation can report unresolved external and aliased React imports unrelated to
the MDX page. Treat JSON, MDX fence, link, and docs-only checks separately from
those application-wide warnings.

**Why:** The repository combines a Mintlify docs tree with a Vite/React
application, while Mintlify's validator assumes a docs-only source tree.

**How to apply:** Validate the documentation configuration and page structure
locally, and use a docs-only Mintlify workspace or the published docs site for
the final render verification.