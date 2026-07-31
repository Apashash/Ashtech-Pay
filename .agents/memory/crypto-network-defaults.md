---
name: Crypto network default stability
description: Stable defaults for crypto network selectors while dynamic asset data loads
---

Dynamic crypto catalogues can briefly expose a different first network before React state settles. Treat USDT/TRC20 as a canonical untouched default and only honor another network after explicit user selection.

**Why:** The live asset list includes Polygon, and replacing the selected value with the first available network caused a visible Polygon flash and could send the wrong asset if state was read during that transition.

**How to apply:** Keep a separate “user touched network” flag in every crypto selector; derive the displayed and submitted network from the canonical default until the user changes it, and reset the flag when the coin or crypto mode changes.