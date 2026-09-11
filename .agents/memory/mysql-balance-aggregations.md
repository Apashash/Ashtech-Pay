---
name: MySQL balance aggregations
description: Dialect-specific SQL requirements for admin wallet totals and safe UI handling of aggregate failures.
---

Admin wallet and revenue aggregates must use MySQL-compatible numeric expressions when `DB_DIALECT=mysql`; PostgreSQL-only casts such as `::numeric` make the endpoint fail.

**Why:** The frontend previously converted a failed aggregate query into `0` through a falsy fallback, making a database error look like an empty platform balance.

**How to apply:** Use a dialect-aware cast for decimal sums and render an unavailable/error state when the aggregate request fails instead of presenting zero as authoritative.