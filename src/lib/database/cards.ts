import { prisma } from "@/lib/database/prisma";
import type { CardData, CardSetData, CardSummary } from "@/types/card";

export interface GetCardsParams {
  page?: number;
  limit?: number;
  search?: string;
  color?: string;
  type?: string;
  set?: string;
  cost?: number;
  rarity?: string;
}

export interface GetCardsResult {
  data: CardSummary[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

function mapToCardSummary(card: {
  id: string;
  cardId: string;
  name: string;
  type: string;
  color: string;
  cost: number | null;
  power: number | null;
  rarity: string;
  imageUrl: string | null;
  setCode: string;
}): CardSummary {
  return {
    id: card.id,
    cardId: card.cardId,
    name: card.name,
    type: card.type as CardSummary["type"],
    color: card.color as CardSummary["color"],
    cost: card.cost,
    power: card.power,
    rarity: card.rarity as CardSummary["rarity"],
    imageUrl: card.imageUrl,
    setCode: card.setCode,
  };
}

function mapToCardData(card: {
  id: string;
  cardId: string;
  name: string;
  type: string;
  color: string;
  cost: number | null;
  power: number | null;
  counter: number | null;
  attribute: string | null;
  effect: string | null;
  life: number | null;
  setCode: string;
  rarity: string;
  imageUrl: string | null;
  set: {
    id: string;
    code: string;
    name: string;
    releaseDate: Date | null;
    cardCount: number;
  };
}): CardData {
  return {
    id: card.id,
    cardId: card.cardId,
    name: card.name,
    type: card.type as CardData["type"],
    color: card.color as CardData["color"],
    cost: card.cost,
    power: card.power,
    counter: card.counter,
    attribute: card.attribute as CardData["attribute"],
    effect: card.effect,
    life: card.life,
    setCode: card.setCode,
    rarity: card.rarity as CardData["rarity"],
    imageUrl: card.imageUrl,
    set: {
      id: card.set.id,
      code: card.set.code,
      name: card.set.name,
      releaseDate: card.set.releaseDate
        ? card.set.releaseDate.toISOString().split("T")[0]
        : null,
      cardCount: card.set.cardCount,
    },
  };
}

export async function getCards(
  params: GetCardsParams
): Promise<GetCardsResult> {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, Math.max(1, params.limit ?? 20));
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};

  if (params.search) {
    where.name = { contains: params.search };
  }
  if (params.color) {
    where.color = params.color;
  }
  if (params.type) {
    where.type = params.type;
  }
  if (params.set) {
    where.setCode = params.set;
  }
  if (params.cost !== undefined) {
    where.cost = params.cost;
  }
  if (params.rarity) {
    where.rarity = params.rarity;
  }

  const [cards, total] = await prisma.$transaction([
    prisma.card.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ setCode: "asc" }, { cardId: "asc" }],
      select: {
        id: true,
        cardId: true,
        name: true,
        type: true,
        color: true,
        cost: true,
        power: true,
        rarity: true,
        imageUrl: true,
        setCode: true,
      },
    }),
    prisma.card.count({ where }),
  ]);

  return {
    data: cards.map(mapToCardSummary),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getCardByCode(code: string): Promise<CardData | null> {
  const card = await prisma.card.findUnique({
    where: { cardId: code },
    include: {
      set: {
        select: {
          id: true,
          code: true,
          name: true,
          releaseDate: true,
          cardCount: true,
        },
      },
    },
  });

  if (!card) return null;

  return mapToCardData(card);
}

export async function getSets(): Promise<CardSetData[]> {
  const sets = await prisma.cardSet.findMany({
    orderBy: { code: "asc" },
    select: {
      id: true,
      code: true,
      name: true,
      releaseDate: true,
      cardCount: true,
    },
  });

  return sets.map((s) => ({
    id: s.id,
    code: s.code,
    name: s.name,
    releaseDate: s.releaseDate
      ? s.releaseDate.toISOString().split("T")[0]
      : null,
    cardCount: s.cardCount,
  }));
}
