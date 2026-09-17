---
name: Local MySQL workflow
description: Keep auxiliary local database startup isolated from the Replit web server port.
---

The local MariaDB process must use a dedicated database-port variable and must never assign or export `PORT`; Replit uses `PORT` for the application listener.

**Why:** Reusing `PORT` makes the database and Node server compete for the same port and can produce misleading `EADDRINUSE` startup failures.

**How to apply:** When a workflow launches both a local database and the web app, keep the database lifecycle in a helper script, preserve the workflow-provided `PORT`, and pass the database URL explicitly to the app.