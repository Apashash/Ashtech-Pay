---
name: AfribaPay autonomous authentication
description: AfribaPay must authenticate only with server-side API credentials and refresh bearer tokens without human browser sessions.
---

# AfribaPay authentication

Rule: use the official API key/secret (or client ID/secret aliases) from environment variables to obtain a bearer token. Never depend on a browser cookie, a human dashboard session, or a cleartext token cache.

**Why:** AfribaPay can return `Security token is not valid` after a dashboard session expires; payment processing must remain independent of that session.

**How to apply:** cache tokens only in memory or encrypted local storage, refresh before expiry, invalidate and retry one protected request after a token-invalid response, and keep provider credentials out of logs and responses.