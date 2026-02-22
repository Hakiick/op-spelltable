"use client";

import { useState } from "react";
import type { CardSummary } from "@/types/card";
import CardDetailOverlay from "@/components/game/CardDetailOverlay";

interface CardGridWithOverlayProps {
  cards: CardSummary[];
}

export default function CardGridWithOverlay({ cards }: CardGridWithOverlayProps) {
  const [selectedCardCode, setSelectedCardCode] = useState<string | null>(null);

  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="mb-4 h-12 w-12 text-gray-300"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <p className="text-lg font-semibold text-gray-500">No cards found</p>
        <p className="mt-1 text-sm text-gray-400">
          Try adjusting your filters or search query.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {cards.map((card) => (
          <CardGridItem
            key={card.id}
            card={card}
            onSelect={setSelectedCardCode}
          />
        ))}
      </div>

      <CardDetailOverlay
        cardCode={selectedCardCode}
        onClose={() => setSelectedCardCode(null)}
      />
    </>
  );
}

// ── Inline card item (clickable, no navigation) ────────────────────────────

const colorBadgeMap: Record<string, string> = {
  Red: "bg-red-600 text-white",
  Green: "bg-green-600 text-white",
  Blue: "bg-blue-600 text-white",
  Purple: "bg-purple-600 text-white",
  Black: "bg-gray-800 text-white",
  Yellow: "bg-yellow-500 text-gray-900",
};

const colorPlaceholderMap: Record<string, string> = {
  Red: "bg-red-200",
  Green: "bg-green-200",
  Blue: "bg-blue-200",
  Purple: "bg-purple-200",
  Black: "bg-gray-300",
  Yellow: "bg-yellow-200",
};

function getColorBadge(color: string): string {
  const primaryColor = color.split(" ")[0];
  return colorBadgeMap[primaryColor] ?? "bg-gray-400 text-white";
}

function getColorPlaceholder(color: string): string {
  const primaryColor = color.split(" ")[0];
  return colorPlaceholderMap[primaryColor] ?? "bg-gray-200";
}

function CardGridItem({
  card,
  onSelect,
}: {
  card: CardSummary;
  onSelect: (cardId: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(card.cardId)}
      className="group flex w-full flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md min-h-[44px] min-w-[44px] text-left"
      aria-label={`View details for ${card.name}`}
    >
      <div
        className={`flex h-40 w-full items-center justify-center ${getColorPlaceholder(card.color)}`}
        aria-hidden="true"
      >
        <span className="text-4xl font-bold text-white/60 drop-shadow">
          {card.cardId.split("-")[0]}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <p className="line-clamp-2 text-sm font-semibold text-gray-900 leading-tight">
          {card.name}
        </p>
        <p className="text-xs text-gray-500 font-mono">{card.cardId}</p>

        <div className="flex flex-wrap gap-1 mt-auto">
          <span
            className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${getColorBadge(card.color)}`}
          >
            {card.color}
          </span>
          <span className="inline-flex items-center rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-700">
            {card.type}
          </span>
          {card.rarity && (
            <span className="inline-flex items-center rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-700">
              {card.rarity}
            </span>
          )}
        </div>

        <div className="flex gap-3 text-xs text-gray-600 mt-1">
          {card.cost !== null && (
            <span>
              Cost:{" "}
              <span className="font-semibold text-gray-900">{card.cost}</span>
            </span>
          )}
          {card.power !== null && (
            <span>
              Power:{" "}
              <span className="font-semibold text-gray-900">{card.power}</span>
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
