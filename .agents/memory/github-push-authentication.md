---
name: GitHub push authentication
description: Reliable way to publish commits when the local HTTPS remote cannot authenticate.
---

When a shell `git push` to an HTTPS GitHub remote fails with invalid or missing credentials, use Replit's managed GitHub push integration rather than requesting, displaying, or manually handling a token.

**Why:** The workspace may have a valid connected GitHub account even when the shell credential helper is unavailable or stale.

**How to apply:** Verify the local commit first, then call the managed GitHub push operation for the target branch and confirm the remote commit afterward.