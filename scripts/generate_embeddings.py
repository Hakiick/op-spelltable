#!/usr/bin/env python3
"""
generate_embeddings.py

Generates ML embedding databases from card image data for the card recognition pipeline.

Usage:
    .venv/bin/python scripts/generate_embeddings.py --sets OP01            # Specific sets
    .venv/bin/python scripts/generate_embeddings.py --sets OP01,OP02,ST01  # Multiple sets
    .venv/bin/python scripts/generate_embeddings.py --mock                 # Mock embeddings
    .venv/bin/python scripts/generate_embeddings.py --gpu                  # GPU (default: auto)

Outputs:
    public/ml/embeddings-{SET}.json   - Embedding database per set
    public/ml/manifest.json           - Index of all available embeddings
"""

import argparse
import json
import math
import os
import random
import sys
import time
from pathlib import Path

import numpy as np
import requests
import torch
import torchvision.models as models
import torchvision.transforms.functional as TF
from PIL import Image, ImageFilter
from io import BytesIO

# ─── Constants ───────────────────────────────────────────────────────────────

EMBEDDING_DIM = 1280
INPUT_SIZE = 224
AUGMENT_COUNT = 30
DATA_DIR = Path("src/data/cards")
OUTPUT_DIR = Path("public/ml")
CACHE_DIR = Path(".cache/card-images")

# ImageNet normalization
IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]

# HSV histogram bins
HIST_H_BINS = 16
HIST_S_BINS = 8
HIST_V_BINS = 8

# Spatial color descriptor grid
GRID_W = 12
GRID_H = 12
DHASH_DIM = GRID_W * GRID_H * 3  # 432


# ─── Argument Parsing ────────────────────────────────────────────────────────

def parse_args():
    parser = argparse.ArgumentParser(description="Generate card embeddings")
    parser.add_argument("--sets", type=str, default="",
                        help="Comma-separated set codes (e.g., OP01,OP02)")
    parser.add_argument("--mock", action="store_true",
                        help="Generate random mock embeddings")
    parser.add_argument("--gpu", action="store_true",
                        help="Force GPU usage (default: auto-detect)")
    return parser.parse_args()


# ─── Model Loading ───────────────────────────────────────────────────────────

def load_model(device: torch.device):
    """Load MobileNetV3 Large as a feature extractor (1280-dim output)."""
    model = models.mobilenet_v3_large(weights=models.MobileNet_V3_Large_Weights.IMAGENET1K_V2)
    # Remove the final classification head, keep only the first linear (960→1280)
    model.classifier = model.classifier[:1]
    model.eval()
    model.to(device)
    return model


# ─── Image Processing ────────────────────────────────────────────────────────

def get_cache_path(card_id: str) -> Path:
    """Return the local cache path for a card image."""
    return CACHE_DIR / f"{card_id}.jpg"


def load_image(card_id: str, url: str) -> Image.Image:
    """Load a card image from local cache, downloading if not cached."""
    cached = get_cache_path(card_id)
    if cached.exists():
        return Image.open(cached).convert("RGB")

    # Download and cache
    response = requests.get(url, timeout=30)
    response.raise_for_status()
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cached.write_bytes(response.content)
    return Image.open(BytesIO(response.content)).convert("RGB")


def download_all_images(sets: list[str]):
    """Download all card images to local cache. Skip already cached."""
    total = 0
    cached = 0
    failed = 0

    for set_code in sets:
        json_path = DATA_DIR / f"{set_code}.json"
        if not json_path.exists():
            continue

        with open(json_path) as f:
            cards = json.load(f)

        cards_to_download = []
        for card in cards:
            url = card.get("imageUrl")
            if not url:
                continue
            total += 1
            if get_cache_path(card["cardId"]).exists():
                cached += 1
            else:
                cards_to_download.append(card)

        if not cards_to_download:
            continue

        print(f"  Downloading {set_code}: {len(cards_to_download)} images...")
        for card in cards_to_download:
            try:
                sys.stdout.write(f"    {card['cardId']}... ")
                sys.stdout.flush()
                response = requests.get(card["imageUrl"], timeout=30)
                response.raise_for_status()
                path = get_cache_path(card["cardId"])
                CACHE_DIR.mkdir(parents=True, exist_ok=True)
                path.write_bytes(response.content)
                sys.stdout.write("OK\n")
            except Exception as e:
                failed += 1
                sys.stdout.write(f"FAILED ({e})\n")

    downloaded = total - cached - failed
    print(f"\nImages: {total} total, {cached} already cached, {downloaded} downloaded, {failed} failed")


def remove_sample_watermark(img: Image.Image) -> Image.Image:
    """
    Remove SAMPLE watermark: detect bright, desaturated pixels (V>0.55, S<0.2)
    and replace with local 7x7 average of non-watermark neighbors.
    """
    pixels = np.array(img, dtype=np.float32)  # (H, W, 3) in [0, 255]
    h, w = pixels.shape[:2]
    rgb = pixels / 255.0

    # Compute HSV-like values
    cmax = rgb.max(axis=2)
    cmin = rgb.min(axis=2)
    delta = cmax - cmin
    with np.errstate(invalid='ignore'):
        s = np.where(cmax == 0, 0, delta / cmax)
    v = cmax

    # SAMPLE mask: bright + desaturated
    is_sample = (v > 0.55) & (s < 0.2)

    if not is_sample.any():
        return img

    result = pixels.copy()
    radius = 3

    # Pad arrays for efficient window computation
    padded = np.pad(pixels, ((radius, radius), (radius, radius), (0, 0)), mode='edge')
    padded_mask = np.pad(is_sample, ((radius, radius), (radius, radius)), mode='constant', constant_values=True)

    # For each sample pixel, compute average of non-sample neighbors
    ys, xs = np.where(is_sample)
    for y, x in zip(ys, xs):
        py, px = y + radius, x + radius
        window = padded[py - radius:py + radius + 1, px - radius:px + radius + 1]
        mask_window = padded_mask[py - radius:py + radius + 1, px - radius:px + radius + 1]
        valid = ~mask_window
        if valid.any():
            result[y, x] = window[valid].mean(axis=0)

    return Image.fromarray(result.astype(np.uint8))


def crop_artwork(img: Image.Image) -> Image.Image:
    """Crop to artwork region (18%-62% V, 8%-92% H)."""
    w, h = img.size
    left = round(w * 0.08)
    right = round(w * 0.92)
    top = round(h * 0.18)
    bottom = round(h * 0.62)
    return img.crop((left, top, right, bottom))


def letterbox(img: Image.Image, size: int = INPUT_SIZE) -> Image.Image:
    """Resize with letterboxing (gray padding) to target size."""
    w, h = img.size
    scale = min(size / w, size / h)
    new_w = round(w * scale)
    new_h = round(h * scale)
    resized = img.resize((new_w, new_h), Image.LANCZOS)

    result = Image.new("RGB", (size, size), (128, 128, 128))
    paste_x = (size - new_w) // 2
    paste_y = (size - new_h) // 2
    result.paste(resized, (paste_x, paste_y))
    return result


# ─── HSV Histogram ───────────────────────────────────────────────────────────

def compute_hsv_histogram(img: Image.Image) -> list:
    """
    Compute normalized HSV histogram from image.
    16x8x8 = 1024 bins. Skip dark pixels (V<0.1) and desaturated bright pixels (S<0.1 & V>0.6).
    """
    resized = letterbox(img, INPUT_SIZE)
    pixels = np.array(resized, dtype=np.float32) / 255.0  # (224, 224, 3)
    r, g, b = pixels[:, :, 0], pixels[:, :, 1], pixels[:, :, 2]

    cmax = np.maximum(np.maximum(r, g), b)
    cmin = np.minimum(np.minimum(r, g), b)
    delta = cmax - cmin

    # Saturation
    with np.errstate(invalid='ignore'):
        s = np.where(cmax == 0, 0, delta / cmax)
    v = cmax

    # Hue
    h = np.zeros_like(cmax)
    mask_r = (cmax == r) & (delta > 0)
    mask_g = (cmax == g) & (delta > 0)
    mask_b = (cmax == b) & (delta > 0)
    h[mask_r] = 60 * (((g[mask_r] - b[mask_r]) / delta[mask_r]) % 6)
    h[mask_g] = 60 * ((b[mask_g] - r[mask_g]) / delta[mask_g] + 2)
    h[mask_b] = 60 * ((r[mask_b] - g[mask_b]) / delta[mask_b] + 4)
    h[h < 0] += 360

    # Skip mask
    valid = ~((v < 0.1) | ((s < 0.1) & (v > 0.6)))

    total_bins = HIST_H_BINS * HIST_S_BINS * HIST_V_BINS
    histogram = np.zeros(total_bins, dtype=np.float32)

    h_valid = h[valid]
    s_valid = s[valid]
    v_valid = v[valid]

    h_bins = np.clip((h_valid / 360 * HIST_H_BINS).astype(int), 0, HIST_H_BINS - 1)
    s_bins = np.clip((s_valid * HIST_S_BINS).astype(int), 0, HIST_S_BINS - 1)
    v_bins = np.clip((v_valid * HIST_V_BINS).astype(int), 0, HIST_V_BINS - 1)

    indices = h_bins * HIST_S_BINS * HIST_V_BINS + s_bins * HIST_V_BINS + v_bins
    np.add.at(histogram, indices, 1)

    counted = valid.sum()
    if counted > 0:
        histogram /= counted

    return histogram.tolist()


# ─── Spatial Color Descriptor ────────────────────────────────────────────────

def compute_spatial_color(img: Image.Image) -> list:
    """
    Compute spatial color descriptor (12x12x3 = 432 dims).
    Mean-center + L2-normalize. Matches dhash.ts computeDHashFromRgb.
    """
    pixels = np.array(img, dtype=np.float32)  # (H, W, 3)
    h, w = pixels.shape[:2]
    descriptor = np.zeros(DHASH_DIM, dtype=np.float32)

    cell_w = w / GRID_W
    cell_h = h / GRID_H

    for gy in range(GRID_H):
        for gx in range(GRID_W):
            start_x = int(gx * cell_w)
            end_x = min(int((gx + 1) * cell_w), w)
            start_y = int(gy * cell_h)
            end_y = min(int((gy + 1) * cell_h), h)

            cell = pixels[start_y:end_y, start_x:end_x]
            count = cell.shape[0] * cell.shape[1]
            if count > 0:
                offset = (gy * GRID_W + gx) * 3
                descriptor[offset] = cell[:, :, 0].mean() / 255
                descriptor[offset + 1] = cell[:, :, 1].mean() / 255
                descriptor[offset + 2] = cell[:, :, 2].mean() / 255

    # Mean-center
    mean = descriptor.mean()
    descriptor -= mean

    # L2-normalize
    norm = np.linalg.norm(descriptor)
    if norm > 0:
        descriptor /= norm

    return descriptor.tolist()


# ─── Augmentations ───────────────────────────────────────────────────────────

def add_gaussian_noise(img: Image.Image, sigma: float) -> Image.Image:
    """Add Gaussian noise to simulate webcam sensor noise."""
    arr = np.array(img, dtype=np.float32)
    noise = np.random.normal(0, sigma, arr.shape)
    arr = np.clip(arr + noise, 0, 255).astype(np.uint8)
    return Image.fromarray(arr)


def adjust_contrast(img: Image.Image, factor: float) -> Image.Image:
    """Adjust contrast around midpoint 128."""
    arr = np.array(img, dtype=np.float32)
    arr = (arr - 128) * factor + 128
    arr = np.clip(arr, 0, 255).astype(np.uint8)
    return Image.fromarray(arr)


def desaturate(img: Image.Image, amount: float) -> Image.Image:
    """Blend toward grayscale by amount (0=no change, 1=full grayscale)."""
    arr = np.array(img, dtype=np.float32)
    gray = 0.299 * arr[:, :, 0] + 0.587 * arr[:, :, 1] + 0.114 * arr[:, :, 2]
    for c in range(3):
        arr[:, :, c] = arr[:, :, c] * (1 - amount) + gray * amount
    arr = np.clip(arr, 0, 255).astype(np.uint8)
    return Image.fromarray(arr)


def generate_augmented_inputs(art_img: Image.Image) -> list:
    """
    Generate AUGMENT_COUNT augmented versions of the artwork image.
    Returns list of PIL Images (letterboxed to INPUT_SIZE).
    Replicates the exact augmentations from generate-embeddings.ts.
    """
    results = []

    # Helper to apply PIL-based augmentations matching the TS sharp augmentations
    def aug_identity(img):
        return img

    def aug_rotate_cw10(img):
        return TF.rotate(img, -10, fill=(128, 128, 128))

    def aug_rotate_ccw10(img):
        return TF.rotate(img, 10, fill=(128, 128, 128))

    def aug_bright(img):
        return TF.adjust_brightness(img, 1.3)

    def aug_dark_blur(img):
        return TF.adjust_brightness(img, 0.7).filter(ImageFilter.GaussianBlur(1.5))

    def aug_hflip(img):
        return TF.hflip(img)

    def aug_bright_desat(img):
        return TF.adjust_saturation(TF.adjust_brightness(img, 1.15), 0.85)

    def aug_very_bright(img):
        return TF.adjust_brightness(img, 1.5)

    def aug_very_dark(img):
        return TF.adjust_brightness(img, 0.5)

    def aug_cool(img):
        return TF.adjust_saturation(TF.adjust_brightness(img, 0.9), 0.8)

    def aug_warm(img):
        return TF.adjust_saturation(TF.adjust_brightness(img, 1.2), 1.1)

    def aug_blur(img):
        return img.filter(ImageFilter.GaussianBlur(2.0))

    def aug_rotate_cw20(img):
        return TF.rotate(img, -20, fill=(128, 128, 128))

    def aug_rotate_ccw20(img):
        return TF.rotate(img, 20, fill=(128, 128, 128))

    def aug_flip_bright(img):
        return TF.adjust_brightness(TF.hflip(img), 1.3)

    def aug_flip_dark(img):
        return TF.adjust_brightness(TF.hflip(img), 0.7)

    def aug_high_sat(img):
        return TF.adjust_saturation(img, 1.4)

    def aug_low_sat(img):
        return TF.adjust_saturation(img, 0.5)

    def aug_bright_rot5(img):
        return TF.adjust_brightness(TF.rotate(img, -5, fill=(128, 128, 128)), 1.2)

    def aug_dark_rot_neg5(img):
        return TF.adjust_brightness(TF.rotate(img, 5, fill=(128, 128, 128)), 0.8)

    # Sharp-level augmentations (0-19)
    sharp_augs = [
        aug_identity, aug_rotate_cw10, aug_rotate_ccw10, aug_bright,
        aug_dark_blur, aug_hflip, aug_bright_desat, aug_very_bright,
        aug_very_dark, aug_cool, aug_warm, aug_blur,
        aug_rotate_cw20, aug_rotate_ccw20, aug_flip_bright, aug_flip_dark,
        aug_high_sat, aug_low_sat, aug_bright_rot5, aug_dark_rot_neg5,
    ]

    # Pixel-level augmentations (20-29): (sharp_aug, pixel_aug) pairs
    pixel_augs = [
        (aug_identity, lambda img: add_gaussian_noise(img, 15)),
        (aug_identity, lambda img: adjust_contrast(img, 0.7)),
        (aug_identity, lambda img: desaturate(img, 0.3)),
        (aug_identity, lambda img: add_gaussian_noise(img, 25)),
        (aug_identity, lambda img: adjust_contrast(img, 1.4)),
        (aug_identity, lambda img: desaturate(img, 0.6)),
        (lambda img: TF.adjust_brightness(img, 0.7), lambda img: add_gaussian_noise(img, 20)),
        (lambda img: TF.adjust_brightness(img, 1.3), lambda img: add_gaussian_noise(img, 15)),
        (aug_identity, lambda img: desaturate(adjust_contrast(img, 0.8), 0.2)),
        (aug_hflip, lambda img: add_gaussian_noise(img, 15)),
    ]

    # Apply sharp-only augmentations
    for aug_fn in sharp_augs[:min(len(sharp_augs), AUGMENT_COUNT)]:
        augmented = aug_fn(art_img)
        results.append(letterbox(augmented))

    # Apply pixel-level augmentations
    remaining = AUGMENT_COUNT - len(results)
    for sharp_fn, pixel_fn in pixel_augs[:remaining]:
        augmented = sharp_fn(art_img)
        letterboxed = letterbox(augmented)
        results.append(pixel_fn(letterboxed))

    return results


def images_to_tensor(images: list, device: torch.device) -> torch.Tensor:
    """
    Convert list of PIL Images to a batched tensor.
    Applies ImageNet normalization in NCHW format.
    """
    tensors = []
    for img in images:
        t = TF.to_tensor(img)  # (3, H, W), [0, 1]
        t = TF.normalize(t, IMAGENET_MEAN, IMAGENET_STD)
        tensors.append(t)
    return torch.stack(tensors).to(device)


# ─── Embedding Generation ───────────────────────────────────────────────────

def generate_mock_embedding() -> list:
    return [random.random() * 2 - 1 for _ in range(EMBEDDING_DIM)]


def generate_mock_database(set_code: str, cards: list) -> dict:
    print(f"  [mock] Generating {len(cards)} random {EMBEDDING_DIM}D embeddings for {set_code}...")
    entries = [{"cardCode": c["cardId"], "embedding": generate_mock_embedding()} for c in cards]
    return {
        "version": "1.0.0",
        "model": "mobilenet_v3_large_100_224_mock",
        "embeddingDim": EMBEDDING_DIM,
        "cardCount": len(entries),
        "generatedAt": _now_iso(),
        "entries": entries,
    }


def generate_real_database(set_code: str, cards: list, model, device: torch.device) -> dict:
    print(f"  [real] Processing {set_code} ({len(cards)} cards, {AUGMENT_COUNT} augmentations each)...")

    entries = []
    processed = 0

    for card in cards:
        image_url = card.get("imageUrl")
        if not image_url:
            print(f"  SKIP {card['cardId']}: no imageUrl")
            continue

        try:
            processed += 1
            sys.stdout.write(f"  Processing {card['cardId']} ({processed}/{len(cards)})... ")
            sys.stdout.flush()

            # Load image (from cache or download)
            raw_img = load_image(card["cardId"], image_url)

            # Remove SAMPLE watermark
            clean_img = remove_sample_watermark(raw_img)

            # Crop to artwork region
            art_img = crop_artwork(clean_img)

            # Compute HSV histogram from letterboxed artwork
            histogram = compute_hsv_histogram(art_img)

            # Compute spatial color descriptor from art crop
            dhash = compute_spatial_color(art_img)

            # Generate augmented versions
            augmented_images = generate_augmented_inputs(art_img)

            # Batch inference on GPU
            batch = images_to_tensor(augmented_images, device)
            with torch.no_grad():
                embeddings = model(batch)  # (30, 1280)

            # Average into centroid (float64 for precision)
            centroid = embeddings.cpu().double().mean(dim=0).tolist()

            entries.append({
                "cardCode": card["cardId"],
                "embedding": centroid,
                "histogram": histogram,
                "color": card.get("color"),
                "dhash": dhash,
            })

            sys.stdout.write("OK\n")

        except Exception as e:
            sys.stdout.write(f"FAILED ({e})\n")

    return {
        "version": "1.0.0",
        "model": "mobilenet_v3_large_100_224",
        "embeddingDim": EMBEDDING_DIM,
        "cardCount": len(entries),
        "generatedAt": _now_iso(),
        "entries": entries,
    }


# ─── Manifest & I/O ─────────────────────────────────────────────────────────

def _now_iso() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def process_set(set_code: str, mock: bool, model, device: torch.device) -> dict | None:
    json_path = DATA_DIR / f"{set_code}.json"
    if not json_path.exists():
        print(f"  WARNING: No data file found at {json_path}, skipping.")
        return None

    with open(json_path) as f:
        cards = json.load(f)
    print(f"\nProcessing {set_code} ({len(cards)} cards)...")

    if mock:
        db = generate_mock_database(set_code, cards)
    else:
        try:
            db = generate_real_database(set_code, cards, model, device)
        except Exception as e:
            print(f"  ERROR: {e}")
            print(f"  Falling back to mock embeddings for {set_code}")
            db = generate_mock_database(set_code, cards)

    output_path = OUTPUT_DIR / f"embeddings-{set_code}.json"
    with open(output_path, "w") as f:
        json.dump(db, f)
    size_mb = output_path.stat().st_size / 1024 / 1024
    print(f"  Written: {output_path} ({db['cardCount']} cards, {size_mb:.1f} MB)")

    return {
        "setCode": set_code,
        "embeddingsUrl": f"/ml/embeddings-{set_code}.json",
        "cardCount": db["cardCount"],
    }


def main():
    args = parse_args()
    sets = [s.strip().upper() for s in args.sets.split(",") if s.strip()] if args.sets else []

    # Device selection
    if args.gpu or torch.cuda.is_available():
        device = torch.device("cuda")
        print(f"[GPU] Using {torch.cuda.get_device_name(0)}")
    else:
        device = torch.device("cpu")
        print("[CPU] CUDA not available, using CPU")

    # Create output directory
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Discover all sets if none specified
    if not sets:
        files = sorted(DATA_DIR.glob("*.json"))
        sets = [f.stem.upper() for f in files if f.stem != "sets"]
        print(f"No sets specified — processing all {len(sets)} sets")

    print(f"\nGenerating embeddings for: {', '.join(sets)} (mock={args.mock})")

    # Phase 1: Download all images to local cache
    if not args.mock:
        print("\n── Phase 1: Download images ──")
        t_dl = time.time()
        download_all_images(sets)
        print(f"Download phase: {time.time() - t_dl:.1f}s")

    # Load model once (unless mock mode)
    model = None
    if not args.mock:
        print("\nLoading MobileNetV3 Large model...")
        t0 = time.time()
        model = load_model(device)
        print(f"Model loaded in {time.time() - t0:.1f}s")

    # Phase 2: Generate embeddings (local images only, no network)
    if not args.mock:
        print("\n── Phase 2: Generate embeddings (local) ──")
    new_entries = []
    t_start = time.time()

    for set_code in sets:
        entry = process_set(set_code, args.mock, model, device)
        if entry:
            new_entries.append(entry)

    # Merge with existing manifest
    manifest_path = OUTPUT_DIR / "manifest.json"
    new_set_codes = {e["setCode"] for e in new_entries}

    existing_entries = []
    if manifest_path.exists():
        with open(manifest_path) as f:
            existing = json.load(f)
        existing_entries = [e for e in existing["sets"] if e["setCode"] not in new_set_codes]

    all_entries = sorted(existing_entries + new_entries, key=lambda e: e["setCode"])

    manifest = {
        "version": "1.0.0",
        "model": "mobilenet_v3_large_100_224_mock" if args.mock else "mobilenet_v3_large_100_224",
        "sets": all_entries,
        "generatedAt": _now_iso(),
    }

    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)

    elapsed = time.time() - t_start
    print(f"\nManifest written: {manifest_path}")
    print(f"\nDone! Generated {len(new_entries)} sets, manifest has {len(all_entries)} total sets.")
    print(f"Total time: {elapsed:.1f}s ({elapsed / 60:.1f} min)")


if __name__ == "__main__":
    main()
