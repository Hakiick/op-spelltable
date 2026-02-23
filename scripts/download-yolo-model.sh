#!/usr/bin/env bash
# Downloads YOLOv8n ONNX model for browser-based card detection.
#
# Two methods available:
#   1. Direct Python export (preferred — guaranteed compatible)
#   2. Fallback: download from Python + ultralytics
#
# Usage:
#   bash scripts/download-yolo-model.sh
#
# Prerequisites for export method:
#   pip install ultralytics onnx

set -euo pipefail

MODEL_DIR="public/ml"
MODEL_NAME="yolov8n"
OUTPUT="${MODEL_DIR}/${MODEL_NAME}.onnx"

mkdir -p "$MODEL_DIR"

if [ -f "$OUTPUT" ]; then
  echo "Model already exists at ${OUTPUT} ($(du -h "$OUTPUT" | cut -f1))"
  echo "Delete it first if you want to re-download."
  exit 0
fi

# Try Python export (most reliable)
if command -v python3 &>/dev/null; then
  if python3 -c "import ultralytics" 2>/dev/null; then
    echo "Exporting ${MODEL_NAME} to ONNX format (640x640) via ultralytics..."
    python3 -c "
from ultralytics import YOLO
model = YOLO('${MODEL_NAME}.pt')
model.export(format='onnx', imgsz=640, simplify=True)
"
    mv "${MODEL_NAME}.onnx" "$OUTPUT"
    rm -f "${MODEL_NAME}.pt"
    echo "Done! Model saved to ${OUTPUT} ($(du -h "$OUTPUT" | cut -f1))"
    exit 0
  fi
fi

echo "============================================"
echo "  ultralytics not found"
echo "============================================"
echo ""
echo "To get the YOLOv8n ONNX model, run:"
echo ""
echo "  pip install ultralytics"
echo "  bash scripts/download-yolo-model.sh"
echo ""
echo "Or manually in Python:"
echo ""
echo "  from ultralytics import YOLO"
echo "  model = YOLO('yolov8n.pt')"
echo "  model.export(format='onnx', imgsz=640, simplify=True)"
echo ""
echo "Then move yolov8n.onnx to ${OUTPUT}"
echo ""
echo "Note: The app works without this model — card detection"
echo "will be disabled, but recognition still processes the full frame."
exit 1
