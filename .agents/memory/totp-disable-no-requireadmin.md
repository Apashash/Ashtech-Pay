---
name: TOTP disable no requireAdmin
description: POST /api/admin/totp/disable must not use requireAdmin middleware — the TOTP code itself is proof enough, and requireAdmin breaks on PM2 multi-worker.
---

## The Rule
`POST /api/admin/totp/disable` must use only `requireAuth`, NOT `requireAdmin`.

**Why:** `requireAdmin` checks the OTP-verified session (`_avs` flag). On PM2 multi-worker, when the disable request lands on a different worker than the one that verified OTP, the `_avs` is not found in memory (Map is per-process). Tier 2/3 DB fallback can also fail under Supabase pool exhaustion. Result: `requireAdmin` returns 403 "Vérification OTP admin requise" even when the admin is actively inside the panel. The TOTP code itself (6-digit valid code from Google Authenticator) is cryptographic proof of ownership — no additional session check needed.

**How to apply:** Replace `requireAdmin` with a manual role check inside the handler:
```javascript
const user = await storage.getUser(req.userId!);
if (!user || !["admin", "support", "finance"].includes(user.role)) {
  return res.status(403).json({ message: "Accès refusé" });
}
```

**Same principle applies to:** Any route where the request body itself provides strong authentication (e.g., change-password with current password, disable-totp with TOTP code). Do NOT add `requireAdmin` to these.
