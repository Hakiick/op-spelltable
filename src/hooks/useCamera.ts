"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface CameraDevice {
  deviceId: string;
  label: string;
}

export interface CameraSettings {
  deviceId: string | null;
  resolution: "auto" | "720p" | "480p" | "360p";
  mirror: boolean;
}

export interface UseCameraReturn {
  stream: MediaStream | null;
  devices: CameraDevice[];
  settings: CameraSettings;
  state: "idle" | "loading" | "active" | "error";
  error: string | null;
  updateSettings: (partial: Partial<CameraSettings>) => void;
  startCamera: () => Promise<void>;
  stopCamera: () => void;
}

const RESOLUTION_CONSTRAINTS: Record<
  CameraSettings["resolution"],
  { width?: number; height?: number } | undefined
> = {
  auto: undefined,
  "720p": { width: 1280, height: 720 },
  "480p": { width: 640, height: 480 },
  "360p": { width: 480, height: 360 },
};

function buildVideoConstraints(
  settings: CameraSettings
): MediaTrackConstraints {
  const sizeConstraints = RESOLUTION_CONSTRAINTS[settings.resolution];
  return {
    ...(settings.deviceId ? { deviceId: { exact: settings.deviceId } } : { facingMode: "user" }),
    ...(sizeConstraints
      ? { width: { ideal: sizeConstraints.width }, height: { ideal: sizeConstraints.height } }
      : {}),
  };
}

function parseMediaError(err: unknown): string {
  if (err instanceof DOMException) {
    if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
      return "Camera access was denied. Please allow camera permissions.";
    }
    if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
      return "No camera found. Please connect a webcam and try again.";
    }
    if (err.name === "NotReadableError" || err.name === "TrackStartError") {
      return "Camera is already in use by another application.";
    }
    return "Could not access camera: " + err.message;
  }
  return "An unexpected error occurred while accessing the camera.";
}

export function useCamera(): UseCameraReturn {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [devices, setDevices] = useState<CameraDevice[]>([]);
  const [settings, setSettings] = useState<CameraSettings>({
    deviceId: null,
    resolution: "auto",
    mirror: true,
  });
  const [cameraState, setCameraState] = useState<"idle" | "loading" | "active" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const isMountedRef = useRef(true);

  // Stop any active stream
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (isMountedRef.current) {
      setStream(null);
      setCameraState("idle");
    }
  }, []);

  // Enumerate camera devices (requires a stream to be active to get labels)
  const enumerateDevices = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices) return;
    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = allDevices
        .filter((d) => d.kind === "videoinput")
        .map((d) => ({
          deviceId: d.deviceId,
          label: d.label || `Camera ${d.deviceId.slice(0, 8)}`,
        }));
      if (isMountedRef.current) {
        setDevices(videoDevices);
      }
    } catch {
      // Enumeration failing is non-critical
    }
  }, []);

  const startCamera = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices) {
      setError("Camera API is not available in this environment.");
      setCameraState("error");
      return;
    }

    // Stop current stream before starting a new one
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    setCameraState("loading");
    setError(null);

    try {
      const videoConstraints = buildVideoConstraints(settings);
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: true,
      });

      if (!isMountedRef.current) {
        newStream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = newStream;
      setStream(newStream);
      setCameraState("active");

      // Enumerate devices now that we have permission (labels are available)
      await enumerateDevices();
    } catch (err) {
      if (!isMountedRef.current) return;
      const message = parseMediaError(err);
      setError(message);
      setCameraState("error");
    }
  }, [settings, enumerateDevices]);

  const updateSettings = useCallback((partial: Partial<CameraSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  return {
    stream,
    devices,
    settings,
    state: cameraState,
    error,
    updateSettings,
    startCamera,
    stopCamera,
  };
}
