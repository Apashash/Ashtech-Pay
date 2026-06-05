#!/bin/bash
# =============================================================================
# git-security-cleanup.sh
#
# Désindexe les fichiers sensibles du tracking git sans les supprimer du disque.
# À exécuter UNE SEULE FOIS dans le terminal Replit (onglet "Shell").
#
# Usage :
#   bash scripts/git-security-cleanup.sh
# =============================================================================
set -e

echo "=== Nettoyage sécurité git — Ashtech Pay ==="
echo ""

echo "[1/3] Désindexage du dossier dist/ (code serveur compilé)..."
git rm --cached -r dist/ 2>/dev/null && echo "  ✓ dist/ désindexé" || echo "  ℹ dist/ déjà absent du tracking"

echo ""
echo "[2/3] Désindexage des fichiers Plesk / API docs sensibles..."
FILES=(
  "Collection swychr api.md"
  "payin (1).yaml"
  "payout.yaml"
  "DEPLOIEMENT_PLESK.md"
  "deploy.sh"
  "ecosystem.config.js"
  "ecosystem.config.cjs"
)
for f in "${FILES[@]}"; do
  git rm --cached "$f" 2>/dev/null && echo "  ✓ '$f' désindexé" || echo "  ℹ '$f' déjà absent du tracking"
done

echo ""
echo "[3/3] Vérification .gitignore..."
if grep -q "dist/" .gitignore; then
  echo "  ✓ .gitignore protège dist/"
else
  echo "  ⚠ Vérifier .gitignore manuellement"
fi

echo ""
echo "=== Terminé. Faites un commit pour valider : ==="
echo "    git add .gitignore"
echo "    git commit -m 'security: untrack compiled output and sensitive docs'"
echo ""
echo "⚠️  IMPORTANT : Les clés déjà exposées dans l'historique git doivent être"
echo "   RÉGÉNÉRÉES sur le dashboard Supabase (Settings > API > Rotate keys)."
echo "   Voir aussi : https://supabase.com/docs/guides/self-hosting#regenerating-keys"
