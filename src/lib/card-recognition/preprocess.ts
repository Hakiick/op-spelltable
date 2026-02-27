/** ImageNet normalization constants */
const IMAGENET_MEAN = [0.485, 0.456, 0.406];
const IMAGENET_STD = [0.229, 0.224, 0.225];

/**
 * Normalizes a pixel value using ImageNet statistics.
 * Formula: (pixel / 255 - mean) / std
 *
 * Exported for testing purposes.
 */
export function normalizePixel(pixelValue: number, channel: number = 0): number {
  return (pixelValue / 255 - IMAGENET_MEAN[channel]) / IMAGENET_STD[channel];
}

/**
 * Converts raw RGBA pixel data (Uint8ClampedArray) to a normalized Float32Array.
 * Output format: NCHW — [R...R, G...G, B...B] with ImageNet normalization.
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
    result[i] = normalizePixel(pixels[srcIdx], 0); // R plane
    result[pixelCount + i] = normalizePixel(pixels[srcIdx + 1], 1); // G plane
    result[2 * pixelCount + i] = normalizePixel(pixels[srcIdx + 2], 2); // B plane
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
 * This matches the preprocessing used in generate_embeddings.py (PIL
 * letterbox with gray background) so that embeddings are comparable.
 *
 * Output is NCHW layout with ImageNet normalization for ONNX Runtime Web.
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

  // Step 4: Extract pixels and normalize (ImageNet, NCHW layout)
  const resized = targetCtx.getImageData(0, 0, inputSize, inputSize);
  return rgbaToNormalizedRgb(resized.data, inputSize * inputSize);
}
