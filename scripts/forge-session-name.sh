#!/usr/bin/env bash
# forge-session-name.sh — Generates a unique tmux session name per project
# Source this file from any forge script:
#   source "$(dirname "$0")/forge-session-name.sh"
# Then use ${SESSION_NAME} which will be "forge-<project-dir-name>"

_FORGE_PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
_FORGE_PROJECT_NAME="$(basename "${_FORGE_PROJECT_DIR}")"

# Sanitize: lowercase, replace spaces/special chars with dashes, truncate
_FORGE_PROJECT_NAME="$(echo "${_FORGE_PROJECT_NAME}" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9-]/-/g' | sed 's/--*/-/g' | sed 's/^-//' | sed 's/-$//' | cut -c1-30)"

SESSION_NAME="forge-${_FORGE_PROJECT_NAME}"
