---
name: Transient startup errors
description: Startup API gating and lazy page chunks can expose temporary errors during restarts or mobile network interruptions.
---

The application must treat database startup failures and dynamically imported page failures as recoverable conditions, not permanent client crashes.

**Why:** The server can open its port before MySQL is reachable, while the browser can request a lazy chunk during a deploy or brief mobile interruption. A single failed attempt otherwise leaves API requests at 503 or shows the fatal error screen until a manual reload/restart.

**How to apply:** Keep MySQL bootstrap retries alive with capped backoff, retry transient 5xx/network queries briefly in the client, and allow one automatic reload for identifiable dynamic-import chunk errors while retaining the visible fallback for genuine runtime errors.

The public ping endpoint exposes two separate readiness concepts: `ready` means the Node listener is available, while `migrations_ready` means database-backed APIs can accept requests.

**Why:** The listener intentionally opens before MySQL bootstrap to avoid Passenger timeouts. Treating `ready` alone as application readiness enables login or registration during the 503 migration gate.

**How to apply:** Auth and other database-backed entry points must require both flags, and should keep checking the ping endpoint until both are true.

Safe no-database public endpoints may bypass the migration gate so the shell can initialize quickly, but authentication, countries, payments, and private data must remain gated.

**Why:** Node can serve country-independent bootstrap data in milliseconds while MySQL is warming up, without exposing an API that could read or mutate incomplete database state.

**How to apply:** Keep the startup allowlist explicit and small; never make the entire `/api/public` namespace available during a database outage.