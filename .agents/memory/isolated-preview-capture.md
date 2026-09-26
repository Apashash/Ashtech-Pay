---
name: Isolated preview capture
description: How to verify rendered components hosted by the mockup artifact.
---

The app preview screenshot route targets the main application server, not the isolated mockup artifact. A `/__mockup/...` path passed to it can return the main app's 404 page even while the artifact preview is healthy.

**Why:** The component preview server runs as a separate artifact workflow and is exposed through a routed path, not the main application's local port.

**How to apply:** For mockup components, verify the artifact route and use its canvas iframe for visual review. Do not treat an app-preview 404 on `/__mockup/...` as evidence that the component itself is broken.