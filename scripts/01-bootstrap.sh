#!/usr/bin/env bash
# =============================================================================
# 01-bootstrap.sh — Bootstrap Ubuntu for Claude Code multi-agents
# Usage: sudo bash 01-bootstrap.sh
# =============================================================================
set -euo pipefail

echo "=========================================="
echo "  BOOTSTRAP OS — Claude Code Mobile-First"
echo "=========================================="

# --- Root check ---
if [[ $EUID -ne 0 ]]; then
  echo "ERROR: this script must be run with sudo"
  exit 1
fi

# --- Variables ---
WORK_USER="${WORK_USER:-$(logname 2>/dev/null || echo "$SUDO_USER")}"
if [[ -z "$WORK_USER" || "$WORK_USER" == "root" ]]; then
  echo "ERROR: WORK_USER not set and cannot detect non-root user."
  echo "  Export WORK_USER before running: export WORK_USER=myuser"
  exit 1
fi

# --- System update ---
echo "[1/5] Updating system..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq

# --- Install base tools ---
echo "[2/5] Installing base tools..."
apt-get install -y -qq \
  git \
  curl \
  wget \
  tmux \
  build-essential \
  ripgrep \
  unzip \
  zip \
  jq \
  htop \
  tree \
  ufw \
  ca-certificates \
  gnupg \
  lsb-release \
  apt-transport-https \
  software-properties-common \
  openssl

# --- Verify work user ---
echo "[3/5] Verifying user '${WORK_USER}'..."
if id "${WORK_USER}" &>/dev/null; then
  echo "  -> User '${WORK_USER}' already exists."
else
  echo "  -> Creating user '${WORK_USER}'..."
  adduser --disabled-password --gecos "" "${WORK_USER}"
  usermod -aG sudo "${WORK_USER}"
  # Copy SSH keys from root if they exist
  if [[ -d /root/.ssh ]]; then
    mkdir -p "/home/${WORK_USER}/.ssh"
    cp /root/.ssh/authorized_keys "/home/${WORK_USER}/.ssh/" 2>/dev/null || true
    chown -R "${WORK_USER}:${WORK_USER}" "/home/${WORK_USER}/.ssh"
    chmod 700 "/home/${WORK_USER}/.ssh"
    chmod 600 "/home/${WORK_USER}/.ssh/authorized_keys" 2>/dev/null || true
  fi
fi

# --- Workspace directory ---
echo "[4/5] Creating workspace directory..."
WORKSPACE="/home/${WORK_USER}/workspace"
mkdir -p "${WORKSPACE}"
chown "${WORK_USER}:${WORK_USER}" "${WORKSPACE}"

# --- Swap (useful for small VMs) ---
echo "[5/5] Configuring swap (2 GB if absent)..."
if ! swapon --show | grep -q '/swapfile'; then
  if [[ ! -f /swapfile ]]; then
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
    echo "  -> 2 GB swap created and enabled."
  fi
else
  echo "  -> Swap already active."
fi

echo ""
echo "=========================================="
echo "  BOOTSTRAP COMPLETE"
echo "  User: ${WORK_USER}"
echo "  Workspace: ${WORKSPACE}"
echo "=========================================="
