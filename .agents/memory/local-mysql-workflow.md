---
name: Local MySQL workflow
description: Keep auxiliary local database startup isolated from the Replit web server port.
---

The local MariaDB process must use a dedicated database-port variable and must never assign or export `PORT`; Replit uses `PORT` for the application listener.

**Why:** Reusing `PORT` makes the database and Node server compete for the same port and can produce misleading `EADDRINUSE` startup failures.

**How to apply:** When a workflow launches both a local database and the web app, keep the database lifecycle in a helper script, preserve the workflow-provided `PORT`, and pass the database URL explicitly to the app.

Imported workspaces may not contain the private schema export used by production-like local imports. Local startup must prefer that export when present, otherwise apply the tracked MySQL schema and verify the expected table set before marking initialization complete.

**Why:** The ignored export is not part of a fresh repository import; treating it as mandatory makes both workflows exit before the web listener opens and produces a preview 502.

**How to apply:** Keep the fallback development-only and protect parallel database/app startup with a schema lock; do not weaken production migration safeguards.