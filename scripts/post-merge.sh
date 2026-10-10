#!/bin/bash
set -e
# Keep Replit's configured registry, but do not rewrite local file dependencies
# or already-internal tarball URLs using the Plesk-only "always" setting.
npm_config_replace_registry_host=npmjs npm install
npm_config_replace_registry_host=npmjs npm --prefix artifacts/mockup-sandbox install
npm run test:braces
yes "No, add the constraint without truncating the table" | npm run db:push || true
