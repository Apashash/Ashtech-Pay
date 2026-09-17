---
name: Supabase Node WebSocket transport
description: Runtime constraint for creating the Supabase server client on Node.js versions without native WebSocket support.
---

On Node.js 20, `@supabase/supabase-js` may fail while constructing its Realtime client unless the `ws` constructor is explicitly passed as the Realtime transport. This can look like a Storage configuration failure because the client remains null before any bucket request.

**Why:** Supabase Realtime now expects native WebSocket support on newer Node runtimes, while the Plesk runtime may still be Node.js 20.

**How to apply:** Keep `ws` installed and configure the server-side Supabase client with `realtime.transport = WebSocket`; keep client initialization retryable when configuration was unavailable during an early Passenger request.