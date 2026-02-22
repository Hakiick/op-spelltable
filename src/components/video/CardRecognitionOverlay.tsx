"use client";

import type { CardRecognitionState } from "@/types/ml";

interface CardRecognitionOverlayProps {
  state: CardRecognitionState;
  isActive: boolean;
  isUsingWorker: boolean;
  onToggle: () => void;
  className?: string;
}

function getFpsColor(fps: number): string {
  if (fps >= 10) return "text-green-400";
  if (fps >= 5) return "text-yellow-400";
  return "text-red-400";
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.75) return "bg-green-900/70";
  if (confidence >= 0.5) return "bg-yellow-900/70";
  return "bg-red-900/70";
}

export default function CardRecognitionOverlay({
  state,
  isActive,
  isUsingWorker,
  onToggle,
  className = "",
}: CardRecognitionOverlayProps) {
  const { status, lastResult, error, loadingProgress, fps } = state;

  const isLoading = status === "loading";
  const isError = status === "error";
  const hasCard =
    lastResult !== null && lastResult.cardCode !== null;

  const confidencePercent =
    lastResult !== null
      ? Math.round(lastResult.confidence * 100)
      : 0;

  return (
    <div
      className={`absolute inset-0 pointer-events-none ${className}`}
      aria-label="Card recognition overlay"
    >
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-2">
        {/* Left: FPS + Worker indicator (only when active) */}
        <div className="flex items-center gap-2">
          {isActive && (
            <>
              <span
                className={`rounded bg-black/60 px-2 py-0.5 text-xs font-mono backdrop-blur-sm ${getFpsColor(fps)}`}
                role="status"
                aria-live="polite"
                aria-label={`Recognition speed: ${fps} frames per second`}
              >
                FPS: {fps}
              </span>
              <span className="rounded bg-black/60 px-2 py-0.5 text-xs text-gray-300 backdrop-blur-sm">
                {isUsingWorker ? "Worker" : "Main"}
              </span>
            </>
          )}
        </div>

        {/* Right: Toggle button */}
        <button
          onClick={onToggle}
          className="pointer-events-auto flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-lg bg-black/60 px-3 py-2 text-xs font-medium text-white backdrop-blur-sm transition-colors hover:bg-black/80 focus:outline-none focus:ring-2 focus:ring-white/50 active:scale-95"
          aria-label={isActive ? "Stop card recognition" : "Start card recognition"}
          aria-pressed={isActive}
        >
          {/* Scan/Search icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            {isActive ? (
              /* Stop icon */
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7"
              />
            ) : (
              /* Search/scan icon */
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            )}
          </svg>
          <span className="hidden sm:inline">
            {isActive ? "Stop Recognition" : "Start Recognition"}
          </span>
        </button>
      </div>

      {/* Center: Loading state */}
      {isLoading && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none"
          role="status"
          aria-live="polite"
          aria-label="Loading ML model"
        >
          <div className="rounded-xl bg-black/70 px-6 py-4 backdrop-blur-sm flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-600 border-t-blue-400" aria-hidden="true" />
            <p className="text-sm text-white">Loading ML model...</p>
            {loadingProgress > 0 && (
              <div className="w-40">
                <div className="mb-1 flex justify-between text-xs text-gray-400">
                  <span>Progress</span>
                  <span>{Math.round(loadingProgress)}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-700">
                  <div
                    className="h-full rounded-full bg-blue-400 transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.round(loadingProgress))}%` }}
                    aria-hidden="true"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Center: Error state */}
      {isError && error && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
          role="alert"
        >
          <div className="rounded-xl bg-black/70 px-6 py-4 backdrop-blur-sm flex flex-col items-center gap-3 pointer-events-auto">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-8 w-8 text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <p className="max-w-xs text-center text-sm text-red-300">{error}</p>
            <button
              onClick={onToggle}
              className="rounded-lg bg-red-900/60 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-900/80 focus:outline-none focus:ring-2 focus:ring-red-400 min-h-11"
              aria-label="Retry card recognition"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Bottom: Result / no match (only when active and not loading/error) */}
      {isActive && !isLoading && !isError && (
        <div
          className="absolute bottom-0 left-0 right-0 flex justify-center p-3"
          role="status"
          aria-live="polite"
          aria-label={
            hasCard && lastResult
              ? `Detected card: ${lastResult.cardCode}, confidence ${confidencePercent}%`
              : "No card detected"
          }
        >
          {hasCard && lastResult && lastResult.cardCode !== null ? (
            <div
              className={`rounded-xl px-4 py-2.5 backdrop-blur-sm transition-opacity duration-300 ${getConfidenceColor(lastResult.confidence)}`}
            >
              <p className="text-sm font-semibold text-white">
                {lastResult.cardCode}
                {/* Card name would come from DB lookup — placeholder via code */}
              </p>
              <p className="text-xs text-gray-300">
                Confidence: {confidencePercent}%
              </p>
            </div>
          ) : (
            <div className="rounded-xl bg-black/60 px-4 py-2.5 backdrop-blur-sm">
              <p className="text-xs text-gray-400">No card detected</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
