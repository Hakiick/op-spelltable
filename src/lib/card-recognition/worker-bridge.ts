import type {
  RecognitionConfig,
  RecognitionOutput,
  RecognitionResult,
  DetectedCard,
  WorkerMessage,
  WorkerResponse,
} from "@/types/ml";
import { preprocessFrame } from "./preprocess";
import {
  loadReferenceDatabase,
  loadAllReferenceDatabases,
  findTopCandidates,
  type ReferenceDatabase,
} from "./reference-db";
import {
  initDetectionModel,
  detectCards,
  disposeDetectionModel,
} from "./detection";

const FPS_WINDOW_SIZE = 10;

/**
 * Crops a rectangular region from an ImageData object.
 * Clamps coordinates to the source dimensions.
 */
function cropFromImageData(
  source: ImageData,
  x: number,
  y: number,
  w: number,
  h: number
): ImageData {
  // Clamp to source bounds
  const sx = Math.max(0, Math.min(x, source.width));
  const sy = Math.max(0, Math.min(y, source.height));
  const sw = Math.min(w, source.width - sx);
  const sh = Math.min(h, source.height - sy);

  if (sw <= 0 || sh <= 0) {
    return new ImageData(1, 1);
  }

  const cropped = new ImageData(sw, sh);
  for (let row = 0; row < sh; row++) {
    const srcOffset = ((sy + row) * source.width + sx) * 4;
    const dstOffset = row * sw * 4;
    cropped.data.set(
      source.data.subarray(srcOffset, srcOffset + sw * 4),
      dstOffset
    );
  }
  return cropped;
}

export interface RecognizeResult {
  result: RecognitionOutput;
  topCandidates: RecognitionResult[];
  fps: number;
  detectedCards: DetectedCard[];
}

export interface WorkerBridge {
  initialize(modelUrl: string, embeddingsUrl: string): Promise<void>;
  recognize(
    imageData: ImageData,
    config: RecognitionConfig
  ): Promise<RecognizeResult>;
  dispose(): void;
  isUsingWorker(): boolean;
}

/** Injectable factory type for creating the recognition Web Worker. */
export type WorkerFactory = () => Worker | null;

function computeFpsFromTimestamps(timestamps: number[]): number {
  if (timestamps.length < 2) return 0;
  const first = timestamps[0];
  const last = timestamps[timestamps.length - 1];
  const elapsed = last - first;
  if (elapsed <= 0) return 0;
  return ((timestamps.length - 1) / elapsed) * 1000;
}

interface TFModel {
  predict(input: unknown): { data(): Promise<Float32Array>; dispose(): void };
  dispose(): void;
}

interface TFLib {
  loadGraphModel(
    url: string,
    options?: { fromTFHub?: boolean }
  ): Promise<TFModel>;
  tensor(data: Float32Array, shape: number[]): unknown;
  tidy<T>(fn: () => T): T;
}

/**
 * Default worker factory that creates a recognition Web Worker.
 * Uses `new URL(...)` which works with Next.js's bundler.
 * Returns null if Workers are unavailable or if the worker fails to load.
 */
export function createDefaultWorkerFactory(): WorkerFactory {
  return (): Worker | null => {
    if (typeof Worker === "undefined") return null;
    try {
      return new Worker(new URL("./recognition.worker.ts", import.meta.url), {
        type: "module",
      });
    } catch {
      return null;
    }
  };
}

/**
 * Creates a WorkerBridge that attempts to run recognition in a Web Worker.
 * Falls back to main-thread execution if Web Workers are unavailable or
 * if the worker fails to load.
 *
 * Both paths accept ImageData (not HTMLVideoElement) so callers control
 * frame capture separately (e.g., via RecognitionLoop).
 *
 * @param workerFactory - Optional factory for creating the worker. Defaults
 *   to `createDefaultWorkerFactory()`. Inject a custom factory for testing.
 */
export function createWorkerBridge(
  workerFactory: WorkerFactory = createDefaultWorkerFactory()
): WorkerBridge {
  let worker: Worker | null = null;
  let usingWorker = false;
  const completionTimestamps: number[] = [];

  // Main-thread fallback state
  let fallbackModel: TFModel | null = null;
  let fallbackDb: ReferenceDatabase | null = null;
  let fallbackReady = false;

  function recordCompletion(): number {
    completionTimestamps.push(Date.now());
    if (completionTimestamps.length > FPS_WINDOW_SIZE) {
      completionTimestamps.shift();
    }
    return computeFpsFromTimestamps(completionTimestamps);
  }

  async function initializeFallback(
    modelUrl: string,
    embeddingsUrl: string
  ): Promise<void> {
    const tf = (await import("@tensorflow/tfjs")) as unknown as TFLib;
    const isManifest = embeddingsUrl.endsWith("manifest.json");
    const [loadedModel, loadedDb] = await Promise.all([
      tf.loadGraphModel(modelUrl, { fromTFHub: true }),
      isManifest
        ? loadAllReferenceDatabases(embeddingsUrl)
        : loadReferenceDatabase(embeddingsUrl),
    ]);
    fallbackModel = loadedModel;
    fallbackDb = loadedDb;
    fallbackReady = true;

    // Detection model is optional — don't crash the pipeline if missing
    try {
      await initDetectionModel();
    } catch {
      // YOLOv8n ONNX model not available — detection disabled,
      // recognition will process the full frame instead
    }
  }

  async function initialize(
    modelUrl: string,
    embeddingsUrl: string
  ): Promise<void> {
    const w = workerFactory();

    if (w) {
      const workerSuccess = await new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => {
          w.terminate();
          resolve(false);
        }, 30000);

        w.onmessage = (event: MessageEvent<WorkerResponse>) => {
          clearTimeout(timeout);
          if (event.data.type === "initialized") {
            worker = w;
            usingWorker = true;
            resolve(true);
          } else {
            w.terminate();
            resolve(false);
          }
        };

        w.onerror = () => {
          clearTimeout(timeout);
          w.terminate();
          resolve(false);
        };

        const msg: WorkerMessage = {
          type: "init",
          modelUrl,
          embeddingsUrl,
        };
        w.postMessage(msg);
      });

      if (!workerSuccess) {
        // Fall back to main thread
        usingWorker = false;
        await initializeFallback(modelUrl, embeddingsUrl);
      }
    } else {
      // No Worker support — use main thread
      usingWorker = false;
      await initializeFallback(modelUrl, embeddingsUrl);
    }
  }

  async function recognize(
    imageData: ImageData,
    config: RecognitionConfig
  ): Promise<RecognizeResult> {
    if (usingWorker && worker) {
      const w = worker;
      // Clone the ImageData before sending to worker to avoid detached buffer issues
      const cloned = new ImageData(
        new Uint8ClampedArray(imageData.data),
        imageData.width,
        imageData.height
      );

      return new Promise<RecognizeResult>((resolve, reject) => {
        const handleMessage = (event: MessageEvent<WorkerResponse>): void => {
          clearTimeout(timeout);
          w.removeEventListener("message", handleMessage);
          w.removeEventListener("error", onError);
          if (event.data.type === "result") {
            // Worker path doesn't support detection yet — return empty
            const workerResult = event.data.data;
            const workerCandidates: RecognitionResult[] =
              workerResult.cardCode !== null
                ? [workerResult as RecognitionResult]
                : [];
            resolve({
              result: workerResult,
              topCandidates: workerCandidates,
              fps: event.data.fps,
              detectedCards: [],
            });
          } else if (event.data.type === "error") {
            reject(new Error(event.data.message));
          }
        };

        const onError = (e: ErrorEvent): void => {
          clearTimeout(timeout);
          w.removeEventListener("message", handleMessage);
          w.removeEventListener("error", onError);
          reject(new Error(e.message ?? "Worker error during recognition"));
        };

        const timeout = setTimeout(() => {
          w.removeEventListener("message", handleMessage);
          w.removeEventListener("error", onError);
          reject(new Error("Worker recognition timeout"));
        }, 5000);

        w.addEventListener("message", handleMessage);
        w.addEventListener("error", onError);

        const msg: WorkerMessage = {
          type: "recognize",
          imageData: cloned,
          config,
        };
        w.postMessage(msg);
      });
    }

    // Main-thread fallback: detect cards first, then recognize each crop
    const start = Date.now();

    if (!fallbackReady || !fallbackModel || !fallbackDb) {
      const fps = recordCompletion();
      return {
        result: {
          cardCode: null,
          confidence: 0,
          candidateCount: 0,
          durationMs: Date.now() - start,
        },
        topCandidates: [],
        fps,
        detectedCards: [],
      };
    }

    try {
      // Step 1: Try to detect card-like objects with YOLOv8n
      const detectedCards = await detectCards(imageData);

      // Step 2: Determine input for MobileNetV3
      // If detection found cards → crop the best one (with padding)
      // If detection unavailable/empty → use the full frame as fallback
      let recognitionInput: ImageData;
      let sorted: DetectedCard[] = [];

      if (detectedCards.length > 0) {
        sorted = [...detectedCards].sort((a, b) => b.confidence - a.confidence);
        const bestDetection = sorted[0];
        const [bx, by, bw, bh] = bestDetection.bbox;

        // Add 10% padding around the bbox to ensure the full card is captured
        const padX = bw * 0.1;
        const padY = bh * 0.1;
        recognitionInput = cropFromImageData(
          imageData,
          Math.round(bx - padX),
          Math.round(by - padY),
          Math.round(bw + padX * 2),
          Math.round(bh + padY * 2)
        );
      } else {
        // No detection model or no cards found — process full frame
        recognitionInput = imageData;
      }

      // Step 3: Preprocess and run MobileNetV3 on the selected input
      const preprocessed = preprocessFrame(recognitionInput, config.inputSize);
      const tf = (await import("@tensorflow/tfjs")) as unknown as TFLib;

      const outputTensor = tf.tidy(() => {
        const inputTensor = tf.tensor(preprocessed, [
          1,
          config.inputSize,
          config.inputSize,
          3,
        ]);
        return (fallbackModel as TFModel).predict(inputTensor) as {
          data(): Promise<Float32Array>;
          dispose(): void;
        };
      });

      const embedding = await outputTensor.data();
      outputTensor.dispose();

      const candidates = findTopCandidates(
        embedding,
        fallbackDb,
        config.maxCandidates,
        config.confidenceThreshold
      );

      const durationMs = Date.now() - start;
      const fps = recordCompletion();

      if (candidates.length === 0) {
        return {
          result: {
            cardCode: null,
            confidence: 0,
            candidateCount: 0,
            durationMs,
          },
          topCandidates: [],
          fps,
          detectedCards: sorted,
        };
      }

      const best = candidates[0];
      return {
        result: {
          cardCode: best.cardCode,
          confidence: best.confidence,
          candidateCount: candidates.length,
          durationMs,
        },
        topCandidates: candidates.map((c) => ({ ...c, durationMs })),
        fps,
        detectedCards: sorted,
      };
    } catch {
      const fps = recordCompletion();
      return {
        result: {
          cardCode: null,
          confidence: 0,
          candidateCount: 0,
          durationMs: Date.now() - start,
        },
        topCandidates: [],
        fps,
        detectedCards: [],
      };
    }
  }

  function dispose(): void {
    if (worker) {
      const msg: WorkerMessage = { type: "dispose" };
      worker.postMessage(msg);
      worker.terminate();
      worker = null;
    }
    if (fallbackModel) {
      fallbackModel.dispose();
      fallbackModel = null;
    }
    disposeDetectionModel();
    fallbackDb = null;
    fallbackReady = false;
    usingWorker = false;
    completionTimestamps.length = 0;
  }

  function isUsingWorker(): boolean {
    return usingWorker;
  }

  return { initialize, recognize, dispose, isUsingWorker };
}
