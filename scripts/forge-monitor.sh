#!/usr/bin/env bash
set -euo pipefail

# ============================================
# FORGE MONITOR — Dashboard temps réel des agents
# Usage: bash scripts/forge-monitor.sh [project-dir]
# ============================================

PROJECT_DIR="${1:-$(cd "$(dirname "$0")/.." && pwd)}"
FORGE_DIR="${PROJECT_DIR}/.forge"
REFRESH_INTERVAL=3

# Couleurs
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
GRAY='\033[0;90m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m'

# Cleanup au signal
cleanup() {
    tput cnorm 2>/dev/null  # Réafficher le curseur
    echo ""
    exit 0
}
trap cleanup SIGTERM SIGINT

# Cacher le curseur
tput civis 2>/dev/null

# Boucle principale
while true; do
    clear

    # Header
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}  FORGE MONITOR${NC}  ${GRAY}— $(date '+%Y-%m-%d %H:%M:%S')${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    if [ ! -d "${FORGE_DIR}/status" ]; then
        echo -e "  ${YELLOW}Aucun agent actif${NC} (.forge/status/ introuvable)"
        echo -e "  ${GRAY}Lancez : bash scripts/forge-panes.sh --agents <agent1> <agent2> ...${NC}"
        sleep "${REFRESH_INTERVAL}"
        continue
    fi

    # Compteurs
    count_idle=0
    count_pending=0
    count_working=0
    count_done=0
    count_error=0
    count_offline=0
    total=0

    # Header tableau
    printf "  ${WHITE}%-25s %-12s %-15s %-20s${NC}\n" "AGENT" "STATUS" "DERNIERE MAJ" "TACHE"
    echo -e "  ${GRAY}────────────────────────────────────────────────────────────────────────${NC}"

    # Parcourir les agents
    for status_file in "${FORGE_DIR}"/status/*; do
        [ -f "${status_file}" ] || continue
        total=$((total + 1))

        agent_name=$(basename "${status_file}")
        status=$(cat "${status_file}" 2>/dev/null || echo "unknown")

        # Calculer le temps écoulé
        last_mod=$(stat -c %Y "${status_file}" 2>/dev/null || stat -f %m "${status_file}" 2>/dev/null || echo "0")
        now=$(date +%s)
        ago=$(( now - last_mod ))

        if [ "${ago}" -lt 60 ]; then
            time_str="${ago}s"
        elif [ "${ago}" -lt 3600 ]; then
            time_str="$(( ago / 60 ))m $(( ago % 60 ))s"
        else
            time_str="$(( ago / 3600 ))h $(( ago / 60 % 60 ))m"
        fi

        # Lire le titre de la tache en cours
        task_title=""
        task_file="${FORGE_DIR}/tasks/${agent_name}.md"
        if [ -f "${task_file}" ] && { [ "${status}" = "working" ] || [ "${status}" = "pending" ]; }; then
            task_title=$(grep -m1 '^# ' "${task_file}" 2>/dev/null | sed 's/^# //' | cut -c1-25 || echo "")
        fi

        # Compteurs
        case "${status}" in
            idle)    count_idle=$((count_idle + 1));       color="${GRAY}";   icon="  " ;;
            pending) count_pending=$((count_pending + 1)); color="${YELLOW}"; icon=".. " ;;
            working) count_working=$((count_working + 1)); color="${BLUE}";   icon=">> " ;;
            done)    count_done=$((count_done + 1));       color="${GREEN}";  icon="OK " ;;
            error)   count_error=$((count_error + 1));     color="${RED}";    icon="!! " ;;
            offline) count_offline=$((count_offline + 1)); color="${RED}";    icon="-- " ;;
            *)       color="${NC}"; icon="?? " ;;
        esac

        printf "  ${color}${icon}%-22s %-12s${NC} %-15s ${GRAY}%-25s${NC}\n" \
            "${agent_name}" "${status}" "${time_str}" "${task_title}"
    done

    echo -e "  ${GRAY}────────────────────────────────────────────────────────────────────────${NC}"
    echo ""

    # Résumé
    echo -e "  ${WHITE}Résumé${NC} (${total} agents)"
    summary=""
    [ "${count_idle}" -gt 0 ]    && summary="${summary}  ${GRAY}${count_idle} idle${NC}"
    [ "${count_pending}" -gt 0 ] && summary="${summary}  ${YELLOW}${count_pending} pending${NC}"
    [ "${count_working}" -gt 0 ] && summary="${summary}  ${BLUE}${count_working} working${NC}"
    [ "${count_done}" -gt 0 ]    && summary="${summary}  ${GREEN}${count_done} done${NC}"
    [ "${count_error}" -gt 0 ]   && summary="${summary}  ${RED}${count_error} error${NC}"
    [ "${count_offline}" -gt 0 ] && summary="${summary}  ${RED}${count_offline} offline${NC}"
    echo -e " ${summary}"
    echo ""

    # Derniers résultats (agents en done ou error)
    has_results=false
    for status_file in "${FORGE_DIR}"/status/*; do
        [ -f "${status_file}" ] || continue
        agent_name=$(basename "${status_file}")
        status=$(cat "${status_file}" 2>/dev/null || echo "")
        result_file="${FORGE_DIR}/results/${agent_name}.md"

        if { [ "${status}" = "done" ] || [ "${status}" = "error" ]; } && [ -f "${result_file}" ]; then
            if [ "${has_results}" = false ]; then
                echo -e "  ${WHITE}Derniers résultats${NC}"
                echo -e "  ${GRAY}────────────────────────────────────────────────────────────────────────${NC}"
                has_results=true
            fi
            result_lines=$(wc -l < "${result_file}" 2>/dev/null || echo "0")
            result_size=$(du -h "${result_file}" 2>/dev/null | cut -f1 || echo "?")
            if [ "${status}" = "done" ]; then
                echo -e "  ${GREEN}[${agent_name}]${NC} ${result_lines} lignes (${result_size})"
            else
                echo -e "  ${RED}[${agent_name}]${NC} ${result_lines} lignes (${result_size}) — ERREUR"
            fi
        fi
    done

    echo ""
    echo -e "  ${GRAY}Refresh: ${REFRESH_INTERVAL}s | Ctrl+C pour quitter${NC}"

    sleep "${REFRESH_INTERVAL}"
done
