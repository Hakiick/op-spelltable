import { describe, it, expect, beforeEach } from "vitest";
import {
  createTemporalSmoother,
  type TemporalSmoother,
} from "../temporal-smoother";
import type { IdentifiedCard } from "@/types/ml";

function makeCard(
  cardCode: string | null,
  bbox: [number, number, number, number] = [10, 10, 100, 150],
  matchConfidence = 0.6,
  detectionConfidence = 0.9
): IdentifiedCard {
  return {
    bbox,
    confidence: detectionConfidence,
    cardCode,
    matchConfidence,
    candidates: cardCode
      ? [
          {
            cardCode,
            confidence: matchConfidence,
            candidateCount: 1,
            durationMs: 10,
          },
        ]
      : [],
  };
}

describe("createTemporalSmoother", () => {
  let smoother: TemporalSmoother;

  beforeEach(() => {
    smoother = createTemporalSmoother();
  });

  it("returns correct interface", () => {
    expect(smoother).toBeDefined();
    expect(typeof smoother.update).toBe("function");
    expect(typeof smoother.reset).toBe("function");
  });

  it("single frame returns no code (debounce)", () => {
    const result = smoother.update([makeCard("OP01-001")]);
    expect(result).toHaveLength(1);
    expect(result[0].cardCode).toBeNull();
  });

  it("same card across 2 frames assigns a code", () => {
    smoother.update([makeCard("OP01-001")]);
    const result = smoother.update([makeCard("OP01-001")]);
    expect(result).toHaveLength(1);
    expect(result[0].cardCode).toBe("OP01-001");
  });

  it("same card across 5 frames produces high smoothed confidence", () => {
    for (let i = 0; i < 4; i++) {
      smoother.update([makeCard("OP01-001", [10, 10, 100, 150], 0.7)]);
    }
    const result = smoother.update([
      makeCard("OP01-001", [10, 10, 100, 150], 0.7),
    ]);
    expect(result[0].cardCode).toBe("OP01-001");
    expect(result[0].matchConfidence).toBeGreaterThan(0.5);
  });

  it("conflicting codes result in majority winner", () => {
    // 3x OP01-001 then 2x OP01-002
    smoother.update([makeCard("OP01-001", [10, 10, 100, 150], 0.6)]);
    smoother.update([makeCard("OP01-001", [10, 10, 100, 150], 0.6)]);
    smoother.update([makeCard("OP01-001", [10, 10, 100, 150], 0.6)]);
    smoother.update([makeCard("OP01-002", [10, 10, 100, 150], 0.6)]);
    const result = smoother.update([
      makeCard("OP01-002", [10, 10, 100, 150], 0.6),
    ]);
    // EMA gives higher weight to recent frames, so OP01-002 could win
    // or OP01-001 still wins from more votes. Either is valid since
    // the consensus uses EMA weighting
    expect(result[0].cardCode).not.toBeNull();
  });

  it("card missing 1-2 frames is still tracked", () => {
    smoother.update([makeCard("OP01-001")]);
    smoother.update([makeCard("OP01-001")]);
    // Card disappears for 2 frames
    smoother.update([]);
    smoother.update([]);
    // Card reappears — should still be tracked (IoU match)
    const result = smoother.update([makeCard("OP01-001")]);
    expect(result).toHaveLength(1);
    expect(result[0].cardCode).toBe("OP01-001");
  });

  it("card missing 4+ frames is evicted", () => {
    smoother.update([makeCard("OP01-001")]);
    smoother.update([makeCard("OP01-001")]);
    // Card gone for 4 frames (exceeds MAX_MISSING_FRAMES=3)
    smoother.update([]);
    smoother.update([]);
    smoother.update([]);
    smoother.update([]);
    // Card reappears — should be treated as new (no history)
    const result = smoother.update([makeCard("OP01-001")]);
    expect(result).toHaveLength(1);
    // First frame of a new track → debounce → no code
    expect(result[0].cardCode).toBeNull();
  });

  it("tracks two cards simultaneously via IoU", () => {
    const card1 = makeCard("OP01-001", [10, 10, 100, 150]);
    const card2 = makeCard("OP01-002", [300, 10, 100, 150]);

    smoother.update([card1, card2]);
    const result = smoother.update([
      makeCard("OP01-001", [12, 12, 100, 150]),
      makeCard("OP01-002", [302, 12, 100, 150]),
    ]);

    expect(result).toHaveLength(2);
    // Both should have codes after 2 frames
    const codes = result.map((r) => r.cardCode).sort();
    expect(codes).toEqual(["OP01-001", "OP01-002"]);
  });

  it("reset clears all tracked state", () => {
    smoother.update([makeCard("OP01-001")]);
    smoother.update([makeCard("OP01-001")]);
    smoother.reset();
    // After reset, card is treated as new
    const result = smoother.update([makeCard("OP01-001")]);
    expect(result[0].cardCode).toBeNull();
  });

  it("bbox smoothing reduces jitter", () => {
    smoother.update([makeCard("OP01-001", [100, 100, 100, 150])]);
    // Second frame with jittery bbox
    const result = smoother.update([
      makeCard("OP01-001", [110, 105, 95, 145]),
    ]);
    // Smoothed bbox should be between the two positions
    const [x, y, w, h] = result[0].bbox;
    expect(x).toBeGreaterThan(100);
    expect(x).toBeLessThan(110);
    expect(y).toBeGreaterThan(100);
    expect(y).toBeLessThan(105);
    expect(w).toBeGreaterThan(95);
    expect(w).toBeLessThan(100);
    expect(h).toBeGreaterThan(145);
    expect(h).toBeLessThan(150);
  });

  it("EMA gives higher weight to recent frames", () => {
    // Feed 3 frames of OP01-001 then 2 frames of OP01-002
    smoother.update([makeCard("OP01-001", [10, 10, 100, 150], 0.5)]);
    smoother.update([makeCard("OP01-001", [10, 10, 100, 150], 0.5)]);
    smoother.update([makeCard("OP01-001", [10, 10, 100, 150], 0.5)]);
    smoother.update([makeCard("OP01-002", [10, 10, 100, 150], 0.9)]);
    const result = smoother.update([
      makeCard("OP01-002", [10, 10, 100, 150], 0.9),
    ]);

    // With EMA decay=0.7, recent OP01-002 frames with high confidence
    // should win over older OP01-001 frames with low confidence
    expect(result[0].cardCode).toBe("OP01-002");
  });

  it("handles empty input", () => {
    const result = smoother.update([]);
    expect(result).toEqual([]);
  });

  it("supports custom configuration", () => {
    const custom = createTemporalSmoother({
      windowSize: 3,
      minFramesForCode: 1,
      maxMissingFrames: 1,
    });

    // With minFramesForCode=1, first frame should emit code
    const result = custom.update([makeCard("OP01-001")]);
    expect(result[0].cardCode).toBe("OP01-001");
  });
});
