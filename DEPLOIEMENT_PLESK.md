# Guide de déploiement Plesk — Ashtech Pay

## Configuration initiale (une seule fois)

### 1. Variables d'environnement dans Plesk
Dans Plesk → votre domaine → Node.js → **Environment variables**, ajoutez toutes les clés de `.env.example`.

### 2. Paramètres Node.js dans Plesk
| Champ | Valeur |
|-------|--------|
| Document root | `/httpdocs` (ou votre répertoire) |
| Application root | `/httpdocs` |
| Application startup file | `dist/index.cjs` |
| Node.js version | 20.x |

### 3. Premier déploiement
Dans le terminal SSH Plesk ou via le gestionnaire de fichiers :
```bash
cd /var/www/vhosts/ashtechpay.top/httpdocs
git clone https://github.com/votre-compte/votre-repo.git .
npm install
npm run db:push
```
Puis dans Plesk → Node.js → **Restart**.

---

## À chaque modification (workflow habituel)

> ⚡ **`dist/` est inclus dans le repo git** — pas besoin de builder sur le serveur.

### Dans Replit (modification du code)
1. Faites vos changements dans Replit
2. Le commit est automatique (incluant le build `dist/`)

### Dans Plesk (déploiement)
1. **Git** → **Pull**
2. **Node.js** → **Restart** ← indispensable après chaque pull !

C'est tout ! ✓

---

## Si vous ajoutez de nouvelles dépendances ou migrations

Après le git pull, lancer via SSH ou le panel "Run script" de Plesk :
```bash
npm install
npm run db:push
```
Puis **Restart** Node.js.

---

## Commandes utiles (SSH Plesk)

```bash
# Redémarrer l'app via PM2 (si utilisé)
pm2 restart ashtech-pay
pm2 logs ashtech-pay
pm2 status

# Appliquer les migrations manuellement
npm run db:push

# Build manuel si nécessaire
npm run build
```

---

## Structure des fichiers importants

```
/
├── dist/              ← inclus dans Git (build pré-compilé)
│   ├── index.cjs      ← serveur de production
│   └── public/        ← fichiers React compilés
├── .htaccess          ← proxy Apache → localhost:5000
├── server/            ← code source du serveur
├── client/            ← code source React
├── shared/            ← schémas partagés
└── .env.example       ← modèle des variables d'environnement
```

---

## Dépannage

### Le site ne s'affiche pas après un git pull
→ **Vous avez oublié de cliquer Restart** dans Plesk → Node.js.

### Erreur "Connection refused" dans les logs Apache
→ Node.js n'est pas démarré. Cliquez **Restart** dans le panel Node.js de Plesk.

### Erreur "Cannot find app.js"
→ Vérifiez que l'**Application startup file** est bien `dist/index.cjs` dans le panel Node.js de Plesk.

### Le site tourne mais les nouvelles fonctionnalités n'apparaissent pas
→ Videz le cache de votre navigateur et vérifiez que vous avez bien fait **Restart** après le pull.
