---
name: Samsung Internet PWA installs
description: Samsung Internet can package a web app with an old Android target and trigger a Play Protect warning.
---

Samsung Internet's PWA installation path can generate a local Android wrapper whose target SDK is considered old by Play Protect. The warning refers to that browser-generated wrapper, not to an APK shipped by AshTech Pay.

**Why:** The project has no APK artifact or download route, while the device screenshot showed Samsung Internet controls and a Play Protect warning naming the PWA from its manifest.

**How to apply:** For a normal web-app install, recommend Google Chrome's PWA install flow. If a native Android package is required, build and sign a separate modern Android app/TWA with a current target SDK and distribute it through the Play Store.