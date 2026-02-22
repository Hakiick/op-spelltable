#!/usr/bin/env bash
# =============================================================================
# 06-install-code-server.sh — VS Code in the browser (code-server)
# Usage: sudo bash 06-install-code-server.sh
# =============================================================================
set -euo pipefail

echo "=========================================="
echo "  CODE-SERVER (VS Code Web)"
echo "=========================================="

# --- Load config ---
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${SCRIPT_DIR}/../config.env"
if [[ -f "$CONFIG_FILE" ]]; then
  # shellcheck source=/dev/null
  source "$CONFIG_FILE"
fi

WORK_USER="${WORK_USER:-$(logname 2>/dev/null || echo "$SUDO_USER")}"
WEB_PASSWORD="${WEB_PASSWORD:-change-me-strong-password}"
CODE_SERVER_BIND="${CODE_SERVER_BIND:-0.0.0.0:8080}"

# --- Install ---
echo "[1/3] Installing code-server..."
if command -v code-server &>/dev/null; then
  echo "  -> Already installed: $(code-server --version | head -1)"
else
  curl -fsSL https://code-server.dev/install.sh | sh
  echo "  -> code-server installed."
fi

# --- Configuration ---
echo "[2/3] Configuring..."
CS_CONFIG="/home/${WORK_USER}/.config/code-server/config.yaml"
mkdir -p "$(dirname "${CS_CONFIG}")"

cat > "${CS_CONFIG}" << CSEOF
bind-addr: ${CODE_SERVER_BIND}
auth: password
password: ${WEB_PASSWORD}
cert: false
CSEOF

chown -R "${WORK_USER}:${WORK_USER}" "/home/${WORK_USER}/.config/code-server"

# --- Enable ---
echo "[3/3] Enabling service..."
systemctl enable --now "code-server@${WORK_USER}"

echo ""
echo "=========================================="
echo "  CODE-SERVER INSTALLED"
echo "  Config: ${CS_CONFIG}"
echo "  Access: http://<IP>:8080/"
echo "  Password: same as WEB_PASSWORD"
echo "=========================================="
