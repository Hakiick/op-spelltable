#!/usr/bin/env bash
set -euo pipefail

# ============================================
# FORGE ADD AGENTS — Ajoute dynamiquement des agents à une session forge existante
# Appelé par le forge (Team Lead) après analyse de l'US pour créer son équipe.
#
# Usage:
#   bash scripts/forge-add-agents.sh <agent1> <agent2> ...
#   bash scripts/forge-add-agents.sh --remove <agent>
#   bash scripts/forge-add-agents.sh --cleanup
#   bash scripts/forge-add-agents.sh --list
#
# Exemples:
#   bash scripts/forge-add-agents.sh mobile-dev responsive-tester stabilizer
#   bash scripts/forge-add-agents.sh --remove responsive-tester
#   bash scripts/forge-add-agents.sh --cleanup    # Retire tous les agents (garde orchestrateur + monitor)
# ============================================

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
source "$(dirname "$0")/forge-session-name.sh"
FORGE_DIR="${PROJECT_DIR}/.forge"
SCRIPTS_DIR="${PROJECT_DIR}/scripts"

# Couleurs
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
GRAY='\033[0;90m'
CYAN='\033[0;36m'
NC='\033[0m'

# --- Fonctions ---

show_usage() {
    echo -e "${GREEN}============================================${NC}"
    echo -e "${GREEN}  FORGE ADD AGENTS — Ajout dynamique${NC}"
    echo -e "${GREEN}============================================${NC}"
    echo ""
    echo "Usage:"
    echo "  bash scripts/forge-add-agents.sh <agent1> <agent2> ...   Ajouter des agents"
    echo "  bash scripts/forge-add-agents.sh --remove <agent>        Retirer un agent"
    echo "  bash scripts/forge-add-agents.sh --cleanup               Retirer TOUS les agents"
    echo "  bash scripts/forge-add-agents.sh --list                  Voir les agents actifs"
    echo ""
    echo "Pré-requis: session forge active (bash scripts/forge-panes.sh --init)"
}

check_session() {
    if ! tmux has-session -t "${SESSION_NAME}" 2>/dev/null; then
        echo -e "${RED}[forge]${NC} Aucune session '${SESSION_NAME}' active."
        echo -e "${GRAY}Lancez d'abord : bash scripts/forge-panes.sh --init${NC}"
        exit 1
    fi
}

add_agents() {
    local agents=("$@")
    local added=0

    check_session
    mkdir -p "${FORGE_DIR}/tasks" "${FORGE_DIR}/results" "${FORGE_DIR}/status"

    for agent in "${agents[@]}"; do
        # Vérifier si la window existe déjà
        if tmux list-windows -t "${SESSION_NAME}" -F '#{window_name}' 2>/dev/null | grep -qx "${agent}"; then
            echo -e "${YELLOW}[forge]${NC} Agent '${agent}' existe déjà — ignoré"
            continue
        fi

        # Créer la window agent AVANT la window monitor
        # On insère la nouvelle window juste avant "monitor"
        tmux new-window -t "${SESSION_NAME}" -n "${agent}" -c "${PROJECT_DIR}"
        tmux send-keys -t "${SESSION_NAME}:${agent}" \
            "cd ${PROJECT_DIR} && bash scripts/agent-watcher.sh ${agent} ${PROJECT_DIR}" Enter

        # Initialiser le statut
        echo "idle" > "${FORGE_DIR}/status/${agent}"

        echo -e "${GREEN}[forge]${NC} Agent '${agent}' ajouté — window créée + watcher lancé"
        added=$((added + 1))
    done

    if [ "${added}" -gt 0 ]; then
        echo ""
        echo -e "${GREEN}[forge]${NC} ${added} agent(s) ajouté(s) à la session."
        echo -e "${GRAY}  Navigation : Ctrl-b + w pour voir toutes les windows${NC}"
    fi

    # Revenir à la window orchestrateur
    tmux select-window -t "${SESSION_NAME}:orchestrateur" 2>/dev/null || true
}

remove_agent() {
    local agent="${1}"

    check_session

    if ! tmux list-windows -t "${SESSION_NAME}" -F '#{window_name}' 2>/dev/null | grep -qx "${agent}"; then
        echo -e "${YELLOW}[forge]${NC} Agent '${agent}' non trouvé dans la session."
        return 1
    fi

    # Protéger orchestrateur et monitor
    if [ "${agent}" = "orchestrateur" ] || [ "${agent}" = "monitor" ]; then
        echo -e "${RED}[forge]${NC} Impossible de supprimer '${agent}' (fenêtre système)."
        return 1
    fi

    # Mettre le statut en offline et fermer la window
    echo "offline" > "${FORGE_DIR}/status/${agent}"
    tmux kill-window -t "${SESSION_NAME}:${agent}" 2>/dev/null
    echo -e "${GREEN}[forge]${NC} Agent '${agent}' retiré."
}

cleanup_agents() {
    check_session

    local removed=0
    local system_windows="orchestrateur monitor"

    # Lister toutes les windows et supprimer celles qui ne sont pas système
    tmux list-windows -t "${SESSION_NAME}" -F '#{window_name}' 2>/dev/null | while read -r name; do
        # Ignorer les windows système
        case " ${system_windows} " in
            *" ${name} "*) continue ;;
        esac

        # Mettre le statut en offline et fermer la window
        if [ -f "${FORGE_DIR}/status/${name}" ]; then
            echo "offline" > "${FORGE_DIR}/status/${name}"
        fi
        tmux kill-window -t "${SESSION_NAME}:${name}" 2>/dev/null
        echo -e "${GREEN}[forge]${NC} Agent '${name}' retiré."
        removed=$((removed + 1))
    done

    # Compter les windows non-système restantes (grep -c retourne exit 1 si count=0)
    local total
    total=$(tmux list-windows -t "${SESSION_NAME}" -F '#{window_name}' 2>/dev/null | grep -cvE '^(orchestrateur|monitor)$') || total=0

    if [ "${total}" -eq 0 ]; then
        echo -e "${GREEN}[forge]${NC} Cleanup terminé — tous les agents ont été retirés."
    else
        echo -e "${YELLOW}[forge]${NC} ${total} window(s) restante(s) après cleanup."
    fi

    # Revenir à la window orchestrateur
    tmux select-window -t "${SESSION_NAME}:orchestrateur" 2>/dev/null || true
}

list_agents() {
    check_session

    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}  FORGE — Windows tmux actives${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

    printf "  ${GRAY}%-4s %-25s %-12s${NC}\n" "#" "WINDOW" "STATUS"
    echo -e "  ${GRAY}───────────────────────────────────────────${NC}"

    tmux list-windows -t "${SESSION_NAME}" -F '#{window_index} #{window_name}' 2>/dev/null | while read -r idx name; do
        status=""
        if [ -f "${FORGE_DIR}/status/${name}" ]; then
            status=$(cat "${FORGE_DIR}/status/${name}" 2>/dev/null || echo "")
        fi

        case "${name}" in
            orchestrateur) role="Team Lead" ;;
            monitor)       role="Dashboard" ;;
            *)             role="${status:-agent}" ;;
        esac

        # Couleur du status
        case "${status}" in
            idle)    color="${GRAY}" ;;
            pending) color="${YELLOW}" ;;
            working) color="${BLUE}" ;;
            done)    color="${GREEN}" ;;
            error)   color="${RED}" ;;
            *)       color="${NC}" ;;
        esac

        printf "  %-4s %-25s ${color}%-12s${NC}\n" "${idx}" "${name}" "${role}"
    done
    echo ""
}

# --- Main ---

case "${1:-}" in
    --remove)
        shift
        remove_agent "${1:?Usage: --remove <agent-name>}"
        ;;
    --cleanup)
        cleanup_agents
        ;;
    --list)
        list_agents
        ;;
    --help|-h|"")
        show_usage
        ;;
    *)
        # Tout argument non-flag est un nom d'agent
        add_agents "$@"
        ;;
esac
