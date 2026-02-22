"use client";

import GameBoard from "@/components/game/GameBoard";
import DonCounter from "@/components/game/DonCounter";
import LifeTracker from "@/components/game/LifeTracker";
import { useGameState } from "@/hooks/useGameState";
import type { PlayerBoard } from "@/types/game";

export interface GameClientProps {
  initialLocalBoard: PlayerBoard;
  opponentBoard: PlayerBoard;
  localPlayerName?: string;
  opponentPlayerName?: string;
  sessionId: string;
  roomCode?: string;
}

export default function GameClient({
  initialLocalBoard,
  opponentBoard,
  localPlayerName,
  opponentPlayerName,
}: GameClientProps) {
  const {
    phase,
    turnNumber,
    nextPhase,
    donActive,
    donRested,
    donDeck,
    activateDon,
    restDon,
    unrestDon,
    lifeCards,
    revealLife,
    loseLife,
  } = useGameState(initialLocalBoard.leader?.life ?? 5);

  // Build the live local board by merging interactive state
  const liveLocalBoard: PlayerBoard = {
    ...initialLocalBoard,
    donDeck,
    costArea: { active: donActive, rested: donRested },
    life: lifeCards.length,
  };

  return (
    <div className="flex min-h-screen flex-col bg-gray-950">
      <GameBoard
        localBoard={liveLocalBoard}
        opponentBoard={opponentBoard}
        localPlayerName={localPlayerName}
        opponentPlayerName={opponentPlayerName}
        gamePhase={phase}
        turnNumber={turnNumber}
        isLocalTurn={true}
        onNextPhase={nextPhase}
      />

      {/* Interactive panel — local player controls */}
      <div
        className="border-t border-gray-800 bg-gray-900 p-3"
        aria-label="Your interactive controls"
      >
        <div className="mx-auto flex max-w-2xl flex-col gap-3 md:flex-row md:gap-4">
          {/* DON!! Counter */}
          <div className="flex-1">
            <DonCounter
              active={donActive}
              rested={donRested}
              deckRemaining={donDeck}
              isInteractive={true}
              onActivate={activateDon}
              onRest={restDon}
              onUnrest={unrestDon}
            />
          </div>

          {/* Life Tracker */}
          <div className="flex-1">
            <LifeTracker
              lifeCards={lifeCards}
              isInteractive={true}
              onReveal={revealLife}
              onLoseLife={loseLife}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
