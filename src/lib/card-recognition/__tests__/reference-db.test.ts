import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  cosineSimilarity,
  computeL2Norm,
  normalizeEmbedding,
  findTopCandidates,
  loadReferenceDatabase,
  type ReferenceDatabase,
} from "../reference-db";

describe("computeL2Norm", () => {
  it("computes norm of a unit vector", () => {
    const v = new Float32Array([1, 0, 0]);
    expect(computeL2Norm(v)).toBeCloseTo(1.0);
  });

  it("computes norm of a known vector", () => {
    const v = new Float32Array([3, 4]);
    expect(computeL2Norm(v)).toBeCloseTo(5.0);
  });

  it("returns 0 for zero vector", () => {
    const v = new Float32Array([0, 0, 0]);
    expect(computeL2Norm(v)).toBe(0);
  });

  it("computes norm of negative values", () => {
    const v = new Float32Array([-3, -4]);
    expect(computeL2Norm(v)).toBeCloseTo(5.0);
  });
});

describe("normalizeEmbedding", () => {
  it("normalizes a vector to unit length", () => {
    const v = new Float32Array([3, 4]);
    const normalized = normalizeEmbedding(v);
    expect(computeL2Norm(normalized)).toBeCloseTo(1.0);
    expect(normalized[0]).toBeCloseTo(0.6);
    expect(normalized[1]).toBeCloseTo(0.8);
  });

  it("returns zero vector for zero input", () => {
    const v = new Float32Array([0, 0, 0]);
    const normalized = normalizeEmbedding(v);
    expect(normalized[0]).toBe(0);
    expect(normalized[1]).toBe(0);
    expect(normalized[2]).toBe(0);
  });

  it("does not mutate original vector", () => {
    const v = new Float32Array([3, 4]);
    const original0 = v[0];
    const original1 = v[1];
    normalizeEmbedding(v);
    expect(v[0]).toBe(original0);
    expect(v[1]).toBe(original1);
  });

  it("normalizes a unit vector to itself", () => {
    const v = new Float32Array([1, 0, 0]);
    const normalized = normalizeEmbedding(v);
    expect(normalized[0]).toBeCloseTo(1.0);
    expect(normalized[1]).toBeCloseTo(0.0);
    expect(normalized[2]).toBeCloseTo(0.0);
  });
});

describe("cosineSimilarity", () => {
  it("returns 1.0 for identical vectors", () => {
    const a = new Float32Array([1, 2, 3]);
    const b = new Float32Array([1, 2, 3]);
    expect(cosineSimilarity(a, b)).toBeCloseTo(1.0);
  });

  it("returns -1.0 for opposite vectors", () => {
    const a = new Float32Array([1, 0, 0]);
    const b = new Float32Array([-1, 0, 0]);
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1.0);
  });

  it("returns 0 for orthogonal vectors", () => {
    const a = new Float32Array([1, 0]);
    const b = new Float32Array([0, 1]);
    expect(cosineSimilarity(a, b)).toBeCloseTo(0.0);
  });

  it("returns 0 for zero vectors", () => {
    const a = new Float32Array([0, 0, 0]);
    const b = new Float32Array([1, 2, 3]);
    expect(cosineSimilarity(a, b)).toBe(0);
  });

  it("is independent of vector magnitude", () => {
    const a = new Float32Array([1, 0]);
    const b = new Float32Array([2, 0]); // Same direction, different magnitude
    expect(cosineSimilarity(a, b)).toBeCloseTo(1.0);
  });

  it("throws on dimension mismatch", () => {
    const a = new Float32Array([1, 2, 3]);
    const b = new Float32Array([1, 2]);
    expect(() => cosineSimilarity(a, b)).toThrow(
      "Vector dimension mismatch: 3 vs 2"
    );
  });

  it("returns ~0.866 for 30-degree angle", () => {
    const a = new Float32Array([1, 0]);
    const b = new Float32Array([Math.cos(Math.PI / 6), Math.sin(Math.PI / 6)]);
    expect(cosineSimilarity(a, b)).toBeCloseTo(Math.cos(Math.PI / 6));
  });
});

describe("findTopCandidates", () => {
  function makeDb(cardCodes: string[]): ReferenceDatabase {
    const embeddings = cardCodes.map((cardCode, i) => {
      const v = new Float32Array(4);
      v[i % 4] = 1.0; // Each card has a distinct direction
      return { cardCode, embedding: v };
    });
    return {
      embeddings,
      cardCount: cardCodes.length,
      embeddingDim: 4,
      model: "test",
    };
  }

  it("returns the best matching card", () => {
    const db = makeDb(["OP01-001", "OP01-002", "OP01-003"]);
    // Query matching OP01-001 exactly
    const query = new Float32Array([1, 0, 0, 0]);
    const results = findTopCandidates(query, db, 3, 0.5);

    expect(results).toHaveLength(1);
    expect(results[0].cardCode).toBe("OP01-001");
    expect(results[0].confidence).toBeCloseTo(1.0);
  });

  it("respects topK limit", () => {
    const db = makeDb(["OP01-001", "OP01-002", "OP01-003", "OP01-004"]);
    // Query slightly toward OP01-001 and OP01-002
    const query = new Float32Array([0.9, 0.9, 0.1, 0.1]);
    const results = findTopCandidates(query, db, 2, 0.0);

    expect(results.length).toBeLessThanOrEqual(2);
  });

  it("filters by threshold", () => {
    const db = makeDb(["OP01-001", "OP01-002"]);
    const query = new Float32Array([1, 0, 0, 0]); // Perfect match for OP01-001
    // Set high threshold - only OP01-001 should pass
    const results = findTopCandidates(query, db, 3, 0.9);

    expect(results.length).toBe(1);
    expect(results[0].cardCode).toBe("OP01-001");
  });

  it("returns empty array when no candidates above threshold", () => {
    const db = makeDb(["OP01-001", "OP01-002"]);
    const query = new Float32Array([1, 0, 0, 0]);
    const results = findTopCandidates(query, db, 3, 1.1); // Impossible threshold

    expect(results).toHaveLength(0);
  });

  it("returns results sorted by descending confidence", () => {
    const db = makeDb(["OP01-001", "OP01-002", "OP01-003", "OP01-004"]);
    const query = new Float32Array([0.9, 0.5, 0.1, 0.0]);
    const results = findTopCandidates(query, db, 4, 0.0);

    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].confidence).toBeGreaterThanOrEqual(
        results[i].confidence
      );
    }
  });

  it("sets candidateCount to total number of results returned", () => {
    const db = makeDb(["OP01-001", "OP01-002"]);
    const query = new Float32Array([1, 0, 0, 0]);
    const results = findTopCandidates(query, db, 3, 0.5);

    for (const r of results) {
      expect(r.candidateCount).toBe(results.length);
    }
  });
});

describe("loadReferenceDatabase", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches and parses a valid database", async () => {
    const mockDb = {
      version: "1.0.0",
      model: "test-model",
      embeddingDim: 3,
      cardCount: 2,
      generatedAt: "2026-01-01T00:00:00.000Z",
      entries: [
        { cardCode: "OP01-001", embedding: [1, 0, 0] },
        { cardCode: "OP01-002", embedding: [0, 1, 0] },
      ],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockDb),
    } as unknown as Response);

    const db = await loadReferenceDatabase("/ml/test.json");

    expect(db.cardCount).toBe(2);
    expect(db.model).toBe("test-model");
    expect(db.embeddingDim).toBe(3);
    expect(db.embeddings).toHaveLength(2);
    expect(db.embeddings[0].cardCode).toBe("OP01-001");
    expect(db.embeddings[0].embedding).toBeInstanceOf(Float32Array);
  });

  it("normalizes embeddings on load", async () => {
    const mockDb = {
      version: "1.0.0",
      model: "test",
      embeddingDim: 2,
      cardCount: 1,
      generatedAt: "2026-01-01T00:00:00.000Z",
      entries: [
        { cardCode: "OP01-001", embedding: [3, 4] }, // norm = 5
      ],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockDb),
    } as unknown as Response);

    const db = await loadReferenceDatabase("/ml/test.json");

    // Should be normalized to unit length
    const norm = computeL2Norm(db.embeddings[0].embedding);
    expect(norm).toBeCloseTo(1.0);
  });

  it("throws on non-ok HTTP response", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
    } as unknown as Response);

    await expect(loadReferenceDatabase("/ml/missing.json")).rejects.toThrow(
      "Failed to load reference database"
    );
  });
});
