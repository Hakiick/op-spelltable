"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createCardRecognizer } from "@/lib/card-recognition/identify";
import type { CardRecognizer } from "@/lib/card-recognition/identify";
import type {
  CardRecognitionState,
  RecognitionConfig,
  RecognitionResult,
  CropRegion,
} from "@/types/ml";

const DEFAULT_CONFIG: RecognitionConfig = {
  confidenceThreshold: 0.75,
  inputSize: 224,
  maxCandidates: 3,
  frameSkip: 5,
};

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
}

export function useCardRecognition(
  modelUrl?: string,
  embeddingsUrl?: string
): UseCardRecognitionReturn {
  const recognizerRef = useRef<CardRecognizer | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const frameCountRef = useRef(0);
  const isActiveRef = useRef(false);

  const [config, setConfigState] = useState<RecognitionConfig>(DEFAULT_CONFIG);

  const [state, setState] = useState<CardRecognitionState>({
    status: "idle",
    lastResult: null,
    topCandidates: [],
    error: null,
    isActive: false,
    loadingProgress: 0,
  });

  // Ensure we have a recognizer instance
  const getRecognizer = useCallback((): CardRecognizer => {
    if (!recognizerRef.current) {
      recognizerRef.current = createCardRecognizer();
    }
    return recognizerRef.current;
  }, []);

  // Initialize the pipeline (load model + embeddings)
  const initialize = useCallback(async (): Promise<boolean> => {
    const recognizer = getRecognizer();
    if (recognizer.isReady) return true;

    setState((prev) => ({ ...prev, status: "loading", loadingProgress: 0 }));

    try {
      await recognizer.initialize(modelUrl, embeddingsUrl);
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
  }, [getRecognizer, modelUrl, embeddingsUrl]);

  const start = useCallback(
    async (
      videoRef: React.RefObject<HTMLVideoElement | null>,
      crop?: CropRegion
    ): Promise<void> => {
      if (isActiveRef.current) return;

      const ready = await initialize();
      if (!ready) return;

      isActiveRef.current = true;
      frameCountRef.current = 0;

      setState((prev) => ({ ...prev, isActive: true, status: "ready" }));

      const loop = async (): Promise<void> => {
        if (!isActiveRef.current) return;

        frameCountRef.current++;

        // Skip frames according to config
        if (frameCountRef.current % config.frameSkip === 0) {
          const video = videoRef.current;
          if (video) {
            setState((prev) => ({ ...prev, status: "processing" }));
            try {
              const recognizer = getRecognizer();
              const result = await recognizer.recognize(video, config, crop);
              const candidates: RecognitionResult[] =
                result.cardCode !== null
                  ? [result as RecognitionResult]
                  : [];

              setState((prev) => ({
                ...prev,
                status: "ready",
                lastResult: result,
                topCandidates: candidates,
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
          }
        }

        if (isActiveRef.current) {
          rafIdRef.current = requestAnimationFrame(() => {
            void loop();
          });
        }
      };

      rafIdRef.current = requestAnimationFrame(() => {
        void loop();
      });
    },
    [config, getRecognizer, initialize]
  );

  const stop = useCallback((): void => {
    isActiveRef.current = false;

    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
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
        const recognizer = getRecognizer();
        const result = await recognizer.recognize(video, config, crop);
        const candidates: RecognitionResult[] =
          result.cardCode !== null ? [result as RecognitionResult] : [];

        setState((prev) => ({
          ...prev,
          status: "ready",
          lastResult: result,
          topCandidates: candidates,
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
    [config, getRecognizer, initialize]
  );

  const setConfig = useCallback((partial: Partial<RecognitionConfig>): void => {
    setConfigState((prev) => ({ ...prev, ...partial }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isActiveRef.current = false;
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      if (recognizerRef.current) {
        recognizerRef.current.dispose();
        recognizerRef.current = null;
      }
    };
  }, []);

  return { state, start, stop, recognizeOnce, setConfig };
}
