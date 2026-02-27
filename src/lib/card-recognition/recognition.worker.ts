// Web Worker for ML card recognition inference
// Handles "init", "recognize", and "dispose" messages from the main thread.
// Uses ONNX Runtime Web for MobileNetV3 inference (NCHW, ImageNet normalization).

import type { WorkerMessage, WorkerResponse } from "@/types/ml";
import { preprocessFrame } from "./preprocess";
import {
  loadReferenceDatabase,
  loadAllReferenceDatabases,
  findTopCandidates,
  type ReferenceDatabase,
} from "./reference-db";
import { loadOnnxModel, type OnnxFeatureModel } from "./onnx-model";

let model: OnnxFeatureModel | null = null;
let referenceDb: ReferenceDatabase | null = null;
let ready = false;

const completionTimestamps: number[] = [];
const FPS_WINDOW = 10;

function computeFps(): number {
  if (completionTimestamps.length < 2) return 0;
  const first = completionTimestamps[0];
  const last = completionTimestamps[completionTimestamps.length - 1];
  const elapsed = last - first;
  if (elapsed <= 0) return 0;
  return ((completionTimestamps.length - 1) / elapsed) * 1000;
}

function recordCompletion(): number {
  completionTimestamps.push(Date.now());
  if (completionTimestamps.length > FPS_WINDOW) {
    completionTimestamps.shift();
  }
  return computeFps();
}

self.onmessage = async (event: MessageEvent<WorkerMessage>): Promise<void> => {
  const msg = event.data;

  if (msg.type === "init") {
    try {
      const isManifest = msg.embeddingsUrl.endsWith("manifest.json");
      const [loadedModel, loadedDb] = await Promise.all([
        loadOnnxModel(msg.modelUrl),
        isManifest
          ? loadAllReferenceDatabases(msg.embeddingsUrl)
          : loadReferenceDatabase(msg.embeddingsUrl),
      ]);
      model = loadedModel;
      referenceDb = loadedDb;
      ready = true;

      const response: WorkerResponse = { type: "initialized" };
      self.postMessage(response);
    } catch (err) {
      const response: WorkerResponse = {
        type: "error",
        message:
          err instanceof Error ? err.message : "Failed to initialize in worker",
      };
      self.postMessage(response);
    }
    return;
  }

  if (msg.type === "recognize") {
    if (!ready || !model || !referenceDb) {
      const response: WorkerResponse = {
        type: "result",
        data: {
          cardCode: null,
          confidence: 0,
          candidateCount: 0,
          durationMs: 0,
        },
        fps: computeFps(),
      };
      self.postMessage(response);
      return;
    }

    const start = Date.now();
    const { imageData, config } = msg;

    try {
      const preprocessed = preprocessFrame(imageData, config.inputSize);
      const embedding = await model.run(preprocessed, config.inputSize);

      const candidates = findTopCandidates(
        embedding,
        referenceDb,
        config.maxCandidates,
        config.confidenceThreshold
      );

      const durationMs = Date.now() - start;
      const fps = recordCompletion();

      if (candidates.length === 0) {
        const response: WorkerResponse = {
          type: "result",
          data: {
            cardCode: null,
            confidence: 0,
            candidateCount: 0,
            durationMs,
          },
          fps,
        };
        self.postMessage(response);
      } else {
        const best = candidates[0];
        const response: WorkerResponse = {
          type: "result",
          data: {
            cardCode: best.cardCode,
            confidence: best.confidence,
            candidateCount: candidates.length,
            durationMs,
          },
          fps,
        };
        self.postMessage(response);
      }
    } catch (err) {
      const response: WorkerResponse = {
        type: "error",
        message: err instanceof Error ? err.message : "Recognition failed",
      };
      self.postMessage(response);
    }
    return;
  }

  if (msg.type === "dispose") {
    if (model) {
      model.dispose();
      model = null;
    }
    referenceDb = null;
    ready = false;
    return;
  }
};
