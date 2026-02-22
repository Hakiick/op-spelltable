#!/usr/bin/env bash
# =============================================================================
# setup.sh — Orchestrator: full Claude Code multi-agent setup in 5 minutes
#
# Usage:
#   sudo bash scripts/setup.sh              # Full install (all steps)
#   sudo bash scripts/setup.sh --skip 3     # Skip Tailscale
#   sudo bash scripts/setup.sh --only 4 7   # Only Claude Code + agents
#   sudo bash scripts/setup.sh --from 5     # Start from step 5
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# --- Load config ---
CONFIG_FILE="${SCRIPT_DIR}/../config.env"
if [[ -f "$CONFIG_FILE" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$CONFIG_FILE"
  set +a
else
  echo "WARNING: config.env not found. Using defaults."
  echo "  Copy config.env.example to config.env and fill in your values."
  echo ""
fi

# --- Variables ---
WORK_USER="${WORK_USER:-$(logname 2>/dev/null || echo "${SUDO_USER:-}")}"
export WORK_USER

# --- Steps ---
STEPS=(
  "01-bootstrap.sh|Bootstrap OS (packages, user, swap)"
  "04-install-claude-code.sh|Node.js + Claude Code CLI"
  "06-install-code-server.sh|VS Code web (code-server)"
  "08-validate.sh|Validate setup"
)

# --- Parse arguments ---
SKIP_STEPS=()
ONLY_STEPS=()
FROM_STEP=0

while [[ $# -gt 0 ]]; do
  case $1 in
    --skip)
      shift
      while [[ $# -gt 0 && ! "$1" =~ ^-- ]]; do
        SKIP_STEPS+=("$1")
        shift
      done
      ;;
    --only)
      shift
      while [[ $# -gt 0 && ! "$1" =~ ^-- ]]; do
        ONLY_STEPS+=("$1")
        shift
      done
      ;;
    --from)
      FROM_STEP="$2"
      shift 2
      ;;
    --help|-h)
      echo "Usage: sudo bash setup.sh [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --skip N [N...]  Skip step(s) N"
      echo "  --only N [N...]  Run only step(s) N"
      echo "  --from N         Start from step N"
      echo "  --help           Show this help"
      echo ""
      echo "Steps:"
      for i in "${!STEPS[@]}"; do
        IFS='|' read -r script desc <<< "${STEPS[$i]}"
        printf "  %d. %-35s %s\n" "$((i+1))" "$script" "$desc"
      done
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# --- Banner ---
echo "╔══════════════════════════════════════════════════════╗"
echo "║   CLAUDE CODE MULTI-AGENT SETUP                     ║"
echo "║   Mobile-First — Setup rapide sur Ubuntu            ║"
echo "╠══════════════════════════════════════════════════════╣"
echo "║   User  : ${WORK_USER:-unknown}"
echo "║   Config: ${CONFIG_FILE}"
echo "║                                                      ║"
echo "║   Etapes :                                           ║"
echo "║     1. Packages systeme, swap, securite (SSH, UFW)   ║"
echo "║     2. Node.js + Claude Code CLI                     ║"
echo "║     3. VS Code web (code-server sur :8080)           ║"
echo "║     4. Validation                                    ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# --- Execute steps ---
for i in "${!STEPS[@]}"; do
  step_num=$((i+1))
  IFS='|' read -r script desc <<< "${STEPS[$i]}"

  # Skip logic
  if [[ $FROM_STEP -gt 0 && $step_num -lt $FROM_STEP ]]; then
    echo "[${step_num}/${#STEPS[@]}] SKIP (--from ${FROM_STEP}): ${desc}"
    continue
  fi

  if [[ ${#SKIP_STEPS[@]} -gt 0 ]]; then
    skip=false
    for s in "${SKIP_STEPS[@]}"; do
      if [[ "$s" == "$step_num" ]]; then
        skip=true
        break
      fi
    done
    if [[ "$skip" == "true" ]]; then
      echo "[${step_num}/${#STEPS[@]}] SKIP (--skip): ${desc}"
      continue
    fi
  fi

  if [[ ${#ONLY_STEPS[@]} -gt 0 ]]; then
    found=false
    for s in "${ONLY_STEPS[@]}"; do
      if [[ "$s" == "$step_num" ]]; then
        found=true
        break
      fi
    done
    if [[ "$found" == "false" ]]; then
      echo "[${step_num}/${#STEPS[@]}] SKIP (--only): ${desc}"
      continue
    fi
  fi

  echo ""
  echo "=========================================="
  echo "  [${step_num}/${#STEPS[@]}] ${desc}"
  echo "=========================================="

  script_path="${SCRIPT_DIR}/${script}"
  if [[ ! -f "$script_path" ]]; then
    echo "  ERROR: script not found: ${script_path}"
    continue
  fi

  # Step 1: bootstrap (root) + tmux config
  # Step 2: claude code (user, no root)
  # Step 3: code-server (root)
  # Step 4: validate (user)
  case $step_num in
    1)
      # Bootstrap: run as root, then install tmux config for user
      bash "${script_path}"
      echo ""
      echo "  -> Installing tmux config for user '${WORK_USER}'..."
      TMUX_CONF_SRC="${SCRIPT_DIR}/../configs/.tmux.conf"
      TMUX_CONF_DST="/home/${WORK_USER}/.tmux.conf"
      if [[ -f "$TMUX_CONF_SRC" ]]; then
        cp "$TMUX_CONF_SRC" "$TMUX_CONF_DST"
        chown "${WORK_USER}:${WORK_USER}" "$TMUX_CONF_DST"
        echo "  -> tmux config installed: ${TMUX_CONF_DST}"
      fi
      ;;
    2)
      # Claude Code: install as user (nvm + npm)
      su -l "${WORK_USER}" -c "bash ${script_path}"
      ;;
    4)
      # Validate: run as user
      su -l "${WORK_USER}" -c "bash ${script_path}"
      ;;
    *)
      # Step 3: run as root
      bash "${script_path}"
      ;;
  esac
done

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║   SETUP TERMINE !                                    ║"
echo "╠══════════════════════════════════════════════════════╣"
echo "║                                                      ║"
echo "║  ETAPES SUIVANTES :                                  ║"
echo "║                                                      ║"
echo "║  1. Configurer la cle API Anthropic :                ║"
echo "║     bash scripts/setup-api-key.sh sk-ant-api03-...   ║"
echo "║                                                      ║"
echo "║  2. Recharger le shell :                             ║"
echo "║     source ~/.bashrc                                 ║"
echo "║                                                      ║"
echo "║  3. Tester Claude Code :                             ║"
echo "║     claude \"say hello\"                               ║"
echo "║                                                      ║"
echo "║  4. Copier le template .claude/ dans ton projet :    ║"
echo "║     cp -r claude/ ~/workspace/mon-projet/.claude/    ║"
echo "║                                                      ║"
echo "║  5. Lancer le Forge :                                 ║"
echo "║     cd ~/workspace/mon-projet                        ║"
echo "║     bash scripts/forge-panes.sh --init               ║"
echo "║     tmux attach -t forge-<project>                   ║"
echo "║                                                      ║"
echo "║  ACCES DEPUIS L'IPHONE :                             ║"
echo "║    VS Code web : http://<IP>:8080                    ║"
echo "║    SSH (Termius) : ssh user@<IP>                     ║"
echo "║                                                      ║"
echo "║  NAVIGATION TMUX :                                   ║"
echo "║    Ctrl+A, 1..9  -> aller a l'agent N               ║"
echo "║    Ctrl+A, Tab   -> agent suivant                    ║"
echo "║    Ctrl+A, w     -> vue arbre (tous les agents)      ║"
echo "║    Ctrl+A, d     -> se detacher (agents continuent)  ║"
echo "║    tmux attach -t forge-<project> -> re-attacher      ║"
echo "║                                                      ║"
echo "╚══════════════════════════════════════════════════════╝"
