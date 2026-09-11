---
name: Transient startup errors
description: Startup API gating and lazy page chunks can expose temporary errors during restarts or mobile network interruptions.
---

The application must treat database startup failures and dynamically imported page failures as recoverable conditions, not permanent client crashes.

**Why:** The server can open its port before MySQL is reachable, while the browser can request a lazy chunk during a deploy or brief mobile interruption. A single failed attempt otherwise leaves API requests at 503 or shows the fatal error screen until a manual reload/restart.

**How to apply:** Keep MySQL bootstrap retries alive with capped backoff, retry transient 5xx/network queries briefly in the client, and allow one automatic reload for identifiable dynamic-import chunk errors while retaining the visible fallback for genuine runtime errors.