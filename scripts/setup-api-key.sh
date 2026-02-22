#!/usr/bin/env bash
# =============================================================================
# setup-api-key.sh — Configure Anthropic API key (skip OAuth on mobile)
#
# Usage: bash scripts/setup-api-key.sh [YOUR_API_KEY]
#
# This script configures your API key so Claude Code works WITHOUT
# the OAuth browser login flow — essential for mobile/terminal access.
# =============================================================================
set -euo pipefail

ENV_FILE="$HOME/.claude-env"

echo "=========================================="
echo "  CLAUDE CODE — API KEY SETUP"
echo "=========================================="
echo ""
echo "This sets your Anthropic API key so Claude Code"
echo "works WITHOUT OAuth (no browser login needed)."
echo ""

# Accept key as argument or prompt
API_KEY="${1:-}"

if [[ -z "$API_KEY" ]]; then
  echo "Get your key at: https://console.anthropic.com/settings/keys"
  echo ""
  read -rp "Paste your API key (sk-ant-api03-...): " API_KEY
fi

# Validate format
if [[ -z "$API_KEY" ]]; then
  echo ""
  echo "ERROR: No key provided. Aborting."
  exit 1
fi

if [[ ! "$API_KEY" == sk-ant-* ]]; then
  echo ""
  echo "WARNING: Key doesn't start with 'sk-ant-'."
  echo "Make sure you copied the full key from console.anthropic.com"
  read -rp "Continue anyway? (y/N): " CONFIRM
  if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
    echo "Aborting."
    exit 1
  fi
fi

# Write the env file
cat > "${ENV_FILE}" << ENVEOF
# === Claude Code — Environment variables ===
export ANTHROPIC_API_KEY="${API_KEY}"

# Optional: default model
# export CLAUDE_MODEL="claude-sonnet-4-20250514"
ENVEOF
chmod 600 "${ENV_FILE}"

# Ensure .bashrc sources it
if ! grep -q 'claude-env' "$HOME/.bashrc" 2>/dev/null; then
  cat >> "$HOME/.bashrc" << 'RCEOF'

# --- Claude Code env ---
if [[ -f "$HOME/.claude-env" ]]; then
  source "$HOME/.claude-env"
fi
RCEOF
fi

# Apply immediately
export ANTHROPIC_API_KEY="$API_KEY"

echo ""
echo "=========================================="
echo "  API KEY CONFIGURED"
echo "=========================================="
echo ""
echo "  Key: ${API_KEY:0:15}...${API_KEY: -4}"
echo "  File: ${ENV_FILE} (chmod 600)"
echo ""
echo "  Claude Code will now skip OAuth entirely."
echo ""
echo "  Test it:"
echo "    source ~/.bashrc"
echo "    claude 'say hello'"
echo "=========================================="
