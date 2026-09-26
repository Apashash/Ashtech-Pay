# Migration Supabase PostgreSQL vers MySQL/MariaDB

Cette procédure conserve Supabase intact jusqu'à la validation complète.

## 1. Exporter Supabase

Configurer temporairement la variable PostgreSQL Supabase dans l'environnement
de développement, puis exécuter :

```bash
npm run export:mysql -- --output exports/ashtechpay-supabase-mysql.sql
```

Si seule `DATABASE_URL` est disponible, ne l'utiliser qu'après avoir vérifié
qu'elle pointe bien vers Supabase, puis ajouter explicitement la confirmation :

```bash
npm run export:mysql -- --allow-generic-database-url \
  --output exports/ashtechpay-supabase-mysql.sql
```

Le script ouvre une transaction PostgreSQL `REPEATABLE READ READ ONLY` :
les compteurs et les lignes proviennent donc du même instant, sans modifier la
source. Il produit :

- `exports/ashtechpay-supabase-mysql.sql`
- `exports/ashtechpay-supabase-mysql.sql.report.json`

Le fichier `.report.json` contient les compteurs par table, les conversions de
types ou de valeurs par défaut et les index PostgreSQL qui nécessitent une
conversion manuelle. Le SQL est généré en phases :

1. création de toutes les tables sans clés étrangères ;
2. insertion de toutes les données ;
3. ajout des clés primaires et uniques ;
4. ajout des clés étrangères ;
5. ajout des index secondaires portables.

Les triggers PostgreSQL, fonctions PL/pgSQL, `LISTEN/NOTIFY`, RLS et Storage
ne sont pas transformés silencieusement en faux SQL MySQL. Les fichiers de
sortie sont temporaires jusqu'à la fin de l'export et restent ignorés par Git.

Les colonnes PostgreSQL `text` utilisées par une clé primaire, unique, étrangère
ou un index sont exportées en `VARCHAR(255)`. MariaDB refuse une colonne
`TEXT`/`BLOB` dans une clé sans longueur. Il faut donc toujours régénérer le
dump avec le convertisseur courant après une correction de celui-ci et importer
le fichier SQL le plus récent.

Le dossier `exports/` est ignoré par Git. Ne jamais ajouter un dump de données
à un commit.

## 2. Préparer MySQL/MariaDB sur Plesk

Dans Plesk :

1. Ouvrir **Databases**.
2. Créer une base MySQL/MariaDB vide.
3. Créer un utilisateur dédié avec un mot de passe long et aléatoire.
4. Donner à cet utilisateur tous les droits uniquement sur cette base.
5. Ouvrir phpMyAdmin.
6. Sélectionner la base vide.
7. Importer `ashtechpay-supabase-mysql.sql`.
8. Vérifier les compteurs du rapport avant de modifier l'application.

Ne pas supprimer la base Supabase et ne pas réutiliser son utilisateur.

## 3. Variables Plesk à préparer

La variable finale sera :

```text
MYSQL_DATABASE_URL=mysql://UTILISATEUR:MOT_DE_PASSE@HOTE:3306/NOM_BASE
```

Ne pas mettre cette valeur dans Git, dans un fichier public ou dans une
réponse de chat.

Conserver temporairement la configuration PostgreSQL pour permettre un
rollback :

```text
SUPABASE_DATABASE_URL=...
```

Le mode MySQL est explicitement activé avec :

```text
DB_DIALECT=mysql
MYSQL_DATABASE_URL=...
SUPABASE_DATABASE_URL=...
```

Sans `DB_DIALECT=mysql`, PostgreSQL reste la source active. En mode MySQL,
l'application ne lance pas les migrations PostgreSQL au démarrage et conserve
le watchdog PL/pgSQL désactivé. La table `session` est créée idempotemment par
le store MySQL. Les tables métier doivent déjà provenir de l'import vérifié ;
le démarrage ne doit jamais tenter une traduction destructive improvisée.

Pour une installation MySQL dont l'import précède l'enregistrement des adresses
crypto, appliquer manuellement
`scripts/migrations/mysql/2026-09-26-create-crypto-withdrawal-addresses.sql`
dans la base de l'application via phpMyAdmin. Cette migration idempotente crée
uniquement la nouvelle table vide ; elle ne modifie ni ne supprime les données
existantes. Ne relancez pas l'import complet sur la base de production pour
ajouter cette table.

Le chemin de rollback est donc réversible :

1. remettre `DB_DIALECT=postgres` ;
2. conserver `SUPABASE_DATABASE_URL` ;
3. redémarrer l'application ;
4. vérifier les compteurs et les écritures sur Supabase.

Les requêtes SQL PostgreSQL restantes doivent être traitées avant d'utiliser
MySQL pour les écritures financières en production. Les chemins déjà adaptés
incluent le schéma Drizzle isolé, les pools, les sessions, le nettoyage de
rétention et la file de webhooks.

## 4. Points à valider avant le basculement

- nombre de lignes par table ;
- UUID et relations ;
- totaux des montants ;
- statuts des transactions ;
- soldes et wallets ;
- utilisateurs et rôles ;
- sessions ;
- webhooks marchands ;
- fichiers Storage et références `image_path`, `pdf_path` et KYC ;
- absence de lignes orphelines ;
- avertissements du rapport `.report.json` traités ou acceptés ;
- tests d'inscription, connexion, dashboard, dépôt, retrait, transfert et
  webhook.

## 5. Rollback

Le rollback consiste à remettre `SUPABASE_DATABASE_URL` comme source active,
redémarrer l'application et conserver MySQL sans le supprimer pour analyser
l'écart. Aucun script de rollback ne doit supprimer Supabase.