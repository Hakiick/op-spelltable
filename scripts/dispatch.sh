#!/usr/bin/env bash
set -euo pipefail
# dispatch.sh — Envoie une tâche à un agent pane
# Usage:
#   bash scripts/dispatch.sh <agent> "prompt court"
#   bash scripts/dispatch.sh <agent> --file /path/to/task.md
#   bash scripts/dispatch.sh <agent> --status
#   bash scripts/dispatch.sh <agent> --force "prompt court"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
FORGE_DIR="$PROJECT_DIR/.forge"
SCRIPT_NAME="$(basename "$0")"
source "${SCRIPT_DIR}/forge-session-name.sh"

# ── Couleurs ──────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ── Fonctions utilitaires ────────────────────────────────────────────

usage() {
  cat <<EOF
Usage:
  $SCRIPT_NAME <agent> "prompt court"
  $SCRIPT_NAME <agent> --file /path/to/task.md
  $SCRIPT_NAME <agent> --status
  $SCRIPT_NAME <agent> --force "prompt court"
  $SCRIPT_NAME <agent> --force --file /path/to/task.md
EOF
  exit 1
}

err() {
  echo -e "${RED}[$SCRIPT_NAME] ERROR: $1${NC}" >&2
  exit 1
}

info() {
  echo -e "${BLUE}[$SCRIPT_NAME]${NC} $1"
}

success() {
  echo -e "${GREEN}[$SCRIPT_NAME]${NC} $1"
}

warn() {
  echo -e "${YELLOW}[$SCRIPT_NAME]${NC} $1"
}

# ── Vérification des arguments ───────────────────────────────────────

[[ $# -lt 2 ]] && usage

AGENT="$1"
shift

# ── Vérification de la session tmux forge ────────────────────────────

check_forge_session() {
  if ! tmux has-session -t "${SESSION_NAME}" 2>/dev/null; then
    err "No forge session '${SESSION_NAME}'. Run: bash scripts/forge-panes.sh"
  fi
}

# ── Vérification des répertoires forge ───────────────────────────────

ensure_forge_dirs() {
  mkdir -p "$FORGE_DIR/status" "$FORGE_DIR/tasks" "$FORGE_DIR/results"
}

# ── Lire le status d'un agent ────────────────────────────────────────

get_status() {
  local agent="$1"
  local status_file="$FORGE_DIR/status/$agent"
  if [[ -f "$status_file" ]]; then
    cat "$status_file"
  else
    echo "idle"
  fi
}

# ── Trouver le pane tmux de l'agent ──────────────────────────────────

find_agent_pane() {
  local agent="$1"
  local pane_index
  pane_index=$(tmux list-panes -t "${SESSION_NAME}" -F '#{pane_index} #{pane_title}' | grep "$agent" | awk '{print $1}')
  if [[ -z "$pane_index" ]]; then
    err "No pane found for agent '$agent' in session '${SESSION_NAME}'"
  fi
  echo "$pane_index"
}

# ── Option --status ──────────────────────────────────────────────────

if [[ "$1" == "--status" ]]; then
  ensure_forge_dirs
  status=$(get_status "$AGENT")
  task_file="$FORGE_DIR/tasks/$AGENT.md"
  task_summary="—"
  if [[ -f "$task_file" ]]; then
    task_summary=$(head -n 1 "$task_file")
  fi

  case "$status" in
    idle)  echo -e "Agent ${BLUE}$AGENT${NC}: idle  | Task: $task_summary" ;;
    busy)  echo -e "Agent ${BLUE}$AGENT${NC}: busy  | Task: $task_summary" ;;
    done)  echo -e "Agent ${BLUE}$AGENT${NC}: done  | Task: $task_summary" ;;
    error) echo -e "Agent ${BLUE}$AGENT${NC}: error | Task: $task_summary" ;;
    *)     echo -e "Agent ${BLUE}$AGENT${NC}: ? $status | Task: $task_summary" ;;
  esac
  exit 0
fi

# ── Parsing des options ──────────────────────────────────────────────

FORCE=false
FILE_MODE=false
TASK_FILE=""
PROMPT=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --force)
      FORCE=true
      shift
      ;;
    --file)
      FILE_MODE=true
      TASK_FILE="${2:-}"
      [[ -z "$TASK_FILE" ]] && err "Missing file path after --file"
      shift 2
      ;;
    *)
      PROMPT="$1"
      shift
      ;;
  esac
done

# ── Validations ──────────────────────────────────────────────────────

if [[ "$FILE_MODE" == true ]]; then
  [[ ! -f "$TASK_FILE" ]] && err "Task file not found: $TASK_FILE"
elif [[ -z "$PROMPT" ]]; then
  err "No prompt or --file provided"
fi

check_forge_session
ensure_forge_dirs

# ── Vérification du status de l'agent ────────────────────────────────

current_status=$(get_status "$AGENT")

if [[ "$current_status" == "busy" && "$FORCE" == false ]]; then
  err "Agent '$AGENT' is busy. Wait or use --force"
fi

if [[ "$current_status" == "busy" && "$FORCE" == true ]]; then
  warn "Agent '$AGENT' is busy — forcing dispatch"
fi

# ── Écrire la tâche ─────────────────────────────────────────────────

if [[ "$FILE_MODE" == true ]]; then
  cp "$TASK_FILE" "$FORGE_DIR/tasks/$AGENT.md"
  PROMPT=$(cat "$TASK_FILE")
  info "Task file copied to .forge/tasks/$AGENT.md"
else
  echo "$PROMPT" > "$FORGE_DIR/tasks/$AGENT.md"
  info "Prompt written to .forge/tasks/$AGENT.md"
fi

# ── Mettre le status à busy ─────────────────────────────────────────

echo "busy" > "$FORGE_DIR/status/$AGENT"

# ── Trouver le pane et envoyer le prompt ─────────────────────────────

PANE_INDEX=$(find_agent_pane "$AGENT")
TARGET="${SESSION_NAME}:${PANE_INDEX}"

prompt_length=${#PROMPT}

if [[ $prompt_length -lt 200 ]]; then
  # Prompt court : envoi direct via send-keys
  tmux send-keys -t "$TARGET" "$PROMPT" Enter
  info "Prompt sent directly via send-keys ($prompt_length chars)"
else
  # Prompt long : utiliser load-buffer + paste-buffer
  TMPFILE=$(mktemp /tmp/dispatch-XXXXXX.txt)
  echo "$PROMPT" > "$TMPFILE"
  tmux load-buffer "$TMPFILE"
  tmux paste-buffer -t "$TARGET"
  tmux send-keys -t "$TARGET" Enter
  rm -f "$TMPFILE"
  info "Prompt sent via load-buffer + paste-buffer ($prompt_length chars)"
fi

# ── Confirmation ─────────────────────────────────────────────────────

success "Task dispatched to agent '$AGENT' (pane $PANE_INDEX)"
