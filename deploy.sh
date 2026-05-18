#!/bin/bash
set -e

echo "=== Ashtech Pay — Déploiement ==="

echo "[1/4] Installation des dépendances..."
npm install --production=false

echo "[2/4] Build (client + serveur)..."
npm run build

echo "[3/4] Migrations base de données..."
npm run db:push

echo "[4/4] Création du dossier logs + redémarrage..."
mkdir -p logs
if command -v pm2 &>/dev/null; then
  pm2 reload ecosystem.config.cjs --env production 2>/dev/null || pm2 start ecosystem.config.cjs --env production
  pm2 save
else
  echo "PM2 non trouvé — démarrez avec : node dist/index.cjs"
fi

echo "=== Déploiement terminé avec succès ==="
