import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { loadProjection, createIdentityProjection } from "../projection";

describe("createIdentityProjection", () => {
  it("returns input unchanged", () => {
    const proj = createIdentityProjection();
    const input = new Float32Array([1, 2, 3, 4, 5]);
    const output = proj.apply(input);
    expect(output).toBe(input); // same reference
  });

  it("has outputDim 0 (signals same-as-input)", () => {
    const proj = createIdentityProjection();
    expect(proj.outputDim).toBe(0);
  });

  it("isReady is true", () => {
    const proj = createIdentityProjection();
    expect(proj.isReady).toBe(true);
  });
});

describe("loadProjection", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns identity when url is null", async () => {
    const proj = await loadProjection(null);
    expect(proj.isReady).toBe(true);
    expect(proj.outputDim).toBe(0);
    const input = new Float32Array([1, 2, 3]);
    expect(proj.apply(input)).toBe(input);
  });

  it("returns identity on fetch failure", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });

    const proj = await loadProjection("/ml/projection-weights.json");
    expect(proj.isReady).toBe(true);
    expect(proj.outputDim).toBe(0);
  });

  it("returns identity on invalid weight format", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ invalid: true }),
    });

    const proj = await loadProjection("/ml/projection-weights.json");
    expect(proj.isReady).toBe(true);
    expect(proj.outputDim).toBe(0);
  });

  it("apply produces correct output dimension", async () => {
    // Small 3→2 projection for testing
    const weights = {
      inputDim: 3,
      outputDim: 2,
      weights: [1, 0, 0, 1, 0, 0], // maps [a,b,c] → [a, b]
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(weights),
    });

    const proj = await loadProjection("/ml/projection-weights.json");
    expect(proj.outputDim).toBe(2);

    const input = new Float32Array([3, 4, 0]);
    const output = proj.apply(input);
    expect(output.length).toBe(2);
  });

  it("output is L2-normalized", async () => {
    const weights = {
      inputDim: 3,
      outputDim: 2,
      weights: [1, 0, 0, 1, 0, 0],
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(weights),
    });

    const proj = await loadProjection("/ml/projection-weights.json");
    const input = new Float32Array([3, 4, 0]);
    const output = proj.apply(input);

    // Compute L2 norm of output
    let norm = 0;
    for (let i = 0; i < output.length; i++) {
      norm += output[i] * output[i];
    }
    norm = Math.sqrt(norm);

    expect(norm).toBeCloseTo(1.0, 5);
  });

  it("matmul correctness with known small weights", async () => {
    // W = [[1, 2], [3, 4], [5, 6]] (3x2 matrix, row-major)
    // input = [1, 1, 1]
    // output_raw = [1*1+1*3+1*5, 1*2+1*4+1*6] = [9, 12]
    // L2 norm = sqrt(81+144) = sqrt(225) = 15
    // normalized = [9/15, 12/15] = [0.6, 0.8]
    const weights = {
      inputDim: 3,
      outputDim: 2,
      weights: [1, 2, 3, 4, 5, 6],
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(weights),
    });

    const proj = await loadProjection("/ml/projection-weights.json");
    const input = new Float32Array([1, 1, 1]);
    const output = proj.apply(input);

    expect(output[0]).toBeCloseTo(0.6, 5);
    expect(output[1]).toBeCloseTo(0.8, 5);
  });

  it("deterministic: same input produces same output", async () => {
    const weights = {
      inputDim: 4,
      outputDim: 2,
      weights: [1, 0, 0, 1, 1, 0, 0, 1],
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(weights),
    });

    const proj = await loadProjection("/ml/projection-weights.json");
    const input = new Float32Array([1, 2, 3, 4]);
    const output1 = proj.apply(input);
    const output2 = proj.apply(input);

    expect(Array.from(output1)).toEqual(Array.from(output2));
  });

  it("handles fetch exception gracefully", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    const proj = await loadProjection("/ml/projection-weights.json");
    expect(proj.isReady).toBe(true);
    expect(proj.outputDim).toBe(0); // identity fallback
  });
});
