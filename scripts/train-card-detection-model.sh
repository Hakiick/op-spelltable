#!/usr/bin/env bash
#
# Train a YOLOv8n single-class "card" detector on synthetic data.
#
# This script chains:
#   1. Activate Python venv (.yolo-venv/)
#   2. Generate synthetic dataset (download cards + create images)
#   3. Train YOLOv8n on the dataset
#   4. Export to ONNX → public/ml/yolov8n.onnx
#
# Usage:
#   bash scripts/train-card-detection-model.sh
#   bash scripts/train-card-detection-model.sh --epochs 100 --num-train 2000
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
VENV_DIR="$PROJECT_ROOT/.yolo-venv"
PYTHON="$VENV_DIR/bin/python"

# Check venv exists
if [ ! -f "$PYTHON" ]; then
    echo "ERROR: Python venv not found at $VENV_DIR"
    echo "Create it with: python3 -m venv .yolo-venv && .yolo-venv/bin/pip install ultralytics opencv-python"
    exit 1
fi

# Parse arguments — split between dataset gen and training
NUM_TRAIN=1000
NUM_VAL=100
NUM_CARDS=300
SEED=42
EPOCHS=50
BATCH=16
SKIP_DOWNLOAD=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --num-train) NUM_TRAIN="$2"; shift 2 ;;
        --num-val) NUM_VAL="$2"; shift 2 ;;
        --num-cards) NUM_CARDS="$2"; shift 2 ;;
        --seed) SEED="$2"; shift 2 ;;
        --epochs) EPOCHS="$2"; shift 2 ;;
        --batch) BATCH="$2"; shift 2 ;;
        --skip-download) SKIP_DOWNLOAD="--skip-download"; shift ;;
        *) echo "Unknown argument: $1"; exit 1 ;;
    esac
done

echo "============================================================"
echo "OP SpellTable — Card Detection Model Training Pipeline"
echo "============================================================"
echo "  Python:     $PYTHON"
echo "  Train imgs: $NUM_TRAIN"
echo "  Val imgs:   $NUM_VAL"
echo "  Cards:      $NUM_CARDS"
echo "  Epochs:     $EPOCHS"
echo "  Batch:      $BATCH"
echo ""

# Step 1: Generate synthetic dataset
echo "[1/2] Generating synthetic dataset..."
"$PYTHON" "$SCRIPT_DIR/generate-synthetic-dataset.py" \
    --num-train "$NUM_TRAIN" \
    --num-val "$NUM_VAL" \
    --num-cards "$NUM_CARDS" \
    --seed "$SEED" \
    $SKIP_DOWNLOAD

echo ""

# Step 2: Train + export ONNX
echo "[2/2] Training YOLOv8n + exporting ONNX..."
"$PYTHON" "$SCRIPT_DIR/train-card-detector.py" \
    --epochs "$EPOCHS" \
    --batch "$BATCH"

echo ""
echo "============================================================"
echo "Done! Model at: public/ml/yolov8n.onnx"
echo ""
echo "Test it:"
echo "  npm run dev → open /game/solo → Start Recognition"
echo "============================================================"
