---
name: MySQL mutation readbacks
description: Drizzle MySQL mutations do not support PostgreSQL-style returning results reliably.
---

Use explicit update/insert followed by a SELECT readback for MySQL storage methods that return the saved row; keep `.returning()` only in the PostgreSQL branch.

**Why:** Drizzle's MySQL driver returns a ResultSetHeader for mutations rather than the updated row, so `.returning()` can make a valid user action fail with a generic save error.

**How to apply:** When adding or repairing a MySQL-backed mutation that must return data, generate an ID for inserts when needed, execute the mutation, read by a stable key, and fail explicitly if the readback is missing.

Keep PostgreSQL-only syntax and modules behind explicit dialect branches; placeholder normalization alone does not make JSON operators, casts, aggregates, date functions, `RETURNING`, or PostgreSQL watchdog code compatible with MySQL.

**Why:** The shared MySQL pool can translate `$1` placeholders, but it cannot translate PostgreSQL SQL grammar or PostgreSQL-specific runtime modules.

**How to apply:** For every runtime path reachable with `DB_DIALECT=mysql`, use MySQL JSON/date/aggregate syntax and load PostgreSQL watchdog/migration helpers only in PostgreSQL mode. Keep export and migration scripts available as explicit PostgreSQL tooling.