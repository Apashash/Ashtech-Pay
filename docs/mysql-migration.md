# Migration Supabase PostgreSQL vers MySQL/MariaDB

Cette procédure conserve Supabase intact jusqu'à la validation complète.

## 1. Exporter Supabase

Configurer temporairement la variable PostgreSQL existante dans l'environnement
de développement, puis exécuter :

```bash
npm run export:mysql -- --output exports/ashtechpay-supabase-mysql.sql
```

Le script est en lecture seule. Il produit :

- `exports/ashtechpay-supabase-mysql.sql`
- `exports/ashtechpay-supabase-mysql.sql.report.json`

Le fichier `.report.json` contient les compteurs par table et les index
PostgreSQL qui nécessitent une conversion manuelle. Les triggers PostgreSQL,
fonctions PL/pgSQL, `LISTEN/NOTIFY`, RLS et Storage ne sont pas transformés
silencieusement en faux SQL MySQL.

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

L'application ne doit pas basculer sur MySQL avant que les requêtes PostgreSQL,
les sessions, les transactions financières, les index, les triggers de sécurité
et les fichiers Storage aient été adaptés et testés.

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
- tests d'inscription, connexion, dashboard, dépôt, retrait, transfert et
  webhook.

## 5. Rollback

Le rollback consiste à remettre `SUPABASE_DATABASE_URL` comme source active,
redémarrer l'application et conserver MySQL sans le supprimer pour analyser
l'écart. Aucun script de rollback ne doit supprimer Supabase.