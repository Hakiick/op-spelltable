/**
 * Shared image utilities for embedding generation and training scripts.
 *
 * Extracted from generate-embeddings.ts for reuse across:
 * - scripts/generate-embeddings.ts
 * - scripts/train-projection.ts
 */

export type SharpInstance = {
  resize: (
    w: number,
    h: number,
    opts: { fit: string; background?: { r: number; g: number; b: number } }
  ) => SharpInstance;
  removeAlpha: () => SharpInstance;
  rotate: (
    angle: number,
    opts?: { background: { r: number; g: number; b: number; alpha: number } }
  ) => SharpInstance;
  modulate: (opts: {
    brightness?: number;
    saturation?: number;
  }) => SharpInstance;
  blur: (sigma?: number) => SharpInstance;
  flop: () => SharpInstance;
  png: () => SharpInstance;
  extract: (opts: {
    left: number;
    top: number;
    width: number;
    height: number;
  }) => SharpInstance;
  raw: () => { toBuffer: () => Promise<Buffer> };
  toBuffer: () => Promise<Buffer>;
  metadata: () => Promise<{ width?: number; height?: number }>;
};

export type SharpFn = {
  (input: Buffer): SharpInstance;
  (
    input: Buffer,
    opts: { raw: { width: number; height: number; channels: number } }
  ): SharpInstance;
};

export async function downloadImage(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${url}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Removes the SAMPLE watermark from a raw RGB buffer by detecting bright,
 * desaturated pixels (the gray/white SAMPLE text) and replacing them with
 * the local average of nearby colored pixels.
 */
export function removeSampleWatermark(
  rgbBuffer: Buffer,
  width: number,
  height: number
): Buffer {
  const result = Buffer.from(rgbBuffer);
  const pixelCount = width * height;

  const isSample = new Uint8Array(pixelCount);
  for (let i = 0; i < pixelCount; i++) {
    const r = rgbBuffer[i * 3] / 255;
    const g = rgbBuffer[i * 3 + 1] / 255;
    const b = rgbBuffer[i * 3 + 2] / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    const s = max === 0 ? 0 : d / max;
    const v = max;

    if (v > 0.55 && s < 0.2) {
      isSample[i] = 1;
    }
  }

  const radius = 3;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (!isSample[idx]) continue;

      let sumR = 0,
        sumG = 0,
        sumB = 0,
        count = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          const ni = ny * width + nx;
          if (isSample[ni]) continue;
          sumR += rgbBuffer[ni * 3];
          sumG += rgbBuffer[ni * 3 + 1];
          sumB += rgbBuffer[ni * 3 + 2];
          count++;
        }
      }

      if (count > 0) {
        result[idx * 3] = Math.round(sumR / count);
        result[idx * 3 + 1] = Math.round(sumG / count);
        result[idx * 3 + 2] = Math.round(sumB / count);
      }
    }
  }

  return result;
}

/** Adds Gaussian noise to a raw RGB buffer. */
export function addGaussianNoise(buffer: Buffer, sigma: number): Buffer {
  const result = Buffer.from(buffer);
  for (let i = 0; i < result.length; i++) {
    const u1 = Math.random() || 1e-10;
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    result[i] = Math.max(0, Math.min(255, Math.round(result[i] + z * sigma)));
  }
  return result;
}

/** Applies contrast jitter to a raw RGB buffer. */
export function adjustContrast(buffer: Buffer, factor: number): Buffer {
  const result = Buffer.from(buffer);
  for (let i = 0; i < result.length; i++) {
    const val = (result[i] - 128) * factor + 128;
    result[i] = Math.max(0, Math.min(255, Math.round(val)));
  }
  return result;
}

/** Blends RGB buffer toward grayscale by a given amount. */
export function desaturate(buffer: Buffer, amount: number): Buffer {
  const result = Buffer.from(buffer);
  for (let i = 0; i < result.length; i += 3) {
    const gray =
      0.299 * result[i] + 0.587 * result[i + 1] + 0.114 * result[i + 2];
    result[i] = Math.round(result[i] * (1 - amount) + gray * amount);
    result[i + 1] = Math.round(
      result[i + 1] * (1 - amount) + gray * amount
    );
    result[i + 2] = Math.round(
      result[i + 2] * (1 - amount) + gray * amount
    );
  }
  return result;
}

/**
 * Crops the artwork region from a card image.
 * OP TCG cards have art at ~18%-62% vertically and ~8%-92% horizontally.
 */
export async function cropArtwork(
  rawImageBuffer: Buffer,
  sharpFn: SharpFn
): Promise<{ artBuffer: Buffer; cleanRgb: Buffer; imgW: number; imgH: number }> {
  const { width: imgW, height: imgH } =
    await sharpFn(rawImageBuffer).metadata();

  const rawRgb = await sharpFn(rawImageBuffer).removeAlpha().raw().toBuffer();
  const cleanRgb = removeSampleWatermark(rawRgb, imgW!, imgH!);

  const artTop = Math.round(imgH! * 0.18);
  const artBottom = Math.round(imgH! * 0.62);
  const artLeft = Math.round(imgW! * 0.08);
  const artRight = Math.round(imgW! * 0.92);

  const artBuffer = await sharpFn(cleanRgb, {
    raw: { width: imgW!, height: imgH!, channels: 3 },
  })
    .extract({
      left: artLeft,
      top: artTop,
      width: artRight - artLeft,
      height: artBottom - artTop,
    })
    .png()
    .toBuffer();

  return { artBuffer, cleanRgb, imgW: imgW!, imgH: imgH! };
}

/**
 * Generates augmented versions of a card image buffer.
 * Returns Float32Array inputs ready for MobileNet.
 */
export async function generateAugmentedInputs(
  imageBuffer: Buffer,
  sharpFn: SharpFn,
  inputSize: number,
  augmentCount: number
): Promise<Float32Array[]> {
  const sharpAugmentations: Array<(s: SharpInstance) => SharpInstance> = [
    (s) => s,
    (s) =>
      s.rotate(10, { background: { r: 128, g: 128, b: 128, alpha: 1 } }),
    (s) =>
      s.rotate(-10, { background: { r: 128, g: 128, b: 128, alpha: 1 } }),
    (s) => s.modulate({ brightness: 1.3 }),
    (s) => s.modulate({ brightness: 0.7 }).blur(1.5),
    (s) => s.flop(),
    (s) => s.modulate({ brightness: 1.15, saturation: 0.85 }),
    (s) => s.modulate({ brightness: 1.5 }),
    (s) => s.modulate({ brightness: 0.5 }),
    (s) => s.modulate({ brightness: 0.9, saturation: 0.8 }),
    (s) => s.modulate({ brightness: 1.2, saturation: 1.1 }),
    (s) => s.blur(2.0),
    (s) =>
      s.rotate(20, { background: { r: 128, g: 128, b: 128, alpha: 1 } }),
    (s) =>
      s.rotate(-20, { background: { r: 128, g: 128, b: 128, alpha: 1 } }),
    (s) => s.flop().modulate({ brightness: 1.3 }),
    (s) => s.flop().modulate({ brightness: 0.7 }),
    (s) => s.modulate({ saturation: 1.4 }),
    (s) => s.modulate({ saturation: 0.5 }),
    (s) =>
      s
        .rotate(5, { background: { r: 128, g: 128, b: 128, alpha: 1 } })
        .modulate({ brightness: 1.2 }),
    (s) =>
      s
        .rotate(-5, { background: { r: 128, g: 128, b: 128, alpha: 1 } })
        .modulate({ brightness: 0.8 }),
  ];

  type PixelAugment = (buf: Buffer) => Buffer;
  const pixelAugmentations: Array<{
    sharpAug: (s: SharpInstance) => SharpInstance;
    pixelAug: PixelAugment;
  }> = [
    { sharpAug: (s) => s, pixelAug: (buf) => addGaussianNoise(buf, 15) },
    { sharpAug: (s) => s, pixelAug: (buf) => adjustContrast(buf, 0.7) },
    { sharpAug: (s) => s, pixelAug: (buf) => desaturate(buf, 0.3) },
    { sharpAug: (s) => s, pixelAug: (buf) => addGaussianNoise(buf, 25) },
    { sharpAug: (s) => s, pixelAug: (buf) => adjustContrast(buf, 1.4) },
    { sharpAug: (s) => s, pixelAug: (buf) => desaturate(buf, 0.6) },
    {
      sharpAug: (s) => s.modulate({ brightness: 0.7 }),
      pixelAug: (buf) => addGaussianNoise(buf, 20),
    },
    {
      sharpAug: (s) => s.modulate({ brightness: 1.3 }),
      pixelAug: (buf) => addGaussianNoise(buf, 15),
    },
    {
      sharpAug: (s) => s,
      pixelAug: (buf) => desaturate(adjustContrast(buf, 0.8), 0.2),
    },
    {
      sharpAug: (s) => s.flop(),
      pixelAug: (buf) => addGaussianNoise(buf, 15),
    },
  ];

  const results: Float32Array[] = [];

  for (const augment of sharpAugmentations.slice(
    0,
    Math.min(sharpAugmentations.length, augmentCount)
  )) {
    const pipeline = augment(sharpFn(imageBuffer));
    const resizedBuffer = await pipeline
      .resize(inputSize, inputSize, {
        fit: "contain",
        background: { r: 128, g: 128, b: 128 },
      })
      .removeAlpha()
      .raw()
      .toBuffer();

    const float32 = new Float32Array(inputSize * inputSize * 3);
    for (let i = 0; i < inputSize * inputSize; i++) {
      float32[i * 3] = resizedBuffer[i * 3] / 127.5 - 1;
      float32[i * 3 + 1] = resizedBuffer[i * 3 + 1] / 127.5 - 1;
      float32[i * 3 + 2] = resizedBuffer[i * 3 + 2] / 127.5 - 1;
    }
    results.push(float32);
  }

  const remaining = augmentCount - results.length;
  for (const { sharpAug, pixelAug } of pixelAugmentations.slice(
    0,
    remaining
  )) {
    const pipeline = sharpAug(sharpFn(imageBuffer));
    const resizedBuffer = await pipeline
      .resize(inputSize, inputSize, {
        fit: "contain",
        background: { r: 128, g: 128, b: 128 },
      })
      .removeAlpha()
      .raw()
      .toBuffer();

    const augmentedBuffer = pixelAug(resizedBuffer);

    const float32 = new Float32Array(inputSize * inputSize * 3);
    for (let i = 0; i < inputSize * inputSize; i++) {
      float32[i * 3] = augmentedBuffer[i * 3] / 127.5 - 1;
      float32[i * 3 + 1] = augmentedBuffer[i * 3 + 1] / 127.5 - 1;
      float32[i * 3 + 2] = augmentedBuffer[i * 3 + 2] / 127.5 - 1;
    }
    results.push(float32);
  }

  return results;
}
