---
name: Crypto fee display
description: User-facing crypto payment screens must hide fee components and show only the combined fee total.
---

Crypto Pay-In calculations keep the provider fee and AshTechPay fee as separate internal values, but user-facing Pay, Deposit, and transaction-detail screens show only their combined “Total des frais”.

**Why:** The administrator needs separate controls for the provider fee and AshTechPay margin, while customers should see one simple total rather than the internal fee split.

**How to apply:** Keep separate fee settings and metadata for server calculations, reconciliation, and admin views; never render the provider or AshTechPay components in customer payment/deposit flows.