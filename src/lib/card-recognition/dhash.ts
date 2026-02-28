/**
 * Spatial Color Descriptor for perceptual image similarity.
 *
 * Creates a compact descriptor by resizing the image to a 16x16 grid
 * and storing mean-centered, L2-normalized RGB values per cell.
 * This captures the spatial layout of colors — WHERE colors appear.
 *
 * Highly discriminative for card art because different cards have unique
 * character poses, background colors, and visual compositions.
 *
 * Properties:
 * - Fast (simple grid average + normalize, no neural network)
 * - Captures spatial color layout at 12x12 resolution
 * - Robust to brightness/contrast shifts (via mean-centering + L2 norm)
 * - Resolution-independent (fixed output size)
 *
 * Used as a complementary signal to MobileNetV3 embeddings and HSV histograms.
 */

/** Grid dimensions for spatial descriptor */
const GRID_W = 12;
const GRID_H = 12;
/** Channels per cell (RGB) */
const CHANNELS = 3;
/** Total descriptor size */
export const DHASH_DIM = GRID_W * GRID_H * CHANNELS; // 432

/**
 * Computes a spatial color descriptor from ImageData (RGBA).
 * Downscales to 12x12 grid, stores mean-centered RGB per cell.
 * Returns a L2-normalized Float32Array of length 432.
 */
export function computeDHash(imageData: ImageData): Float32Array {
  const { data, width, height } = imageData;
  const descriptor = new Float32Array(DHASH_DIM);
  const cellW = width / GRID_W;
  const cellH = height / GRID_H;

  for (let gy = 0; gy < GRID_H; gy++) {
    for (let gx = 0; gx < GRID_W; gx++) {
      const startX = Math.floor(gx * cellW);
      const endX = Math.min(Math.floor((gx + 1) * cellW), width);
      const startY = Math.floor(gy * cellH);
      const endY = Math.min(Math.floor((gy + 1) * cellH), height);

      let sumR = 0,
        sumG = 0,
        sumB = 0,
        count = 0;
      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const idx = (y * width + x) * 4;
          sumR += data[idx];
          sumG += data[idx + 1];
          sumB += data[idx + 2];
          count++;
        }
      }

      const offset = (gy * GRID_W + gx) * CHANNELS;
      if (count > 0) {
        descriptor[offset] = sumR / count / 255;
        descriptor[offset + 1] = sumG / count / 255;
        descriptor[offset + 2] = sumB / count / 255;
      }
    }
  }

  return normalizeDescriptor(descriptor);
}

/**
 * Computes a spatial color descriptor from a raw RGB Buffer (3 bytes per pixel).
 * Used in the embedding generation script (Node.js, no ImageData).
 */
export function computeDHashFromRgb(
  rgbBuffer: Buffer | Uint8Array,
  width: number,
  height: number
): Float32Array {
  const descriptor = new Float32Array(DHASH_DIM);
  const cellW = width / GRID_W;
  const cellH = height / GRID_H;

  for (let gy = 0; gy < GRID_H; gy++) {
    for (let gx = 0; gx < GRID_W; gx++) {
      const startX = Math.floor(gx * cellW);
      const endX = Math.min(Math.floor((gx + 1) * cellW), width);
      const startY = Math.floor(gy * cellH);
      const endY = Math.min(Math.floor((gy + 1) * cellH), height);

      let sumR = 0,
        sumG = 0,
        sumB = 0,
        count = 0;
      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const idx = (y * width + x) * 3;
          sumR += rgbBuffer[idx];
          sumG += rgbBuffer[idx + 1];
          sumB += rgbBuffer[idx + 2];
          count++;
        }
      }

      const offset = (gy * GRID_W + gx) * CHANNELS;
      if (count > 0) {
        descriptor[offset] = sumR / count / 255;
        descriptor[offset + 1] = sumG / count / 255;
        descriptor[offset + 2] = sumB / count / 255;
      }
    }
  }

  return normalizeDescriptor(descriptor);
}

/** Mean-center and L2-normalize a descriptor. */
function normalizeDescriptor(descriptor: Float32Array): Float32Array {
  let mean = 0;
  for (let i = 0; i < DHASH_DIM; i++) mean += descriptor[i];
  mean /= DHASH_DIM;
  for (let i = 0; i < DHASH_DIM; i++) descriptor[i] -= mean;

  let norm = 0;
  for (let i = 0; i < DHASH_DIM; i++) norm += descriptor[i] * descriptor[i];
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < DHASH_DIM; i++) descriptor[i] /= norm;
  }

  return descriptor;
}

/**
 * Computes cosine similarity between two spatial color descriptors.
 * Returns a value in [0, 1] where 1 = identical spatial color layout.
 */
export function dHashSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;
  return Math.max(0, dot / denom);
}

/**
 * Converts a Float32Array descriptor to a JSON-serializable number array.
 */
export function dHashToHex(hash: Float32Array): number[] {
  return Array.from(hash);
}

/**
 * Converts a JSON number array back to a Float32Array descriptor.
 * Handles legacy formats gracefully.
 */
export function hexToDHash(data: number[] | string): Float32Array {
  if (typeof data === "string") return new Float32Array(DHASH_DIM);
  return new Float32Array(data);
}
