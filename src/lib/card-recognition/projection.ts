/**
 * Projection head for card recognition embeddings.
 *
 * Applies a learned 1280→512 linear transform to MobileNetV3 embeddings,
 * optimizing the embedding space for card discrimination via triplet loss.
 *
 * Pure TypeScript matrix multiply — no TF dependency at runtime.
 * Falls back to an identity projection (pass-through) when no weights are available.
 */

export interface Projection {
  /** Applies the projection to a 1280D embedding, returning a 512D vector. */
  apply(embedding: Float32Array): Float32Array;
  /** Output dimension (512 if trained, inputDim if identity). */
  outputDim: number;
  /** Whether the projection is loaded and ready. */
  isReady: boolean;
}

interface ProjectionWeights {
  inputDim: number;
  outputDim: number;
  /** Row-major weight matrix [inputDim * outputDim] */
  weights: number[];
}

/**
 * L2-normalizes a vector in place and returns it.
 */
function l2Normalize(v: Float32Array): Float32Array {
  let norm = 0;
  for (let i = 0; i < v.length; i++) {
    norm += v[i] * v[i];
  }
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < v.length; i++) {
      v[i] /= norm;
    }
  }
  return v;
}

/**
 * Matrix-vector multiply: output[j] = sum_i(input[i] * W[i * outputDim + j])
 * W is stored row-major: W[i][j] = weights[i * outputDim + j]
 */
function matVecMul(
  input: Float32Array,
  weights: Float32Array,
  inputDim: number,
  outputDim: number
): Float32Array {
  const output = new Float32Array(outputDim);
  for (let i = 0; i < inputDim; i++) {
    const val = input[i];
    if (val === 0) continue; // skip zero entries for speed
    const rowOffset = i * outputDim;
    for (let j = 0; j < outputDim; j++) {
      output[j] += val * weights[rowOffset + j];
    }
  }
  return output;
}

/**
 * Creates an identity projection that passes through the input unchanged.
 * Used when no trained weights are available.
 */
export function createIdentityProjection(): Projection {
  return {
    apply(embedding: Float32Array): Float32Array {
      return embedding;
    },
    outputDim: 0, // 0 signals "same as input"
    isReady: true,
  };
}

/**
 * Loads a trained projection from a weights URL.
 * Falls back to identity projection if url is null or loading fails.
 */
export async function loadProjection(
  weightsUrl: string | null
): Promise<Projection> {
  if (!weightsUrl) {
    return createIdentityProjection();
  }

  try {
    const response = await fetch(weightsUrl);
    if (!response.ok) {
      console.warn(
        `[Projection] Failed to load weights from ${weightsUrl}: ${response.status}, using identity`
      );
      return createIdentityProjection();
    }

    const data = (await response.json()) as ProjectionWeights;

    if (
      !data.weights ||
      !data.inputDim ||
      !data.outputDim ||
      data.weights.length !== data.inputDim * data.outputDim
    ) {
      console.warn("[Projection] Invalid weight format, using identity");
      return createIdentityProjection();
    }

    const weightsF32 = new Float32Array(data.weights);
    const { inputDim, outputDim } = data;

    return {
      apply(embedding: Float32Array): Float32Array {
        if (embedding.length !== inputDim) {
          console.warn(
            `[Projection] Input dim mismatch: expected ${inputDim}, got ${embedding.length}`
          );
          return embedding;
        }
        const projected = matVecMul(embedding, weightsF32, inputDim, outputDim);
        return l2Normalize(projected);
      },
      outputDim,
      isReady: true,
    };
  } catch (err) {
    console.warn("[Projection] Error loading weights, using identity:", err);
    return createIdentityProjection();
  }
}
