import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/database/cards", () => ({
  getCards: vi.fn(),
  getCardByCode: vi.fn(),
}));

import { getCards, getCardByCode } from "@/lib/database/cards";
import { GET as getCardsList } from "@/app/api/cards/route";
import { GET as getCardByCodeHandler } from "@/app/api/cards/[code]/route";

const mockPaginatedResult = {
  data: [
    {
      id: "clx1",
      cardId: "OP01-001",
      name: "Monkey D. Luffy",
      type: "Leader" as const,
      color: "Red" as const,
      cost: null,
      power: 5000,
      rarity: "L" as const,
      imageUrl: "/cards/OP01-001.jpg",
      setCode: "OP01",
    },
  ],
  pagination: {
    page: 1,
    limit: 20,
    total: 1,
    totalPages: 1,
  },
};

const mockCardData = {
  id: "clx1",
  cardId: "OP01-001",
  name: "Monkey D. Luffy",
  type: "Leader" as const,
  color: "Red" as const,
  cost: null,
  power: 5000,
  counter: null,
  attribute: "Strike" as const,
  effect: "Activate: Main Once Per Turn",
  life: 5,
  setCode: "OP01",
  rarity: "L" as const,
  imageUrl: "/cards/OP01-001.jpg",
  set: {
    id: "set1",
    code: "OP01",
    name: "Romance Dawn",
    releaseDate: "2022-07-08",
    cardCount: 121,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/cards", () => {
  it("returns 200 with data and pagination", async () => {
    vi.mocked(getCards).mockResolvedValue(mockPaginatedResult);

    const request = new NextRequest("http://localhost:3000/api/cards");
    const response = await getCardsList(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data).toHaveLength(1);
    expect(json.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
    });
  });

  it("passes query params as filters to getCards", async () => {
    vi.mocked(getCards).mockResolvedValue({
      ...mockPaginatedResult,
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });

    const request = new NextRequest(
      "http://localhost:3000/api/cards?color=Red&type=Leader&search=Luffy&set=OP01&cost=3&rarity=R&page=2&limit=10"
    );
    await getCardsList(request);

    expect(getCards).toHaveBeenCalledWith({
      color: "Red",
      type: "Leader",
      search: "Luffy",
      set: "OP01",
      cost: 3,
      rarity: "R",
      page: 2,
      limit: 10,
    });
  });

  it("returns 500 when getCards throws", async () => {
    vi.mocked(getCards).mockRejectedValue(new Error("DB error"));

    const request = new NextRequest("http://localhost:3000/api/cards");
    const response = await getCardsList(request);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json).toEqual({ error: "Failed to fetch cards" });
  });
});

describe("GET /api/cards/[code]", () => {
  it("returns 200 with card data when card is found", async () => {
    vi.mocked(getCardByCode).mockResolvedValue(mockCardData);

    const response = await getCardByCodeHandler(
      new Request("http://localhost:3000/api/cards/OP01-001"),
      { params: Promise.resolve({ code: "OP01-001" }) }
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ data: mockCardData });
    expect(getCardByCode).toHaveBeenCalledWith("OP01-001");
  });

  it("returns 404 when card is not found", async () => {
    vi.mocked(getCardByCode).mockResolvedValue(null);

    const response = await getCardByCodeHandler(
      new Request("http://localhost:3000/api/cards/INVALID"),
      { params: Promise.resolve({ code: "INVALID" }) }
    );
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json).toEqual({ error: "Card not found" });
  });

  it("returns 500 when getCardByCode throws", async () => {
    vi.mocked(getCardByCode).mockRejectedValue(new Error("DB error"));

    const response = await getCardByCodeHandler(
      new Request("http://localhost:3000/api/cards/OP01-001"),
      { params: Promise.resolve({ code: "OP01-001" }) }
    );
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json).toEqual({ error: "Failed to fetch card" });
  });
});
