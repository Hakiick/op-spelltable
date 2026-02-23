#!/usr/bin/env bash
# Non-interactive screenshot on GNOME Wayland via XDG Desktop Portal.
# Usage: bash scripts/screenshot.sh [output_name]
#   output_name defaults to "screenshot"
#   Saves to pictures/<output_name>.png

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PICTURES_DIR="$PROJECT_DIR/pictures"
NAME="${1:-screenshot}"
OUTPUT="$PICTURES_DIR/$NAME.png"

python3 "$SCRIPT_DIR/screenshot-portal.py" "$OUTPUT"
