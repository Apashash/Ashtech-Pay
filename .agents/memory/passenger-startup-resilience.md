---
name: Passenger startup resilience
description: Constraints for reliable Plesk/Phusion Passenger restarts from committed production bundles.
---

Passenger may report a generic startup 500 when the Node process does not open its port while database migrations or route registration are running. The production bundle must open the listener first, gate requests until bootstrap completes, and resolve runtime paths from the bundle location rather than trusting Passenger's current working directory.

**Why:** Plesk can start the configured Node entrypoint with a different working directory and a shorter startup window than the local Replit workflow. A valid committed `dist/index.cjs` can otherwise look like a dead application even when the code eventually starts.

**How to apply:** Keep `dist/index.cjs` committed for Plesk pull/restart deployments. Defer DB-transitive imports and fatal production configuration checks until after the listener opens, then verify startup from a non-project working directory. Keep the Plesk application root at the parent directory containing `dist/`, with startup file `dist/index.cjs`.

**Why:** Static imports such as the route registry or bot guard can evaluate `db.ts` before the listener even when migrations are inside a later bootstrap function, turning a missing environment variable into Passenger's generic startup 500.