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
  maxCandidates: 20,
  frameSkip: 5,
  maxIdentify: 5,
};

const DEFAULT_MODEL_URL = "/ml/mobilenet_v3_large.onnx";
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
    identifiedCards: [],
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

    console.log("[Recognition] Initializing ML pipeline...");
    setState((prev) => ({ ...prev, status: "loading", loadingProgress: 0 }));

    try {
      await bridge.initialize(
        modelUrl ?? DEFAULT_MODEL_URL,
        embeddingsUrl ?? DEFAULT_EMBEDDINGS_URL
      );
      setIsUsingWorker(bridge.isUsingWorker());
      initializedRef.current = true;
      console.log(
        `[Recognition] Initialized (${bridge.isUsingWorker() ? "Worker" : "Main thread"})`
      );
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
      console.error("[Recognition] Init failed:", message);
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
        console.warn("[Recognition] No video element found");
        isActiveRef.current = false;
        setState((prev) => ({ ...prev, isActive: false, status: "ready" }));
        return;
      }

      // Wait for the video to have decoded frames before starting the loop.
      // Without this, captureFrame() returns null on every call and the loop
      // runs silently without ever producing results.
      if (video.readyState < 2) {
        console.log(
          "[Recognition] Waiting for video readiness (readyState=%d)...",
          video.readyState
        );
        await new Promise<void>((resolve) => {
          const onReady = () => {
            video.removeEventListener("loadeddata", onReady);
            resolve();
          };
          video.addEventListener("loadeddata", onReady);
          // Safety timeout — don't hang forever if video never becomes ready
          setTimeout(() => {
            video.removeEventListener("loadeddata", onReady);
            resolve();
          }, 5000);
        });
      }

      if (video.videoWidth === 0 || video.videoHeight === 0) {
        console.warn(
          "[Recognition] Video has zero dimensions (%dx%d), readyState=%d",
          video.videoWidth,
          video.videoHeight,
          video.readyState
        );
      } else {
        console.log(
          "[Recognition] Video ready: %dx%d, readyState=%d",
          video.videoWidth,
          video.videoHeight,
          video.readyState
        );
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
              ({
                result,
                fps,
                detectedCards,
                topCandidates,
                identifiedCards,
              }) => {
                recognizingRef.current = false;
                setState((prev) => ({
                  ...prev,
                  status: "ready",
                  lastResult: result,
                  topCandidates,
                  detectedCards: detectedCards ?? [],
                  identifiedCards: identifiedCards ?? [],
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
        const { result, fps, detectedCards, topCandidates, identifiedCards } =
          await bridge.recognize(capture.imageData, config);

        setState((prev) => ({
          ...prev,
          status: "ready",
          lastResult: result,
          topCandidates,
          detectedCards: detectedCards ?? [],
          identifiedCards: identifiedCards ?? [],
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
