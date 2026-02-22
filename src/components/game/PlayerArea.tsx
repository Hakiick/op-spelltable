"use client";

import CardZone from "@/components/game/CardZone";
import type { PlayerBoard } from "@/types/game";

export interface PlayerAreaProps {
  board: PlayerBoard;
  isOpponent: boolean;
  playerName?: string;
  className?: string;
}

export default function PlayerArea({
  board,
  isOpponent,
  playerName,
  className = "",
}: PlayerAreaProps) {
  // ── Rows ──────────────────────────────────────────────────────────────────
  // Row 1 (Resources): Deck | Trash | Life | DON!!
  const resourceRow = (
    <div className="flex flex-wrap items-end gap-2" data-row="resources">
      <CardZone
        variant="deck"
        label="Deck"
        count={board.deck}
      />
      <CardZone
        variant="trash"
        label="Trash"
        cards={board.trash}
      />
      <CardZone
        variant="life"
        label="Life"
        life={board.life}
        isOpponent={isOpponent}
      />
      <CardZone
        variant="don"
        label="DON!!"
        count={board.donDeck}
        activeCount={board.costArea.active}
        restedCount={board.costArea.rested}
      />
    </div>
  );

  // Row 2 (Characters): 5 character slots
  const charactersRow = (
    <div className="flex items-end gap-2" data-row="characters">
      <CardZone
        variant="characters"
        label="Characters"
        cards={board.characters}
        isOpponent={isOpponent}
      />
    </div>
  );

  // Row 3 (Field): Stage + Leader
  const fieldRow = (
    <div className="flex items-end gap-4" data-row="field">
      <CardZone
        variant="stage"
        label="Stage"
        cards={board.stage ? [board.stage] : []}
        isOpponent={isOpponent}
      />
      <CardZone
        variant="leader"
        label="Leader"
        cards={board.leader ? [board.leader] : []}
        isOpponent={isOpponent}
      />
    </div>
  );

  // For opponent, rows are reversed (field at top, resources at bottom)
  const rows = isOpponent
    ? [fieldRow, charactersRow, resourceRow]
    : [resourceRow, charactersRow, fieldRow];

  const rowKeys = isOpponent
    ? ["field", "characters", "resources"]
    : ["resources", "characters", "field"];

  return (
    <div
      className={`flex flex-col gap-2 ${className}`}
      data-testid={isOpponent ? "opponent-area" : "local-area"}
      aria-label={isOpponent ? `Opponent: ${playerName ?? "Opponent"}` : `You: ${playerName ?? "Player"}`}
    >
      {/* Player name label */}
      {playerName && (
        <div
          className={`flex items-center gap-2 ${isOpponent ? "flex-row-reverse" : ""}`}
        >
          <span className="text-sm font-semibold text-gray-300">
            {isOpponent ? `Opponent: ${playerName}` : `You: ${playerName}`}
          </span>
        </div>
      )}

      {/* Zone rows */}
      <div className="flex flex-col gap-2">
        {rows.map((row, i) => (
          <div key={rowKeys[i]}>{row}</div>
        ))}
      </div>

      {/* Hand count (shown for local player) */}
      {!isOpponent && (
        <div
          className="mt-1 text-xs text-gray-400"
          aria-label={`Hand: ${board.hand} cards`}
        >
          Hand: <span className="font-semibold text-gray-200">{board.hand}</span> cards
        </div>
      )}

      {/* Opponent hand count (only count, no peeking) */}
      {isOpponent && (
        <div
          className="mt-1 text-xs text-gray-400"
          aria-label={`Opponent hand: ${board.hand} cards`}
        >
          Hand: <span className="font-semibold text-gray-200">{board.hand}</span> cards
        </div>
      )}
    </div>
  );
}
