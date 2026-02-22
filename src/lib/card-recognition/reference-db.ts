import type {
  EmbeddingDatabase,
  ReferenceEmbedding,
  RecognitionResult,
} from "@/types/ml";

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
    throw new Error(
      `Vector dimension mismatch: ${a.length} vs ${b.length}`
    );
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
  }));

  return {
    embeddings,
    cardCount: json.cardCount,
    embeddingDim: json.embeddingDim,
    model: json.model,
  };
}

/**
 * Finds the top-K most similar cards in the reference database for a query embedding.
 * Returns candidates above the confidence threshold, sorted by descending confidence.
 *
 * @param query - The query embedding (will be normalized internally)
 * @param db - The reference database with pre-normalized embeddings
 * @param topK - Maximum number of candidates to return
 * @param threshold - Minimum cosine similarity to include a candidate
 */
export function findTopCandidates(
  query: Float32Array,
  db: ReferenceDatabase,
  topK: number,
  threshold: number
): RecognitionResult[] {
  const normalizedQuery = normalizeEmbedding(query);

  const scored: Array<{ cardCode: string; similarity: number }> = [];

  for (const ref of db.embeddings) {
    const similarity = cosineSimilarity(normalizedQuery, ref.embedding);
    if (similarity >= threshold) {
      scored.push({ cardCode: ref.cardCode, similarity });
    }
  }

  // Sort by descending similarity
  scored.sort((a, b) => b.similarity - a.similarity);

  // Take top-K
  const topResults = scored.slice(0, topK);
  const candidateCount = topResults.length;

  return topResults.map((r) => ({
    cardCode: r.cardCode,
    confidence: r.similarity,
    candidateCount,
    durationMs: 0, // Will be set by caller
  }));
}
