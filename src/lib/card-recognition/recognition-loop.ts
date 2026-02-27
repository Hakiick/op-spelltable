import type { RecognitionConfig, CropRegion } from "@/types/ml";
import { captureFrame } from "./capture";

const FPS_WINDOW_SIZE = 10;

export interface RecognitionLoopCallbacks {
  onFrame: (imageData: ImageData) => void;
  onFpsUpdate: (fps: number) => void;
}

export interface RecognitionLoop {
  start(
    video: HTMLVideoElement,
    config: RecognitionConfig,
    callbacks: RecognitionLoopCallbacks,
    crop?: CropRegion
  ): void;
  stop(): void;
  isRunning(): boolean;
  getFps(): number;
}

/**
 * Computes FPS from a rolling window of completion timestamps.
 * @param timestamps - Array of timestamps (ms) of completed recognitions
 * @returns FPS value, or 0 if fewer than 2 timestamps are available
 */
export function computeFpsFromTimestamps(timestamps: number[]): number {
  if (timestamps.length < 2) return 0;
  const first = timestamps[0];
  const last = timestamps[timestamps.length - 1];
  const elapsed = last - first;
  if (elapsed <= 0) return 0;
  return ((timestamps.length - 1) / elapsed) * 1000;
}

export function createRecognitionLoop(): RecognitionLoop {
  let rafId: number | null = null;
  let running = false;
  let frameCount = 0;
  const completionTimestamps: number[] = [];

  function getFps(): number {
    return computeFpsFromTimestamps(completionTimestamps);
  }

  function recordCompletion(callbacks: RecognitionLoopCallbacks): void {
    const now = Date.now();
    completionTimestamps.push(now);
    if (completionTimestamps.length > FPS_WINDOW_SIZE) {
      completionTimestamps.shift();
    }
    callbacks.onFpsUpdate(computeFpsFromTimestamps(completionTimestamps));
  }

  function start(
    video: HTMLVideoElement,
    config: RecognitionConfig,
    callbacks: RecognitionLoopCallbacks,
    crop?: CropRegion
  ): void {
    if (running) return;

    running = true;
    frameCount = 0;
    completionTimestamps.length = 0;

    // Create a single canvas to reuse across all frames, avoiding per-frame
    // allocations and GC pressure (especially noticeable on mobile).
    const reusableCanvas = document.createElement("canvas");

    let loggedFirstCapture = false;
    let nullCaptureCount = 0;

    const loop = (): void => {
      if (!running) return;

      frameCount++;

      if (frameCount % config.frameSkip === 0) {
        const capture = captureFrame(video, crop, reusableCanvas);
        if (capture) {
          if (!loggedFirstCapture) {
            console.log(
              "[RecognitionLoop] First frame captured: %dx%d",
              capture.sourceWidth,
              capture.sourceHeight
            );
            loggedFirstCapture = true;
          }
          callbacks.onFrame(capture.imageData);
          recordCompletion(callbacks);
        } else {
          nullCaptureCount++;
          if (nullCaptureCount <= 3 || nullCaptureCount % 100 === 0) {
            console.warn(
              "[RecognitionLoop] captureFrame returned null (count=%d, video.readyState=%d, %dx%d)",
              nullCaptureCount,
              video.readyState,
              video.videoWidth,
              video.videoHeight
            );
          }
        }
      }

      if (running) {
        rafId = requestAnimationFrame(loop);
      }
    };

    rafId = requestAnimationFrame(loop);
  }

  function stop(): void {
    running = false;
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function isRunning(): boolean {
    return running;
  }

  return { start, stop, isRunning, getFps };
}
