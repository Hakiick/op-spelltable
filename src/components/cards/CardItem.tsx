import Link from "next/link";
import type { CardSummary } from "@/types/card";

interface CardItemProps {
  card: CardSummary;
}

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

export default function CardItem({ card }: CardItemProps) {
  return (
    <Link
      href={`/cards/${card.cardId}`}
      className="group flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md min-h-[44px] min-w-[44px]"
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
    </Link>
  );
}
