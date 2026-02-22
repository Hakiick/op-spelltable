"use client";

import { useEffect, useRef } from "react";

interface PeerVideoProps {
  stream: MediaStream | null;
  className?: string;
  label?: string;
}

export default function PeerVideo({
  stream,
  className = "",
  label = "Opponent",
}: PeerVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div
      className={`relative overflow-hidden rounded-xl bg-gray-900 ${className}`}
      aria-label="Remote peer video feed"
    >
      {/* Video element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className={`h-full w-full object-cover transition-opacity duration-300 ${
          stream ? "opacity-100" : "opacity-0"
        }`}
        aria-label={`${label}'s webcam`}
      />

      {/* Waiting placeholder */}
      {!stream && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-700">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-8 w-8 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
          </div>

          <div className="flex flex-col items-center gap-1">
            <p className="text-sm font-medium text-gray-300">Waiting for opponent...</p>
            <div className="flex gap-1">
              <span
                className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-500"
                style={{ animationDelay: "0ms" }}
              />
              <span
                className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-500"
                style={{ animationDelay: "150ms" }}
              />
              <span
                className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-500"
                style={{ animationDelay: "300ms" }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Label overlay */}
      {stream && (
        <div className="absolute bottom-2 left-2 rounded bg-black/50 px-2 py-0.5 text-xs text-white">
          {label}
        </div>
      )}
    </div>
  );
}
