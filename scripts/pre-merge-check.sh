#!/bin/bash
# pre-merge-check.sh — Vérifie qu'une branche est prête à être mergée
# Usage: bash scripts/pre-merge-check.sh [branch-name]
# Si pas de branch-name, utilise la branche courante

set -uo pipefail

BRANCH="${1:-$(git branch --show-current)}"
BASE_BRANCH="main"

echo "========================================="
echo "  PRE-MERGE CHECK"
echo "  Branche : $BRANCH"
echo "  Base    : $BASE_BRANCH"
echo "========================================="
echo ""

errors=0

# 1. Vérifier qu'on n'est pas sur main
echo "[1/5] Vérification de la branche..."
if [ "$BRANCH" = "main" ] || [ "$BRANCH" = "master" ]; then
  echo "  ✗ ERREUR : Tu es sur $BRANCH. Basculer sur la branche feature."
  exit 1
fi
echo "  ✓ Branche feature : $BRANCH"
echo ""

# 2. Vérifier que la branche est à jour avec main (rebasée)
echo "[2/5] Vérification du rebase sur $BASE_BRANCH..."
git fetch origin "$BASE_BRANCH" --quiet 2>/dev/null

MERGE_BASE=$(git merge-base "$BRANCH" "origin/$BASE_BRANCH" 2>/dev/null)
MAIN_HEAD=$(git rev-parse "origin/$BASE_BRANCH" 2>/dev/null)

if [ "$MERGE_BASE" != "$MAIN_HEAD" ]; then
  echo "  ✗ La branche n'est PAS rebasée sur $BASE_BRANCH"
  echo "    → Exécute : git fetch origin $BASE_BRANCH && git rebase origin/$BASE_BRANCH"
  errors=$((errors + 1))
else
  echo "  ✓ Branche rebasée sur $BASE_BRANCH"
fi
echo ""

# 3. Vérifier qu'il n'y a pas de changements non commités
echo "[3/5] Vérification des changements non commités..."
if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
  echo "  ✗ Des changements non commités existent"
  echo "    → Commite ou stash tes changements avant le merge"
  errors=$((errors + 1))
else
  echo "  ✓ Working directory propre"
fi
echo ""

# 4. Vérifier que la branche existe sur le remote
echo "[4/5] Vérification de la branche sur le remote..."
if git ls-remote --heads origin "$BRANCH" | grep -q "$BRANCH"; then
  echo "  ✓ Branche existe sur le remote"
else
  echo "  ✗ La branche n'existe PAS sur le remote"
  echo "    → Exécute : git push -u origin $BRANCH"
  errors=$((errors + 1))
fi
echo ""

# 5. Stability check
echo "[5/5] Stability check..."
if bash scripts/stability-check.sh; then
  echo "  ✓ Stability check OK"
else
  echo "  ✗ Stability check FAILED"
  errors=$((errors + 1))
fi
echo ""

echo ""
echo "========================================="
if [ "$errors" -eq 0 ]; then
  echo "  RÉSULTAT: PRÊT À MERGER ✓"
  echo "  Tous les checks passent."
  echo "========================================="
  exit 0
else
  echo "  RÉSULTAT: PAS PRÊT ✗"
  echo "  $errors vérification(s) en échec."
  echo "  Corrige les problèmes avant de merger."
  echo "========================================="
  exit 1
fi
