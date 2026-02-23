#!/usr/bin/env bash
# Downloads and exports a YOLOv8 card detection model to ONNX format.
#
# Options:
#   --roboflow   Download One Piece TCG dataset from Roboflow, train, export
#   --huggingface Download pre-trained playing cards model from HuggingFace
#   --generic    Export generic YOLOv8n (COCO 80-class)
#   (no flag)    Defaults to --roboflow
#
# Prerequisites:
#   pip install ultralytics roboflow
#
# The exported ONNX model is placed in public/ml/yolov8n.onnx and used
# by the browser-side ONNX Runtime Web inference (no API key at runtime).

set -euo pipefail

MODEL_DIR="public/ml"
OUTPUT="${MODEL_DIR}/yolov8n.onnx"
MODE="${1:---roboflow}"

mkdir -p "$MODEL_DIR"

if [ -f "$OUTPUT" ]; then
  echo "Model already exists at ${OUTPUT} ($(du -h "$OUTPUT" | cut -f1))"
  echo "Delete it first if you want to re-download."
  exit 0
fi

# ---- Check Python ----
if ! command -v python3 &>/dev/null; then
  echo "Error: python3 is required."
  exit 1
fi

if ! python3 -c "import ultralytics" 2>/dev/null; then
  echo "Error: ultralytics not found. Run: pip install ultralytics"
  exit 1
fi

# ===========================================================================
# Option 1: Roboflow One Piece TCG dataset → train → export
# ===========================================================================
if [ "$MODE" = "--roboflow" ]; then
  if ! python3 -c "import roboflow" 2>/dev/null; then
    echo "Error: roboflow not found. Run: pip install roboflow"
    exit 1
  fi

  echo "============================================"
  echo "  One Piece TCG Card Detection Model"
  echo "============================================"
  echo ""
  echo "This will:"
  echo "  1. Download the One Piece TCG dataset from Roboflow"
  echo "  2. Train YOLOv8n on it (~10-30 min depending on hardware)"
  echo "  3. Export the trained model to ONNX"
  echo ""

  # Prompt for API key if not in env
  if [ -z "${ROBOFLOW_API_KEY:-}" ]; then
    echo "You need a Roboflow API key (free account):"
    echo "  1. Go to https://app.roboflow.com → Settings → API Keys"
    echo "  2. Copy your Private API key"
    echo ""
    read -rp "Roboflow API key: " ROBOFLOW_API_KEY
  fi

  python3 << PYEOF
import os
from roboflow import Roboflow

api_key = "${ROBOFLOW_API_KEY}"
rf = Roboflow(api_key=api_key)

# Download the One Piece TCG card detection dataset
project = rf.workspace("one-piece-card-game").project("onepiece-card-game-legoh")
version = project.version(1)
dataset = version.download("yolov8", location="./op-card-dataset")

print("Dataset downloaded to ./op-card-dataset")
print("Starting YOLOv8n training...")

from ultralytics import YOLO

model = YOLO("yolov8n.pt")
model.train(
    data="./op-card-dataset/data.yaml",
    epochs=50,
    imgsz=640,
    batch=16,
    name="op-card-detection",
    patience=10,
)

# Export best model to ONNX
best_path = "./runs/detect/op-card-detection/weights/best.pt"
if not os.path.exists(best_path):
    # Try alternative path
    import glob
    candidates = glob.glob("./runs/detect/*/weights/best.pt")
    if candidates:
        best_path = candidates[-1]
    else:
        raise FileNotFoundError("Training did not produce a best.pt weights file")

trained = YOLO(best_path)
trained.export(format="onnx", imgsz=640, simplify=True)

onnx_path = best_path.replace(".pt", ".onnx")
os.rename(onnx_path, "${OUTPUT}")
print(f"Model exported to ${OUTPUT}")
PYEOF

  # Cleanup
  rm -rf ./op-card-dataset ./runs ./yolov8n.pt 2>/dev/null || true

  echo ""
  echo "============================================"
  echo "  Model ready: ${OUTPUT} ($(du -h "$OUTPUT" | cut -f1))"
  echo "============================================"
  echo ""
  echo "  Start the dev server and open /game/solo to test."
  exit 0
fi

# ===========================================================================
# Option 2: HuggingFace pre-trained playing cards model
# ===========================================================================
if [ "$MODE" = "--huggingface" ]; then
  HF_REPO="mustafakemal0146/playing-cards-yolov8"
  HF_FILE="playing_cards_model_0_playing-cards-colab.pt"
  HF_URL="https://huggingface.co/${HF_REPO}/resolve/main/${HF_FILE}"

  echo "Downloading playing cards YOLOv8n from HuggingFace..."

  if command -v wget &>/dev/null; then
    wget -q --show-progress -O "$HF_FILE" "$HF_URL"
  elif command -v curl &>/dev/null; then
    curl -L -o "$HF_FILE" "$HF_URL"
  else
    echo "Error: wget or curl required."
    exit 1
  fi

  echo "Converting to ONNX..."
  python3 -c "
from ultralytics import YOLO
model = YOLO('${HF_FILE}')
model.export(format='onnx', imgsz=640, simplify=True)
"
  mv "${HF_FILE%.pt}.onnx" "$OUTPUT"
  rm -f "$HF_FILE"

  echo "Done! Model saved to ${OUTPUT} ($(du -h "$OUTPUT" | cut -f1))"
  exit 0
fi

# ===========================================================================
# Option 3: Generic YOLOv8n (COCO)
# ===========================================================================
if [ "$MODE" = "--generic" ]; then
  echo "Exporting generic YOLOv8n (COCO 80-class) to ONNX..."
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

echo "Unknown option: $MODE"
echo "Usage: bash scripts/download-card-detection-model.sh [--roboflow|--huggingface|--generic]"
exit 1
