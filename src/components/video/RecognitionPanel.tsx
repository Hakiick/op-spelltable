"use client";

import type { RecognitionOutput, RecognitionResult } from "@/types/ml";

interface RecognitionPanelProps {
  lastResult: RecognitionOutput | null;
  topCandidates: RecognitionResult[];
  className?: string;
}

function ConfidenceBar({ confidence }: { confidence: number }) {
  const percent = Math.round(confidence * 100);
  const barColor =
    percent >= 75
      ? "bg-green-500"
      : percent >= 50
        ? "bg-yellow-500"
        : "bg-red-500";

  return (
    <div className="flex items-center gap-2">
      <div
        className="h-2 flex-1 overflow-hidden rounded-full bg-gray-700"
        aria-hidden="true"
      >
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="w-10 text-right text-xs font-mono text-gray-300">
        {percent}%
      </span>
    </div>
  );
}

export default function RecognitionPanel({
  lastResult,
  topCandidates,
  className = "",
}: RecognitionPanelProps) {
  const hasCard = lastResult !== null && lastResult.cardCode !== null;

  return (
    <div
      className={`rounded-xl bg-gray-900 p-4 text-white ${className}`}
      role="region"
      aria-label="Card recognition results"
    >
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
        Recognition
      </h3>

      {/* No result state */}
      {(!lastResult || !hasCard) && (
        <div
          className="flex items-center justify-center py-4"
          role="status"
          aria-live="polite"
        >
          <p className="text-sm text-gray-500">No card detected</p>
        </div>
      )}

      {/* Card detected */}
      {hasCard && lastResult && lastResult.cardCode !== null && (
        <div
          role="status"
          aria-live="polite"
          aria-label={`Detected ${lastResult.cardCode} with ${Math.round(lastResult.confidence * 100)}% confidence`}
        >
          {/* Primary result */}
          {topCandidates.length <= 1 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-semibold text-white">
                  {lastResult.cardCode}
                </span>
                <span className="text-xs text-gray-400">
                  {lastResult.durationMs}ms
                </span>
              </div>
              <ConfidenceBar confidence={lastResult.confidence} />
            </div>
          ) : (
            /* Multiple candidates list */
            <ol
              className="space-y-3"
              aria-label="Candidate cards ranked by confidence"
            >
              {topCandidates.map((candidate, index) => (
                <li key={candidate.cardCode} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-700 text-xs font-bold text-gray-300"
                        aria-hidden="true"
                      >
                        {index + 1}
                      </span>
                      <span className="font-mono text-sm font-medium text-white">
                        {candidate.cardCode}
                      </span>
                    </div>
                    {index === 0 && (
                      <span className="text-xs text-gray-400">
                        {lastResult.durationMs}ms
                      </span>
                    )}
                  </div>
                  <ConfidenceBar confidence={candidate.confidence} />
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
