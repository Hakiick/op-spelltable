#!/usr/bin/env bash
# Downloads a YOLOv8 card detection model for browser-based card detection.
#
# Two model options:
#   1. Playing cards model from HuggingFace (recommended for TCG cards)
#      - 52-class model trained on playing cards dataset
#      - Works for trading card detection (Pokemon, One Piece, etc.)
#
#   2. Generic YOLOv8n model (COCO 80-class, geometry-based filtering)
#      - Detects general objects, filters by card-like shape
#
# Usage:
#   bash scripts/download-card-detection-model.sh           # Card-specific model
#   bash scripts/download-card-detection-model.sh --generic  # Generic COCO model
#
# Prerequisites:
#   pip install ultralytics
#
# Alternative (no local model needed):
#   Set NEXT_PUBLIC_ROBOFLOW_API_KEY in .env.local
#   Get a free key at https://roboflow.com (free tier, no credit card)

set -euo pipefail

MODEL_DIR="public/ml"
mkdir -p "$MODEL_DIR"

MODE="${1:-card}"

# ---- Check prerequisites ----
if ! command -v python3 &>/dev/null; then
  echo "Error: python3 is required but not found."
  echo ""
  echo "Alternative: Use the Roboflow API instead (no Python needed):"
  echo "  1. Create a free account at https://roboflow.com"
  echo "  2. Get your publishable API key from project settings"
  echo "  3. Add to .env.local: NEXT_PUBLIC_ROBOFLOW_API_KEY=your_key"
  exit 1
fi

if ! python3 -c "import ultralytics" 2>/dev/null; then
  echo "Error: ultralytics not found."
  echo ""
  echo "  pip install ultralytics"
  echo ""
  echo "Then re-run this script."
  echo ""
  echo "Alternative: Use the Roboflow API instead (no Python needed):"
  echo "  1. Create a free account at https://roboflow.com"
  echo "  2. Get your publishable API key from project settings"
  echo "  3. Add to .env.local: NEXT_PUBLIC_ROBOFLOW_API_KEY=your_key"
  exit 1
fi

# ---- Generic COCO model ----
if [ "$MODE" = "--generic" ]; then
  OUTPUT="${MODEL_DIR}/yolov8n.onnx"

  if [ -f "$OUTPUT" ]; then
    echo "Model already exists at ${OUTPUT} ($(du -h "$OUTPUT" | cut -f1))"
    echo "Delete it first if you want to re-download."
    exit 0
  fi

  echo "Exporting generic YOLOv8n (COCO) to ONNX..."
  python3 -c "
from ultralytics import YOLO
model = YOLO('yolov8n.pt')
model.export(format='onnx', imgsz=640, simplify=True)
"
  mv "yolov8n.onnx" "$OUTPUT"
  rm -f "yolov8n.pt"
  echo "Done! Model saved to ${OUTPUT} ($(du -h "$OUTPUT" | cut -f1))"
  exit 0
fi

# ---- Card-specific model from HuggingFace ----
OUTPUT="${MODEL_DIR}/yolov8n.onnx"
HF_REPO="mustafakemal0146/playing-cards-yolov8"
HF_FILE="playing_cards_model_0_playing-cards-colab.pt"
HF_URL="https://huggingface.co/${HF_REPO}/resolve/main/${HF_FILE}"

if [ -f "$OUTPUT" ]; then
  echo "Model already exists at ${OUTPUT} ($(du -h "$OUTPUT" | cut -f1))"
  echo "Delete it first if you want to re-download."
  exit 0
fi

echo "Downloading playing cards YOLOv8n model from HuggingFace..."
echo "  Repo: ${HF_REPO}"
echo "  File: ${HF_FILE}"

# Download the .pt file
if command -v wget &>/dev/null; then
  wget -q --show-progress -O "$HF_FILE" "$HF_URL"
elif command -v curl &>/dev/null; then
  curl -L -o "$HF_FILE" "$HF_URL"
else
  echo "Error: wget or curl is required for download."
  exit 1
fi

echo "Converting to ONNX format (640x640)..."
python3 -c "
from ultralytics import YOLO
model = YOLO('${HF_FILE}')
model.export(format='onnx', imgsz=640, simplify=True)
"

# The export creates a file alongside the .pt
ONNX_FILE="${HF_FILE%.pt}.onnx"
mv "$ONNX_FILE" "$OUTPUT"
rm -f "$HF_FILE"

echo ""
echo "============================================"
echo "  Card detection model ready!"
echo "============================================"
echo ""
echo "  Model:    Playing Cards YOLOv8n (52 classes)"
echo "  Source:   HuggingFace ${HF_REPO}"
echo "  Saved to: ${OUTPUT} ($(du -h "$OUTPUT" | cut -f1))"
echo ""
echo "  Start the dev server and open /game/solo to test card detection."
