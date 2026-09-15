---
name: Merchant webhook SSRF boundary
description: Merchant callback URLs are server-side outbound requests and need DNS/IP pinning, redirect blocking, and private-range rejection.
---

Merchant-provided webhook destinations are an SSRF boundary, even when they
require HTTPS. Validation must reject private, loopback, link-local, CGNAT,
reserved and IPv4-mapped IPv6 addresses, resolve public DNS addresses, pin the
validated address for the actual TLS request, and avoid following redirects.

**Why:** A lexical URL check alone accepts alternate IP spellings, internal
hostnames, DNS rebinding and redirect-based access to internal services.

**How to apply:** Reuse the outbound webhook network helper for every persisted
merchant callback delivery; do not replace it with a direct `fetch(notifyUrl)`.