#!/bin/bash
# stability-check.sh — Vérifie la stabilité du projet Next.js
# Usage: bash scripts/stability-check.sh

set -uo pipefail

echo "========================================="
echo "  STABILITY CHECK (OP SpellTable)"
echo "========================================="
echo ""

errors=0
warnings=0

# 0. Vérifier que node_modules existe
if [ ! -d "node_modules" ]; then
  echo "[0/5] Installing dependencies..."
  npm install --silent 2>&1
  if [ $? -ne 0 ]; then
    echo "  ✗ npm install FAILED"
    exit 1
  fi
  echo "  ✓ Dependencies installed"
  echo ""
fi

# 0b. Générer le client Prisma si nécessaire
if [ -f "prisma/schema.prisma" ] && [ ! -d "src/generated/prisma" ]; then
  echo "[0b] Generating Prisma client..."
  npx prisma generate 2>&1 > /dev/null
  echo "  ✓ Prisma client generated"
  echo ""
fi

# 1. TypeScript type-check
echo "[1/4] TypeScript type-check (tsc --noEmit)..."
tsc_output=$(npx tsc --noEmit 2>&1)
tsc_exit=$?
if [ $tsc_exit -eq 0 ]; then
  echo "  ✓ TypeScript OK"
else
  echo "  ✗ TypeScript FAILED"
  echo "$tsc_output" | head -20
  errors=$((errors + 1))
fi
echo ""

# 2. ESLint
echo "[2/4] ESLint..."
lint_output=$(npm run lint 2>&1)
lint_exit=$?
if [ $lint_exit -eq 0 ]; then
  echo "  ✓ ESLint OK"
else
  echo "  ✗ ESLint FAILED"
  echo "$lint_output" | head -20
  errors=$((errors + 1))
fi
echo ""

# 3. Tests (Vitest)
echo "[3/4] Tests (Vitest)..."
if grep -q '"test"' package.json 2>/dev/null; then
  test_output=$(npm test -- --run 2>&1)
  test_exit=$?
  if [ $test_exit -eq 0 ]; then
    echo "  ✓ Tests OK"
  else
    echo "  ✗ Tests FAILED"
    echo "$test_output" | tail -20
    errors=$((errors + 1))
  fi
else
  echo "  ⚠ No test script found — skipped"
  warnings=$((warnings + 1))
fi
echo ""

# 4. Next.js Build
echo "[4/4] Next.js Build..."
build_output=$(npm run build 2>&1)
build_exit=$?
if [ $build_exit -eq 0 ]; then
  echo "  ✓ Build OK"
else
  echo "  ✗ Build FAILED"
  echo "$build_output" | tail -30
  errors=$((errors + 1))
fi
echo ""

# Résultat
echo "========================================="
if [ "$errors" -eq 0 ]; then
  if [ "$warnings" -gt 0 ]; then
    echo "  RESULTAT: STABLE ✓ ($warnings warning(s))"
  else
    echo "  RESULTAT: STABLE ✓"
  fi
  echo "  Tous les checks passent."
  echo "========================================="
  exit 0
else
  echo "  RESULTAT: INSTABLE ✗"
  echo "  $errors check(s) en échec."
  echo "========================================="
  exit 1
fi
