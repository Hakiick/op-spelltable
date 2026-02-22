import type {
  RecognitionConfig,
  RecognitionOutput,
  WorkerMessage,
  WorkerResponse,
} from "@/types/ml";
import { preprocessFrame } from "./preprocess";
import {
  loadReferenceDatabase,
  findTopCandidates,
  type ReferenceDatabase,
} from "./reference-db";

const FPS_WINDOW_SIZE = 10;

export interface WorkerBridge {
  initialize(modelUrl: string, embeddingsUrl: string): Promise<void>;
  recognize(
    imageData: ImageData,
    config: RecognitionConfig
  ): Promise<{ result: RecognitionOutput; fps: number }>;
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
      return new Worker(
        new URL("./recognition.worker.ts", import.meta.url),
        { type: "module" }
      );
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
    const [loadedModel, loadedDb] = await Promise.all([
      tf.loadGraphModel(modelUrl, { fromTFHub: true }),
      loadReferenceDatabase(embeddingsUrl),
    ]);
    fallbackModel = loadedModel;
    fallbackDb = loadedDb;
    fallbackReady = true;
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
  ): Promise<{ result: RecognitionOutput; fps: number }> {
    if (usingWorker && worker) {
      const w = worker;
      // Clone the ImageData before sending to worker to avoid detached buffer issues
      const cloned = new ImageData(
        new Uint8ClampedArray(imageData.data),
        imageData.width,
        imageData.height
      );

      return new Promise<{ result: RecognitionOutput; fps: number }>(
        (resolve, reject) => {
          const handleMessage = (event: MessageEvent<WorkerResponse>): void => {
            w.removeEventListener("message", handleMessage);
            if (event.data.type === "result") {
              resolve({ result: event.data.data, fps: event.data.fps });
            } else if (event.data.type === "error") {
              reject(new Error(event.data.message));
            }
          };

          w.addEventListener("message", handleMessage);

          const msg: WorkerMessage = {
            type: "recognize",
            imageData: cloned,
            config,
          };
          w.postMessage(msg);
        }
      );
    }

    // Main-thread fallback: process imageData directly using the pipeline
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
        fps,
      };
    }

    try {
      const preprocessed = preprocessFrame(imageData, config.inputSize);
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
          fps,
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
        fps,
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
        fps,
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
