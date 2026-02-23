"use client";

import PlayerArea from "@/components/game/PlayerArea";
import TurnPhaseIndicator from "@/components/game/TurnPhaseIndicator";
import type { GamePhase, PlayerBoard } from "@/types/game";

export interface GameBoardProps {
  localBoard: PlayerBoard;
  opponentBoard: PlayerBoard;
  localPlayerName?: string;
  opponentPlayerName?: string;
  gamePhase?: GamePhase;
  turnNumber?: number;
  isLocalTurn?: boolean;
  onNextPhase?: () => void;
  className?: string;
}

export default function GameBoard({
  localBoard,
  opponentBoard,
  localPlayerName,
  opponentPlayerName,
  gamePhase = "main",
  turnNumber = 1,
  isLocalTurn = false,
  onNextPhase,
  className = "",
}: GameBoardProps) {
  return (
    <div
      className={`flex min-h-dvh flex-col bg-gray-950 text-white ${className}`}
      data-testid="game-board"
    >
      {/* Phase indicator */}
      <div className="border-b border-gray-800 bg-gray-900">
        <TurnPhaseIndicator
          phase={gamePhase}
          turnNumber={turnNumber}
          isLocalTurn={isLocalTurn}
          onNextPhase={onNextPhase}
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
        <div className="my-2 flex items-center gap-2" aria-hidden="true">
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
