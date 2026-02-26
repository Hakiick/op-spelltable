"use client";

import type {
  RecognitionOutput,
  RecognitionResult,
  IdentifiedCard,
} from "@/types/ml";

interface RecognitionPanelProps {
  lastResult: RecognitionOutput | null;
  topCandidates: RecognitionResult[];
  identifiedCards?: IdentifiedCard[];
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
  identifiedCards = [],
  className = "",
}: RecognitionPanelProps) {
  const hasCard = lastResult !== null && lastResult.cardCode !== null;
  const matchedCards = identifiedCards.filter((c) => c.cardCode !== null);

  return (
    <div
      className={`rounded-xl bg-gray-900 p-4 text-white ${className}`}
      role="region"
      aria-label="Card recognition results"
    >
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
        Recognition
        {identifiedCards.length > 0 && (
          <span className="ml-2 text-gray-500">
            ({matchedCards.length}/{identifiedCards.length} identified)
          </span>
        )}
      </h3>

      {/* No result state */}
      {(!lastResult || !hasCard) && matchedCards.length === 0 && (
        <div
          className="flex items-center justify-center py-4"
          role="status"
          aria-live="polite"
        >
          <p className="text-sm text-gray-500">No card detected</p>
        </div>
      )}

      {/* Multi-card identified list */}
      {matchedCards.length > 1 && (
        <div role="status" aria-live="polite">
          <ol className="space-y-3" aria-label="Identified cards">
            {matchedCards.map((card, index) => (
              <li key={`${card.cardCode}-${index}`} className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-700 text-xs font-bold text-gray-300"
                      aria-hidden="true"
                    >
                      {index + 1}
                    </span>
                    <span className="font-mono text-sm font-medium text-white">
                      {card.cardCode}
                    </span>
                  </div>
                  {index === 0 && lastResult && (
                    <span className="text-xs text-gray-400">
                      {lastResult.durationMs}ms
                    </span>
                  )}
                </div>
                <ConfidenceBar confidence={card.matchConfidence} />
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Single card or fallback to topCandidates */}
      {matchedCards.length <= 1 &&
        hasCard &&
        lastResult &&
        lastResult.cardCode !== null && (
          <div
            role="status"
            aria-live="polite"
            aria-label={`Detected ${lastResult.cardCode} with ${Math.round(lastResult.confidence * 100)}% confidence`}
          >
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
