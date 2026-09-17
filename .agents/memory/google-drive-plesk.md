---
name: Google Drive on Plesk
description: Storage integration boundary between the Replit workspace and the external Plesk deployment
---

The Replit Google Drive connector is bound to applications running in the Replit environment; it does not automatically provide OAuth access to the Node.js process running externally on Plesk. Plesk must use a separately configured Google service account and Drive folder, with credentials supplied through Plesk environment variables.

**Why:** The production application is hosted outside Replit, so Replit connector identity and proxy variables are not available to that process.

**How to apply:** For Plesk production, configure a service account, share the target Drive folder with it, and use the app's native Google Drive JWT upload path. Never put the service-account JSON in the repository or chat.