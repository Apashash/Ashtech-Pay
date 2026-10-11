---
name: Isolated PostgreSQL tests
description: Running PostgreSQL compatibility checks without replacing the app's MySQL database.
---
Use a separate temporary PostgreSQL instance and an explicitly writable temporary socket directory for PostgreSQL compatibility tests.

**Why:** The installed PostgreSQL runtime defaults to a socket directory that may be absent. A test server can open its TCP port and still fail to start when creating that socket's lock file.

**How to apply:** Use a distinct port and temporary data/socket directories, target only that database in the test process, and stop/remove the temporary instance afterward. Do not change the application's configured database or project secrets.
