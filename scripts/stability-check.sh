#!/bin/bash
# stability-check.sh — Vérifie la stabilité de l'infrastructure
# Usage: bash scripts/stability-check.sh

set -uo pipefail

echo "========================================="
echo "  STABILITY CHECK (Infrastructure)"
echo "========================================="
echo ""

errors=0
TERRAFORM_DIR="terraform"

# Detect terraform directory
if [ ! -d "$TERRAFORM_DIR" ]; then
  # Try current directory
  if ls *.tf 1>/dev/null 2>&1; then
    TERRAFORM_DIR="."
  else
    echo "  ⚠ No terraform directory found. Skipping Terraform checks."
    TERRAFORM_DIR=""
  fi
fi

# 1. Terraform Format
if [ -n "$TERRAFORM_DIR" ]; then
  echo "[1/5] Terraform Format..."
  if terraform -chdir="$TERRAFORM_DIR" fmt -check -recursive 2>&1; then
    echo "  ✓ Terraform fmt OK"
  else
    echo "  ✗ Terraform fmt FAILED (run: terraform -chdir=$TERRAFORM_DIR fmt -recursive)"
    errors=$((errors + 1))
  fi
  echo ""

  # 2. Terraform Validate
  echo "[2/5] Terraform Validate..."
  terraform -chdir="$TERRAFORM_DIR" init -backend=false -input=false >/dev/null 2>&1
  if terraform -chdir="$TERRAFORM_DIR" validate 2>&1; then
    echo "  ✓ Terraform validate OK"
  else
    echo "  ✗ Terraform validate FAILED"
    errors=$((errors + 1))
  fi
  echo ""

  # 3. Terraform Plan (dry-run, skip if no tfvars)
  echo "[3/5] Terraform Plan..."
  if [ -f "$TERRAFORM_DIR/terraform.tfvars" ]; then
    if terraform -chdir="$TERRAFORM_DIR" plan -input=false -detailed-exitcode >/dev/null 2>&1; then
      echo "  ✓ Terraform plan OK (no changes)"
    else
      plan_exit=$?
      if [ "$plan_exit" -eq 2 ]; then
        echo "  ✓ Terraform plan OK (changes pending)"
      else
        echo "  ✗ Terraform plan FAILED"
        errors=$((errors + 1))
      fi
    fi
  else
    echo "  ⚠ No terraform.tfvars — plan skipped (validate-only mode)"
  fi
  echo ""
else
  echo "[1/5] Terraform Format... ⚠ SKIPPED"
  echo "[2/5] Terraform Validate... ⚠ SKIPPED"
  echo "[3/5] Terraform Plan... ⚠ SKIPPED"
  echo ""
fi

# 4. Dockerfile Build Check
echo "[4/5] Dockerfile syntax..."
dockerfiles_found=0
docker_errors=0
for df in $(find . -name "Dockerfile*" -not -path "./.git/*" -not -path "./node_modules/*" 2>/dev/null); do
  dockerfiles_found=$((dockerfiles_found + 1))
  # Basic syntax check: verify FROM instruction exists
  if ! grep -q "^FROM " "$df" 2>/dev/null; then
    echo "  ✗ $df: missing FROM instruction"
    docker_errors=$((docker_errors + 1))
  fi
done
if [ "$dockerfiles_found" -eq 0 ]; then
  echo "  ⚠ No Dockerfiles found — skipped"
elif [ "$docker_errors" -eq 0 ]; then
  echo "  ✓ Dockerfile syntax OK ($dockerfiles_found files)"
else
  echo "  ✗ Dockerfile syntax FAILED ($docker_errors errors in $dockerfiles_found files)"
  errors=$((errors + 1))
fi
echo ""

# 5. GitHub Actions YAML syntax
echo "[5/5] GitHub Actions syntax..."
workflows_found=0
yaml_errors=0
for wf in $(find .github/workflows -name "*.yml" -o -name "*.yaml" 2>/dev/null); do
  workflows_found=$((workflows_found + 1))
  if command -v python3 >/dev/null 2>&1; then
    if ! python3 -c "import yaml; yaml.safe_load(open('$wf'))" 2>/dev/null; then
      echo "  ✗ $wf: invalid YAML"
      yaml_errors=$((yaml_errors + 1))
    fi
  fi
done
if [ "$workflows_found" -eq 0 ]; then
  echo "  ⚠ No GitHub Actions workflows found — skipped"
elif [ "$yaml_errors" -eq 0 ]; then
  echo "  ✓ GitHub Actions syntax OK ($workflows_found workflows)"
else
  echo "  ✗ GitHub Actions syntax FAILED ($yaml_errors errors in $workflows_found workflows)"
  errors=$((errors + 1))
fi
echo ""

echo "========================================="
if [ "$errors" -eq 0 ]; then
  echo "  RESULTAT: STABLE ✓"
  echo "  Tous les checks passent."
  echo "========================================="
  exit 0
else
  echo "  RESULTAT: INSTABLE ✗"
  echo "  $errors check(s) en échec."
  echo "========================================="
  exit 1
fi
