---
name: Mintlify internal link prefix
description: Internal Mintlify page links must include the docs directory prefix in this project.
---

Les liens internes Mintlify doivent utiliser le chemin public complet avec le préfixe `/docs/`, par exemple `/docs/embedded-checkout` ou `/docs/direct-api/crypto`.

**Why:** Les fichiers source sont stockés sous `docs/`, et les pages sont publiées sous `/docs/...`; omettre ce préfixe mène à une page 404.

**How to apply:** Utiliser `/docs/<chemin-de-page>` dans les composants `Card` et les liens MDX, puis vérifier que la page correspondante existe dans `docs.json`.