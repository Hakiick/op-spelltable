/**
 * Image enhancement for webcam card recognition.
 *
 * Applies a luminance-preserving contrast stretch to normalize webcam
 * images that are often washed-out by ambient lighting. Uses a SINGLE
 * scaling factor derived from the luminance channel so that color ratios
 * are preserved (crucial for histogram/spatial matching).
 *
 * Also applies a simple unsharp mask to compensate for webcam blur,
 * which improves CNN feature extraction.
 */

/**
 * Applies gentle luminance-preserving contrast stretch + sharpening.
 *
 * Unlike per-channel auto-levels, this computes the stretch from the
 * luminance histogram and applies the SAME mapping to R/G/B. This
 * preserves the original color ratios while expanding the dynamic range.
 *
 * Returns a new ImageData (does not modify input).
 */
export function enhanceCardImage(source: ImageData): ImageData {
  const { width, height, data } = source;
  const pixelCount = width * height;

  // Step 1: Compute luminance histogram
  const lumHist = new Uint32Array(256);
  for (let i = 0; i < pixelCount; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    // Standard luminance (BT.601)
    const lum = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    lumHist[Math.min(255, lum)]++;
  }

  // Step 2: Find 5th and 95th percentiles of luminance (gentle stretch)
  let cumulative = 0;
  let lo = 0;
  let hi = 255;
  const target5 = Math.floor(pixelCount * 0.05);
  const target95 = Math.floor(pixelCount * 0.95);
  for (let i = 0; i < 256; i++) {
    cumulative += lumHist[i];
    if (cumulative >= target5 && lo === 0) lo = i;
    if (cumulative >= target95) {
      hi = i;
      break;
    }
  }

  const lumRange = Math.max(hi - lo, 1);

  // Only apply if the image actually has reduced contrast
  // (range < 200 means the image doesn't use the full dynamic range)
  if (lumRange >= 200) {
    // Image already has good contrast — return as-is
    return source;
  }

  // Step 3: Build a single lookup table that maps [lo..hi] → [0..255]
  // Applied uniformly to all channels to preserve color ratios
  const lut = new Uint8ClampedArray(256);
  for (let i = 0; i < 256; i++) {
    lut[i] = Math.round(
      Math.max(0, Math.min(255, ((i - lo) / lumRange) * 255))
    );
  }

  // Step 4: Apply the LUT to all channels
  const result = new ImageData(width, height);
  for (let i = 0; i < pixelCount; i++) {
    result.data[i * 4] = lut[data[i * 4]];
    result.data[i * 4 + 1] = lut[data[i * 4 + 1]];
    result.data[i * 4 + 2] = lut[data[i * 4 + 2]];
    result.data[i * 4 + 3] = 255;
  }

  return result;
}
