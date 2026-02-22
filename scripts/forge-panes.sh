#!/usr/bin/env bash
set -euo pipefail

# ============================================
# FORGE PANES — Orchestrateur multi-agents tmux
# Usage:
#   bash scripts/forge-panes.sh --init                        # Orchestrateur seul (les agents seront créés par le forge)
#   bash scripts/forge-panes.sh --agents <agent1> <agent2> ... # Session complète avec agents prédéfinis
#   bash scripts/forge-panes.sh --list
#   bash scripts/forge-panes.sh --kill
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

# --- Fonctions utilitaires ---

show_usage() {
    echo -e "${GREEN}============================================${NC}"
    echo -e "${GREEN}  FORGE — Multi-Agent Claude Orchestrator${NC}"
    echo -e "${GREEN}============================================${NC}"
    echo ""
    echo "Usage:"
    echo "  bash scripts/forge-panes.sh --init                          Lancer l'orchestrateur seul (mode autonome)"
    echo "  bash scripts/forge-panes.sh --agents <agent1> <agent2> ...  Session complète avec agents"
    echo "  bash scripts/forge-panes.sh --list                          Voir les agents actifs"
    echo "  bash scripts/forge-panes.sh --kill                          Fermer la session"
    echo ""
    echo "Mode recommandé (l'orchestrateur choisit ses agents) :"
    echo "  bash scripts/forge-panes.sh --init"
    echo "  tmux attach -t ${SESSION_NAME}"
    echo "  # puis dans la window orchestrateur : /forge <US-numero>"
    echo ""
    echo "Mode manuel (agents prédéfinis) :"
    echo "  bash scripts/forge-panes.sh --agents mobile-dev responsive-tester stabilizer"
}

kill_session() {
    if tmux has-session -t "${SESSION_NAME}" 2>/dev/null; then
        # Mettre tous les agents en offline
        if [ -d "${FORGE_DIR}/status" ]; then
            for status_file in "${FORGE_DIR}"/status/*; do
                [ -f "${status_file}" ] && echo "offline" > "${status_file}"
            done
        fi
        tmux kill-session -t "${SESSION_NAME}"
        echo -e "${GREEN}[forge]${NC} Session '${SESSION_NAME}' fermée."
    else
        echo -e "${YELLOW}[forge]${NC} Aucune session '${SESSION_NAME}' active."
    fi
}

list_agents() {
    if [ ! -d "${FORGE_DIR}/status" ]; then
        echo -e "${YELLOW}[forge]${NC} Aucun agent actif (.forge/status/ introuvable)"
        return
    fi

    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}  FORGE — Agents actifs${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    printf "  ${GRAY}%-25s %-12s %-20s${NC}\n" "AGENT" "STATUS" "DERNIERE MAJ"
    echo -e "  ${GRAY}─────────────────────────────────────────────────────────${NC}"

    for status_file in "${FORGE_DIR}"/status/*; do
        [ -f "${status_file}" ] || continue
        agent_name=$(basename "${status_file}")
        status=$(cat "${status_file}" 2>/dev/null || echo "unknown")
        last_mod=$(stat -c %Y "${status_file}" 2>/dev/null || stat -f %m "${status_file}" 2>/dev/null || echo "0")
        now=$(date +%s)
        ago=$(( now - last_mod ))

        # Formatage du temps
        if [ "${ago}" -lt 60 ]; then
            time_str="${ago}s ago"
        elif [ "${ago}" -lt 3600 ]; then
            time_str="$(( ago / 60 ))m ago"
        else
            time_str="$(( ago / 3600 ))h ago"
        fi

        # Couleur du status
        case "${status}" in
            idle)    color="${GRAY}" ;;
            pending) color="${YELLOW}" ;;
            working) color="${BLUE}" ;;
            done)    color="${GREEN}" ;;
            error)   color="${RED}" ;;
            offline) color="${RED}" ;;
            *)       color="${NC}" ;;
        esac

        printf "  %-25s ${color}%-12s${NC} %-20s\n" "${agent_name}" "${status}" "${time_str}"
    done
    echo ""
}

init_session() {
    # Vérifier si la session existe déjà
    if tmux has-session -t "${SESSION_NAME}" 2>/dev/null; then
        echo -e "${YELLOW}[forge]${NC} Session '${SESSION_NAME}' existe déjà. Utilisez --kill d'abord."
        exit 1
    fi

    # Créer le dossier .forge/
    mkdir -p "${FORGE_DIR}/tasks" "${FORGE_DIR}/results" "${FORGE_DIR}/status"

    # Créer la session tmux avec la fenêtre orchestrateur
    tmux new-session -d -s "${SESSION_NAME}" -n "orchestrateur" -c "${PROJECT_DIR}"

    # Fenêtre 1 : Orchestrateur — lance Claude en mode autonome
    tmux send-keys -t "${SESSION_NAME}:orchestrateur" \
        "cd ${PROJECT_DIR} && claude --dangerously-skip-permissions" Enter

    # Fenêtre monitor (la seule autre fenêtre au démarrage)
    tmux new-window -t "${SESSION_NAME}" -n "monitor" -c "${PROJECT_DIR}"
    tmux send-keys -t "${SESSION_NAME}:monitor" \
        "cd ${PROJECT_DIR} && bash scripts/forge-monitor.sh ${PROJECT_DIR}" Enter

    # Revenir à la fenêtre orchestrateur
    tmux select-window -t "${SESSION_NAME}:orchestrateur"

    # Afficher le résumé
    echo -e "${GREEN}============================================${NC}"
    echo -e "${GREEN}  FORGE — Orchestrateur autonome${NC}"
    echo -e "${GREEN}============================================${NC}"
    echo -e "  ${GRAY}Projet  :${NC} ${PROJECT_DIR}"
    echo -e "  ${GRAY}Session :${NC} ${SESSION_NAME}"
    echo -e "  ${GRAY}Mode    :${NC} Autonome (le forge crée ses agents)"
    echo -e "  ${GRAY}Windows :${NC}"
    printf "    ${CYAN}%-4s %-20s %-50s${NC}\n" "#" "NOM" "ROLE"
    echo -e "    ${GRAY}─────────────────────────────────────────────────${NC}"
    printf "    %-4s %-20s %-50s\n" "1" "orchestrateur" "Team Lead (claude --dangerously-skip-permissions)"
    printf "    %-4s %-20s %-50s\n" "2" "monitor" "Dashboard statuts agents"
    echo ""
    echo -e "  ${YELLOW}Les agents seront créés par le forge après analyse de l'US.${NC}"
    echo -e "  ${GRAY}Le forge utilisera : bash scripts/forge-add-agents.sh <agent1> <agent2> ...${NC}"
    echo ""
    echo -e "  ${GRAY}Commandes :${NC}"
    echo "    tmux attach -t ${SESSION_NAME}          Rejoindre la session"
    echo "    # puis dans l'orchestrateur : /forge <US-numero>"
    echo ""
}

create_session() {
    local agents=("$@")

    if [ ${#agents[@]} -eq 0 ]; then
        echo -e "${RED}[forge]${NC} Erreur: aucun agent spécifié"
        show_usage
        exit 1
    fi

    # Vérifier si la session existe déjà
    if tmux has-session -t "${SESSION_NAME}" 2>/dev/null; then
        echo -e "${YELLOW}[forge]${NC} Session '${SESSION_NAME}' existe déjà. Utilisez --kill d'abord."
        exit 1
    fi

    # Créer le dossier .forge/
    mkdir -p "${FORGE_DIR}/tasks" "${FORGE_DIR}/results" "${FORGE_DIR}/status"

    # Créer la session tmux avec la fenêtre orchestrateur
    tmux new-session -d -s "${SESSION_NAME}" -n "orchestrateur" -c "${PROJECT_DIR}"

    # Fenêtre 1 : Orchestrateur — lance Claude en mode autonome
    tmux send-keys -t "${SESSION_NAME}:orchestrateur" \
        "cd ${PROJECT_DIR} && claude --dangerously-skip-permissions" Enter

    # Créer une fenêtre pour chaque agent avec le watcher
    local window_num=2
    for agent in "${agents[@]}"; do
        tmux new-window -t "${SESSION_NAME}" -n "${agent}" -c "${PROJECT_DIR}"
        tmux send-keys -t "${SESSION_NAME}:${agent}" \
            "cd ${PROJECT_DIR} && bash scripts/agent-watcher.sh ${agent} ${PROJECT_DIR}" Enter
        window_num=$((window_num + 1))
    done

    # Fenêtre monitor
    tmux new-window -t "${SESSION_NAME}" -n "monitor" -c "${PROJECT_DIR}"
    tmux send-keys -t "${SESSION_NAME}:monitor" \
        "cd ${PROJECT_DIR} && bash scripts/forge-monitor.sh ${PROJECT_DIR}" Enter

    # Revenir à la fenêtre orchestrateur
    tmux select-window -t "${SESSION_NAME}:orchestrateur"

    # Afficher le résumé
    echo -e "${GREEN}============================================${NC}"
    echo -e "${GREEN}  FORGE — Multi-Agent Claude Orchestrator${NC}"
    echo -e "${GREEN}============================================${NC}"
    echo -e "  ${GRAY}Projet  :${NC} ${PROJECT_DIR}"
    echo -e "  ${GRAY}Session :${NC} ${SESSION_NAME}"
    echo -e "  ${GRAY}Agents  :${NC} ${agents[*]}"
    echo -e "  ${GRAY}Windows :${NC}"
    printf "    ${CYAN}%-4s %-20s %-50s${NC}\n" "#" "NOM" "ROLE"
    echo -e "    ${GRAY}─────────────────────────────────────────────────${NC}"
    printf "    %-4s %-20s %-50s\n" "1" "orchestrateur" "Team Lead (claude --dangerously-skip-permissions)"
    local i=2
    for agent in "${agents[@]}"; do
        printf "    %-4s %-20s %-50s\n" "${i}" "${agent}" "Monitor passif → agent-watcher.sh ${agent}"
        i=$((i + 1))
    done
    printf "    %-4s %-20s %-50s\n" "${i}" "monitor" "Dashboard statuts agents"
    echo ""
    echo -e "  ${GRAY}Commandes :${NC}"
    echo "    tmux attach -t ${SESSION_NAME}          Rejoindre la session"
    echo "    bash scripts/forge-panes.sh --list    Voir les agents actifs"
    echo "    bash scripts/forge-panes.sh --kill    Fermer la session"
    echo ""
    echo -e "  ${GRAY}Navigation tmux :${NC}"
    echo "    Ctrl-b + n / p                        Window suivante / précédente"
    echo "    Ctrl-b + w                            Liste des windows"
    echo "    Ctrl-b + <numéro>                     Aller à la window N"
    echo "    Ctrl-b + d                            Détacher la session"
    echo ""
    echo -e "  ${GRAY}Dispatch une tâche manuellement :${NC}"
    echo "    echo 'Ta tâche ici' > .forge/tasks/<agent>.md"
    echo "    echo 'pending' > .forge/status/<agent>"
    echo ""
}

# --- Main ---

case "${1:-}" in
    --init)
        init_session
        ;;
    --kill)
        kill_session
        ;;
    --list)
        list_agents
        ;;
    --agents)
        shift
        create_session "$@"
        ;;
    --help|-h|"")
        show_usage
        ;;
    *)
        echo -e "${RED}[forge]${NC} Option inconnue: $1"
        show_usage
        exit 1
        ;;
esac
