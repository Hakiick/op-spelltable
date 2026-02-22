"use client";

export interface LifeTrackerProps {
  lifeCards: boolean[]; // true = face-down, false = revealed
  isInteractive?: boolean;
  onReveal?: (index: number) => void;
  onLoseLife?: () => void;
  className?: string;
}

interface LifeCardProps {
  faceDown: boolean;
  index: number;
  isInteractive: boolean;
  onReveal?: (index: number) => void;
}

function LifeCard({ faceDown, index, isInteractive, onReveal }: LifeCardProps) {
  const canFlip = isInteractive && faceDown && onReveal != null;

  const handleClick = canFlip ? () => onReveal!(index) : undefined;
  const handleKeyDown = canFlip
    ? (e: React.KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onReveal!(index);
        }
      }
    : undefined;

  return (
    <div
      className={`
        perspective-[600px] relative h-14 w-10 md:h-20 md:w-14
        ${canFlip ? "cursor-pointer" : ""}
      `}
      role={canFlip ? "button" : undefined}
      tabIndex={canFlip ? 0 : undefined}
      aria-label={
        faceDown
          ? `Life card ${index + 1} — face-down`
          : `Life card ${index + 1} — revealed`
      }
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      {/* Flip container */}
      <div
        className={`
          relative h-full w-full transition-transform duration-500
          [transform-style:preserve-3d]
          ${faceDown ? "" : "[transform:rotateY(180deg)]"}
        `}
      >
        {/* Front face (face-down / card back) */}
        <div
          className={`
            absolute inset-0 flex items-center justify-center rounded border
            [backface-visibility:hidden]
            ${
              faceDown
                ? "border-pink-600 bg-gradient-to-br from-gray-700 via-gray-800 to-gray-900"
                : "border-gray-600 bg-gray-800"
            }
            ${canFlip ? "hover:border-pink-400 hover:shadow-lg hover:shadow-pink-900/50 transition-all" : ""}
          `}
          aria-hidden="true"
        >
          {/* Card back pattern */}
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-1">
            <div className="text-lg text-pink-400">♦</div>
            <span className="text-[8px] font-bold uppercase text-pink-600">
              Life
            </span>
          </div>
        </div>

        {/* Back face (revealed) */}
        <div
          className="absolute inset-0 flex items-center justify-center rounded border border-gray-500 bg-gray-700 [backface-visibility:hidden] [transform:rotateY(180deg)]"
          aria-hidden="true"
        >
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-1">
            <div className="text-base text-gray-300">✓</div>
            <span className="text-[8px] text-gray-400">Seen</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LifeTracker({
  lifeCards,
  isInteractive = false,
  onReveal,
  onLoseLife,
  className = "",
}: LifeTrackerProps) {
  const count = lifeCards.length;

  return (
    <div
      className={`flex flex-col gap-2 ${className}`}
      data-testid="life-tracker"
      aria-label={`Life: ${count} cards remaining`}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-widest text-pink-400">
          Life
        </span>
        <span
          className="text-sm font-bold text-pink-300"
          data-testid="life-count"
        >
          {count}
        </span>
      </div>

      {/* Life card row */}
      <div
        className="flex flex-wrap gap-1"
        role="list"
        aria-label={`${count} life card${count !== 1 ? "s" : ""}`}
      >
        {count === 0 ? (
          <div className="flex h-14 w-10 items-center justify-center rounded border border-dashed border-gray-600 md:h-20 md:w-14">
            <span className="text-[10px] text-gray-500">0</span>
          </div>
        ) : (
          lifeCards.map((faceDown, i) => (
            <div key={i} role="listitem">
              <LifeCard
                faceDown={faceDown}
                index={i}
                isInteractive={isInteractive}
                onReveal={onReveal}
              />
            </div>
          ))
        )}
      </div>

      {/* Lose Life button */}
      {isInteractive && (
        <button
          type="button"
          onClick={onLoseLife}
          disabled={count === 0}
          aria-label="Lose one life card"
          data-testid="lose-life-button"
          className={`
            flex min-h-[44px] w-full items-center justify-center gap-1 rounded px-3 py-2
            text-xs font-semibold transition-colors
            ${
              count === 0
                ? "cursor-not-allowed bg-gray-800 text-gray-600"
                : "bg-pink-900/60 text-pink-300 hover:bg-pink-800/60 active:bg-pink-900 border border-pink-800/40"
            }
          `}
        >
          <span aria-hidden="true">−</span> Lose Life
        </button>
      )}
    </div>
  );
}
