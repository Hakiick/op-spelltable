import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useGameState } from "@/hooks/useGameState";

describe("useGameState — initial state", () => {
  it("starts at refresh phase turn 1", () => {
    const { result } = renderHook(() => useGameState(5));
    expect(result.current.phase).toBe("refresh");
    expect(result.current.turnNumber).toBe(1);
  });

  it("initialises DON!! correctly", () => {
    const { result } = renderHook(() => useGameState(5));
    expect(result.current.donDeck).toBe(10);
    expect(result.current.donActive).toBe(0);
    expect(result.current.donRested).toBe(0);
  });

  it("initialises life cards equal to leaderLife, all face-down", () => {
    const { result } = renderHook(() => useGameState(4));
    expect(result.current.lifeCards).toHaveLength(4);
    expect(result.current.lifeCards.every((c) => c === true)).toBe(true);
  });
});

describe("useGameState — phase transitions", () => {
  it("advances phase from refresh to draw", () => {
    const { result } = renderHook(() => useGameState(5));
    act(() => result.current.nextPhase());
    expect(result.current.phase).toBe("draw");
  });

  it("advances through the full phase cycle", () => {
    const { result } = renderHook(() => useGameState(5));
    const phases = ["draw", "don", "main", "end", "refresh"] as const;
    for (const expected of phases) {
      act(() => result.current.nextPhase());
      expect(result.current.phase).toBe(expected);
    }
  });

  it("increments turnNumber after end phase", () => {
    const { result } = renderHook(() => useGameState(5));
    // Advance to end: refresh→draw→don→main→end
    for (let i = 0; i < 4; i++) act(() => result.current.nextPhase());
    expect(result.current.phase).toBe("end");
    act(() => result.current.nextPhase());
    expect(result.current.phase).toBe("refresh");
    expect(result.current.turnNumber).toBe(2);
  });

  it("auto-unrests all DON!! when leaving refresh phase", () => {
    const { result } = renderHook(() => useGameState(5));
    // Manually set up some rested DON!! via activateDon + restDon
    // First activate 3 DON!! from deck
    act(() => result.current.activateDon());
    act(() => result.current.activateDon());
    act(() => result.current.activateDon());
    // Rest all 3
    act(() => result.current.restDon());
    act(() => result.current.restDon());
    act(() => result.current.restDon());
    expect(result.current.donRested).toBe(3);
    expect(result.current.donActive).toBe(0);
    // Advance from refresh → draw (triggers unrest-all side-effect)
    act(() => result.current.nextPhase());
    expect(result.current.phase).toBe("draw");
    expect(result.current.donRested).toBe(0);
    expect(result.current.donActive).toBe(3);
  });

  it("auto-activates 2 DON!! from deck when leaving DON!! phase", () => {
    const { result } = renderHook(() => useGameState(5));
    // Advance to don phase: refresh→draw→don
    act(() => result.current.nextPhase()); // draw
    act(() => result.current.nextPhase()); // don
    expect(result.current.phase).toBe("don");
    const deckBefore = result.current.donDeck;
    const activeBefore = result.current.donActive;
    // Advance from don → main
    act(() => result.current.nextPhase());
    expect(result.current.phase).toBe("main");
    expect(result.current.donDeck).toBe(deckBefore - 2);
    expect(result.current.donActive).toBe(activeBefore + 2);
  });

  it("does not activate more DON!! than remaining in deck", () => {
    const { result } = renderHook(() => useGameState(5));
    // Drain the deck down to 1
    for (let i = 0; i < 9; i++) act(() => result.current.activateDon());
    expect(result.current.donDeck).toBe(1);
    // Advance to don phase
    act(() => result.current.nextPhase()); // draw
    act(() => result.current.nextPhase()); // don
    const deckBefore = result.current.donDeck; // 1
    const activeBefore = result.current.donActive;
    act(() => result.current.nextPhase()); // main — should only take 1
    expect(result.current.donDeck).toBe(0);
    expect(result.current.donActive).toBe(activeBefore + deckBefore);
  });
});

describe("useGameState — DON!! operations", () => {
  it("activateDon moves 1 card from deck to active", () => {
    const { result } = renderHook(() => useGameState(5));
    act(() => result.current.activateDon());
    expect(result.current.donDeck).toBe(9);
    expect(result.current.donActive).toBe(1);
    expect(result.current.donRested).toBe(0);
  });

  it("activateDon does nothing when deck is empty", () => {
    const { result } = renderHook(() => useGameState(5));
    for (let i = 0; i < 10; i++) act(() => result.current.activateDon());
    act(() => result.current.activateDon()); // should be no-op
    expect(result.current.donDeck).toBe(0);
    expect(result.current.donActive).toBe(10);
  });

  it("restDon moves 1 active to rested", () => {
    const { result } = renderHook(() => useGameState(5));
    act(() => result.current.activateDon());
    act(() => result.current.restDon());
    expect(result.current.donActive).toBe(0);
    expect(result.current.donRested).toBe(1);
  });

  it("restDon does nothing when no active DON!!", () => {
    const { result } = renderHook(() => useGameState(5));
    act(() => result.current.restDon());
    expect(result.current.donActive).toBe(0);
    expect(result.current.donRested).toBe(0);
  });

  it("unrestDon moves 1 rested to active", () => {
    const { result } = renderHook(() => useGameState(5));
    act(() => result.current.activateDon());
    act(() => result.current.restDon());
    act(() => result.current.unrestDon());
    expect(result.current.donRested).toBe(0);
    expect(result.current.donActive).toBe(1);
  });

  it("unrestDon does nothing when no rested DON!!", () => {
    const { result } = renderHook(() => useGameState(5));
    act(() => result.current.unrestDon());
    expect(result.current.donRested).toBe(0);
  });

  it("unrestAllDon moves all rested to active", () => {
    const { result } = renderHook(() => useGameState(5));
    act(() => result.current.activateDon());
    act(() => result.current.activateDon());
    act(() => result.current.activateDon());
    act(() => result.current.restDon());
    act(() => result.current.restDon());
    act(() => result.current.restDon());
    act(() => result.current.unrestAllDon());
    expect(result.current.donRested).toBe(0);
    expect(result.current.donActive).toBe(3);
  });

  it("total DON!! never exceeds 10", () => {
    const { result } = renderHook(() => useGameState(5));
    for (let i = 0; i < 15; i++) act(() => result.current.activateDon());
    const total =
      result.current.donDeck +
      result.current.donActive +
      result.current.donRested;
    expect(total).toBe(10);
  });
});

describe("useGameState — life operations", () => {
  it("revealLife flips a face-down card to face-up", () => {
    const { result } = renderHook(() => useGameState(5));
    act(() => result.current.revealLife(2));
    expect(result.current.lifeCards[2]).toBe(false);
    // Others remain face-down
    expect(result.current.lifeCards[0]).toBe(true);
  });

  it("revealLife is a no-op for out-of-range index", () => {
    const { result } = renderHook(() => useGameState(3));
    act(() => result.current.revealLife(99));
    expect(result.current.lifeCards).toHaveLength(3);
  });

  it("loseLife removes the last life card", () => {
    const { result } = renderHook(() => useGameState(4));
    act(() => result.current.loseLife());
    expect(result.current.lifeCards).toHaveLength(3);
  });

  it("loseLife does nothing when no life cards remain", () => {
    const { result } = renderHook(() => useGameState(1));
    act(() => result.current.loseLife());
    act(() => result.current.loseLife()); // should be no-op
    expect(result.current.lifeCards).toHaveLength(0);
  });
});

describe("useGameState — resetForNewGame", () => {
  it("resets all state with new leader life", () => {
    const { result } = renderHook(() => useGameState(5));
    // Make some changes
    act(() => result.current.nextPhase());
    act(() => result.current.activateDon());
    act(() => result.current.loseLife());
    // Reset
    act(() => result.current.resetForNewGame(3));
    expect(result.current.phase).toBe("refresh");
    expect(result.current.turnNumber).toBe(1);
    expect(result.current.donDeck).toBe(10);
    expect(result.current.donActive).toBe(0);
    expect(result.current.donRested).toBe(0);
    expect(result.current.lifeCards).toHaveLength(3);
    expect(result.current.lifeCards.every((c) => c === true)).toBe(true);
  });
});
