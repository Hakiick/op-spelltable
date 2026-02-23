import { Suspense } from "react";
import type { Metadata } from "next";
import { getCards, getSets } from "@/lib/database/cards";
import CardSearch from "@/components/cards/CardSearch";
import CardFilters from "@/components/cards/CardFilters";
import CardGridWithOverlay from "@/components/cards/CardGridWithOverlay";
import CardPagination from "@/components/cards/CardPagination";

export const metadata: Metadata = {
  title: "Cards — OP SpellTable",
  description: "Browse One Piece TCG cards with search and filters.",
};

interface CardsPageProps {
  searchParams: Promise<{
    search?: string;
    color?: string;
    type?: string;
    set?: string;
    cost?: string;
    rarity?: string;
    page?: string;
  }>;
}

export default async function CardsPage({ searchParams }: CardsPageProps) {
  const params = await searchParams;

  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const cost =
    params.cost !== undefined && params.cost !== ""
      ? parseInt(params.cost, 10)
      : undefined;

  const [{ data: cards, pagination }, sets] = await Promise.all([
    getCards({
      page,
      limit: 20,
      search: params.search || undefined,
      color: params.color || undefined,
      type: params.type || undefined,
      set: params.set || undefined,
      cost: typeof cost === "number" && !isNaN(cost) ? cost : undefined,
      rarity: params.rarity || undefined,
    }),
    getSets(),
  ]);

  const setOptions = sets.map((s) => ({ code: s.code, name: s.name }));

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Card Browser
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            {pagination.total} cards found
          </p>
        </div>

        <div className="mb-6 flex flex-col gap-4">
          <Suspense
            fallback={
              <div className="h-9 w-full animate-pulse rounded-md bg-gray-200" />
            }
          >
            <CardSearch />
          </Suspense>

          <Suspense
            fallback={
              <div className="h-11 w-full animate-pulse rounded-md bg-gray-200" />
            }
          >
            <CardFilters sets={setOptions} />
          </Suspense>
        </div>

        <CardGridWithOverlay cards={cards} />

        <Suspense fallback={null}>
          <CardPagination
            page={pagination.page}
            totalPages={pagination.totalPages}
          />
        </Suspense>
      </div>
    </div>
  );
}
