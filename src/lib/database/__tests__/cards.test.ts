import { describe, it, expect, vi, beforeEach } from "vitest";
import { getCards, getCardByCode, getSets } from "@/lib/database/cards";

vi.mock("@/lib/database/prisma", () => ({
  prisma: {
    card: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
    },
    cardSet: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn((queries: Promise<unknown>[]) => Promise.all(queries)),
  },
}));

import { prisma } from "@/lib/database/prisma";

const mockCardRow = {
  id: "clx1",
  cardId: "OP01-001",
  name: "Monkey D. Luffy",
  type: "Leader",
  color: "Red",
  cost: null,
  power: 5000,
  rarity: "L",
  imageUrl: "/cards/OP01-001.jpg",
  setCode: "OP01",
};

const mockCardRowFull = {
  ...mockCardRow,
  counter: null,
  attribute: "Strike",
  effect: "Activate: Main Once Per Turn",
  life: 5,
  set: {
    id: "set1",
    code: "OP01",
    name: "Romance Dawn",
    releaseDate: new Date("2022-07-08"),
    cardCount: 121,
  },
};

const mockSetRow = {
  id: "set1",
  code: "OP01",
  name: "Romance Dawn",
  releaseDate: new Date("2022-07-08"),
  cardCount: 121,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getCards", () => {
  it("returns cards with default pagination", async () => {
    vi.mocked(prisma.card.findMany).mockResolvedValue([mockCardRow] as never);
    vi.mocked(prisma.card.count).mockResolvedValue(1 as never);

    const result = await getCards({});

    expect(result.data).toHaveLength(1);
    expect(result.data[0].cardId).toBe("OP01-001");
    expect(result.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
    });
    expect(prisma.card.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 20 })
    );
  });

  it("passes correct where filter when searching by name", async () => {
    vi.mocked(prisma.card.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.card.count).mockResolvedValue(0 as never);

    await getCards({ search: "Luffy" });

    expect(prisma.card.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ name: { contains: "Luffy" } }),
      })
    );
  });

  it("filters by color and type", async () => {
    vi.mocked(prisma.card.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.card.count).mockResolvedValue(0 as never);

    await getCards({ color: "Red", type: "Leader" });

    expect(prisma.card.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ color: "Red", type: "Leader" }),
      })
    );
  });

  it("calculates correct skip and take for page 2 with limit 10", async () => {
    vi.mocked(prisma.card.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.card.count).mockResolvedValue(25 as never);

    const result = await getCards({ page: 2, limit: 10 });

    expect(prisma.card.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10 })
    );
    expect(result.pagination).toEqual({
      page: 2,
      limit: 10,
      total: 25,
      totalPages: 3,
    });
  });
});

describe("getCardByCode", () => {
  it("returns a card with its set when found", async () => {
    vi.mocked(prisma.card.findUnique).mockResolvedValue(
      mockCardRowFull as never
    );

    const result = await getCardByCode("OP01-001");

    expect(result).not.toBeNull();
    expect(result?.cardId).toBe("OP01-001");
    expect(result?.name).toBe("Monkey D. Luffy");
    expect(result?.set).toEqual({
      id: "set1",
      code: "OP01",
      name: "Romance Dawn",
      releaseDate: "2022-07-08",
      cardCount: 121,
    });
    expect(prisma.card.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { cardId: "OP01-001" } })
    );
  });

  it("returns null when card is not found", async () => {
    vi.mocked(prisma.card.findUnique).mockResolvedValue(null as never);

    const result = await getCardByCode("INVALID");

    expect(result).toBeNull();
    expect(prisma.card.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { cardId: "INVALID" } })
    );
  });
});

describe("getSets", () => {
  it("returns the list of sets", async () => {
    vi.mocked(prisma.cardSet.findMany).mockResolvedValue(
      [mockSetRow] as never
    );

    const result = await getSets();

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: "set1",
      code: "OP01",
      name: "Romance Dawn",
      releaseDate: "2022-07-08",
      cardCount: 121,
    });
    expect(prisma.cardSet.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { code: "asc" } })
    );
  });
});
