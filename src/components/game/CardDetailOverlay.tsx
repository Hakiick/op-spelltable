"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { useCardDetail } from "@/hooks/useCardDetail";
import type { CardData } from "@/types/card";

// ── Colour helpers ─────────────────────────────────────────────────────────

const COLOR_GRADIENT: Record<string, string> = {
  Red: "from-red-700 to-red-900",
  Green: "from-green-700 to-green-900",
  Blue: "from-blue-700 to-blue-900",
  Purple: "from-purple-700 to-purple-900",
  Black: "from-gray-700 to-gray-900",
  Yellow: "from-yellow-500 to-yellow-700",
};

const COLOR_BADGE: Record<string, string> = {
  Red: "bg-red-600 text-white",
  Green: "bg-green-600 text-white",
  Blue: "bg-blue-600 text-white",
  Purple: "bg-purple-600 text-white",
  Black: "bg-gray-700 text-white",
  Yellow: "bg-yellow-400 text-gray-900",
};

function getColorGradient(color: string): string {
  const primary = color.split(" ")[0];
  return COLOR_GRADIENT[primary] ?? "from-gray-700 to-gray-900";
}

function getColorBadge(color: string): string {
  const primary = color.split(" ")[0];
  return COLOR_BADGE[primary] ?? "bg-gray-500 text-white";
}

// ── Stat badge ─────────────────────────────────────────────────────────────

function StatBadge({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex flex-col items-center rounded-md bg-gray-800 px-3 py-2">
      <span className="text-[10px] uppercase tracking-wider text-gray-400">
        {label}
      </span>
      <span className="text-sm font-bold text-white">{value}</span>
    </div>
  );
}

// ── Loading skeleton ────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="animate-pulse p-6" aria-label="Loading card details">
      <div className="mb-4 h-48 w-full rounded-lg bg-gray-700 md:h-64" />
      <div className="mb-2 h-5 w-3/4 rounded bg-gray-700" />
      <div className="mb-4 h-4 w-1/3 rounded bg-gray-700" />
      <div className="mb-4 flex gap-2">
        <div className="h-8 w-16 rounded bg-gray-700" />
        <div className="h-8 w-16 rounded bg-gray-700" />
        <div className="h-8 w-16 rounded bg-gray-700" />
      </div>
      <div className="space-y-2">
        <div className="h-4 w-full rounded bg-gray-700" />
        <div className="h-4 w-5/6 rounded bg-gray-700" />
        <div className="h-4 w-4/6 rounded bg-gray-700" />
      </div>
    </div>
  );
}

// ── Error state ─────────────────────────────────────────────────────────────

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-12 w-12 text-red-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
        />
      </svg>
      <p className="text-sm text-gray-300">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="min-h-11 min-w-11 rounded-md bg-gray-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-600"
      >
        Retry
      </button>
    </div>
  );
}

// ── Card content ────────────────────────────────────────────────────────────

function CardContent({ card }: { card: CardData }) {
  const gradient = getColorGradient(card.color);
  const colorBadge = getColorBadge(card.color);

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      {/* Card image or gradient placeholder */}
      <div
        className={`relative flex h-48 w-full items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br ${gradient} md:h-64`}
      >
        {card.imageUrl ? (
          <Image
            src={card.imageUrl}
            alt={card.name}
            fill
            className="object-contain"
            unoptimized
          />
        ) : (
          <span className="select-none text-6xl font-black text-white/20">
            {card.cardId.split("-")[0]}
          </span>
        )}
      </div>

      {/* Name and code */}
      <div>
        <h2
          id="card-detail-title"
          className="text-lg font-bold leading-tight text-white md:text-xl"
        >
          {card.name}
        </h2>
        <p className="mt-0.5 font-mono text-xs text-gray-400">{card.cardId}</p>
      </div>

      {/* Badges: type, color, rarity */}
      <div className="flex flex-wrap gap-2">
        <span className="inline-flex items-center rounded bg-gray-700 px-2 py-1 text-xs font-medium text-gray-200">
          {card.type}
        </span>
        <span
          className={`inline-flex items-center rounded px-2 py-1 text-xs font-medium ${colorBadge}`}
        >
          {card.color}
        </span>
        <span className="inline-flex items-center rounded bg-gray-700 px-2 py-1 text-xs font-medium text-gray-200">
          {card.rarity}
        </span>
        {card.attribute && (
          <span className="inline-flex items-center rounded bg-gray-700 px-2 py-1 text-xs font-medium text-gray-200">
            {card.attribute}
          </span>
        )}
      </div>

      {/* Stats */}
      {(card.cost !== null ||
        card.power !== null ||
        card.counter !== null ||
        card.life !== null) && (
        <div className="flex flex-wrap gap-2">
          {card.cost !== null && <StatBadge label="Cost" value={card.cost} />}
          {card.power !== null && (
            <StatBadge label="Power" value={card.power.toLocaleString()} />
          )}
          {card.counter !== null && (
            <StatBadge label="Counter" value={card.counter.toLocaleString()} />
          )}
          {card.life !== null && <StatBadge label="Life" value={card.life} />}
        </div>
      )}

      {/* Effect text */}
      {card.effect && (
        <div className="rounded-md bg-gray-800 p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Effect
          </p>
          <p className="mt-1 text-sm leading-relaxed text-gray-200">
            {card.effect}
          </p>
        </div>
      )}

      {/* Set info */}
      {card.set && (
        <p className="text-xs text-gray-500">
          Set:{" "}
          <span className="text-gray-400">
            {card.set.name} ({card.set.code})
          </span>
        </p>
      )}
    </div>
  );
}

// ── Main overlay ────────────────────────────────────────────────────────────

export interface CardDetailOverlayProps {
  cardCode: string | null;
  onClose: () => void;
}

export default function CardDetailOverlay({
  cardCode,
  onClose,
}: CardDetailOverlayProps) {
  const { card, loading, error, open } = useCardDetail();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Fetch card when cardCode changes
  useEffect(() => {
    if (cardCode) {
      open(cardCode);
    }
  }, [cardCode, open]);

  // Close on Escape
  useEffect(() => {
    if (!cardCode) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [cardCode, onClose]);

  // Auto-focus close button when overlay opens
  useEffect(() => {
    if (cardCode) {
      closeButtonRef.current?.focus();
    }
  }, [cardCode]);

  // Don't render anything when there's no cardCode
  if (!cardCode) {
    return null;
  }

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm transition-all duration-200 md:items-center"
      onClick={onClose}
      aria-hidden="false"
    >
      {/* Modal content */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="card-detail-title"
        className="relative w-full overflow-y-auto rounded-t-2xl bg-gray-900 shadow-2xl transition-all duration-200 md:max-w-lg md:rounded-2xl"
        style={{ maxHeight: "90dvh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          aria-label="Close card detail"
          className="absolute right-3 top-3 z-10 flex min-h-11 min-w-11 items-center justify-center rounded-full bg-gray-800 text-gray-300 transition-colors hover:bg-gray-700 hover:text-white"
        >
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
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        {/* Content */}
        {loading && <LoadingSkeleton />}
        {error && !loading && (
          <ErrorState message={error} onRetry={() => open(cardCode)} />
        )}
        {card && !loading && !error && <CardContent card={card} />}
      </div>
    </div>
  );
}
