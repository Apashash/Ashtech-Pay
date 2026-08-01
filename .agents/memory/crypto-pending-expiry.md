---
name: Crypto pending expiry
description: Crypto-only pending payment timeout and UI countdown behavior
---

Crypto address screens show a five-minute informational countdown, while the server rejects crypto transactions still pending after 15 minutes. Mobile Money keeps its existing status and timeout behavior.

**Why:** The short UI timer is a user-facing instruction, not the payment validity window; relying on it would fail when the page is closed or a process restarts.

**How to apply:** Enforce the 15-minute rule from persisted transactions using `paymentMethod = crypto`, run it periodically and before recovery, and never re-queue those transactions through the Mobile Money provider poller.