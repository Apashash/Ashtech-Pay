#!/bin/bash
set -e

echo "=== Ashtech Pay — Déploiement ==="

echo "[1/4] Installation des dépendances..."
npm install --production=false

echo "[2/4] Build (client + serveur)..."
npm run build

echo "[3/4] Migrations base de données..."
npm run db:push

echo "[4/4] Redémarrage de l'application..."
if command -v pm2 &>/dev/null; then
  pm2 reload ecosystem.config.js --env production || pm2 start ecosystem.config.js --env production
  pm2 save
else
  echo "PM2 non trouvé — redémarrez l'application manuellement dans Plesk."
fi

echo "=== Déploiement terminé avec succès ==="
