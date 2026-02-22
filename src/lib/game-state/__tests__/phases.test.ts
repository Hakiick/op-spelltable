import { describe, it, expect } from "vitest";
import {
  PHASES,
  getNextPhase,
  getPhaseLabel,
  getPhaseDescription,
} from "@/lib/game-state/phases";
import type { GamePhase } from "@/types/game";

describe("PHASES", () => {
  it("contains all 5 game phases in order", () => {
    expect(PHASES).toEqual(["refresh", "draw", "don", "main", "end"]);
  });
});

describe("getNextPhase", () => {
  it("advances from refresh to draw", () => {
    expect(getNextPhase("refresh")).toBe("draw");
  });

  it("advances from draw to don", () => {
    expect(getNextPhase("draw")).toBe("don");
  });

  it("advances from don to main", () => {
    expect(getNextPhase("don")).toBe("main");
  });

  it("advances from main to end", () => {
    expect(getNextPhase("main")).toBe("end");
  });

  it("wraps from end back to refresh", () => {
    expect(getNextPhase("end")).toBe("refresh");
  });

  it("cycles through all phases and returns to start", () => {
    let phase: GamePhase = "refresh";
    const visited: GamePhase[] = [phase];
    for (let i = 0; i < PHASES.length; i++) {
      phase = getNextPhase(phase);
      visited.push(phase);
    }
    // After 5 advances we are back at refresh
    expect(visited[PHASES.length]).toBe("refresh");
    // All 5 phases were visited
    const unique = new Set(visited.slice(0, PHASES.length));
    expect(unique.size).toBe(PHASES.length);
  });
});

describe("getPhaseLabel", () => {
  it("returns correct label for each phase", () => {
    expect(getPhaseLabel("refresh")).toBe("Refresh");
    expect(getPhaseLabel("draw")).toBe("Draw");
    expect(getPhaseLabel("don")).toBe("DON!!");
    expect(getPhaseLabel("main")).toBe("Main");
    expect(getPhaseLabel("end")).toBe("End");
  });
});

describe("getPhaseDescription", () => {
  it("returns a non-empty description for each phase", () => {
    for (const phase of PHASES) {
      const desc = getPhaseDescription(phase);
      expect(typeof desc).toBe("string");
      expect(desc.length).toBeGreaterThan(0);
    }
  });
});
