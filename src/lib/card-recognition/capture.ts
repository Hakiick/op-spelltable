import type { CropRegion } from "@/types/ml";

export interface CaptureResult {
  imageData: ImageData;
  capturedAt: number;
  sourceWidth: number;
  sourceHeight: number;
}

/**
 * Captures a single frame from a video element, optionally cropped to a region.
 * Returns null if the video is not ready (readyState < HAVE_CURRENT_DATA).
 *
 * @param reusableCanvas - Optional pre-created canvas to reuse across calls,
 *   reducing GC pressure in tight loops (e.g., the recognition RAF loop).
 *   If not provided, a new canvas is created for each call.
 */
export function captureFrame(
  video: HTMLVideoElement,
  crop?: CropRegion,
  reusableCanvas?: HTMLCanvasElement | OffscreenCanvas
): CaptureResult | null {
  // HTMLMediaElement.HAVE_CURRENT_DATA = 2
  if (video.readyState < 2) {
    return null;
  }

  const sourceWidth = video.videoWidth;
  const sourceHeight = video.videoHeight;

  if (sourceWidth === 0 || sourceHeight === 0) {
    return null;
  }

  const sx = crop ? crop.x : 0;
  const sy = crop ? crop.y : 0;
  const sw = crop ? crop.width : sourceWidth;
  const sh = crop ? crop.height : sourceHeight;

  const canvas: HTMLCanvasElement | OffscreenCanvas =
    reusableCanvas ?? document.createElement("canvas");
  canvas.width = sw;
  canvas.height = sh;

  const ctx = canvas.getContext("2d") as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null;
  if (!ctx) {
    return null;
  }

  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);

  const imageData = ctx.getImageData(0, 0, sw, sh);

  return {
    imageData,
    capturedAt: Date.now(),
    sourceWidth,
    sourceHeight,
  };
}
