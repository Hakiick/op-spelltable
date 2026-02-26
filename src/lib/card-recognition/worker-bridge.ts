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
import { recognizeCardCode, disposeOcrWorker } from "./ocr";
import { computeHistogram } from "./histogram";
import { detectBorderColor } from "./color-filter";
import { computeDHash } from "./dhash";

const FPS_WINDOW_SIZE = 10;

/**
 * Flips an ImageData horizontally (mirror).
 * Used to handle webcam streams that are mirrored relative to reference card images.
 */
function flipImageDataHorizontally(source: ImageData): ImageData {
  const { width, height, data } = source;
  const flipped = new ImageData(width, height);
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const srcIdx = (row * width + col) * 4;
      const dstIdx = (row * width + (width - 1 - col)) * 4;
      flipped.data[dstIdx] = data[srcIdx];
      flipped.data[dstIdx + 1] = data[srcIdx + 1];
      flipped.data[dstIdx + 2] = data[srcIdx + 2];
      flipped.data[dstIdx + 3] = data[srcIdx + 3];
    }
  }
  return flipped;
}

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

        // Shrink the bbox by 10% on each edge to counteract the tendency of
        // YOLOv8 detections to be slightly larger than the actual card.
        const shrinkX = bw * 0.1;
        const shrinkY = bh * 0.1;
        recognitionInput = cropFromImageData(
          imageData,
          Math.round(bx + shrinkX),
          Math.round(by + shrinkY),
          Math.round(bw - shrinkX * 2),
          Math.round(bh - shrinkY * 2)
        );
      } else {
        // No detection model or no cards found — process full frame
        recognitionInput = imageData;
      }

      // OCR-based card code detection is available (see ./ocr.ts) but
      // disabled in the hot loop — webcam resolution is typically too low
      // for reliable reading of the small card code text. We keep the module
      // for potential future use with higher-resolution captures.

      // Step 2b: Detect border color for pre-filtering the reference database
      const detectedColor = detectBorderColor(recognitionInput);

      console.log(
        `[Recognition] Crop: ${recognitionInput.width}x${recognitionInput.height} (from ${imageData.width}x${imageData.height}), color=${detectedColor ?? "unknown"}`
      );

      // Debug: log crop dimensions + detection info
      if (sorted.length > 0) {
        const [, , bw, bh] = sorted[0].bbox;
        console.log(
          `[Detection] Best bbox: ${Math.round(bw)}x${Math.round(bh)} conf=${(sorted[0].confidence * 100).toFixed(0)}%`
        );
      }

      // Step 2c: Crop to artwork region to match reference embeddings.
      // OP TCG cards have art at ~18%-62% vertically, ~8%-92% horizontally.
      const artTop = Math.round(recognitionInput.height * 0.18);
      const artHeight = Math.round(recognitionInput.height * 0.44);
      const artLeft = Math.round(recognitionInput.width * 0.08);
      const artWidth = Math.round(recognitionInput.width * 0.84);
      const artCrop = cropFromImageData(
        recognitionInput,
        artLeft,
        artTop,
        artWidth,
        artHeight
      );

      console.log(
        `[ArtCrop] ${artCrop.width}x${artCrop.height} (from ${recognitionInput.width}x${recognitionInput.height})`
      );

      // Step 3: Preprocess and run MobileNetV3 on BOTH orientations
      // (normal + horizontally flipped) to handle mirrored webcam streams.
      const tf = (await import("@tensorflow/tfjs")) as unknown as TFLib;
      const flippedArt = flipImageDataHorizontally(artCrop);

      const preprocessedNormal = preprocessFrame(artCrop, config.inputSize);
      const preprocessedFlipped = preprocessFrame(flippedArt, config.inputSize);

      const [embNormal, embFlipped] = await Promise.all(
        [preprocessedNormal, preprocessedFlipped].map(async (pp) => {
          const out = tf.tidy(() => {
            const inp = tf.tensor(pp, [
              1,
              config.inputSize,
              config.inputSize,
              3,
            ]);
            return (fallbackModel as TFModel).predict(inp) as {
              data(): Promise<Float32Array>;
              dispose(): void;
            };
          });
          const data = await out.data();
          out.dispose();
          return data;
        })
      );

      // Compute color histograms for hybrid matching (on art crop)
      const histNormal = computeHistogram(artCrop);
      const histFlipped = computeHistogram(flippedArt);

      // Compute dHash for structural matching (on art crop)
      const dhashNormal = computeDHash(artCrop);
      const dhashFlipped = computeDHash(flippedArt);

      const candidatesNormal = findTopCandidates(
        embNormal,
        fallbackDb,
        config.maxCandidates,
        config.confidenceThreshold,
        histNormal,
        detectedColor,
        dhashNormal
      );
      const candidatesFlipped = findTopCandidates(
        embFlipped,
        fallbackDb,
        config.maxCandidates,
        config.confidenceThreshold,
        histFlipped,
        detectedColor,
        dhashFlipped
      );

      // Pick the orientation that produced the highest-confidence match
      const bestNormal = candidatesNormal[0]?.confidence ?? 0;
      const bestFlipped = candidatesFlipped[0]?.confidence ?? 0;
      const candidates =
        bestFlipped > bestNormal ? candidatesFlipped : candidatesNormal;

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
        topCandidates: candidates.map((c, i) => {
          if (i < 5) {
            console.log(
              `[Match] #${i + 1}: ${c.cardCode} (${(c.confidence * 100).toFixed(1)}%) color=${detectedColor ?? "?"}`
            );
          }
          return { ...c, durationMs };
        }),
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
    void disposeOcrWorker();
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
