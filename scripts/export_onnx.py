#!/usr/bin/env python3
"""
export_onnx.py

Exports MobileNetV3 Large (feature extractor) to ONNX format for browser inference
via ONNX Runtime Web.

Usage:
    .venv/bin/python scripts/export_onnx.py

Output:
    public/ml/mobilenet_v3_large.onnx (~22MB)
"""

import sys
from pathlib import Path

import numpy as np
import torch
import torchvision.models as models

OUTPUT_PATH = Path("public/ml/mobilenet_v3_large.onnx")


def main():
    # Load MobileNetV3 Large with ImageNet V2 weights
    model = models.mobilenet_v3_large(weights=models.MobileNet_V3_Large_Weights.IMAGENET1K_V2)
    # Keep only the first linear layer of the classifier (960→1280 feature vector)
    model.classifier = model.classifier[:1]
    model.eval()

    # Dummy input: batch of 1, 3 channels, 224x224 (ImageNet-normalized)
    dummy_input = torch.randn(1, 3, 224, 224)

    # Export to ONNX
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    torch.onnx.export(
        model,
        dummy_input,
        str(OUTPUT_PATH),
        input_names=["input"],
        output_names=["embedding"],
        dynamic_axes={
            "input": {0: "batch"},
            "embedding": {0: "batch"},
        },
        opset_version=17,
    )

    size_mb = OUTPUT_PATH.stat().st_size / 1024 / 1024
    print(f"Exported: {OUTPUT_PATH} ({size_mb:.1f} MB)")

    # Verify: compare PyTorch output vs ONNX Runtime output
    print("Verifying ONNX vs PyTorch output...")
    try:
        import onnxruntime as ort
    except ImportError:
        print("  onnxruntime not installed, skipping verification")
        return

    session = ort.InferenceSession(str(OUTPUT_PATH))
    test_input = torch.randn(1, 3, 224, 224)

    # PyTorch inference
    with torch.no_grad():
        pytorch_out = model(test_input).numpy()

    # ONNX inference
    onnx_out = session.run(None, {"input": test_input.numpy()})[0]

    max_diff = np.abs(pytorch_out - onnx_out).max()
    mean_diff = np.abs(pytorch_out - onnx_out).mean()
    print(f"  Max diff: {max_diff:.2e}")
    print(f"  Mean diff: {mean_diff:.2e}")

    if max_diff < 1e-5:
        print("  PASS: ONNX output matches PyTorch within tolerance")
    else:
        print(f"  WARNING: Max diff {max_diff:.2e} exceeds 1e-5 threshold")
        sys.exit(1)


if __name__ == "__main__":
    main()
