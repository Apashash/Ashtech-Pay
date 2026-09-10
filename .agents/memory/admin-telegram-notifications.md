---
name: Admin Telegram notification boundary
description: Admin success alerts must be emitted at login, not from per-request authorization middleware.
---

The Telegram notification for a successful admin connection belongs to the
successful login/OTP completion path. Authorization middleware may validate
every admin request, but it must not emit a success notification there.

**Why:** Admin dashboards make many parallel and auto-refreshing API requests.
Mobile Bearer authentication and multi-worker production deployments make
request/session-based throttles unreliable and can produce repeated alerts.

**How to apply:** Keep successful notifications on login only; keep failure
notifications for actual rejected access attempts. A logout followed by a new
login should produce one new success notification.