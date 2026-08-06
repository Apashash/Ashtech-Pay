---
name: Admin route cloaking
description: Admin API and panel paths must look like ordinary missing routes to unauthenticated or non-admin clients.
---

## The rule
All `/api/admin` requests from unauthenticated clients or non-admin accounts must return the shared branded HTML 404, regardless of HTTP method. The cloaking middleware must run before CSRF, PIN, and admin handlers so those layers cannot reveal the route through a 401, 403, or 428 response.

**Why:** JSON authorization errors expose that an admin route exists and allowed `OPTIONS`/CSRF responses can still reveal the endpoint family to scanners.

**How to apply:** Keep the shared `sendClean404` response for GET, HEAD, POST, PUT, PATCH, DELETE, and OPTIONS. Do not cloak the dedicated admin login/TOTP pages needed to complete the legitimate admin authentication flow.