"use client";

export interface DonCounterProps {
  active: number;
  rested: number;
  deckRemaining: number;
  isInteractive?: boolean;
  onActivate?: () => void;
  onRest?: () => void;
  onUnrest?: () => void;
  className?: string;
}

function PlusMinusButton({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick?: () => void;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`
        flex min-h-[44px] min-w-[44px] items-center justify-center rounded
        text-sm font-bold transition-colors
        ${
          disabled
            ? "cursor-not-allowed bg-gray-700 text-gray-500"
            : "bg-red-700 text-white hover:bg-red-600 active:bg-red-800"
        }
      `}
    >
      {children}
    </button>
  );
}

export default function DonCounter({
  active,
  rested,
  deckRemaining,
  isInteractive = false,
  onActivate,
  onRest,
  onUnrest,
  className = "",
}: DonCounterProps) {
  const total = active + rested + deckRemaining;

  return (
    <div
      className={`flex flex-col gap-2 ${className}`}
      data-testid="don-counter"
      aria-label={`DON!! — Active: ${active}, Rested: ${rested}, Deck: ${deckRemaining}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-widest text-red-400">
          DON!!
        </span>
        <span className="text-[10px] text-gray-500">{total}/10</span>
      </div>

      {/* Active DON!! */}
      <div className="flex items-center gap-2 rounded-lg bg-gray-800 px-3 py-2">
        <div className="flex flex-1 items-center gap-2">
          {/* Active pip indicator */}
          <div
            className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white transition-all duration-200"
            aria-hidden="true"
          >
            ▲
          </div>
          <span className="text-xs text-gray-300">Active</span>
          <span
            className="ml-auto text-xl font-bold text-red-400 transition-all duration-200"
            data-testid="don-active-count"
          >
            {active}
          </span>
        </div>
        {isInteractive && (
          <div className="flex gap-1">
            <PlusMinusButton
              onClick={onActivate}
              disabled={deckRemaining <= 0}
              label="Activate DON!! from deck"
            >
              +
            </PlusMinusButton>
            <PlusMinusButton
              onClick={onRest}
              disabled={active <= 0}
              label="Rest active DON!!"
            >
              −
            </PlusMinusButton>
          </div>
        )}
      </div>

      {/* Rested DON!! */}
      <div className="flex items-center gap-2 rounded-lg bg-gray-800 px-3 py-2">
        <div className="flex flex-1 items-center gap-2">
          {/* Rested pip indicator — rotated */}
          <div
            className="flex h-5 w-5 items-center justify-center rounded-full bg-red-900 text-[10px] font-bold text-red-300 transition-all duration-200"
            style={{ transform: "rotate(90deg)" }}
            aria-hidden="true"
          >
            ▲
          </div>
          <span className="text-xs text-gray-400">Rested</span>
          <span
            className="ml-auto text-xl font-bold text-red-800 transition-all duration-200"
            data-testid="don-rested-count"
          >
            {rested}
          </span>
        </div>
        {isInteractive && (
          <PlusMinusButton
            onClick={onUnrest}
            disabled={rested <= 0}
            label="Unrest a rested DON!!"
          >
            ↺
          </PlusMinusButton>
        )}
      </div>

      {/* Deck remaining */}
      <div className="flex items-center justify-between rounded-lg bg-gray-900 px-3 py-1.5">
        <span className="text-[10px] text-gray-500">Deck</span>
        <span
          className="text-sm font-semibold text-gray-400 transition-all duration-200"
          data-testid="don-deck-count"
        >
          {deckRemaining}
        </span>
      </div>
    </div>
  );
}
