---
name: Plesk browser-only access
description: Deployment troubleshooting must work through the authenticated web application because the operator has no Plesk terminal.
---

The Plesk deployment is managed without terminal access. Database and runtime diagnostics should therefore be exposed through short-lived or protected admin-only browser endpoints, with read-only behavior and no credentials in responses.

**Why:** Shell commands cannot be executed by the operator on the deployed server, so a command-only diagnostic cannot be collected.

**How to apply:** Prefer an authenticated admin diagnostic route or downloadable report. Keep it read-only, restrict it to administrators, and return sanitized database errors and schema metadata only.