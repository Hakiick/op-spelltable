"use client";

import { useEffect, useRef, useState } from "react";

type FeedState = "loading" | "active" | "error";

interface WebcamFeedProps {
  onStream: (stream: MediaStream) => void;
  className?: string;
}

export default function WebcamFeed({ onStream, className = "" }: WebcamFeedProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [feedState, setFeedState] = useState<FeedState>("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: true,
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        setFeedState("active");
        onStream(stream);
      } catch (err) {
        if (cancelled) return;

        if (err instanceof DOMException) {
          if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
            setErrorMessage("Camera access was denied. Please allow camera permissions.");
          } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
            setErrorMessage("No camera found. Please connect a webcam and try again.");
          } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
            setErrorMessage("Camera is already in use by another application.");
          } else {
            setErrorMessage("Could not access camera: " + err.message);
          }
        } else {
          setErrorMessage("An unexpected error occurred while accessing the camera.");
        }

        setFeedState("error");
      }
    }

    void startCamera();

    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className={`relative overflow-hidden rounded-xl bg-gray-900 ${className}`}
      aria-label="Local webcam feed"
    >
      {/* Video element — always rendered, hidden when not active */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className={`h-full w-full object-cover transition-opacity duration-300 ${
          feedState === "active" ? "opacity-100" : "opacity-0"
        }`}
        aria-label="Your webcam"
      />

      {/* Loading state */}
      {feedState === "loading" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-600 border-t-blue-500" />
          <p className="text-sm text-gray-400">Accessing camera...</p>
        </div>
      )}

      {/* Error state */}
      {feedState === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-900/50">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6 text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 10l4.553-2.069A1 1 0 0121 8.882v6.236a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"
              />
            </svg>
          </div>
          <p className="text-center text-sm text-red-400">{errorMessage}</p>
        </div>
      )}

      {/* Label overlay */}
      {feedState === "active" && (
        <div className="absolute bottom-2 left-2 rounded bg-black/50 px-2 py-0.5 text-xs text-white">
          You
        </div>
      )}
    </div>
  );
}
