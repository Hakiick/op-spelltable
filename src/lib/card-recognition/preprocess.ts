/**
 * Normalizes a pixel value from [0, 255] to [-1, 1].
 * Formula: pixel / 127.5 - 1
 *
 * Exported for testing purposes.
 */
export function normalizePixel(pixelValue: number): number {
  return pixelValue / 127.5 - 1;
}

/**
 * Converts raw RGBA pixel data (Uint8ClampedArray) to a normalized Float32Array.
 * Output format: [R, G, B, R, G, B, ...] with values in [-1, 1].
 * Alpha channel is dropped.
 *
 * Exported for testing purposes.
 */
export function rgbaToNormalizedRgb(
  pixels: Uint8ClampedArray,
  pixelCount: number
): Float32Array {
  const result = new Float32Array(pixelCount * 3);
  for (let i = 0; i < pixelCount; i++) {
    const srcIdx = i * 4;
    const dstIdx = i * 3;
    result[dstIdx] = normalizePixel(pixels[srcIdx]); // R
    result[dstIdx + 1] = normalizePixel(pixels[srcIdx + 1]); // G
    result[dstIdx + 2] = normalizePixel(pixels[srcIdx + 2]); // B
  }
  return result;
}

/**
 * Creates a canvas and 2D context of the given dimensions.
 * Uses OffscreenCanvas when available (Worker context), otherwise HTMLCanvasElement.
 */
function createCanvas(
  w: number,
  h: number
): {
  canvas: OffscreenCanvas | HTMLCanvasElement;
  ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
} {
  let canvas: OffscreenCanvas | HTMLCanvasElement;
  let ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null;

  if (typeof OffscreenCanvas !== "undefined") {
    canvas = new OffscreenCanvas(w, h);
    ctx = (canvas as OffscreenCanvas).getContext("2d");
  } else {
    canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    ctx = (canvas as HTMLCanvasElement).getContext("2d");
  }

  if (!ctx) {
    throw new Error("Could not get 2D context for canvas");
  }

  return { canvas, ctx };
}

/**
 * Preprocesses an ImageData frame for MobileNet input.
 *
 * Uses **letterbox** resizing: pads the input to a square (with gray=128)
 * while preserving aspect ratio, then resizes to inputSize x inputSize.
 * This matches the preprocessing used in generate-embeddings.ts (sharp
 * `fit: 'contain'` with gray background) so that embeddings are comparable.
 *
 * Uses a pure canvas approach — NO TensorFlow.js dependency.
 */
export function preprocessFrame(
  imageData: ImageData,
  inputSize: number
): Float32Array {
  // Step 1: Paint the original imageData onto a source canvas
  const { canvas: sourceCanvas, ctx: sourceCtx } = createCanvas(
    imageData.width,
    imageData.height
  );
  sourceCtx.putImageData(imageData, 0, 0);

  // Step 2: Create target canvas at inputSize x inputSize, filled with gray
  // (128 normalizes to ~0.0, the neutral activation for MobileNet)
  const { canvas: targetCanvas, ctx: targetCtx } = createCanvas(
    inputSize,
    inputSize
  );
  targetCtx.fillStyle = "rgb(128,128,128)";
  targetCtx.fillRect(0, 0, inputSize, inputSize);

  // Step 3: Letterbox — scale to fit within inputSize while preserving aspect ratio
  const scale = Math.min(
    inputSize / imageData.width,
    inputSize / imageData.height
  );
  const scaledW = Math.round(imageData.width * scale);
  const scaledH = Math.round(imageData.height * scale);
  const offsetX = Math.round((inputSize - scaledW) / 2);
  const offsetY = Math.round((inputSize - scaledH) / 2);

  targetCtx.drawImage(
    sourceCanvas as CanvasImageSource,
    0,
    0,
    imageData.width,
    imageData.height,
    offsetX,
    offsetY,
    scaledW,
    scaledH
  );

  // Step 4: Extract pixels and normalize to [-1, 1]
  const resized = targetCtx.getImageData(0, 0, inputSize, inputSize);
  return rgbaToNormalizedRgb(resized.data, inputSize * inputSize);
}
