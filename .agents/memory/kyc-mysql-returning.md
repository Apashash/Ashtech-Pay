---
name: MySQL KYC update readback
description: KYC mutations must not use PostgreSQL RETURNING when the application runs on MySQL/MariaDB.
---

KYC approval and rejection must use the MySQL update-then-readback path. Drizzle
`.returning()` is valid for PostgreSQL but fails for MySQL/MariaDB; retrying the
same call in a fallback still returns an internal server error.

**Why:** Plesk production uses MySQL/MariaDB while local development may use a
different database path, so PostgreSQL-only mutation code can pass checks and
fail only when an admin reviews KYC.

**How to apply:** Branch MySQL KYC updates through the shared update/readback
helper, including compatibility fallbacks for older schemas missing reviewer
columns. Keep `.returning()` only in the PostgreSQL branch.