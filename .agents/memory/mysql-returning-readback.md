---
name: MySQL mutation readbacks
description: Drizzle MySQL mutations do not support PostgreSQL-style returning results reliably.
---

Use explicit update/insert followed by a SELECT readback for MySQL storage methods that return the saved row; keep `.returning()` only in the PostgreSQL branch.

**Why:** Drizzle's MySQL driver returns a ResultSetHeader for mutations rather than the updated row, so `.returning()` can make a valid user action fail with a generic save error.

**How to apply:** When adding or repairing a MySQL-backed mutation that must return data, generate an ID for inserts when needed, execute the mutation, read by a stable key, and fail explicitly if the readback is missing.