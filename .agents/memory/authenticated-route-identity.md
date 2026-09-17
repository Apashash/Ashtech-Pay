---
name: Authenticated route identity
description: Identity fields guaranteed by the application authentication middleware
---

The authentication middleware establishes `req.userId`; it does not populate `req.user`. Authenticated route handlers must use `req.userId` directly or explicitly load the user record before accessing user properties.

**Why:** A confirmed AfribaPay deposit could reach provider success and then fail with a server error while recording the pending poller entry because the route used `req.user.id`, which was undefined after `requireAuth`.

**How to apply:** When adding a protected route, inspect the middleware contract first. Treat `req.user` as unavailable unless the route explicitly loads it.