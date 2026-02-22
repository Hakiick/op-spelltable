"use client";

import type { CardData } from "@/types/card";

export type CardZoneVariant =
  | "leader"
  | "characters"
  | "stage"
  | "don"
  | "life"
  | "deck"
  | "trash";

export interface CardZoneProps {
  variant: CardZoneVariant;
  label: string;
  /** Cards to display (for leader, characters, stage, trash) */
  cards?: CardData[];
  /** Generic count (for deck, don deck) */
  count?: number;
  /** DON!! active count */
  activeCount?: number;
  /** DON!! rested count */
  restedCount?: number;
  /** Life count */
  life?: number;
  /** Is this the opponent's zone (some zones face-down) */
  isOpponent?: boolean;
  className?: string;
}

// ── Colours per variant ─────────────────────────────────────────────────────
const BORDER_COLOURS: Record<CardZoneVariant, string> = {
  leader: "border-amber-500",
  characters: "border-blue-500",
  stage: "border-green-500",
  don: "border-red-500",
  life: "border-pink-500",
  deck: "border-gray-500",
  trash: "border-gray-700",
};

// ── Card stub (individual card slot) ────────────────────────────────────────
function CardSlot({
  card,
  faceDown = false,
}: {
  card?: CardData | null;
  faceDown?: boolean;
}) {
  if (!card) {
    return (
      <div
        className="h-16 w-12 rounded border border-dashed border-gray-600 md:h-24 md:w-16"
        aria-label="Empty card slot"
      />
    );
  }

  if (faceDown) {
    return (
      <div
        className="h-16 w-12 rounded border border-gray-500 bg-gray-700 md:h-24 md:w-16"
        title="Face-down card"
        aria-label="Face-down card"
      />
    );
  }

  return (
    <div
      className="h-16 w-12 overflow-hidden rounded border border-gray-500 bg-gray-800 md:h-24 md:w-16"
      title={card.name}
      aria-label={card.name}
    >
      {card.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={card.imageUrl}
          alt={card.name}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-1">
          <span className="text-center text-[9px] font-semibold leading-tight text-gray-200 md:text-[10px]">
            {card.name}
          </span>
          <span className="text-[8px] text-gray-400">{card.cardId}</span>
        </div>
      )}
    </div>
  );
}

// ── Pile indicator ───────────────────────────────────────────────────────────
function PileIndicator({
  count,
  icon,
  label,
}: {
  count: number;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div
      className="flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-1"
      aria-label={label}
    >
      <span className="text-gray-400" aria-hidden="true">
        {icon}
      </span>
      <span className="text-lg font-bold text-white">{count}</span>
    </div>
  );
}

// ── Icons (inline SVG, no dependency) ────────────────────────────────────────
function DeckIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
      />
    </svg>
  );
}

// ── Main CardZone ─────────────────────────────────────────────────────────────
export default function CardZone({
  variant,
  label,
  cards = [],
  count = 0,
  activeCount = 0,
  restedCount = 0,
  life = 0,
  isOpponent = false,
  className = "",
}: CardZoneProps) {
  const borderColour = BORDER_COLOURS[variant];

  const renderContent = () => {
    switch (variant) {
      case "leader": {
        const leader = cards[0] ?? null;
        return (
          <div className="flex flex-col items-center gap-1">
            <div className="h-20 w-14 overflow-hidden rounded border-2 border-amber-500 bg-gray-800 md:h-28 md:w-20">
              {leader ? (
                leader.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={leader.imageUrl}
                    alt={leader.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-1">
                    <span className="text-center text-[9px] font-semibold leading-tight text-amber-200">
                      {leader.name}
                    </span>
                    <span className="text-[8px] text-gray-400">{leader.cardId}</span>
                    {leader.life !== null && (
                      <span className="text-[8px] text-amber-400">
                        Life: {leader.life}
                      </span>
                    )}
                  </div>
                )
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <span className="text-[10px] text-gray-500">Empty</span>
                </div>
              )}
            </div>
          </div>
        );
      }

      case "characters": {
        // 5 slots
        const slots = Array.from({ length: 5 }, (_, i) => cards[i] ?? null);
        return (
          <div className="flex gap-1" role="list" aria-label="Character area">
            {slots.map((card, i) => (
              <div key={i} role="listitem">
                <CardSlot card={card} />
              </div>
            ))}
          </div>
        );
      }

      case "stage": {
        const stage = cards[0] ?? null;
        return <CardSlot card={stage} />;
      }

      case "don": {
        return (
          <div
            className="flex min-h-[44px] flex-col items-center justify-center gap-1 px-2"
            aria-label={`DON!! Active: ${activeCount}, Rested: ${restedCount}`}
          >
            <div className="flex items-center gap-2">
              <span className="text-xs text-green-400">Active</span>
              <span className="text-lg font-bold text-white">{activeCount}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-orange-400">Rested</span>
              <span className="text-lg font-bold text-white">{restedCount}</span>
            </div>
          </div>
        );
      }

      case "life": {
        return (
          <PileIndicator
            count={isOpponent ? life : life}
            icon={<ShieldIcon />}
            label={`Life: ${life} cards`}
          />
        );
      }

      case "deck": {
        return (
          <PileIndicator
            count={count}
            icon={<DeckIcon />}
            label={`Deck: ${count} cards`}
          />
        );
      }

      case "trash": {
        return (
          <PileIndicator
            count={cards.length > 0 ? cards.length : count}
            icon={<TrashIcon />}
            label={`Trash: ${cards.length > 0 ? cards.length : count} cards`}
          />
        );
      }
    }
  };

  return (
    <div
      className={`flex flex-col items-center gap-1 ${className}`}
      data-variant={variant}
    >
      <span className="text-[10px] font-medium uppercase tracking-wide text-gray-400">
        {label}
      </span>
      <div
        className={`rounded-lg border ${borderColour} bg-gray-900 p-1.5`}
      >
        {renderContent()}
      </div>
    </div>
  );
}
