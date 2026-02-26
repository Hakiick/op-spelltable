import type {
  EmbeddingDatabase,
  ReferenceEmbedding,
  RecognitionResult,
} from "@/types/ml";
import { hexToDHash, dHashSimilarity } from "./dhash";

export interface ReferenceDatabase {
  embeddings: ReferenceEmbedding[];
  cardCount: number;
  embeddingDim: number;
  model: string;
}

/**
 * Computes the L2 norm (Euclidean length) of a vector.
 */
export function computeL2Norm(v: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < v.length; i++) {
    sum += v[i] * v[i];
  }
  return Math.sqrt(sum);
}

/**
 * Returns a unit-length (L2-normalized) copy of the input vector.
 * If the norm is zero, returns a zero vector.
 */
export function normalizeEmbedding(v: Float32Array): Float32Array {
  const norm = computeL2Norm(v);
  if (norm === 0) {
    return new Float32Array(v.length);
  }
  const result = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) {
    result[i] = v[i] / norm;
  }
  return result;
}

/**
 * Computes cosine similarity between two vectors.
 * Both vectors should be unit-normalized for best performance.
 * Returns a value in [-1, 1]; higher means more similar.
 */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;
  return dot / denom;
}

/**
 * Loads and parses an EmbeddingDatabase JSON file from a URL.
 * Converts number[] embeddings to Float32Array and normalizes them.
 */
export async function loadReferenceDatabase(
  url: string
): Promise<ReferenceDatabase> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to load reference database from ${url}: ${response.status} ${response.statusText}`
    );
  }

  const json: EmbeddingDatabase = (await response.json()) as EmbeddingDatabase;

  const embeddings: ReferenceEmbedding[] = json.entries.map((entry) => ({
    cardCode: entry.cardCode,
    embedding: normalizeEmbedding(new Float32Array(entry.embedding)),
    histogram: entry.histogram ? new Float32Array(entry.histogram) : undefined,
    color: entry.color,
    dhash: entry.dhash ? hexToDHash(entry.dhash) : undefined,
  }));

  return {
    embeddings,
    cardCount: json.cardCount,
    embeddingDim: json.embeddingDim,
    model: json.model,
  };
}

interface ManifestEntry {
  setCode: string;
  embeddingsUrl: string;
  cardCount: number;
}

interface Manifest {
  version: string;
  model: string;
  sets: ManifestEntry[];
}

/**
 * Loads all embedding databases listed in the manifest and merges them
 * into a single ReferenceDatabase.
 */
export async function loadAllReferenceDatabases(
  manifestUrl: string
): Promise<ReferenceDatabase> {
  const response = await fetch(manifestUrl);
  if (!response.ok) {
    throw new Error(
      `Failed to load manifest from ${manifestUrl}: ${response.status}`
    );
  }

  const manifest = (await response.json()) as Manifest;

  const databases = await Promise.all(
    manifest.sets.map((entry) => loadReferenceDatabase(entry.embeddingsUrl))
  );

  const allEmbeddings: ReferenceEmbedding[] = [];
  let embeddingDim = 0;

  for (const db of databases) {
    allEmbeddings.push(...db.embeddings);
    if (db.embeddingDim > 0) embeddingDim = db.embeddingDim;
  }

  return {
    embeddings: allEmbeddings,
    cardCount: allEmbeddings.length,
    embeddingDim,
    model: manifest.model,
  };
}

/**
 * Computes histogram intersection similarity between two normalized histograms.
 * Returns a value in [0, 1] where 1 = identical.
 */
function histogramIntersection(a: Float32Array, b: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += Math.min(a[i], b[i]);
  return sum;
}

/**
 * Finds the top-K most similar cards in the reference database for a query embedding.
 * Uses a multi-signal hybrid score combining:
 * - MobileNetV3 cosine similarity (semantic features)
 * - HSV color histogram intersection (color distribution)
 * - dHash similarity (structural layout patterns)
 *
 * Weights adapt based on available signals:
 * - All 3 signals: 0.55 emb + 0.20 hist + 0.25 dhash
 * - Emb + dHash:   0.70 emb + 0.30 dhash
 * - Emb + hist:    0.85 emb + 0.15 hist
 * - Emb only:      1.00 emb
 *
 * When a colorFilter is provided, only reference cards matching that color are scored,
 * dramatically reducing the search space (e.g. from ~127 to ~21 cards for Yellow).
 *
 * @param query - The query embedding (will be normalized internally)
 * @param db - The reference database with pre-normalized embeddings
 * @param topK - Maximum number of candidates to return
 * @param threshold - Minimum score to include a candidate
 * @param queryHistogram - Optional HSV color histogram of the query image
 * @param colorFilter - Optional card border color to pre-filter candidates
 * @param queryDHash - Optional 64-bit difference hash of the query art crop
 */
export function findTopCandidates(
  query: Float32Array,
  db: ReferenceDatabase,
  topK: number,
  threshold: number,
  queryHistogram?: Float32Array,
  colorFilter?: string | null,
  queryDHash?: Float32Array
): RecognitionResult[] {
  const normalizedQuery = normalizeEmbedding(query);
  const useHistogram =
    !!queryHistogram && db.embeddings.some((e) => e.histogram);
  const useDHash =
    queryDHash !== undefined && db.embeddings.some((e) => e.dhash !== undefined);

  function scoreRef(ref: ReferenceEmbedding): { score: number; debug: string } {
    const embSim = cosineSimilarity(normalizedQuery, ref.embedding);

    if (useHistogram && useDHash && ref.histogram && queryHistogram && ref.dhash !== undefined) {
      const histSim = histogramIntersection(queryHistogram, ref.histogram);
      const dhSim = dHashSimilarity(queryDHash, ref.dhash);
      const score = 0.50 * embSim + 0.10 * histSim + 0.40 * dhSim;
      return { score, debug: `e=${(embSim*100).toFixed(0)} h=${(histSim*100).toFixed(0)} s=${(dhSim*100).toFixed(0)} c=${ref.color ?? "?"}` };
    } else if (useDHash && ref.dhash !== undefined) {
      const dhSim = dHashSimilarity(queryDHash, ref.dhash);
      const score = 0.55 * embSim + 0.45 * dhSim;
      return { score, debug: `e=${(embSim*100).toFixed(0)} s=${(dhSim*100).toFixed(0)} c=${ref.color ?? "?"}` };
    } else if (useHistogram && ref.histogram && queryHistogram) {
      const histSim = histogramIntersection(queryHistogram, ref.histogram);
      const score = 0.85 * embSim + 0.15 * histSim;
      return { score, debug: `e=${(embSim*100).toFixed(0)} h=${(histSim*100).toFixed(0)} c=${ref.color ?? "?"}` };
    }
    return { score: embSim, debug: `e=${(embSim*100).toFixed(0)} c=${ref.color ?? "?"}` };
  }

  // Two-pass strategy:
  // Pass 1: If color detected, search only same-color cards (reduces search ~5x)
  // Pass 2: If no good match, fall back to all cards
  let results: Array<{ cardCode: string; similarity: number; debug: string }> = [];

  if (colorFilter) {
    const sameColorRefs = db.embeddings.filter((e) => e.color === colorFilter);
    console.log(`[Search] Color filter: ${colorFilter} → ${sameColorRefs.length}/${db.embeddings.length} candidates`);

    for (const ref of sameColorRefs) {
      const { score, debug } = scoreRef(ref);
      if (score >= threshold) {
        results.push({ cardCode: ref.cardCode, similarity: score, debug });
      }
    }
    results.sort((a, b) => b.similarity - a.similarity);

    // If same-color search produced weak results, fall back to all cards
    const bestSameColor = results[0]?.similarity ?? 0;
    if (bestSameColor < 0.40) {
      console.log(`[Search] Same-color best=${(bestSameColor*100).toFixed(1)}% < 40%, falling back to all cards`);
      results = [];
      for (const ref of db.embeddings) {
        const { score, debug } = scoreRef(ref);
        if (score >= threshold) {
          results.push({ cardCode: ref.cardCode, similarity: score, debug });
        }
      }
      results.sort((a, b) => b.similarity - a.similarity);
    }
  } else {
    // No color detected — search all cards
    console.log(`[Search] No color detected, searching all ${db.embeddings.length} cards`);
    for (const ref of db.embeddings) {
      const { score, debug } = scoreRef(ref);
      if (score >= threshold) {
        results.push({ cardCode: ref.cardCode, similarity: score, debug });
      }
    }
    results.sort((a, b) => b.similarity - a.similarity);
  }

  const topResults = results.slice(0, topK);
  const candidateCount = topResults.length;

  // Debug: log per-signal scores for top candidates
  for (let i = 0; i < Math.min(topResults.length, 5); i++) {
    const r = topResults[i];
    console.log(`[Score] #${i+1}: ${r.cardCode} = ${(r.similarity*100).toFixed(1)}% [${r.debug}]`);
  }

  return topResults.map((r) => ({
    cardCode: r.cardCode,
    confidence: r.similarity,
    candidateCount,
    durationMs: 0, // Will be set by caller
  }));
}
