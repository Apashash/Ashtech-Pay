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
npm run deploy
```

---

## À chaque modification (workflow habituel)

### Dans Replit (modification du code)
1. Faites vos changements dans Replit
2. Le commit est automatique

### Dans Plesk (déploiement)
1. **Git** → **Pull**
2. **Node.js** → cliquez **"Run script"** → entrez `deploy`  
   *(cela exécute `npm run deploy` = install + build + migrations)*
3. **Node.js** → **Restart**

C'est tout ! ✓

---

## Ce que fait `npm run deploy`

```
npm install          → installe/met à jour les dépendances
npm run build        → compile le client React + le serveur Node.js
npm run db:push      → applique les nouvelles migrations de base de données
```

---

## Commandes utiles (SSH Plesk)

```bash
# Déploiement complet manuel
npm run deploy

# Démarrer l'app (si PM2 est installé)
pm2 start ecosystem.config.js --env production

# Redémarrer
pm2 reload ashtech-pay

# Voir les logs
pm2 logs ashtech-pay

# Vérifier le statut
pm2 status
```

---

## Structure des fichiers importants

```
/
├── dist/              ← généré par le build (PAS dans Git)
│   ├── index.cjs      ← serveur de production
│   └── public/        ← fichiers React compilés
├── server/            ← code source du serveur
├── client/            ← code source React
├── shared/            ← schémas partagés
├── deploy.sh          ← script de déploiement bash
├── ecosystem.config.js← config PM2
└── .env.example       ← modèle des variables d'environnement
```
