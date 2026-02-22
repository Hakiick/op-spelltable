#!/usr/bin/env bash
# =============================================================================
# 04-install-claude-code.sh — Install Node.js LTS + Claude Code CLI
# Usage: bash 04-install-claude-code.sh  (no sudo needed)
# =============================================================================
set -euo pipefail

echo "=========================================="
echo "  CLAUDE CODE INSTALLATION"
echo "=========================================="

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${SCRIPT_DIR}/../config.env"
if [[ -f "$CONFIG_FILE" ]]; then
  # shellcheck source=/dev/null
  source "$CONFIG_FILE"
fi

# --- Node.js LTS via nvm ---
# NOTE: nvm scripts use unbound variables internally, so we must
# temporarily disable 'set -u' (nounset) around all nvm operations.
echo "[1/4] Installing Node.js LTS via nvm..."

# Helper: source nvm safely (nvm uses unbound vars)
load_nvm() {
  set +u
  export NVM_DIR="$HOME/.nvm"
  # shellcheck source=/dev/null
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
  set -u
}

if command -v node &>/dev/null && node -v | grep -qE '^v(20|22|24)'; then
  echo "  -> Node.js already installed: $(node -v)"
else
  if [[ ! -d "$HOME/.nvm" ]]; then
    curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
  fi
  load_nvm

  set +u
  nvm install --lts
  nvm use --lts
  nvm alias default 'lts/*'
  set -u
  echo "  -> Node.js installed: $(node -v)"
fi

load_nvm

echo "  -> npm: $(npm -v)"

# --- Claude Code CLI ---
echo "[2/4] Installing Claude Code CLI..."
npm install -g @anthropic-ai/claude-code
echo "  -> Claude Code installed: $(claude --version 2>/dev/null || echo 'check PATH')"

# --- API key configuration ---
echo "[3/4] Configuring Anthropic API key..."
echo ""
echo "  IMPORTANT: Setting ANTHROPIC_API_KEY lets you skip OAuth login."
echo "  This is essential for mobile access (no browser copy-paste needed)."
echo ""

ENV_FILE="$HOME/.claude-env"
ANTHROPIC_KEY="${ANTHROPIC_API_KEY:-}"

# If no key is set, try to read from config.env
if [[ -z "$ANTHROPIC_KEY" || "$ANTHROPIC_KEY" == "sk-ant-..." ]]; then
  ANTHROPIC_KEY="sk-ant-YOUR-KEY-HERE"
fi

if [[ ! -f "${ENV_FILE}" ]]; then
  cat > "${ENV_FILE}" << ENVEOF
# === Claude Code — Environment variables ===
export ANTHROPIC_API_KEY="${ANTHROPIC_KEY}"

# Optional: default model
# export CLAUDE_MODEL="claude-sonnet-4-20250514"
ENVEOF
  chmod 600 "${ENV_FILE}"
  echo "  -> File ${ENV_FILE} created (chmod 600)."
else
  echo "  -> File ${ENV_FILE} already exists."
  # Re-read existing key
  source "${ENV_FILE}" 2>/dev/null || true
  ANTHROPIC_KEY="${ANTHROPIC_API_KEY:-}"
fi

# Validate key format
if [[ -z "$ANTHROPIC_KEY" || "$ANTHROPIC_KEY" == "sk-ant-YOUR-KEY-HERE" || "$ANTHROPIC_KEY" == "sk-ant-..." ]]; then
  echo ""
  echo "  =========================================="
  echo "  WARNING: No valid API key detected!"
  echo "  Without an API key, Claude will ask for"
  echo "  OAuth login (difficult on mobile)."
  echo ""
  echo "  To fix:"
  echo "    bash scripts/setup-api-key.sh"
  echo "  Or manually:"
  echo "    nano ~/.claude-env"
  echo "  =========================================="
  echo ""
elif [[ "$ANTHROPIC_KEY" == sk-ant-api03-* ]]; then
  echo "  -> API key configured (starts with ${ANTHROPIC_KEY:0:15}...)"
  echo "  -> OAuth will be SKIPPED — direct API access enabled."
fi

# Add sourcing to .bashrc if absent
if ! grep -q 'claude-env' "$HOME/.bashrc" 2>/dev/null; then
  cat >> "$HOME/.bashrc" << 'RCEOF'

# --- Claude Code env ---
if [[ -f "$HOME/.claude-env" ]]; then
  source "$HOME/.claude-env"
fi
RCEOF
  echo "  -> Sourcing added to .bashrc"
fi

# --- Verification ---
echo "[4/4] Verification..."
echo ""

source "${ENV_FILE}" 2>/dev/null || true

if command -v claude &>/dev/null; then
  echo "  Claude Code CLI found: $(which claude)"
  echo "  Version: $(claude --version 2>/dev/null || echo 'N/A')"
else
  echo "  WARNING: 'claude' not in PATH."
  echo "  Try: source ~/.bashrc && claude --version"
fi

echo ""
echo "=========================================="
echo "  INSTALLATION COMPLETE"
echo ""
echo "  NEXT STEPS:"
echo "  1. Edit your API key:"
echo "     nano ~/.claude-env"
echo ""
echo "  2. Reload shell:"
echo "     source ~/.bashrc"
echo ""
echo "  3. Test:"
echo "     claude --version"
echo "     claude 'say hello'"
echo "=========================================="
