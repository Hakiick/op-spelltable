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
 * Preprocesses an ImageData frame for MobileNet input.
 * Resizes to inputSize x inputSize and normalizes pixel values to [-1, 1].
 *
 * Uses a pure canvas approach — NO TensorFlow.js dependency.
 */
export function preprocessFrame(
  imageData: ImageData,
  inputSize: number
): Float32Array {
  // Use OffscreenCanvas if available (Worker context), otherwise fall back to document.createElement
  let canvas: OffscreenCanvas | HTMLCanvasElement;
  let ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null;

  if (typeof OffscreenCanvas !== "undefined") {
    canvas = new OffscreenCanvas(inputSize, inputSize);
    ctx = (canvas as OffscreenCanvas).getContext("2d");
  } else {
    canvas = document.createElement("canvas");
    canvas.width = inputSize;
    canvas.height = inputSize;
    ctx = (canvas as HTMLCanvasElement).getContext("2d");
  }

  if (!ctx) {
    throw new Error("Could not get 2D context for preprocessing canvas");
  }

  // First, paint the original imageData onto a temporary canvas so we can drawImage from it
  let sourceCanvas: OffscreenCanvas | HTMLCanvasElement;
  let sourceCtx:
    | OffscreenCanvasRenderingContext2D
    | CanvasRenderingContext2D
    | null;

  if (typeof OffscreenCanvas !== "undefined") {
    sourceCanvas = new OffscreenCanvas(imageData.width, imageData.height);
    sourceCtx = (sourceCanvas as OffscreenCanvas).getContext("2d");
  } else {
    sourceCanvas = document.createElement("canvas");
    sourceCanvas.width = imageData.width;
    sourceCanvas.height = imageData.height;
    sourceCtx = (sourceCanvas as HTMLCanvasElement).getContext("2d");
  }

  if (!sourceCtx) {
    throw new Error("Could not get 2D context for source canvas");
  }

  sourceCtx.putImageData(imageData, 0, 0);

  // Draw scaled version onto the target canvas
  ctx.drawImage(
    sourceCanvas as CanvasImageSource,
    0,
    0,
    imageData.width,
    imageData.height,
    0,
    0,
    inputSize,
    inputSize
  );

  const resized = ctx.getImageData(0, 0, inputSize, inputSize);
  const pixels = resized.data; // Uint8ClampedArray [R, G, B, A, R, G, B, A, ...]

  return rgbaToNormalizedRgb(pixels, inputSize * inputSize);
}
