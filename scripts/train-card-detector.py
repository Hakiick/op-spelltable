#!/usr/bin/env python3
"""
Train YOLOv8n single-class ("card") detector on synthetic data and export to ONNX.

Prerequisites:
  - Synthetic dataset generated at datasets/synthetic/ (via generate-synthetic-dataset.py)
  - Python venv at .yolo-venv/ with ultralytics, torch, opencv-python

Usage:
  .yolo-venv/bin/python scripts/train-card-detector.py
  .yolo-venv/bin/python scripts/train-card-detector.py --epochs 100 --batch 32
"""

from __future__ import annotations

import argparse
import shutil
from pathlib import Path

from ultralytics import YOLO

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATASET_DIR = PROJECT_ROOT / "datasets" / "synthetic"
OUTPUT_DIR = PROJECT_ROOT / "public" / "ml"


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Train YOLOv8n card detector and export ONNX"
    )
    parser.add_argument("--epochs", type=int, default=50, help="Training epochs (default: 50)")
    parser.add_argument("--batch", type=int, default=16, help="Batch size (default: 16)")
    parser.add_argument("--imgsz", type=int, default=640, help="Image size (default: 640)")
    parser.add_argument("--patience", type=int, default=15, help="Early stopping patience (default: 15)")
    parser.add_argument("--resume", action="store_true", help="Resume training from last checkpoint")
    args = parser.parse_args()

    data_yaml = DATASET_DIR / "data.yaml"
    if not data_yaml.exists():
        print(f"ERROR: {data_yaml} not found. Run generate-synthetic-dataset.py first.")
        raise SystemExit(1)

    print("=" * 60)
    print("YOLOv8n Card Detector Training")
    print("=" * 60)
    print(f"  Dataset:  {data_yaml}")
    print(f"  Epochs:   {args.epochs}")
    print(f"  Batch:    {args.batch}")
    print(f"  Img size: {args.imgsz}")
    print()

    # Load pretrained YOLOv8n (COCO weights for transfer learning)
    model = YOLO("yolov8n.pt")

    # Train
    model.train(
        data=str(data_yaml),
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        patience=args.patience,
        optimizer="AdamW",
        lr0=0.01,
        momentum=0.937,
        weight_decay=0.0005,
        # Augmentations (ultralytics built-in)
        hsv_h=0.015,
        hsv_s=0.7,
        hsv_v=0.4,
        degrees=15.0,
        scale=0.5,
        fliplr=0.5,
        mosaic=1.0,
        mixup=0.1,
        copy_paste=0.1,
        # Output
        project=str(PROJECT_ROOT / "runs" / "detect"),
        name="card-detector",
        exist_ok=True,
        resume=args.resume,
    )

    # Export best model to ONNX
    print()
    print("Exporting best model to ONNX...")
    best_pt = PROJECT_ROOT / "runs" / "detect" / "card-detector" / "weights" / "best.pt"
    if not best_pt.exists():
        print(f"ERROR: {best_pt} not found. Training may have failed.")
        raise SystemExit(1)

    best_model = YOLO(str(best_pt))
    onnx_path = best_model.export(
        format="onnx",
        imgsz=args.imgsz,
        simplify=True,
        opset=17,
    )

    # Copy to public/ml/
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    dest = OUTPUT_DIR / "yolov8n.onnx"
    shutil.copy2(onnx_path, dest)

    size_mb = dest.stat().st_size / (1024 * 1024)
    print()
    print("=" * 60)
    print(f"Model exported: {dest} ({size_mb:.1f} MB)")
    print("=" * 60)


if __name__ == "__main__":
    main()
