---
name: Transaction metadata typing
description: Drizzle JSON transaction metadata needs an explicit Zod record type for server-side insert payloads.
---

Les métadonnées JSON des transactions doivent être déclarées explicitement comme un `Record<string, any>` dans le schéma d’insertion partagé.

**Why:** Sans cette précision, TypeScript peut inférer le tuple interne SQL de Drizzle et signaler à tort chaque valeur de métadonnée crypto comme incompatible.

**How to apply:** Lorsqu’un nouveau champ JSON est ajouté à une transaction, vérifier le schéma Zod d’insertion partagé avant de corriger les appels individuels dans les routes.