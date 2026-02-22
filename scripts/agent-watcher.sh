#!/usr/bin/env bash
set -euo pipefail

# ============================================
# AGENT WATCHER — Moniteur passif d'un agent forge
# Affiche en temps réel le statut et les résultats d'un agent.
# Le travail est exécuté par le forge (orchestrateur) via Task() subagents.
# Usage: bash scripts/agent-watcher.sh <agent-name> [project-dir]
# ============================================

AGENT_NAME="${1:?Usage: agent-watcher.sh <agent-name> [project-dir]}"
PROJECT_DIR="${2:-$(pwd)}"
FORGE_DIR="${PROJECT_DIR}/.forge"
STATUS_FILE="${FORGE_DIR}/status/${AGENT_NAME}"
TASK_FILE="${FORGE_DIR}/tasks/${AGENT_NAME}.md"
RESULT_FILE="${FORGE_DIR}/results/${AGENT_NAME}.md"
POLL_INTERVAL=2
HEARTBEAT_INTERVAL=30
HEARTBEAT_COUNT=0

# Couleurs
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
GRAY='\033[0;90m'
CYAN='\033[0;36m'
NC='\033[0m'

# Cleanup au signal
cleanup() {
    echo -e "\n${YELLOW}[${AGENT_NAME}]${NC} Arrêt du moniteur..."
    echo "offline" > "${STATUS_FILE}"
    exit 0
}
trap cleanup SIGTERM SIGINT

# Initialisation
mkdir -p "${FORGE_DIR}/tasks" "${FORGE_DIR}/results" "${FORGE_DIR}/status"
echo "idle" > "${STATUS_FILE}"

echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  AGENT MONITOR — ${AGENT_NAME}${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GRAY}  Mode    : Passif (exécution via forge Task())${NC}"
echo -e "${GRAY}  Projet  : ${PROJECT_DIR}${NC}"
echo -e "${GRAY}  Tâche   : ${TASK_FILE}${NC}"
echo -e "${GRAY}  Résultat: ${RESULT_FILE}${NC}"
echo -e "${GRAY}  Status  : ${STATUS_FILE}${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}[${AGENT_NAME}]${NC} En attente — le forge orchestre l'exécution..."

PREV_STATUS="idle"
PREV_TASK_HASH=""
PREV_RESULT_HASH=""

# Boucle principale — monitoring passif
while true; do
    CURRENT_STATUS=$(cat "${STATUS_FILE}" 2>/dev/null || echo "unknown")

    # Détecter un changement de statut
    if [ "${CURRENT_STATUS}" != "${PREV_STATUS}" ]; then
        TIMESTAMP=$(date '+%H:%M:%S')

        case "${CURRENT_STATUS}" in
            idle)
                echo -e "${GRAY}[${AGENT_NAME}]${NC} idle — ${TIMESTAMP}"
                ;;
            pending)
                echo -e "\n${YELLOW}[${AGENT_NAME}]${NC} Tâche assignée — ${TIMESTAMP}"
                # Afficher le titre de la tâche
                if [ -f "${TASK_FILE}" ]; then
                    TASK_TITLE=$(grep -m1 '^# ' "${TASK_FILE}" 2>/dev/null | sed 's/^# //' || echo "")
                    [ -n "${TASK_TITLE}" ] && echo -e "${GRAY}  → ${TASK_TITLE}${NC}"
                fi
                ;;
            working)
                echo -e "${BLUE}[${AGENT_NAME}]${NC} En cours d'exécution — ${TIMESTAMP}"
                # Afficher le contenu de la tâche
                if [ -f "${TASK_FILE}" ]; then
                    echo -e "${GRAY}  ┌─────────────────────────────────────────${NC}"
                    head -20 "${TASK_FILE}" 2>/dev/null | while IFS= read -r line; do
                        echo -e "${GRAY}  │ ${line}${NC}"
                    done
                    TASK_LINES=$(wc -l < "${TASK_FILE}" 2>/dev/null || echo "0")
                    if [ "${TASK_LINES}" -gt 20 ]; then
                        echo -e "${GRAY}  │ ... (${TASK_LINES} lignes au total)${NC}"
                    fi
                    echo -e "${GRAY}  └─────────────────────────────────────────${NC}"
                fi
                ;;
            done)
                echo -e "\n${GREEN}[${AGENT_NAME}]${NC} Tâche terminée — ${TIMESTAMP}"
                # Afficher le résultat
                if [ -f "${RESULT_FILE}" ]; then
                    RESULT_LINES=$(wc -l < "${RESULT_FILE}" 2>/dev/null || echo "0")
                    echo -e "${GREEN}  Résultat: ${RESULT_LINES} lignes${NC}"
                    echo -e "${GRAY}  ┌─────────────────────────────────────────${NC}"
                    tail -15 "${RESULT_FILE}" 2>/dev/null | while IFS= read -r line; do
                        echo -e "${GRAY}  │ ${line}${NC}"
                    done
                    echo -e "${GRAY}  └─────────────────────────────────────────${NC}"
                fi
                ;;
            error)
                echo -e "\n${RED}[${AGENT_NAME}]${NC} Erreur — ${TIMESTAMP}"
                # Afficher l'erreur
                if [ -f "${RESULT_FILE}" ]; then
                    echo -e "${RED}  ┌─────────────────────────────────────────${NC}"
                    tail -10 "${RESULT_FILE}" 2>/dev/null | while IFS= read -r line; do
                        echo -e "${RED}  │ ${line}${NC}"
                    done
                    echo -e "${RED}  └─────────────────────────────────────────${NC}"
                fi
                ;;
            offline)
                echo -e "${RED}[${AGENT_NAME}]${NC} Offline — ${TIMESTAMP}"
                ;;
            *)
                echo -e "${GRAY}[${AGENT_NAME}]${NC} ? ${CURRENT_STATUS} — ${TIMESTAMP}"
                ;;
        esac

        PREV_STATUS="${CURRENT_STATUS}"
        HEARTBEAT_COUNT=0
    else
        # Heartbeat discret pendant idle ou working
        HEARTBEAT_COUNT=$((HEARTBEAT_COUNT + POLL_INTERVAL))
        if [ "${HEARTBEAT_COUNT}" -ge "${HEARTBEAT_INTERVAL}" ]; then
            if [ "${CURRENT_STATUS}" = "working" ]; then
                echo -e "${BLUE}[${AGENT_NAME}]${NC} working — $(date +%H:%M:%S)"
            elif [ "${CURRENT_STATUS}" = "idle" ]; then
                echo -e "${GRAY}[${AGENT_NAME}]${NC} idle — $(date +%H:%M:%S)"
            fi
            HEARTBEAT_COUNT=0
        fi
    fi

    sleep "${POLL_INTERVAL}"
done
