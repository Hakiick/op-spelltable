"use client";

import PlayerArea from "@/components/game/PlayerArea";
import type { GamePhase, PlayerBoard } from "@/types/game";

export interface GameBoardProps {
  localBoard: PlayerBoard;
  opponentBoard: PlayerBoard;
  localPlayerName?: string;
  opponentPlayerName?: string;
  gamePhase?: GamePhase;
  turnNumber?: number;
  isLocalTurn?: boolean;
  className?: string;
}

const PHASE_LABELS: Record<GamePhase, string> = {
  refresh: "Refresh",
  draw: "Draw",
  don: "DON!!",
  main: "Main",
  end: "End",
};

function PhaseIndicator({
  phase,
  turnNumber,
  isLocalTurn,
}: {
  phase: GamePhase;
  turnNumber: number;
  isLocalTurn: boolean;
}) {
  return (
    <div
      className="flex items-center justify-between px-2 py-1"
      aria-label={`Turn ${turnNumber}, ${PHASE_LABELS[phase]} phase`}
      data-testid="phase-indicator"
      role="status"
      aria-live="polite"
    >
      <span className="text-xs text-gray-400">Turn {turnNumber}</span>
      <div className="flex items-center gap-2">
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            isLocalTurn
              ? "bg-blue-600 text-white"
              : "bg-gray-700 text-gray-300"
          }`}
        >
          {PHASE_LABELS[phase]} Phase
        </span>
        {isLocalTurn && (
          <span className="text-xs font-medium text-blue-400">Your turn</span>
        )}
      </div>
    </div>
  );
}

export default function GameBoard({
  localBoard,
  opponentBoard,
  localPlayerName,
  opponentPlayerName,
  gamePhase = "main",
  turnNumber = 1,
  isLocalTurn = false,
  className = "",
}: GameBoardProps) {
  return (
    <div
      className={`flex min-h-dvh flex-col bg-gray-950 text-white ${className}`}
      data-testid="game-board"
    >
      {/* Phase indicator */}
      <div className="border-b border-gray-800 bg-gray-900">
        <PhaseIndicator
          phase={gamePhase}
          turnNumber={turnNumber}
          isLocalTurn={isLocalTurn}
        />
      </div>

      {/* Game area */}
      <div className="flex flex-1 flex-col gap-0 p-2 md:p-4">
        {/* Opponent area — top half */}
        <div className="flex-1 rounded-lg border border-gray-800 bg-gray-900/50 p-2 md:p-3">
          <PlayerArea
            board={opponentBoard}
            isOpponent={true}
            playerName={opponentPlayerName}
          />
        </div>

        {/* Separator */}
        <div
          className="my-2 flex items-center gap-2"
          aria-hidden="true"
        >
          <div className="h-px flex-1 bg-gray-700" />
          <span className="text-[10px] uppercase tracking-widest text-gray-600">
            vs
          </span>
          <div className="h-px flex-1 bg-gray-700" />
        </div>

        {/* Local player area — bottom half */}
        <div className="flex-1 rounded-lg border border-gray-800 bg-gray-900/50 p-2 md:p-3">
          <PlayerArea
            board={localBoard}
            isOpponent={false}
            playerName={localPlayerName}
          />
        </div>
      </div>
    </div>
  );
}
