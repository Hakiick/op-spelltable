"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createWorkerBridge,
  type WorkerBridge,
} from "@/lib/card-recognition/worker-bridge";
import {
  createRecognitionLoop,
  type RecognitionLoop,
} from "@/lib/card-recognition/recognition-loop";
import { captureFrame } from "@/lib/card-recognition/capture";
import type {
  CardRecognitionState,
  RecognitionConfig,
  CropRegion,
  DetectedCard,
} from "@/types/ml";

const DEFAULT_CONFIG: RecognitionConfig = {
  confidenceThreshold: 0.0,
  inputSize: 224,
  maxCandidates: 5,
  frameSkip: 5,
};

const DEFAULT_MODEL_URL =
  "https://tfhub.dev/google/tfjs-model/imagenet/mobilenet_v3_small_100_224/feature_vector/5/default/1";
const DEFAULT_EMBEDDINGS_URL = "/ml/manifest.json";

export interface UseCardRecognitionReturn {
  state: CardRecognitionState;
  start: (
    videoRef: React.RefObject<HTMLVideoElement | null>,
    crop?: CropRegion
  ) => Promise<void>;
  stop: () => void;
  recognizeOnce: (
    videoRef: React.RefObject<HTMLVideoElement | null>,
    crop?: CropRegion
  ) => Promise<void>;
  setConfig: (partial: Partial<RecognitionConfig>) => void;
  isUsingWorker: boolean;
}

export function useCardRecognition(
  modelUrl?: string,
  embeddingsUrl?: string
): UseCardRecognitionReturn {
  const bridgeRef = useRef<WorkerBridge | null>(null);
  const loopRef = useRef<RecognitionLoop | null>(null);
  const isActiveRef = useRef(false);
  const initializedRef = useRef(false);
  const recognizingRef = useRef(false);
  const [isUsingWorker, setIsUsingWorker] = useState(false);

  const [config, setConfigState] = useState<RecognitionConfig>(DEFAULT_CONFIG);

  const [state, setState] = useState<CardRecognitionState>({
    status: "idle",
    lastResult: null,
    topCandidates: [],
    detectedCards: [],
    error: null,
    isActive: false,
    loadingProgress: 0,
    fps: 0,
  });

  const getBridge = useCallback((): WorkerBridge => {
    if (!bridgeRef.current) {
      bridgeRef.current = createWorkerBridge();
    }
    return bridgeRef.current;
  }, []);

  const getLoop = useCallback((): RecognitionLoop => {
    if (!loopRef.current) {
      loopRef.current = createRecognitionLoop();
    }
    return loopRef.current;
  }, []);

  // Initialize the bridge (loads model + embeddings).
  // Guarded by initializedRef so repeated calls (start + recognizeOnce)
  // skip re-initialization and avoid creating orphaned workers.
  const initialize = useCallback(async (): Promise<boolean> => {
    if (initializedRef.current) return true;

    const bridge = getBridge();

    setState((prev) => ({ ...prev, status: "loading", loadingProgress: 0 }));

    try {
      await bridge.initialize(
        modelUrl ?? DEFAULT_MODEL_URL,
        embeddingsUrl ?? DEFAULT_EMBEDDINGS_URL
      );
      setIsUsingWorker(bridge.isUsingWorker());
      initializedRef.current = true;
      setState((prev) => ({
        ...prev,
        status: "ready",
        loadingProgress: 100,
        error: null,
      }));
      return true;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to initialize ML pipeline";
      setState((prev) => ({
        ...prev,
        status: "error",
        error: message,
        loadingProgress: 0,
      }));
      return false;
    }
  }, [getBridge, modelUrl, embeddingsUrl]);

  const start = useCallback(
    async (
      videoRef: React.RefObject<HTMLVideoElement | null>,
      crop?: CropRegion
    ): Promise<void> => {
      if (isActiveRef.current) return;

      const ready = await initialize();
      if (!ready) return;

      const video = videoRef.current;
      if (!video) {
        isActiveRef.current = false;
        setState((prev) => ({ ...prev, isActive: false, status: "ready" }));
        return;
      }

      isActiveRef.current = true;
      setState((prev) => ({ ...prev, isActive: true, status: "ready" }));

      const bridge = getBridge();
      const loop = getLoop();
      const currentConfig = config;

      loop.start(
        video,
        currentConfig,
        {
          onFrame: (imageData: ImageData) => {
            // Skip if a previous recognition is still in flight to prevent
            // race conditions, out-of-order state updates, and memory pressure.
            if (recognizingRef.current) return;
            recognizingRef.current = true;

            setState((prev) => ({ ...prev, status: "processing" }));

            void bridge.recognize(imageData, currentConfig).then(
              ({ result, fps, detectedCards, topCandidates }) => {
                recognizingRef.current = false;
                setState((prev) => ({
                  ...prev,
                  status: "ready",
                  lastResult: result,
                  topCandidates,
                  detectedCards: detectedCards ?? [],
                  fps,
                }));
              },
              (err: unknown) => {
                recognizingRef.current = false;
                const message =
                  err instanceof Error ? err.message : "Recognition error";
                setState((prev) => ({
                  ...prev,
                  status: "error",
                  error: message,
                }));
              }
            );
          },
          onFpsUpdate: (fps: number) => {
            setState((prev) => ({ ...prev, fps }));
          },
        },
        crop
      );
    },
    [config, getBridge, getLoop, initialize]
  );

  const stop = useCallback((): void => {
    isActiveRef.current = false;

    if (loopRef.current) {
      loopRef.current.stop();
    }

    setState((prev) => ({
      ...prev,
      isActive: false,
      status: prev.status === "processing" ? "ready" : prev.status,
    }));
  }, []);

  const recognizeOnce = useCallback(
    async (
      videoRef: React.RefObject<HTMLVideoElement | null>,
      crop?: CropRegion
    ): Promise<void> => {
      const ready = await initialize();
      if (!ready) return;

      const video = videoRef.current;
      if (!video) return;

      setState((prev) => ({ ...prev, status: "processing" }));

      try {
        const capture = captureFrame(video, crop);
        if (!capture) {
          setState((prev) => ({ ...prev, status: "ready" }));
          return;
        }

        const bridge = getBridge();
        const { result, fps, detectedCards, topCandidates } =
          await bridge.recognize(capture.imageData, config);

        setState((prev) => ({
          ...prev,
          status: "ready",
          lastResult: result,
          topCandidates,
          detectedCards: detectedCards ?? [],
          fps,
        }));
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Recognition error";
        setState((prev) => ({
          ...prev,
          status: "error",
          error: message,
        }));
      }
    },
    [config, getBridge, initialize]
  );

  const setConfig = useCallback((partial: Partial<RecognitionConfig>): void => {
    setConfigState((prev) => ({ ...prev, ...partial }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isActiveRef.current = false;
      recognizingRef.current = false;
      initializedRef.current = false;
      if (loopRef.current) {
        loopRef.current.stop();
        loopRef.current = null;
      }
      if (bridgeRef.current) {
        bridgeRef.current.dispose();
        bridgeRef.current = null;
      }
    };
  }, []);

  return { state, start, stop, recognizeOnce, setConfig, isUsingWorker };
}
