#!/usr/bin/env bash
# =============================================================================
# 08-validate.sh — Validate complete Claude Code multi-agent setup
# Usage: bash 08-validate.sh
# =============================================================================
set -uo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS=0
FAIL=0
WARN=0

check() {
  local desc="$1"
  local cmd="$2"
  if eval "${cmd}" &>/dev/null; then
    echo -e "${GREEN}[OK]${NC} ${desc}"
    ((PASS++))
  else
    echo -e "${RED}[FAIL]${NC} ${desc}"
    ((FAIL++))
  fi
}

warn_check() {
  local desc="$1"
  local cmd="$2"
  if eval "${cmd}" &>/dev/null; then
    echo -e "${GREEN}[OK]${NC} ${desc}"
    ((PASS++))
  else
    echo -e "${YELLOW}[SKIP]${NC} ${desc} (optional)"
    ((WARN++))
  fi
}

echo "=========================================="
echo "  VALIDATION — Claude Code Multi-Agents"
echo "=========================================="
echo ""

# --- System ---
echo "=== SYSTEM ==="
check "OS Ubuntu/Debian" "grep -qiE 'ubuntu|debian' /etc/os-release"
check "Swap active" "swapon --show | grep -q /"
check "git installed" "command -v git"
check "curl installed" "command -v curl"
check "tmux installed" "command -v tmux"
check "jq installed" "command -v jq"
check "ripgrep installed" "command -v rg"
echo ""

# --- Security ---
echo "=== SECURITY ==="
check "SSH PasswordAuth disabled" "grep -rq 'PasswordAuthentication no' /etc/ssh/sshd_config.d/ 2>/dev/null || grep -q 'PasswordAuthentication no' /etc/ssh/sshd_config"
check "SSH PermitRootLogin disabled" "grep -rq 'PermitRootLogin no' /etc/ssh/sshd_config.d/ 2>/dev/null || grep -q 'PermitRootLogin no' /etc/ssh/sshd_config"
check "UFW active" "sudo ufw status | grep -qi active"
echo ""

# --- Network ---
echo "=== NETWORK ==="
warn_check "Tailscale installed" "command -v tailscale"
warn_check "Tailscale connected" "tailscale status"
if command -v tailscale &>/dev/null && tailscale status &>/dev/null; then
  echo "  Tailscale IP: $(tailscale ip -4 2>/dev/null || echo 'N/A')"
fi
echo ""

# --- Node.js / Claude Code ---
echo "=== CLAUDE CODE ==="
export NVM_DIR="$HOME/.nvm"
# shellcheck source=/dev/null
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" 2>/dev/null
source ~/.claude-env 2>/dev/null || true

check "Node.js installed" "command -v node"
if command -v node &>/dev/null; then
  echo "  Node.js version: $(node -v)"
fi
check "npm installed" "command -v npm"
check "Claude Code CLI installed" "command -v claude"
if command -v claude &>/dev/null; then
  echo "  Claude version: $(claude --version 2>/dev/null || echo 'N/A')"
fi
check ".claude-env file exists" "test -f ~/.claude-env"
check ".claude-env permissions 600" "test \"$(stat -c %a ~/.claude-env 2>/dev/null)\" = '600'"

if grep -q 'YOUR-KEY-HERE\|VOTRE-CLE-ICI\|sk-ant-\.\.\.' ~/.claude-env 2>/dev/null; then
  echo -e "${YELLOW}[WARN]${NC} API key not configured (default value)"
  ((WARN++))
else
  check "API key configured" "grep -q 'ANTHROPIC_API_KEY' ~/.claude-env"
fi
echo ""

# --- tmux ---
echo "=== TMUX ==="
check ".tmux.conf installed" "test -f ~/.tmux.conf"
check "Prefix Ctrl+a configured" "grep -q 'prefix C-a' ~/.tmux.conf"
warn_check "tmux sessions active" "tmux list-sessions"
if tmux list-sessions &>/dev/null; then
  echo "  Sessions:"
  tmux list-sessions 2>/dev/null | sed 's/^/    /'
fi
echo ""

# --- Optional services ---
echo "=== OPTIONAL SERVICES ==="
warn_check "code-server installed" "command -v code-server"
warn_check "code-server service active" "systemctl is-active code-server@$(whoami)"
echo ""

# --- Ports ---
echo "=== LISTENING PORTS ==="
echo "  (ss -lntp)"
sudo ss -lntp 2>/dev/null | grep -E '(22|8080)' | sed 's/^/    /' || echo "  (cannot list ports)"
echo ""

# --- Summary ---
echo "=========================================="
echo -e "  Result: ${GREEN}${PASS} OK${NC} / ${RED}${FAIL} FAIL${NC} / ${YELLOW}${WARN} SKIP${NC}"
if [[ ${FAIL} -eq 0 ]]; then
  echo -e "  ${GREEN}SETUP READY!${NC}"
else
  echo -e "  ${RED}${FAIL} issue(s) to fix.${NC}"
fi
echo "=========================================="

# --- Debug commands ---
echo ""
echo "=== DEBUG COMMANDS ==="
echo "  systemctl status sshd"
echo "  systemctl status code-server@\$(whoami)"
echo "  journalctl -u code-server@\$(whoami) -f"
echo "  sudo ufw status verbose"
echo "  sudo ss -lntp"
echo "  tailscale status"
