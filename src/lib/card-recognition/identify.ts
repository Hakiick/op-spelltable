"use client";

import type {
  RecognitionConfig,
  RecognitionOutput,
  CropRegion,
} from "@/types/ml";
import { captureFrame } from "./capture";
import { preprocessFrame } from "./preprocess";
import {
  loadReferenceDatabase,
  loadAllReferenceDatabases,
  findTopCandidates,
  type ReferenceDatabase,
} from "./reference-db";
import { loadOnnxModel, type OnnxFeatureModel } from "./onnx-model";

const DEFAULT_MODEL_URL = "/ml/mobilenet_v3_large.onnx";

const DEFAULT_EMBEDDINGS_URL = "/ml/manifest.json";

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

function createCardRecognizerImpl(): CardRecognizer {
  let model: OnnxFeatureModel | null = null;
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

      // Load the ONNX model and reference DB concurrently
      const isManifest = embeddingsUrl.endsWith("manifest.json");
      const [loadedModel, loadedDb] = await Promise.all([
        loadOnnxModel(modelUrl),
        isManifest
          ? loadAllReferenceDatabases(embeddingsUrl)
          : loadReferenceDatabase(embeddingsUrl),
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

      // Preprocess (NCHW, ImageNet normalization)
      const preprocessed = preprocessFrame(capture.imageData, config.inputSize);

      let embedding: Float32Array;

      try {
        embedding = await model.run(preprocessed, config.inputSize);
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
