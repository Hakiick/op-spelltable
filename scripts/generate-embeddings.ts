#!/usr/bin/env tsx
/**
 * generate-embeddings.ts
 *
 * Generates ML embedding databases from card image data for the card recognition pipeline.
 *
 * Usage:
 *   npx tsx scripts/generate-embeddings.ts --sets OP01            # Generate for specific sets
 *   npx tsx scripts/generate-embeddings.ts --sets OP01,OP02,ST01  # Multiple sets
 *   npx tsx scripts/generate-embeddings.ts --mock                  # Generate mock embeddings (no images needed)
 *   npx tsx scripts/generate-embeddings.ts --sets OP01 --mock      # Mock for specific sets
 *
 * Outputs:
 *   public/ml/embeddings-{SET}.json   — Embedding database per set
 *   public/ml/manifest.json           — Index of all available embeddings
 */

import fs from "fs";
import path from "path";

interface CardEntry {
  cardId: string;
  name: string;
  imageUrl: string | null;
  color?: string;
}

interface EmbeddingEntry {
  cardCode: string;
  embedding: number[];
  histogram?: number[];
  color?: string;
}

interface EmbeddingDatabase {
  version: string;
  model: string;
  embeddingDim: number;
  cardCount: number;
  generatedAt: string;
  entries: EmbeddingEntry[];
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
  generatedAt: string;
}

const EMBEDDING_DIM = 1280;
const MODEL_URL =
  "https://tfhub.dev/google/tfjs-model/imagenet/mobilenet_v3_large_100_224/feature_vector/5/default/1";
const INPUT_SIZE = 224;

/** Number of augmented versions to generate per card for a robust centroid embedding. */
const AUGMENT_COUNT = 6;
const DATA_DIR = path.resolve("src/data/cards");
const OUTPUT_DIR = path.resolve("public/ml");

function parseArgs(): { sets: string[]; mock: boolean } {
  const args = process.argv.slice(2);
  const setsIdx = args.indexOf("--sets");
  const mock = args.includes("--mock");

  let sets: string[] = [];
  if (setsIdx !== -1 && args[setsIdx + 1]) {
    sets = args[setsIdx + 1].split(",").map((s) => s.trim().toUpperCase());
  }

  return { sets, mock };
}

function generateMockEmbedding(): number[] {
  return Array.from({ length: EMBEDDING_DIM }, () => Math.random() * 2 - 1);
}

async function generateMockDatabase(
  setCode: string,
  cards: CardEntry[]
): Promise<EmbeddingDatabase> {
  console.log(
    `  [mock] Generating ${cards.length} random ${EMBEDDING_DIM}D embeddings for ${setCode}...`
  );

  const entries: EmbeddingEntry[] = cards.map((card) => ({
    cardCode: card.cardId,
    embedding: generateMockEmbedding(),
  }));

  return {
    version: "1.0.0",
    model: "mobilenet_v3_large_100_224_mock",
    embeddingDim: EMBEDDING_DIM,
    cardCount: entries.length,
    generatedAt: new Date().toISOString(),
    entries,
  };
}

async function downloadImage(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${url}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

type SharpInstance = {
  resize: (
    w: number,
    h: number,
    opts: { fit: string; background?: { r: number; g: number; b: number } }
  ) => SharpInstance;
  removeAlpha: () => SharpInstance;
  rotate: (angle: number, opts?: { background: { r: number; g: number; b: number; alpha: number } }) => SharpInstance;
  modulate: (opts: { brightness?: number; saturation?: number }) => SharpInstance;
  blur: (sigma?: number) => SharpInstance;
  flop: () => SharpInstance;
  raw: () => { toBuffer: () => Promise<Buffer> };
};
type SharpFn = (input: Buffer) => SharpInstance;

/**
 * Generates augmented versions of a card image buffer for more robust embeddings.
 * Returns an array of letterboxed, normalized Float32Array buffers ready for MobileNet.
 */
async function generateAugmentedInputs(
  imageBuffer: Buffer,
  sharpFn: SharpFn
): Promise<Float32Array[]> {
  const augmentations: Array<(s: SharpInstance) => SharpInstance> = [
    // 0: Original (no augmentation)
    (s) => s,
    // 1: Slight clockwise rotation
    (s) => s.rotate(10, { background: { r: 128, g: 128, b: 128, alpha: 1 } }),
    // 2: Slight counter-clockwise rotation
    (s) => s.rotate(-10, { background: { r: 128, g: 128, b: 128, alpha: 1 } }),
    // 3: Brighter
    (s) => s.modulate({ brightness: 1.3 }),
    // 4: Darker + slight blur (simulates distance/defocus)
    (s) => s.modulate({ brightness: 0.7 }).blur(1.5),
    // 5: Horizontal flip (handles mirrored webcam streams)
    (s) => s.flop(),
  ];

  const results: Float32Array[] = [];

  for (const augment of augmentations.slice(0, AUGMENT_COUNT)) {
    const pipeline = augment(sharpFn(imageBuffer));
    // Boost saturation before resize to reduce the impact of the gray
    // SAMPLE watermark on the embedding. The SAMPLE text is desaturated
    // (gray/white) while card art is colorful, so higher saturation
    // makes the art features more dominant in the embedding.
    const resizedBuffer = await pipeline
      .modulate({ saturation: 1.5 })
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
    results.push(float32);
  }

  return results;
}

/**
 * Averages multiple embedding vectors into a single centroid embedding.
 */
function averageEmbeddings(embeddings: Float32Array[]): number[] {
  if (embeddings.length === 0) return [];
  const dim = embeddings[0].length;
  const avg = new Float64Array(dim); // Use float64 for accumulation precision
  for (const emb of embeddings) {
    for (let i = 0; i < dim; i++) {
      avg[i] += emb[i];
    }
  }
  const result: number[] = new Array(dim);
  for (let i = 0; i < dim; i++) {
    result[i] = avg[i] / embeddings.length;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Color histogram (HSV) — computed from raw RGB buffer
// ---------------------------------------------------------------------------

const HIST_H_BINS = 16;
const HIST_S_BINS = 8;
const HIST_V_BINS = 8;

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;
  if (d > 0) {
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
    if (h < 0) h += 360;
  }
  return [h, s, v];
}

/** Compute normalized HSV histogram from raw RGB buffer (3 bytes per pixel). */
function computeImageHistogram(
  rgbBuffer: Buffer,
  size: number
): Float32Array {
  const totalBins = HIST_H_BINS * HIST_S_BINS * HIST_V_BINS;
  const histogram = new Float32Array(totalBins);
  const pixelCount = size * size;
  let counted = 0;

  for (let i = 0; i < pixelCount; i++) {
    const r = rgbBuffer[i * 3];
    const g = rgbBuffer[i * 3 + 1];
    const b = rgbBuffer[i * 3 + 2];

    const [h, s, v] = rgbToHsv(r, g, b);
    // Skip dark pixels (background) and desaturated bright pixels (SAMPLE text)
    if (v < 0.1 || (s < 0.1 && v > 0.6)) continue;

    const hBin = Math.min(Math.floor((h / 360) * HIST_H_BINS), HIST_H_BINS - 1);
    const sBin = Math.min(Math.floor(s * HIST_S_BINS), HIST_S_BINS - 1);
    const vBin = Math.min(Math.floor(v * HIST_V_BINS), HIST_V_BINS - 1);

    histogram[hBin * HIST_S_BINS * HIST_V_BINS + sBin * HIST_V_BINS + vBin]++;
    counted++;
  }

  if (counted > 0) {
    for (let i = 0; i < totalBins; i++) histogram[i] /= counted;
  }
  return histogram;
}

async function generateRealDatabase(
  setCode: string,
  cards: CardEntry[]
): Promise<EmbeddingDatabase> {
  console.log(
    `  [real] Loading MobileNetV3 Large model for ${setCode} (${cards.length} cards, ${AUGMENT_COUNT} augmentations each)...`
  );

  // Dynamic imports to avoid load-time errors in environments without native bindings
  let tf: typeof import("@tensorflow/tfjs");
  let sharpFn: SharpFn;

  try {
    tf = await import("@tensorflow/tfjs");
  } catch {
    console.error(
      "  ERROR: Could not load @tensorflow/tfjs. Try --mock flag instead."
    );
    throw new Error("TensorFlow.js unavailable");
  }

  try {
    sharpFn = (await import("sharp"))
      .default as unknown as SharpFn;
  } catch {
    console.error(
      "  ERROR: Could not load sharp. Install it with: npm install --save-dev sharp"
    );
    throw new Error("sharp unavailable");
  }

  const model = await tf.loadGraphModel(MODEL_URL, { fromTFHub: true });
  console.log("  Model loaded.");

  const entries: EmbeddingEntry[] = [];
  let processed = 0;

  for (const card of cards) {
    if (!card.imageUrl) {
      console.log(`  SKIP ${card.cardId}: no imageUrl`);
      continue;
    }

    try {
      process.stdout.write(
        `  Processing ${card.cardId} (${++processed}/${cards.length})... `
      );

      // Download image
      const imageBuffer = await downloadImage(card.imageUrl);

      // Compute color histogram from the original image (HSV, skip SAMPLE-like pixels)
      const histogramBuffer = await sharpFn(imageBuffer)
        .resize(INPUT_SIZE, INPUT_SIZE, {
          fit: "contain",
          background: { r: 128, g: 128, b: 128 },
        })
        .removeAlpha()
        .raw()
        .toBuffer();
      const histogram = computeImageHistogram(histogramBuffer, INPUT_SIZE);

      // Generate augmented versions and compute embeddings for each
      const augmentedInputs = await generateAugmentedInputs(imageBuffer, sharpFn);
      const augmentedEmbeddings: Float32Array[] = [];

      for (const input of augmentedInputs) {
        const inputTensor = tf.tensor4d(input, [1, INPUT_SIZE, INPUT_SIZE, 3]);
        const rawOutput = model.predict(inputTensor);
        inputTensor.dispose();

        const outputTensor = (
          Array.isArray(rawOutput) ? rawOutput[0] : rawOutput
        ) as import("@tensorflow/tfjs").Tensor;

        const embeddingData = await outputTensor.data();
        outputTensor.dispose();
        augmentedEmbeddings.push(new Float32Array(embeddingData));
      }

      // Average all augmented embeddings into a single centroid
      entries.push({
        cardCode: card.cardId,
        embedding: averageEmbeddings(augmentedEmbeddings),
        histogram: Array.from(histogram),
        color: card.color,
      });

      process.stdout.write("OK\n");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      process.stdout.write(`FAILED (${message})\n`);
    }
  }

  model.dispose();

  return {
    version: "1.0.0",
    model: "mobilenet_v3_large_100_224",
    embeddingDim: EMBEDDING_DIM,
    cardCount: entries.length,
    generatedAt: new Date().toISOString(),
    entries,
  };
}

async function processSet(
  setCode: string,
  mock: boolean
): Promise<ManifestEntry | null> {
  const jsonPath = path.join(DATA_DIR, `${setCode}.json`);

  if (!fs.existsSync(jsonPath)) {
    console.log(`  WARNING: No data file found at ${jsonPath}, skipping.`);
    return null;
  }

  const rawData = JSON.parse(fs.readFileSync(jsonPath, "utf8")) as CardEntry[];
  console.log(`\nProcessing ${setCode} (${rawData.length} cards)...`);

  let db: EmbeddingDatabase;
  if (mock) {
    db = await generateMockDatabase(setCode, rawData);
  } else {
    try {
      db = await generateRealDatabase(setCode, rawData);
    } catch {
      console.log(
        `  Falling back to mock embeddings for ${setCode} (use --mock to suppress this)`
      );
      db = await generateMockDatabase(setCode, rawData);
    }
  }

  const outputPath = path.join(OUTPUT_DIR, `embeddings-${setCode}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(db));
  console.log(
    `  Written: ${outputPath} (${db.cardCount} cards, ${(fs.statSync(outputPath).size / 1024 / 1024).toFixed(1)} MB)`
  );

  return {
    setCode,
    embeddingsUrl: `/ml/embeddings-${setCode}.json`,
    cardCount: db.cardCount,
  };
}

async function main(): Promise<void> {
  const { sets, mock } = parseArgs();

  // Ensure output directory exists
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Discover all available sets if none specified
  let targetSets = sets;
  if (targetSets.length === 0) {
    const files = fs
      .readdirSync(DATA_DIR)
      .filter((f) => f.endsWith(".json") && f !== "sets.json");
    targetSets = files.map((f) => f.replace(".json", "").toUpperCase());
    console.log(`No sets specified — processing all ${targetSets.length} sets`);
  }

  console.log(
    `\nGenerating embeddings for: ${targetSets.join(", ")} (mock=${mock})`
  );

  const manifestEntries: ManifestEntry[] = [];

  for (const setCode of targetSets) {
    const entry = await processSet(setCode, mock);
    if (entry) {
      manifestEntries.push(entry);
    }
  }

  // Write manifest
  const manifest: Manifest = {
    version: "1.0.0",
    model: mock
      ? "mobilenet_v3_large_100_224_mock"
      : "mobilenet_v3_large_100_224",
    sets: manifestEntries,
    generatedAt: new Date().toISOString(),
  };

  const manifestPath = path.join(OUTPUT_DIR, "manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`\nManifest written: ${manifestPath}`);
  console.log(
    `\nDone! Generated embeddings for ${manifestEntries.length} sets.`
  );
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
