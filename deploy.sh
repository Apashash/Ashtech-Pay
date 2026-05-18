#!/bin/bash
# =============================================================================
# deploy.sh — Script de déploiement Plesk pour Ashtech Pay
#
# WORKFLOW :
#   Sur Replit : npm run build  →  git add -A  →  git commit  →  git push
#   Sur Plesk  : git pull origin main  →  bash deploy.sh
#
# Ce script NE compile PAS l'application (le dist/ est commité sur GitHub).
# Il installe uniquement les dépendances de production et redémarre PM2.
# =============================================================================
set -e

echo "=== Ashtech Pay — Mise à jour Plesk ==="

echo "[1/2] Installation des dépendances de production..."
npm install --omit=dev

echo "[2/2] Création du dossier logs + redémarrage PM2..."
mkdir -p logs
if command -v pm2 &>/dev/null; then
  pm2 startOrRestart ecosystem.config.js --env production
  pm2 save
  echo "✓ Application redémarrée avec PM2"
else
  echo "PM2 non trouvé. Installez-le : npm install -g pm2"
  echo "Puis lancez : pm2 start ecosystem.config.js --env production"
  exit 1
fi

echo "=== Mise à jour terminée ==="
