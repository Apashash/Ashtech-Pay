---
name: IziChange API quirks
description: Undocumented behaviors and gotchas in the IziChange Pay WaaS API that caused production errors.
---

## Rule 1 — List endpoint returns a bare array, not `{ data: [...] }`

`GET /v1/accounts?externalRef=...` returns `[{id, label, externalRef, ...}, ...]` directly.

The code must handle both shapes:
```typescript
const arr = Array.isArray(result) ? result : Array.isArray(result?.data) ? result.data : [];
return arr[0] ?? null;
```

**Why:** Assuming `result.data[0]` always returned `undefined`, so `findWaaSAccountByExternalRef` always returned `null`. On the second call (after DB save failed), `createWaaSAccount` would throw "externalRef already exists" → retry → null again → 500.

**How to apply:** Any new list endpoint from IziChange must be tested with `Array.isArray(result)` before accessing `.data`.

---

## Rule 2 — ESM import hoisting breaks module-level `process.env` reads on Plesk

The project is `"type": "module"`. All `import` statements are hoisted above the module body, so `izichange.ts` is fully initialized before `server/index.ts` runs its `.env` IIFE loader. On Plesk/Passenger, `process.env.IZIPAY_API_KEY` is `""` at that moment.

**Fix:** Use lazy getter functions that read `process.env` at call time:
```typescript
export function getIziPayApiKey(): string { return process.env.IZIPAY_API_KEY || ""; }
```

**Why:** Module-level `export const IZIPAY_API_KEY = process.env.IZIPAY_API_KEY || ""` captures `""` forever on Plesk.

**How to apply:** Any new env var read in an ESM-loaded module that is imported by `server/index.ts` must use a getter function, not a module-level constant.
