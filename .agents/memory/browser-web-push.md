---
name: Browser Web Push
description: Platform constraints and key-handling decisions for AshTech Pay browser notifications.
---

Web Push uses a root-scoped Service Worker and a per-user subscription stored encrypted in the database. iOS requires the site to be installed on the Home Screen and opened as a standalone web app; a normal Safari tab cannot complete the push flow.

**Why:** Safari on iPhone gates Web Push behind Home Screen web apps, so a toggle that only asks for browser permission appears to work but cannot receive notifications in a regular tab.

**How to apply:** Keep the UI's support check and installation guidance in place. The server derives a stable VAPID key from the dedicated VAPID secret when configured, with the existing field-encryption secret as a deployment-compatible fallback; never expose the private key to client code.