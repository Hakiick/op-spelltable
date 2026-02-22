import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useCardDetail } from "@/hooks/useCardDetail";
import type { CardData } from "@/types/card";

function makeCardData(overrides: Partial<CardData> = {}): CardData {
  return {
    id: "mock-id",
    cardId: "OP01-001",
    name: "Monkey D. Luffy",
    type: "Character",
    color: "Red",
    cost: 3,
    power: 3000,
    counter: 1000,
    attribute: "Strike",
    effect: "Rush",
    life: null,
    setCode: "OP01",
    rarity: "C",
    imageUrl: null,
    ...overrides,
  };
}

describe("useCardDetail", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("initializes with empty/closed state", () => {
    const { result } = renderHook(() => useCardDetail());

    expect(result.current.isOpen).toBe(false);
    expect(result.current.card).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("open() sets isOpen to true and starts loading", async () => {
    const card = makeCardData();
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: card }), { status: 200 })
    );

    const { result } = renderHook(() => useCardDetail());

    act(() => {
      result.current.open("OP01-001");
    });

    // Immediately after open(): isOpen and loading should be true
    expect(result.current.isOpen).toBe(true);
    expect(result.current.loading).toBe(true);

    // Wait for fetch to resolve
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.card).toEqual(card);
    expect(result.current.error).toBeNull();
  });

  it("open() calls fetch with correct URL", async () => {
    const card = makeCardData({ cardId: "ST01-012" });
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: card }), { status: 200 })
    );

    const { result } = renderHook(() => useCardDetail());

    await act(async () => {
      result.current.open("ST01-012");
    });

    expect(fetch).toHaveBeenCalledWith(
      "/api/cards/ST01-012",
      expect.objectContaining({ signal: expect.anything() })
    );
  });

  it("loading is true during fetch, then false after resolution", async () => {
    const card = makeCardData();
    let resolvePromise!: (value: Response) => void;
    const pendingPromise = new Promise<Response>((resolve) => {
      resolvePromise = resolve;
    });

    vi.mocked(fetch).mockReturnValueOnce(pendingPromise);

    const { result } = renderHook(() => useCardDetail());

    act(() => {
      result.current.open("OP01-001");
    });

    expect(result.current.loading).toBe(true);

    await act(async () => {
      resolvePromise(
        new Response(JSON.stringify({ data: card }), { status: 200 })
      );
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.card).toEqual(card);
  });

  it("sets error when fetch returns 404", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Card not found" }), { status: 404 })
    );

    const { result } = renderHook(() => useCardDetail());

    await act(async () => {
      result.current.open("INVALID-001");
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe("Card not found.");
    expect(result.current.card).toBeNull();
  });

  it("sets error when fetch returns 500", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Server error" }), { status: 500 })
    );

    const { result } = renderHook(() => useCardDetail());

    await act(async () => {
      result.current.open("OP01-001");
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toContain("Failed to load card");
    expect(result.current.card).toBeNull();
  });

  it("close() sets isOpen to false and card to null", async () => {
    const card = makeCardData();
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: card }), { status: 200 })
    );

    const { result } = renderHook(() => useCardDetail());

    await act(async () => {
      result.current.open("OP01-001");
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.isOpen).toBe(true);
    expect(result.current.card).toEqual(card);

    act(() => {
      result.current.close();
    });

    expect(result.current.isOpen).toBe(false);
    expect(result.current.card).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("close() resets loading if called during fetch", async () => {
    // Never resolves
    vi.mocked(fetch).mockReturnValueOnce(new Promise(() => {}));

    const { result } = renderHook(() => useCardDetail());

    act(() => {
      result.current.open("OP01-001");
    });

    expect(result.current.loading).toBe(true);

    act(() => {
      result.current.close();
    });

    expect(result.current.isOpen).toBe(false);
    expect(result.current.loading).toBe(false);
  });
});
