---
name: CommonJS server bundle loading
description: Keep runtime package resolution compatible with the production server build.
---

The production server is bundled to CommonJS. Avoid constructing a Node `require` from `import.meta.url` in modules included in that bundle: esbuild can erase `import.meta`, even though ESM development execution and type checks succeed. Resolve external CommonJS packages from the application root or use a compatible static import.

**Why:** The production build warned that `import.meta` is unavailable in its CommonJS output, which would leave a file-relative `createRequire` base invalid at runtime.

**How to apply:** Check the server bundle format when adding dynamic package loading, and verify the production bundle's module-resolution path rather than relying only on ESM dev tests.
