---
name: Supabase to MySQL export
description: Durable rules for producing a safe, reviewable PostgreSQL-to-MySQL migration dump.
---

The migration dump must read PostgreSQL with a repeatable-read, read-only snapshot and emit MySQL in phases: all tables, all rows, key constraints, foreign keys, then portable secondary indexes. PostgreSQL source identifiers use double quotes; MySQL output identifiers use backticks.

**Why:** Foreign keys embedded in table creation make imports depend on alphabetical table order, while PostgreSQL temporal parsers and DDL transaction semantics can silently change data or create a false atomicity guarantee.

**How to apply:** Keep the Supabase source untouched, write data dumps only under the ignored exports directory, review the sidecar conversion report, and do not switch application runtime until imported counters, sums, relations, Storage files, and critical flows match.

The application keeps PostgreSQL as the default runtime. MySQL/MariaDB is an explicit opt-in mode selected by `DB_DIALECT=mysql` plus its own connection URL; keeping both URLs configured does not switch traffic.

**Why:** The user explicitly decided that the existing PostgreSQL schema must not be replaced or cut over before the isolated MySQL port is validated.

**How to apply:** Treat the MySQL schema/export, runtime adapters, and production writes as isolated until counter comparisons, relation checks, storage verification, and critical-flow tests are complete; rollback by restoring the PostgreSQL dialect.

The MySQL Drizzle dialect does not provide PostgreSQL-style `.returning()` builders; MySQL write paths must supply IDs explicitly and read the row back after insert/update.

**Why:** The shared storage layer was written around PostgreSQL returning semantics, and leaving those calls in MySQL mode would fail at runtime even when the schema import is correct.

**How to apply:** Port write methods with explicit read-back before enabling MySQL, prioritizing authentication, balances, transactions, payments, and then administrative/reporting flows.