import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getCardByCode } from "@/lib/database/cards";

interface CardDetailPageProps {
  params: Promise<{ code: string }>;
}

export async function generateMetadata({
  params,
}: CardDetailPageProps): Promise<Metadata> {
  const { code } = await params;
  const card = await getCardByCode(code);

  if (!card) {
    return { title: "Card not found — OP SpellTable" };
  }

  return {
    title: `${card.name} (${card.cardId}) — OP SpellTable`,
    description: card.effect ?? `${card.type} card from ${card.setCode}`,
  };
}

const colorPlaceholderMap: Record<string, string> = {
  Red: "bg-red-300",
  Green: "bg-green-300",
  Blue: "bg-blue-300",
  Purple: "bg-purple-300",
  Black: "bg-gray-500",
  Yellow: "bg-yellow-300",
};

const colorBadgeMap: Record<string, string> = {
  Red: "bg-red-600 text-white",
  Green: "bg-green-600 text-white",
  Blue: "bg-blue-600 text-white",
  Purple: "bg-purple-600 text-white",
  Black: "bg-gray-800 text-white",
  Yellow: "bg-yellow-500 text-gray-900",
};

function getColorPlaceholder(color: string): string {
  const primary = color.split(" ")[0];
  return colorPlaceholderMap[primary] ?? "bg-gray-300";
}

function getColorBadge(color: string): string {
  const primary = color.split(" ")[0];
  return colorBadgeMap[primary] ?? "bg-gray-400 text-white";
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2 py-2 border-b border-gray-100 last:border-0">
      <span className="w-24 shrink-0 text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </span>
      <span className="text-sm text-gray-900">{value}</span>
    </div>
  );
}

export default async function CardDetailPage({ params }: CardDetailPageProps) {
  const { code } = await params;
  const card = await getCardByCode(code);

  if (!card) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href="/cards"
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 min-h-[44px]"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to Cards
        </Link>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-col md:flex-row">
            <div
              className={`flex h-64 w-full items-center justify-center md:h-auto md:w-64 md:shrink-0 ${getColorPlaceholder(card.color)}`}
              aria-hidden="true"
            >
              <div className="flex flex-col items-center gap-1 text-white/70">
                <span className="text-5xl font-bold">
                  {card.cardId.split("-")[0]}
                </span>
                <span className="text-lg font-medium">
                  #{card.cardId.split("-")[1]}
                </span>
              </div>
            </div>

            <div className="flex-1 p-6">
              <div className="mb-4 flex flex-wrap items-start gap-2">
                <h1 className="text-2xl font-bold text-gray-900 leading-tight">
                  {card.name}
                </h1>
                <span className="font-mono text-sm text-gray-500 mt-1">
                  {card.cardId}
                </span>
              </div>

              <div className="mb-4 flex flex-wrap gap-2">
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${getColorBadge(card.color)}`}
                >
                  {card.color}
                </span>
                <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                  {card.type}
                </span>
                <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                  {card.rarity}
                </span>
              </div>

              <div className="mb-6">
                <DetailRow label="Set" value={card.set?.name ?? card.setCode} />
                {card.cost !== null && (
                  <DetailRow label="Cost" value={card.cost} />
                )}
                {card.power !== null && (
                  <DetailRow label="Power" value={card.power} />
                )}
                {card.counter !== null && (
                  <DetailRow label="Counter" value={card.counter} />
                )}
                {card.life !== null && (
                  <DetailRow label="Life" value={card.life} />
                )}
                {card.attribute && (
                  <DetailRow label="Attribute" value={card.attribute} />
                )}
              </div>

              {card.effect && (
                <div className="rounded-lg bg-gray-50 p-4">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Effect
                  </p>
                  <p className="text-sm leading-relaxed text-gray-800 whitespace-pre-wrap">
                    {card.effect}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
