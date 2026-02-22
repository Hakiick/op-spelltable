#!/usr/bin/env bash
set -euo pipefail
# collect.sh — Lit le résultat d'un agent et le marque idle
# Usage:
#   bash scripts/collect.sh <agent>           # Affiche le résultat
#   bash scripts/collect.sh <agent> --wait    # Attend que l'agent soit done, puis affiche
#   bash scripts/collect.sh --all             # Affiche tous les résultats disponibles

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
FORGE_DIR="$PROJECT_DIR/.forge"
SCRIPT_NAME="$(basename "$0")"

# ── Couleurs ──────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color

# ── Fonctions utilitaires ────────────────────────────────────────────

usage() {
  cat <<EOF
Usage:
  $SCRIPT_NAME <agent>           # Show result
  $SCRIPT_NAME <agent> --wait    # Wait for done, then show result
  $SCRIPT_NAME --all             # Show all available results
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

warn() {
  echo -e "${YELLOW}[$SCRIPT_NAME] WARNING: $1${NC}" >&2
}

success() {
  echo -e "${GREEN}[$SCRIPT_NAME]${NC} $1"
}

# ── Vérification des arguments ───────────────────────────────────────

[[ $# -lt 1 ]] && usage

# ── Fonctions principales ────────────────────────────────────────────

get_status() {
  local agent="$1"
  local status_file="$FORGE_DIR/status/$agent"
  if [[ -f "$status_file" ]]; then
    cat "$status_file"
  else
    echo "unknown"
  fi
}

collect_agent() {
  local agent="$1"
  local result_file="$FORGE_DIR/results/$agent.md"
  local status_file="$FORGE_DIR/status/$agent"

  # Vérifier que le fichier résultat existe
  if [[ ! -f "$result_file" ]]; then
    echo -e "${YELLOW}No result from '$agent' yet${NC}"
    return 1
  fi

  # Vérifier le status
  local status
  status=$(get_status "$agent")
  if [[ "$status" != "done" ]]; then
    warn "Agent '$agent' status is '$status', result may be incomplete"
  fi

  # Afficher le résultat
  echo -e "${CYAN}━━━ Result from ${BLUE}$agent${CYAN} ━━━${NC}"
  echo ""
  cat "$result_file"
  echo ""
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

  # Remettre le status à idle
  echo "idle" > "$status_file"
  success "Agent '$agent' marked as idle"
}

wait_and_collect() {
  local agent="$1"
  local status

  info "Waiting for agent '$agent' to finish..."

  while true; do
    status=$(get_status "$agent")
    case "$status" in
      done)
        info "Agent '$agent' is done!"
        collect_agent "$agent"
        return 0
        ;;
      error)
        warn "Agent '$agent' ended with error status"
        collect_agent "$agent"
        return 1
        ;;
      idle)
        warn "Agent '$agent' is idle (no task in progress)"
        return 1
        ;;
      busy)
        echo -ne "${GRAY}\r  Agent '$agent' is busy... waiting 3s${NC}"
        sleep 3
        ;;
      *)
        warn "Agent '$agent' has unknown status: $status"
        sleep 3
        ;;
    esac
  done
}

# ── Mode --all ───────────────────────────────────────────────────────

if [[ "$1" == "--all" ]]; then
  mkdir -p "$FORGE_DIR/results"

  results_found=false
  for result_file in "$FORGE_DIR/results"/*.md; do
    [[ ! -f "$result_file" ]] && continue
    results_found=true
    agent=$(basename "$result_file" .md)
    collect_agent "$agent"
    echo ""
  done

  if [[ "$results_found" == false ]]; then
    info "No results available from any agent"
  fi
  exit 0
fi

# ── Mode agent unique ────────────────────────────────────────────────

AGENT="$1"
shift

WAIT_MODE=false
if [[ $# -gt 0 && "$1" == "--wait" ]]; then
  WAIT_MODE=true
fi

mkdir -p "$FORGE_DIR/status" "$FORGE_DIR/results"

if [[ "$WAIT_MODE" == true ]]; then
  wait_and_collect "$AGENT"
else
  collect_agent "$AGENT"
fi
