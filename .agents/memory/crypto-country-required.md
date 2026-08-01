---
name: Crypto country required
description: Country selection requirement for crypto payment and deposit flows
---

Country selection is mandatory before generating a crypto payment address, both for public payment links and authenticated crypto deposits. The server validates the submitted country instead of trusting the UI.

**Why:** The country is required business context for crypto transactions even though the direct address provider does not need it to generate an address.

**How to apply:** Keep the country selector and client-side blocking validation in both crypto flows, and require a valid country identifier in both address-generation endpoints.