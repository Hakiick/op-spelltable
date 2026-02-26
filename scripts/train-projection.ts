#!/usr/bin/env tsx
/**
 * train-projection.ts
 *
 * Trains a 1280→512 linear projection head that optimizes MobileNetV3
 * embeddings for card discrimination using triplet loss with
 * semi-hard negative mining.
 *
 * Usage:
 *   npx tsx scripts/train-projection.ts [--epochs 50] [--batch-size 32] [--lr 0.001] [--seed 42]
 *
 * Output:
 *   public/ml/projection-weights.json — Projection weight matrix
 */

import fs from "fs";
import path from "path";
import { createSeededRandom, shuffleArray } from "./lib/seeded-random";
import {
  downloadImage,
  cropArtwork,
  type SharpFn,
} from "./lib/image-utils";
import { saveProjectionWeights } from "./lib/projection-utils";

interface CardEntry {
  cardId: string;
  name: string;
  imageUrl: string | null;
  color?: string;
}

// ─── Config ─────────────────────────────────────────────────────────────────

const INPUT_DIM = 1280;
const OUTPUT_DIM = 512;
const MODEL_URL =
  "https://tfhub.dev/google/tfjs-model/imagenet/mobilenet_v3_large_100_224/feature_vector/5/default/1";
const INPUT_SIZE = 224;
const AUGMENT_COUNT = 4; // augmentations per card for training
const DATA_DIR = path.resolve("src/data/cards");
const OUTPUT_PATH = path.resolve("public/ml/projection-weights.json");
const CACHE_DIR = path.resolve(".cache/embeddings");
const TRIPLET_MARGIN = 0.2;

function parseArgs(): {
  epochs: number;
  batchSize: number;
  lr: number;
  seed: number;
} {
  const args = process.argv.slice(2);
  const get = (flag: string, def: number): number => {
    const idx = args.indexOf(flag);
    if (idx !== -1 && args[idx + 1]) return Number(args[idx + 1]);
    return def;
  };
  return {
    epochs: get("--epochs", 50),
    batchSize: get("--batch-size", 32),
    lr: get("--lr", 0.001),
    seed: get("--seed", 42),
  };
}

// ─── Embedding extraction ───────────────────────────────────────────────────

interface TFModel {
  predict(input: unknown): { data(): Promise<Float32Array>; dispose(): void };
  dispose(): void;
}

interface TFLib {
  loadGraphModel(
    url: string,
    options?: { fromTFHub?: boolean }
  ): Promise<TFModel>;
  tensor4d(data: Float32Array, shape: [number, number, number, number]): unknown;
  tidy<T>(fn: () => T): T;
}

async function extractEmbedding(
  imageBuffer: Buffer,
  model: TFModel,
  tf: TFLib,
  sharpFn: SharpFn
): Promise<Float32Array> {
  const resizedBuffer = await sharpFn(imageBuffer)
    .resize(INPUT_SIZE, INPUT_SIZE, {
      fit: "contain",
      background: { r: 128, g: 128, b: 128 },
    })
    .removeAlpha()
    .raw()
    .toBuffer();

  const float32 = new Float32Array(INPUT_SIZE * INPUT_SIZE * 3);
  for (let i = 0; i < INPUT_SIZE * INPUT_SIZE; i++) {
    float32[i * 3] = resizedBuffer[i * 3] / 127.5 - 1;
    float32[i * 3 + 1] = resizedBuffer[i * 3 + 1] / 127.5 - 1;
    float32[i * 3 + 2] = resizedBuffer[i * 3 + 2] / 127.5 - 1;
  }

  const out = tf.tidy(() => {
    const inp = tf.tensor4d(float32, [1, INPUT_SIZE, INPUT_SIZE, 3]);
    return model.predict(inp) as { data(): Promise<Float32Array>; dispose(): void };
  });
  const data = await out.data();
  out.dispose();
  return new Float32Array(data);
}

/**
 * Simple augmentations for training diversity: brightness jitter + flop.
 */
async function generateTrainingAugmentations(
  artBuffer: Buffer,
  sharpFn: SharpFn,
  model: TFModel,
  tf: TFLib
): Promise<Float32Array[]> {
  const augFns: Array<(buf: Buffer) => Promise<Buffer>> = [
    // Original
    async (buf) => buf,
    // Brighter
    async (buf) =>
      sharpFn(buf).modulate({ brightness: 1.3 }).png().toBuffer(),
    // Darker
    async (buf) =>
      sharpFn(buf).modulate({ brightness: 0.7 }).png().toBuffer(),
    // Flipped
    async (buf) => sharpFn(buf).flop().png().toBuffer(),
  ];

  const results: Float32Array[] = [];
  for (let i = 0; i < Math.min(AUGMENT_COUNT, augFns.length); i++) {
    const augmented = await augFns[i](artBuffer);
    const embedding = await extractEmbedding(augmented, model, tf, sharpFn);
    results.push(embedding);
  }
  return results;
}

// ─── Projection training (pure math, no TF dependency for the head) ─────────

function l2Normalize(v: Float32Array): Float32Array {
  let norm = 0;
  for (let i = 0; i < v.length; i++) norm += v[i] * v[i];
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < v.length; i++) v[i] /= norm;
  }
  return v;
}

function applyProjection(
  input: Float32Array,
  W: Float32Array,
  outputDim: number
): Float32Array {
  const output = new Float32Array(outputDim);
  const inputDim = input.length;
  for (let i = 0; i < inputDim; i++) {
    const val = input[i];
    if (val === 0) continue;
    const offset = i * outputDim;
    for (let j = 0; j < outputDim; j++) {
      output[j] += val * W[offset + j];
    }
  }
  return l2Normalize(output);
}

function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot; // vectors are already L2-normalized
}

/**
 * Trains the projection head using triplet loss with gradient descent.
 *
 * For each batch:
 *   1. Sample anchor cards
 *   2. For each anchor, pick a positive (same card, different augmentation)
 *   3. Semi-hard negative mining: closest negative that is further than positive
 *   4. Compute triplet loss and gradient
 *   5. Update weights via SGD
 */
function trainProjection(
  embeddings: Map<string, Float32Array[]>,
  config: {
    epochs: number;
    batchSize: number;
    lr: number;
    seed: number;
  }
): Float32Array {
  const { epochs, batchSize, lr, seed } = config;
  const random = createSeededRandom(seed);

  // Initialize weights with Xavier initialization
  const W = new Float32Array(INPUT_DIM * OUTPUT_DIM);
  const scale = Math.sqrt(2.0 / (INPUT_DIM + OUTPUT_DIM));
  for (let i = 0; i < W.length; i++) {
    // Box-Muller for Gaussian
    const u1 = random() || 1e-10;
    const u2 = random();
    W[i] = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2) * scale;
  }

  const cardCodes = Array.from(embeddings.keys());
  if (cardCodes.length < 2) {
    console.error("Need at least 2 cards for training");
    return W;
  }

  console.log(
    `\nTraining projection: ${cardCodes.length} cards, ${epochs} epochs, batch=${batchSize}, lr=${lr}`
  );

  for (let epoch = 0; epoch < epochs; epoch++) {
    let epochLoss = 0;
    let tripletCount = 0;
    const shuffledCodes = shuffleArray(cardCodes, random);

    // Process in batches
    for (let b = 0; b < shuffledCodes.length; b += batchSize) {
      const batchCodes = shuffledCodes.slice(b, b + batchSize);
      const gradW = new Float32Array(INPUT_DIM * OUTPUT_DIM);

      for (const anchorCode of batchCodes) {
        const augmentations = embeddings.get(anchorCode)!;
        if (augmentations.length < 2) continue;

        // Pick anchor and positive (different augmentations)
        const anchorIdx = Math.floor(random() * augmentations.length);
        let posIdx = Math.floor(random() * (augmentations.length - 1));
        if (posIdx >= anchorIdx) posIdx++;

        const anchor = applyProjection(augmentations[anchorIdx], W, OUTPUT_DIM);
        const positive = applyProjection(augmentations[posIdx], W, OUTPUT_DIM);

        const dAP = 1 - cosineSimilarity(anchor, positive); // distance

        // Semi-hard negative mining: find closest negative farther than positive
        let bestNegCode: string | null = null;
        let bestNegDist = Infinity;
        let bestNegIdx = 0;

        // Sample a subset for efficiency
        const negSampleSize = Math.min(32, cardCodes.length - 1);
        const negCandidates = shuffleArray(
          cardCodes.filter((c) => c !== anchorCode),
          random
        ).slice(0, negSampleSize);

        for (const negCode of negCandidates) {
          const negAugs = embeddings.get(negCode)!;
          const nIdx = Math.floor(random() * negAugs.length);
          const negative = applyProjection(negAugs[nIdx], W, OUTPUT_DIM);
          const dAN = 1 - cosineSimilarity(anchor, negative);

          // Semi-hard: dAP < dAN < dAP + margin
          if (dAN > dAP && dAN < dAP + TRIPLET_MARGIN && dAN < bestNegDist) {
            bestNegDist = dAN;
            bestNegCode = negCode;
            bestNegIdx = nIdx;
          }
        }

        // If no semi-hard found, use hardest negative
        if (!bestNegCode) {
          let hardestDist = Infinity;
          for (const negCode of negCandidates) {
            const negAugs = embeddings.get(negCode)!;
            const nIdx = Math.floor(random() * negAugs.length);
            const negative = applyProjection(negAugs[nIdx], W, OUTPUT_DIM);
            const dAN = 1 - cosineSimilarity(anchor, negative);
            if (dAN < hardestDist) {
              hardestDist = dAN;
              bestNegCode = negCode;
              bestNegIdx = nIdx;
              bestNegDist = dAN;
            }
          }
        }

        if (!bestNegCode) continue;

        const negEmb = embeddings.get(bestNegCode)![bestNegIdx];
        const negative = applyProjection(negEmb, W, OUTPUT_DIM);

        const loss = Math.max(0, dAP - bestNegDist + TRIPLET_MARGIN);
        epochLoss += loss;
        tripletCount++;

        if (loss > 0) {
          // Gradient of triplet loss w.r.t. projection weights
          // d(loss)/dW ≈ numerical approximation via chain rule on projected vectors
          // For efficiency, use the simplified gradient:
          // Push anchor-positive closer, push anchor-negative apart
          const anchorEmb = augmentations[anchorIdx];
          const posEmb = augmentations[posIdx];

          for (let i = 0; i < INPUT_DIM; i++) {
            for (let j = 0; j < OUTPUT_DIM; j++) {
              const idx = i * OUTPUT_DIM + j;
              // Gradient: make anchor closer to positive and further from negative
              gradW[idx] +=
                (anchorEmb[i] * (negative[j] - positive[j]) +
                  negEmb[i] * anchor[j] -
                  posEmb[i] * anchor[j]) *
                0.5;
            }
          }
        }
      }

      // SGD update
      const scale = lr / Math.max(1, batchCodes.length);
      for (let i = 0; i < W.length; i++) {
        W[i] -= scale * gradW[i];
      }
    }

    const avgLoss = tripletCount > 0 ? epochLoss / tripletCount : 0;
    if ((epoch + 1) % 5 === 0 || epoch === 0) {
      console.log(
        `  Epoch ${epoch + 1}/${epochs}: loss=${avgLoss.toFixed(4)}, triplets=${tripletCount}`
      );
    }
  }

  return W;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const config = parseArgs();
  console.log("=== Projection Head Training ===");
  console.log(`Config: epochs=${config.epochs}, batch=${config.batchSize}, lr=${config.lr}, seed=${config.seed}`);

  // Dynamic imports
  let tf: TFLib;
  let sharpFn: SharpFn;

  try {
    tf = (await import("@tensorflow/tfjs")) as unknown as TFLib;
  } catch {
    console.error("ERROR: Could not load @tensorflow/tfjs");
    process.exit(1);
  }

  try {
    sharpFn = (await import("sharp")).default as unknown as SharpFn;
  } catch {
    console.error("ERROR: Could not load sharp. Install with: npm install --save-dev sharp");
    process.exit(1);
  }

  // Ensure cache and output directories
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });

  // Load MobileNetV3
  console.log("\nLoading MobileNetV3 Large...");
  const model = await tf.loadGraphModel(MODEL_URL, { fromTFHub: true });
  console.log("Model loaded.");

  // Discover cards with images
  const files = fs
    .readdirSync(DATA_DIR)
    .filter((f) => f.endsWith(".json") && f !== "sets.json");

  const allCards: CardEntry[] = [];
  for (const file of files) {
    const data = JSON.parse(
      fs.readFileSync(path.join(DATA_DIR, file), "utf8")
    ) as CardEntry[];
    allCards.push(...data.filter((c) => c.imageUrl));
  }

  console.log(`Found ${allCards.length} cards with images across ${files.length} sets`);

  // Extract embeddings (with caching)
  const embeddingsMap = new Map<string, Float32Array[]>();
  let processed = 0;
  let cached = 0;

  for (const card of allCards) {
    const cacheFile = path.join(CACHE_DIR, `${card.cardId}.json`);

    if (fs.existsSync(cacheFile)) {
      const data = JSON.parse(fs.readFileSync(cacheFile, "utf8")) as number[][];
      embeddingsMap.set(card.cardId, data.map((d) => new Float32Array(d)));
      cached++;
      continue;
    }

    try {
      process.stdout.write(
        `  Extracting ${card.cardId} (${++processed}/${allCards.length - cached})... `
      );

      const rawImageBuffer = await downloadImage(card.imageUrl!);
      const { artBuffer } = await cropArtwork(rawImageBuffer, sharpFn);
      const augs = await generateTrainingAugmentations(
        artBuffer,
        sharpFn,
        model,
        tf
      );

      embeddingsMap.set(card.cardId, augs);

      // Cache to disk
      const toCache = augs.map((a) => Array.from(a));
      fs.writeFileSync(cacheFile, JSON.stringify(toCache));

      process.stdout.write("OK\n");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stdout.write(`FAILED (${msg})\n`);
    }
  }

  console.log(
    `\nEmbeddings ready: ${embeddingsMap.size} cards (${cached} cached, ${processed} extracted)`
  );

  model.dispose();

  // Train projection
  const W = trainProjection(embeddingsMap, config);

  // Save weights
  saveProjectionWeights(OUTPUT_PATH, INPUT_DIM, OUTPUT_DIM, W);

  console.log("\nDone! Next steps:");
  console.log("  1. Regenerate embeddings: npx tsx scripts/generate-embeddings.ts");
  console.log("  2. The projection will be automatically loaded by the recognition pipeline");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
