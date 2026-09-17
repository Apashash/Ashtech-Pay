---
name: MySQL aggregate result shape
description: Cross-dialect handling for raw Drizzle SELECT aggregates.
---

Drizzle's MySQL `db.execute()` returns the selected rows as an array, while PostgreSQL returns a query-result object containing `rows`.

**Why:** Reading only `.rows[0]` makes valid MySQL aggregate queries look empty and causes dashboards or reports to render zeros without an SQL error.

**How to apply:** Normalize raw SELECT results at the boundary before reading aggregate rows, supporting both the direct MySQL array and PostgreSQL `.rows` shapes.