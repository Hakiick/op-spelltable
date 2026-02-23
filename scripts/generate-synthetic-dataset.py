#!/usr/bin/env python3
"""
Generate a synthetic dataset for YOLOv8 single-class ("card") detection.

Inspired by the Stanford CS231N paper "Real-Time Pokémon Card Detection
from Tournament Footage" (Pua, 2024). The approach:
  1. Download card images from optcgapi.com
  2. Generate varied backgrounds (card mosaics, table colors, noise)
  3. Composite cards onto backgrounds with augmentations
  4. Output YOLO-format labels (class 0 = "card")

Usage:
  .yolo-venv/bin/python scripts/generate-synthetic-dataset.py \
      --num-train 1000 --num-val 100 --num-cards 300 --seed 42
"""

from __future__ import annotations

import argparse
import json
import math
import os
import random
import sys
import time
import urllib.request
from pathlib import Path
from typing import Optional

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parent.parent
CARD_JSON_DIR = PROJECT_ROOT / "src" / "data" / "cards"
CARD_IMG_DIR = PROJECT_ROOT / "datasets" / "card-images"
DATASET_DIR = PROJECT_ROOT / "datasets" / "synthetic"
BG_DIR = DATASET_DIR / "backgrounds"

IMG_W, IMG_H = 1280, 720
CARD_ORIG_W, CARD_ORIG_H = 367, 512  # typical OP TCG card dimensions


# ---------------------------------------------------------------------------
# Phase A — Download card images
# ---------------------------------------------------------------------------


def load_card_urls() -> list[dict]:
    """Read all card JSON files and extract cards with valid imageUrl."""
    cards = []
    for json_file in sorted(CARD_JSON_DIR.glob("*.json")):
        if json_file.name == "sets.json":
            continue
        with open(json_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        for card in data:
            url = card.get("imageUrl")
            card_id = card.get("cardId", "")
            if url and card_id:
                cards.append({"cardId": card_id, "imageUrl": url})
    return cards


def download_card_images(cards: list[dict], max_cards: int) -> list[Path]:
    """Download card images, respecting cache and rate limits."""
    CARD_IMG_DIR.mkdir(parents=True, exist_ok=True)

    downloaded = []
    to_download = cards[:max_cards]

    print(f"[Phase A] Downloading up to {len(to_download)} card images...")

    for i, card in enumerate(to_download):
        card_id = card["cardId"]
        url = card["imageUrl"]
        ext = url.rsplit(".", 1)[-1].split("?")[0] if "." in url else "jpg"
        dest = CARD_IMG_DIR / f"{card_id}.{ext}"

        if dest.exists() and dest.stat().st_size > 0:
            downloaded.append(dest)
            continue

        try:
            req = urllib.request.Request(
                url,
                headers={
                    "User-Agent": "op-spelltable-dataset-gen/1.0",
                    "Accept": "image/jpeg,image/png,image/*",
                },
            )
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = resp.read()
            dest.write_bytes(data)
            downloaded.append(dest)

            if (i + 1) % 50 == 0:
                print(f"  Downloaded {i + 1}/{len(to_download)}")

            time.sleep(0.1)  # 100ms rate limit
        except Exception as e:
            print(f"  Warning: failed to download {card_id}: {e}")
            continue

    print(f"  Total card images available: {len(downloaded)}")
    return downloaded


# ---------------------------------------------------------------------------
# Phase B — Generate backgrounds
# ---------------------------------------------------------------------------

TABLE_COLORS = [
    # Wood tones
    (139, 90, 43),
    (160, 110, 60),
    (120, 75, 35),
    (180, 130, 80),
    (100, 65, 30),
    # Playmat colors
    (30, 80, 30),    # green
    (25, 70, 25),    # dark green
    (30, 30, 80),    # blue
    (25, 25, 70),    # dark blue
    (20, 20, 20),    # black
    (40, 40, 40),    # dark gray
    (60, 60, 60),    # gray
    # Light surfaces
    (220, 220, 220), # white/light
    (200, 190, 170), # cream
    (180, 170, 150), # beige
]


def generate_solid_bg(color: tuple[int, int, int]) -> Image.Image:
    """Solid color background."""
    return Image.new("RGB", (IMG_W, IMG_H), color)


def generate_noise_bg(base_color: tuple[int, int, int]) -> Image.Image:
    """Solid color + gaussian noise + gradient."""
    arr = np.full((IMG_H, IMG_W, 3), base_color, dtype=np.float32)

    # Add gaussian noise
    noise = np.random.normal(0, 15, arr.shape).astype(np.float32)
    arr = arr + noise

    # Add a subtle gradient
    gradient = np.linspace(0.85, 1.15, IMG_H).reshape(-1, 1, 1)
    arr = arr * gradient

    arr = np.clip(arr, 0, 255).astype(np.uint8)
    return Image.fromarray(arr)


def generate_mosaic_bg(card_images: list[Path]) -> Image.Image:
    """Card mosaic background (technique from the paper). Tile blurred cards."""
    bg = Image.new("RGB", (IMG_W, IMG_H), (40, 40, 40))

    if not card_images:
        return bg

    # Grid of 3x3 to 4x4 cards
    cols = random.randint(3, 4)
    rows = random.randint(2, 3)
    cell_w = IMG_W // cols
    cell_h = IMG_H // rows

    for r in range(rows):
        for c in range(cols):
            card_path = random.choice(card_images)
            try:
                card = Image.open(card_path).convert("RGB")
                card = card.resize((cell_w + 20, cell_h + 20), Image.BILINEAR)
                # Heavy blur to make it a "clutter" background
                card = card.filter(ImageFilter.GaussianBlur(radius=random.uniform(5, 15)))
                # Random brightness adjustment
                card = ImageEnhance.Brightness(card).enhance(random.uniform(0.5, 1.2))
                x = c * cell_w - 10
                y = r * cell_h - 10
                bg.paste(card, (x, y))
            except Exception:
                continue

    return bg


def generate_backgrounds(card_images: list[Path], num_bg: int = 50) -> list[Path]:
    """Generate a mix of backgrounds."""
    BG_DIR.mkdir(parents=True, exist_ok=True)

    backgrounds = []
    print(f"[Phase B] Generating {num_bg} backgrounds...")

    for i in range(num_bg):
        if i < len(TABLE_COLORS):
            # Solid + noise backgrounds
            color = TABLE_COLORS[i % len(TABLE_COLORS)]
            if random.random() < 0.5:
                bg = generate_solid_bg(color)
            else:
                bg = generate_noise_bg(color)
        else:
            # Mosaic backgrounds (if we have card images)
            if card_images and random.random() < 0.7:
                bg = generate_mosaic_bg(card_images)
            else:
                color = random.choice(TABLE_COLORS)
                bg = generate_noise_bg(color)

        path = BG_DIR / f"bg_{i:04d}.jpg"
        bg.save(path, "JPEG", quality=90)
        backgrounds.append(path)

    print(f"  Generated {len(backgrounds)} backgrounds")
    return backgrounds


# ---------------------------------------------------------------------------
# Phase C — Generate synthetic images with card placements
# ---------------------------------------------------------------------------


def load_card_image(path: Path, target_h: int) -> Optional[Image.Image]:
    """Load and resize a card image maintaining aspect ratio."""
    try:
        img = Image.open(path).convert("RGBA")
        aspect = img.width / img.height
        target_w = int(target_h * aspect)
        return img.resize((target_w, target_h), Image.LANCZOS)
    except Exception:
        return None


def apply_perspective_warp(
    img: Image.Image, strength: float = 0.1
) -> tuple[Image.Image, list[tuple[float, float]]]:
    """Apply perspective warp to a card image. Returns warped image and corner positions."""
    w, h = img.size

    # Source corners (full image)
    src_pts = np.float32([[0, 0], [w, 0], [w, h], [0, h]])

    # Destination: randomly displace each corner
    max_dx = w * strength
    max_dy = h * strength
    dst_pts = np.float32([
        [random.uniform(0, max_dx), random.uniform(0, max_dy)],
        [w - random.uniform(0, max_dx), random.uniform(0, max_dy)],
        [w - random.uniform(0, max_dx), h - random.uniform(0, max_dy)],
        [random.uniform(0, max_dx), h - random.uniform(0, max_dy)],
    ])

    # Compute perspective transform
    M = cv2.getPerspectiveTransform(src_pts, dst_pts)

    # Convert to numpy for OpenCV warp
    img_arr = np.array(img)
    warped = cv2.warpPerspective(
        img_arr, M, (w, h),
        flags=cv2.INTER_LINEAR,
        borderMode=cv2.BORDER_CONSTANT,
        borderValue=(0, 0, 0, 0),
    )

    return Image.fromarray(warped), [(float(p[0]), float(p[1])) for p in dst_pts]


def apply_color_jitter(img: Image.Image) -> Image.Image:
    """Random color augmentations."""
    # Brightness
    img = ImageEnhance.Brightness(img).enhance(random.uniform(0.7, 1.3))
    # Contrast
    img = ImageEnhance.Contrast(img).enhance(random.uniform(0.7, 1.3))
    # Color/Saturation
    img = ImageEnhance.Color(img).enhance(random.uniform(0.7, 1.3))
    return img


def rotate_image(
    img: Image.Image, angle: float
) -> tuple[Image.Image, tuple[int, int]]:
    """Rotate image and return rotated image + new size."""
    rotated = img.rotate(angle, expand=True, resample=Image.BILINEAR, fillcolor=(0, 0, 0, 0))
    return rotated, rotated.size


def compute_axis_aligned_bbox(
    card_w: int,
    card_h: int,
    angle: float,
    paste_x: int,
    paste_y: int,
    rotated_w: int,
    rotated_h: int,
) -> tuple[float, float, float, float]:
    """Compute axis-aligned bounding box after rotation, in image coordinates.
    Returns (cx, cy, w, h) in absolute pixels."""
    # The rotated image center is at paste position + half of rotated size
    cx = paste_x + rotated_w / 2
    cy = paste_y + rotated_h / 2

    # Compute the bounding box of the rotated rectangle
    angle_rad = math.radians(abs(angle))
    cos_a = abs(math.cos(angle_rad))
    sin_a = abs(math.sin(angle_rad))

    bbox_w = card_w * cos_a + card_h * sin_a
    bbox_h = card_w * sin_a + card_h * cos_a

    return (cx, cy, bbox_w, bbox_h)


def generate_single_image(
    card_images: list[Path],
    backgrounds: list[Path],
    rng: random.Random,
) -> tuple[Image.Image, list[tuple[float, float, float, float]]]:
    """Generate one synthetic training image with card placements.

    Returns (image, labels) where labels are YOLO-format:
        [(class, cx_norm, cy_norm, w_norm, h_norm), ...]
    """
    # Load background
    bg_path = rng.choice(backgrounds)
    bg = Image.open(bg_path).convert("RGB")
    bg = bg.resize((IMG_W, IMG_H), Image.BILINEAR)

    labels: list[tuple[float, float, float, float]] = []

    # Place 1-8 cards
    num_cards = rng.randint(1, 8)

    for _ in range(num_cards):
        card_path = rng.choice(card_images)

        # Scale: 15%-50% of image height
        target_h = int(IMG_H * rng.uniform(0.15, 0.50))
        card = load_card_image(card_path, target_h)
        if card is None:
            continue

        orig_w, orig_h = card.size

        # Perspective warp (5-15% corner displacement)
        warp_strength = rng.uniform(0.05, 0.15)
        card, _ = apply_perspective_warp(card, warp_strength)

        # Color jitter
        card = apply_color_jitter(card)

        # Rotation: -30 to +30, with 10% chance of 90° (tapped card)
        if rng.random() < 0.10:
            angle = rng.choice([90, -90]) + rng.uniform(-5, 5)
        else:
            angle = rng.uniform(-30, 30)

        card_rotated, (rot_w, rot_h) = rotate_image(card, angle)

        # Optional blur (depth of field effect)
        if rng.random() < 0.3:
            blur_r = rng.uniform(0.5, 2.0)
            card_rotated = card_rotated.filter(ImageFilter.GaussianBlur(radius=blur_r))

        # Random position (allow partial out-of-frame)
        margin_x = int(rot_w * 0.3)
        margin_y = int(rot_h * 0.3)
        paste_x = rng.randint(-margin_x, IMG_W - rot_w + margin_x)
        paste_y = rng.randint(-margin_y, IMG_H - rot_h + margin_y)

        # Paste with alpha compositing
        if card_rotated.mode == "RGBA":
            # Create a temporary layer
            layer = Image.new("RGBA", bg.size, (0, 0, 0, 0))
            layer.paste(card_rotated, (paste_x, paste_y))
            bg = Image.alpha_composite(bg.convert("RGBA"), layer).convert("RGB")
        else:
            bg.paste(card_rotated, (paste_x, paste_y))

        # Compute YOLO bounding box
        cx, cy, bbox_w, bbox_h = compute_axis_aligned_bbox(
            orig_w, orig_h, angle, paste_x, paste_y, rot_w, rot_h
        )

        # Clip to image bounds
        x1 = max(0, cx - bbox_w / 2)
        y1 = max(0, cy - bbox_h / 2)
        x2 = min(IMG_W, cx + bbox_w / 2)
        y2 = min(IMG_H, cy + bbox_h / 2)

        clipped_w = x2 - x1
        clipped_h = y2 - y1

        # Skip if too small after clipping (less than 20% of original visible)
        if clipped_w < orig_w * 0.2 or clipped_h < orig_h * 0.2:
            continue

        # Normalize to [0, 1]
        cx_norm = (x1 + clipped_w / 2) / IMG_W
        cy_norm = (y1 + clipped_h / 2) / IMG_H
        w_norm = clipped_w / IMG_W
        h_norm = clipped_h / IMG_H

        # Sanity check
        if 0 < w_norm <= 1 and 0 < h_norm <= 1:
            labels.append((cx_norm, cy_norm, w_norm, h_norm))

    # Global augmentations
    bg_arr = np.array(bg)

    # Gaussian noise
    if rng.random() < 0.5:
        noise = np.random.normal(0, rng.uniform(3, 10), bg_arr.shape).astype(np.float32)
        bg_arr = np.clip(bg_arr.astype(np.float32) + noise, 0, 255).astype(np.uint8)

    # Global brightness
    if rng.random() < 0.3:
        factor = rng.uniform(0.8, 1.2)
        bg_arr = np.clip(bg_arr.astype(np.float32) * factor, 0, 255).astype(np.uint8)

    result = Image.fromarray(bg_arr)
    return result, labels


def generate_dataset(
    card_images: list[Path],
    backgrounds: list[Path],
    num_train: int,
    num_val: int,
    seed: int,
) -> None:
    """Generate full train + val dataset."""
    rng = random.Random(seed)
    np.random.seed(seed)

    for split, count in [("train", num_train), ("val", num_val)]:
        img_dir = DATASET_DIR / "images" / split
        lbl_dir = DATASET_DIR / "labels" / split
        img_dir.mkdir(parents=True, exist_ok=True)
        lbl_dir.mkdir(parents=True, exist_ok=True)

        print(f"[Phase C] Generating {count} {split} images...")

        for i in range(count):
            img, labels = generate_single_image(card_images, backgrounds, rng)

            # Save image (JPEG compression as augmentation)
            quality = rng.randint(70, 95)
            img_path = img_dir / f"{split}_{i:05d}.jpg"
            img.save(img_path, "JPEG", quality=quality)

            # Save YOLO label
            lbl_path = lbl_dir / f"{split}_{i:05d}.txt"
            with open(lbl_path, "w") as f:
                for cx, cy, w, h in labels:
                    f.write(f"0 {cx:.6f} {cy:.6f} {w:.6f} {h:.6f}\n")

            if (i + 1) % 100 == 0:
                print(f"  {split}: {i + 1}/{count}")

    print(f"  Dataset complete: {num_train} train + {num_val} val images")


# ---------------------------------------------------------------------------
# Phase D — Generate data.yaml
# ---------------------------------------------------------------------------


def generate_data_yaml() -> None:
    """Write YOLO data.yaml for the synthetic dataset."""
    yaml_path = DATASET_DIR / "data.yaml"
    content = f"""path: {DATASET_DIR.resolve()}
train: images/train
val: images/val
nc: 1
names: ['card']
"""
    yaml_path.write_text(content)
    print(f"[Phase D] Wrote {yaml_path}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate synthetic dataset for YOLOv8 card detection"
    )
    parser.add_argument(
        "--num-train", type=int, default=1000,
        help="Number of training images (default: 1000)"
    )
    parser.add_argument(
        "--num-val", type=int, default=100,
        help="Number of validation images (default: 100)"
    )
    parser.add_argument(
        "--num-cards", type=int, default=300,
        help="Max card images to download (default: 300)"
    )
    parser.add_argument(
        "--num-backgrounds", type=int, default=50,
        help="Number of backgrounds to generate (default: 50)"
    )
    parser.add_argument(
        "--seed", type=int, default=42,
        help="Random seed (default: 42)"
    )
    parser.add_argument(
        "--skip-download", action="store_true",
        help="Skip card image download (use cached images)"
    )
    args = parser.parse_args()

    print("=" * 60)
    print("Synthetic Dataset Generator for OP SpellTable")
    print("=" * 60)
    print(f"  Train images: {args.num_train}")
    print(f"  Val images:   {args.num_val}")
    print(f"  Max cards:    {args.num_cards}")
    print(f"  Seed:         {args.seed}")
    print()

    # Phase A — Download card images
    if args.skip_download:
        card_images = sorted(CARD_IMG_DIR.glob("*.jpg")) + sorted(CARD_IMG_DIR.glob("*.png"))
        print(f"[Phase A] Skipping download, found {len(card_images)} cached images")
    else:
        cards = load_card_urls()
        print(f"  Found {len(cards)} cards with URLs across all sets")
        card_images = download_card_images(cards, args.num_cards)

    if not card_images:
        print("ERROR: No card images available. Cannot generate dataset.")
        sys.exit(1)

    # Phase B — Generate backgrounds
    backgrounds = generate_backgrounds(card_images, args.num_backgrounds)

    # Phase C — Generate synthetic images
    generate_dataset(card_images, backgrounds, args.num_train, args.num_val, args.seed)

    # Phase D — Write data.yaml
    generate_data_yaml()

    print()
    print("=" * 60)
    print("Dataset generation complete!")
    print(f"  Output: {DATASET_DIR}")
    print("=" * 60)


if __name__ == "__main__":
    main()
