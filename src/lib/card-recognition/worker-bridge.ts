import type {
  RecognitionConfig,
  RecognitionOutput,
  RecognitionResult,
  DetectedCard,
  IdentifiedCard,
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
import { loadOnnxModel, type OnnxFeatureModel } from "./onnx-model";

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
  identifiedCards: IdentifiedCard[];
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

// TFModel/TFLib interfaces removed — now using OnnxFeatureModel from onnx-model.ts

/**
 * Default worker factory that creates a recognition Web Worker.
 *
 * Currently returns null to force main-thread fallback, which includes
 * the full pipeline: YOLO detection → art crop → flip → multi-signal
 * scoring (embedding + histogram + spatial color + color filtering).
 * The Worker only supports embedding-only matching and needs to be
 * enhanced with the full pipeline before re-enabling.
 */
export function createDefaultWorkerFactory(): WorkerFactory {
  return (): Worker | null => null;
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
  let fallbackModel: OnnxFeatureModel | null = null;
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
    const isManifest = embeddingsUrl.endsWith("manifest.json");
    console.log("[WorkerBridge] Loading ONNX model + embeddings...");
    const t0 = Date.now();
    const [loadedModel, loadedDb] = await Promise.all([
      loadOnnxModel(modelUrl),
      isManifest
        ? loadAllReferenceDatabases(embeddingsUrl)
        : loadReferenceDatabase(embeddingsUrl),
    ]);
    fallbackModel = loadedModel;
    fallbackDb = loadedDb;
    fallbackReady = true;
    console.log(
      "[WorkerBridge] Model + embeddings loaded in %dms (%d cards)",
      Date.now() - t0,
      loadedDb.cardCount
    );

    // Detection model is optional — don't crash the pipeline if missing
    try {
      console.log("[WorkerBridge] Loading YOLO detection model...");
      await initDetectionModel();
      console.log("[WorkerBridge] YOLO model loaded");
    } catch {
      console.warn("[WorkerBridge] YOLO model not available — detection disabled");
    }
  }

  async function initialize(
    modelUrl: string,
    embeddingsUrl: string
  ): Promise<void> {
    const w = workerFactory();

    if (w) {
      console.log("[WorkerBridge] Worker created, sending init...");

      // Workers created by bundlers (Turbopack/webpack) may have an opaque
      // origin (blob: URL), which means relative paths like "/ml/model.onnx"
      // cannot be resolved by fetch().  Convert to absolute URLs here.
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const toAbsolute = (url: string): string =>
        url.startsWith("/") ? origin + url : url;

      const workerSuccess = await new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => {
          console.warn("[WorkerBridge] Worker init timed out (30s), falling back to main thread");
          w.terminate();
          resolve(false);
        }, 30000);

        w.onmessage = (event: MessageEvent<WorkerResponse>) => {
          clearTimeout(timeout);
          if (event.data.type === "initialized") {
            console.log("[WorkerBridge] Worker initialized successfully");
            worker = w;
            usingWorker = true;
            resolve(true);
          } else {
            console.warn("[WorkerBridge] Worker init failed:", event.data);
            w.terminate();
            resolve(false);
          }
        };

        w.onerror = (e) => {
          clearTimeout(timeout);
          console.warn("[WorkerBridge] Worker error:", e);
          w.terminate();
          resolve(false);
        };

        const msg: WorkerMessage = {
          type: "init",
          modelUrl: toAbsolute(modelUrl),
          embeddingsUrl: toAbsolute(embeddingsUrl),
        };
        w.postMessage(msg);
      });

      if (!workerSuccess) {
        // Fall back to main thread
        console.log("[WorkerBridge] Falling back to main thread...");
        usingWorker = false;
        await initializeFallback(modelUrl, embeddingsUrl);
        console.log("[WorkerBridge] Main thread fallback ready");
      }
    } else {
      // No Worker support — use main thread
      console.log("[WorkerBridge] No Worker support, using main thread");
      usingWorker = false;
      await initializeFallback(modelUrl, embeddingsUrl);
      console.log("[WorkerBridge] Main thread init complete");
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
              identifiedCards: [],
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
        identifiedCards: [],
      };
    }

    /** Identify a single cropped card image via MobileNetV3 embedding matching. */
    async function identifyCard(
      croppedInput: ImageData,
      model: OnnxFeatureModel,
      db: ReferenceDatabase,
      cfg: RecognitionConfig
    ): Promise<{
      candidates: RecognitionResult[];
      detectedColor: string | null;
    }> {
      const detectedColor = detectBorderColor(croppedInput);

      // Art crop: OP TCG cards have art at ~18%-62% vertically, ~8%-92% horizontally
      const artTop = Math.round(croppedInput.height * 0.18);
      const artHeight = Math.round(croppedInput.height * 0.44);
      const artLeft = Math.round(croppedInput.width * 0.08);
      const artWidth = Math.round(croppedInput.width * 0.84);
      const artCrop = cropFromImageData(
        croppedInput,
        artLeft,
        artTop,
        artWidth,
        artHeight
      );

      const flippedArt = flipImageDataHorizontally(artCrop);

      const preprocessedNormal = preprocessFrame(artCrop, cfg.inputSize);
      const preprocessedFlipped = preprocessFrame(flippedArt, cfg.inputSize);

      // ONNX Runtime WASM doesn't support concurrent session.run() calls
      // ("Session already started" error), so run sequentially.
      const embNormal = await model.run(preprocessedNormal, cfg.inputSize);
      const embFlipped = await model.run(preprocessedFlipped, cfg.inputSize);

      const histNormal = computeHistogram(artCrop);
      const histFlipped = computeHistogram(flippedArt);
      const dhashNormal = computeDHash(artCrop);
      const dhashFlipped = computeDHash(flippedArt);

      const candidatesNormal = findTopCandidates(
        embNormal,
        db,
        cfg.maxCandidates,
        cfg.confidenceThreshold,
        histNormal,
        detectedColor,
        dhashNormal
      );
      const candidatesFlipped = findTopCandidates(
        embFlipped,
        db,
        cfg.maxCandidates,
        cfg.confidenceThreshold,
        histFlipped,
        detectedColor,
        dhashFlipped
      );

      const bestNormal = candidatesNormal[0]?.confidence ?? 0;
      const bestFlipped = candidatesFlipped[0]?.confidence ?? 0;
      const candidates =
        bestFlipped > bestNormal ? candidatesFlipped : candidatesNormal;

      return { candidates, detectedColor };
    }

    try {
      // Step 1: Detect card-like objects with YOLOv8n
      const detectedCards = await detectCards(imageData);
      console.log(
        "[Recognize] YOLO detected %d cards in %dx%d frame",
        detectedCards.length,
        imageData.width,
        imageData.height
      );

      const sorted =
        detectedCards.length > 0
          ? [...detectedCards].sort((a, b) => b.confidence - a.confidence)
          : [];

      const maxIdentify = config.maxIdentify ?? 5;
      const TIME_BUDGET_MS = 1500;
      const identifiedCards: IdentifiedCard[] = [];
      let bestOverallResult: RecognitionOutput | null = null;
      let bestOverallCandidates: RecognitionResult[] = [];

      if (sorted.length > 0) {
        // Multi-card identification loop
        const toProcess = sorted.slice(0, maxIdentify);

        for (let i = 0; i < toProcess.length; i++) {
          // Time budget check — break if we've exceeded the budget
          if (i > 0 && Date.now() - start > TIME_BUDGET_MS) {
            // Mark remaining detections as unidentified
            for (let j = i; j < toProcess.length; j++) {
              identifiedCards.push({
                ...toProcess[j],
                cardCode: null,
                matchConfidence: 0,
                candidates: [],
              });
            }
            break;
          }

          const detection = toProcess[i];
          const [bx, by, bw, bh] = detection.bbox;

          // Shrink bbox by 10% on each edge
          const shrinkX = bw * 0.1;
          const shrinkY = bh * 0.1;
          const cropped = cropFromImageData(
            imageData,
            Math.round(bx + shrinkX),
            Math.round(by + shrinkY),
            Math.round(bw - shrinkX * 2),
            Math.round(bh - shrinkY * 2)
          );

          const { candidates, detectedColor } = await identifyCard(
            cropped,
            fallbackModel,
            fallbackDb,
            config
          );

          const durationMs = Date.now() - start;
          const best = candidates[0] ?? null;

          const identified: IdentifiedCard = {
            ...detection,
            cardCode: best?.cardCode ?? null,
            matchConfidence: best?.confidence ?? 0,
            candidates: candidates.map((c) => ({ ...c, durationMs })),
          };
          identifiedCards.push(identified);

          // Log matches
          if (candidates.length > 0) {
            candidates.slice(0, 3).forEach((c, ci) => {
              console.log(
                `[Match] Card ${i + 1} #${ci + 1}: ${c.cardCode} (${(c.confidence * 100).toFixed(1)}%) color=${detectedColor ?? "?"}`
              );
            });
          }

          // Track best overall match (for backward compat lastResult/topCandidates)
          if (
            best &&
            (bestOverallResult === null ||
              best.confidence > (bestOverallResult.confidence ?? 0))
          ) {
            bestOverallResult = {
              cardCode: best.cardCode,
              confidence: best.confidence,
              candidateCount: candidates.length,
              durationMs,
            };
            bestOverallCandidates = candidates.map((c) => ({
              ...c,
              durationMs,
            }));
          }
        }

        // Any remaining detections beyond maxIdentify
        for (let i = toProcess.length; i < sorted.length; i++) {
          identifiedCards.push({
            ...sorted[i],
            cardCode: null,
            matchConfidence: 0,
            candidates: [],
          });
        }
      } else {
        // No detections — process full frame as single card
        const { candidates, detectedColor } = await identifyCard(
          imageData,
          fallbackModel,
          fallbackDb,
          config
        );

        const durationMs = Date.now() - start;
        const best = candidates[0] ?? null;

        if (best) {
          bestOverallResult = {
            cardCode: best.cardCode,
            confidence: best.confidence,
            candidateCount: candidates.length,
            durationMs,
          };
          bestOverallCandidates = candidates.map((c) => ({
            ...c,
            durationMs,
          }));
          candidates.slice(0, 5).forEach((c, i) => {
            console.log(
              `[Match] #${i + 1}: ${c.cardCode} (${(c.confidence * 100).toFixed(1)}%) color=${detectedColor ?? "?"}`
            );
          });
        }
      }

      const durationMs = Date.now() - start;
      const fps = recordCompletion();

      return {
        result: bestOverallResult ?? {
          cardCode: null,
          confidence: 0,
          candidateCount: 0,
          durationMs,
        },
        topCandidates: bestOverallCandidates,
        fps,
        detectedCards: sorted,
        identifiedCards,
      };
    } catch (err) {
      console.error("[Recognize] Pipeline error:", err);
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
        identifiedCards: [],
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
