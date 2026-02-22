"use client";

import type { RecognitionConfig, RecognitionOutput, CropRegion } from "@/types/ml";
import { captureFrame } from "./capture";
import { preprocessFrame } from "./preprocess";
import {
  loadReferenceDatabase,
  findTopCandidates,
  type ReferenceDatabase,
} from "./reference-db";

const DEFAULT_MODEL_URL =
  "https://tfhub.dev/google/tfjs-model/imagenet/mobilenet_v3_small_100_224/feature_vector/5/default/1";

const DEFAULT_EMBEDDINGS_URL = "/ml/embeddings-OP01.json";

export interface CardRecognizer {
  isReady: boolean;
  initialize(modelUrl?: string, embeddingsUrl?: string): Promise<void>;
  recognize(
    video: HTMLVideoElement,
    config: RecognitionConfig,
    crop?: CropRegion
  ): Promise<RecognitionOutput>;
  dispose(): void;
}

interface TFModel {
  predict(input: unknown): { data(): Promise<Float32Array>; dispose(): void };
  dispose(): void;
}

interface TFLib {
  loadGraphModel(url: string, options?: { fromTFHub?: boolean }): Promise<TFModel>;
  tensor(data: Float32Array, shape: number[]): unknown;
  tidy<T>(fn: () => T): T;
  dispose(tensor: unknown): void;
}

function createCardRecognizerImpl(): CardRecognizer {
  let model: TFModel | null = null;
  let referenceDb: ReferenceDatabase | null = null;
  let ready = false;

  return {
    get isReady() {
      return ready;
    },

    async initialize(
      modelUrl: string = DEFAULT_MODEL_URL,
      embeddingsUrl: string = DEFAULT_EMBEDDINGS_URL
    ): Promise<void> {
      ready = false;

      // Dynamic import to avoid loading TF at module level
      const tf = (await import("@tensorflow/tfjs")) as unknown as TFLib;

      // Load the model and reference DB concurrently
      const [loadedModel, loadedDb] = await Promise.all([
        tf.loadGraphModel(modelUrl, { fromTFHub: true }),
        loadReferenceDatabase(embeddingsUrl),
      ]);

      model = loadedModel;
      referenceDb = loadedDb;
      ready = true;
    },

    async recognize(
      video: HTMLVideoElement,
      config: RecognitionConfig,
      crop?: CropRegion
    ): Promise<RecognitionOutput> {
      const start = Date.now();

      if (!ready || !model || !referenceDb) {
        return {
          cardCode: null,
          confidence: 0,
          candidateCount: 0,
          durationMs: Date.now() - start,
        };
      }

      // Capture frame
      const capture = captureFrame(video, crop);
      if (!capture) {
        return {
          cardCode: null,
          confidence: 0,
          candidateCount: 0,
          durationMs: Date.now() - start,
        };
      }

      // Preprocess
      const preprocessed = preprocessFrame(
        capture.imageData,
        config.inputSize
      );

      // Run inference with TF — dynamically imported
      const tf = (await import("@tensorflow/tfjs")) as unknown as TFLib;

      let embedding: Float32Array;

      try {
        const outputTensor = tf.tidy(() => {
          const inputTensor = tf.tensor(preprocessed, [
            1,
            config.inputSize,
            config.inputSize,
            3,
          ]);
          return (model as TFModel).predict(inputTensor) as {
            data(): Promise<Float32Array>;
            dispose(): void;
          };
        });

        embedding = await outputTensor.data();
        outputTensor.dispose();
      } catch {
        return {
          cardCode: null,
          confidence: 0,
          candidateCount: 0,
          durationMs: Date.now() - start,
        };
      }

      // Find candidates
      const candidates = findTopCandidates(
        embedding,
        referenceDb,
        config.maxCandidates,
        config.confidenceThreshold
      );

      const durationMs = Date.now() - start;

      if (candidates.length === 0) {
        return {
          cardCode: null,
          confidence: 0,
          candidateCount: 0,
          durationMs,
        };
      }

      // Return best match with actual duration
      const best = candidates[0];
      return {
        cardCode: best.cardCode,
        confidence: best.confidence,
        candidateCount: candidates.length,
        durationMs,
      };
    },

    dispose(): void {
      if (model) {
        model.dispose();
        model = null;
      }
      referenceDb = null;
      ready = false;
    },
  };
}

export function createCardRecognizer(): CardRecognizer {
  return createCardRecognizerImpl();
}
