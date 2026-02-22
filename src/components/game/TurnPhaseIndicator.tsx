"use client";

import type { GamePhase } from "@/types/game";
import { PHASES, getPhaseLabel } from "@/lib/game-state/phases";

export interface TurnPhaseIndicatorProps {
  phase: GamePhase;
  turnNumber: number;
  isLocalTurn: boolean;
  onNextPhase?: () => void;
  className?: string;
}

export default function TurnPhaseIndicator({
  phase,
  turnNumber,
  isLocalTurn,
  onNextPhase,
  className = "",
}: TurnPhaseIndicatorProps) {
  const currentIndex = PHASES.indexOf(phase);
  const canAdvance = isLocalTurn && onNextPhase != null;

  return (
    <div
      className={`flex flex-col gap-1.5 px-3 py-2 ${className}`}
      data-testid="turn-phase-indicator"
      role="status"
      aria-live="polite"
      aria-label={`Turn ${turnNumber}, ${getPhaseLabel(phase)} phase${isLocalTurn ? " — your turn" : ""}`}
    >
      {/* Top row: Turn counter + whose turn */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-400">
          Turn {turnNumber}
        </span>
        <span
          className={`text-xs font-medium ${isLocalTurn ? "text-blue-400" : "text-gray-500"}`}
        >
          {isLocalTurn ? "Your turn" : "Opponent's turn"}
        </span>
      </div>

      {/* Phase progress bar */}
      <div className="flex items-center gap-0.5" role="list">
        {PHASES.map((p, i) => {
          const isActive = p === phase;
          const isPast = i < currentIndex;

          return (
            <div key={p} className="flex flex-1 items-center" role="listitem">
              {/* Phase segment */}
              <div
                className={`
                  flex-1 rounded-sm px-1 py-1 text-center transition-all duration-300
                  ${
                    isActive
                      ? "bg-blue-600 text-white shadow-md shadow-blue-900/50"
                      : isPast
                        ? "bg-gray-700 text-gray-500"
                        : "bg-gray-800 text-gray-600"
                  }
                `}
                aria-current={isActive ? "step" : undefined}
              >
                <span className="block text-[9px] font-bold uppercase leading-tight tracking-wide md:text-[10px]">
                  {getPhaseLabel(p)}
                </span>
              </div>

              {/* Connector between phases */}
              {i < PHASES.length - 1 && (
                <div
                  className={`mx-0.5 h-0.5 w-1 shrink-0 transition-colors duration-300 ${
                    i < currentIndex ? "bg-gray-600" : "bg-gray-800"
                  }`}
                  aria-hidden="true"
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Next Phase button */}
      {canAdvance && (
        <button
          type="button"
          onClick={onNextPhase}
          aria-label={`Advance to next phase from ${getPhaseLabel(phase)}`}
          data-testid="next-phase-button"
          className="
            mt-0.5 flex min-h-[44px] w-full items-center justify-center gap-1
            rounded bg-blue-700 px-3 py-2 text-xs font-bold text-white
            transition-colors hover:bg-blue-600 active:bg-blue-800
          "
        >
          Next Phase
          <span aria-hidden="true">→</span>
        </button>
      )}
    </div>
  );
}
