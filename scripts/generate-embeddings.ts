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
import { computeDHashFromRgb, dHashToHex } from "../src/lib/card-recognition/dhash";
import {
  downloadImage,
  removeSampleWatermark,
  addGaussianNoise,
  adjustContrast,
  desaturate,
  type SharpInstance,
  type SharpFn,
} from "./lib/image-utils";
import { loadProjectionFromFile, type ProjectionWeightsData } from "./lib/projection-utils";

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
  dhash?: number[];
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
const AUGMENT_COUNT = 30;
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

// downloadImage, removeSampleWatermark, addGaussianNoise, adjustContrast,
// desaturate, SharpInstance, SharpFn — all imported from ./lib/image-utils

/**
 * Generates augmented versions of a card image buffer for more robust embeddings.
 * Returns an array of letterboxed, normalized Float32Array buffers ready for MobileNet.
 *
 * Augmentations cover: rotation, brightness, blur, flip, noise, contrast, desaturation.
 */
async function generateAugmentedInputs(
  imageBuffer: Buffer,
  sharpFn: SharpFn
): Promise<Float32Array[]> {
  // Sharp-based augmentations (applied before resize)
  const sharpAugmentations: Array<(s: SharpInstance) => SharpInstance> = [
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
    // 6: Slightly brighter + slight saturation drop (warm webcam lighting)
    (s) => s.modulate({ brightness: 1.15, saturation: 0.85 }),
    // 7: Very bright (overexposed webcam)
    (s) => s.modulate({ brightness: 1.5 }),
    // 8: Very dark (underexposed)
    (s) => s.modulate({ brightness: 0.5 }),
    // 9: Cool lighting (slightly desaturated + dark)
    (s) => s.modulate({ brightness: 0.9, saturation: 0.8 }),
    // 10: Warm lighting (bright + slightly saturated)
    (s) => s.modulate({ brightness: 1.2, saturation: 1.1 }),
    // 11: Slight blur (distance/defocus)
    (s) => s.blur(2.0),
    // 12: Higher rotation CW
    (s) => s.rotate(20, { background: { r: 128, g: 128, b: 128, alpha: 1 } }),
    // 13: Higher rotation CCW
    (s) => s.rotate(-20, { background: { r: 128, g: 128, b: 128, alpha: 1 } }),
    // 14: Flipped + brighter (mirrored webcam + overexposure)
    (s) => s.flop().modulate({ brightness: 1.3 }),
    // 15: Flipped + darker
    (s) => s.flop().modulate({ brightness: 0.7 }),
    // 16: High saturation (vibrant display)
    (s) => s.modulate({ saturation: 1.4 }),
    // 17: Low saturation (washed out)
    (s) => s.modulate({ saturation: 0.5 }),
    // 18: Bright + rotated
    (s) => s.rotate(5, { background: { r: 128, g: 128, b: 128, alpha: 1 } }).modulate({ brightness: 1.2 }),
    // 19: Dark + rotated
    (s) => s.rotate(-5, { background: { r: 128, g: 128, b: 128, alpha: 1 } }).modulate({ brightness: 0.8 }),
  ];

  // Pixel-level augmentations (applied after resize to raw buffer)
  type PixelAugment = (buf: Buffer) => Buffer;
  const pixelAugmentations: Array<{
    sharpAug: (s: SharpInstance) => SharpInstance;
    pixelAug: PixelAugment;
  }> = [
    // 20: Gaussian noise (σ=15) — webcam sensor noise
    { sharpAug: (s) => s, pixelAug: (buf) => addGaussianNoise(buf, 15) },
    // 21: Low contrast (0.7×) — simulates washed-out webcam
    { sharpAug: (s) => s, pixelAug: (buf) => adjustContrast(buf, 0.7) },
    // 22: Slight desaturation — simulates poor white balance
    { sharpAug: (s) => s, pixelAug: (buf) => desaturate(buf, 0.3) },
    // 23: Heavy noise (σ=25) — very noisy sensor
    { sharpAug: (s) => s, pixelAug: (buf) => addGaussianNoise(buf, 25) },
    // 24: High contrast (1.4×) — harsh lighting
    { sharpAug: (s) => s, pixelAug: (buf) => adjustContrast(buf, 1.4) },
    // 25: Heavy desaturation — near-grayscale
    { sharpAug: (s) => s, pixelAug: (buf) => desaturate(buf, 0.6) },
    // 26: Noise + dark — noisy underexposed
    { sharpAug: (s) => s.modulate({ brightness: 0.7 }), pixelAug: (buf) => addGaussianNoise(buf, 20) },
    // 27: Noise + bright — noisy overexposed
    { sharpAug: (s) => s.modulate({ brightness: 1.3 }), pixelAug: (buf) => addGaussianNoise(buf, 15) },
    // 28: Low contrast + desaturated
    { sharpAug: (s) => s, pixelAug: (buf) => desaturate(adjustContrast(buf, 0.8), 0.2) },
    // 29: Flipped + noise — mirrored webcam with noise
    { sharpAug: (s) => s.flop(), pixelAug: (buf) => addGaussianNoise(buf, 15) },
  ];

  const results: Float32Array[] = [];

  // Apply sharp-only augmentations
  for (const augment of sharpAugmentations.slice(0, Math.min(sharpAugmentations.length, AUGMENT_COUNT))) {
    const pipeline = augment(sharpFn(imageBuffer));
    const resizedBuffer = await pipeline
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

  // Apply pixel-level augmentations (up to AUGMENT_COUNT total)
  const remaining = AUGMENT_COUNT - results.length;
  for (const { sharpAug, pixelAug } of pixelAugmentations.slice(0, remaining)) {
    const pipeline = sharpAug(sharpFn(imageBuffer));
    const resizedBuffer = await pipeline
      .resize(INPUT_SIZE, INPUT_SIZE, {
        fit: "contain",
        background: { r: 128, g: 128, b: 128 },
      })
      .removeAlpha()
      .raw()
      .toBuffer();

    const augmentedBuffer = pixelAug(resizedBuffer);

    const float32 = new Float32Array(INPUT_SIZE * INPUT_SIZE * 3);
    for (let i = 0; i < INPUT_SIZE * INPUT_SIZE; i++) {
      float32[i * 3] = augmentedBuffer[i * 3] / 127.5 - 1;
      float32[i * 3 + 1] = augmentedBuffer[i * 3 + 1] / 127.5 - 1;
      float32[i * 3 + 2] = augmentedBuffer[i * 3 + 2] / 127.5 - 1;
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
  r /= 255;
  g /= 255;
  b /= 255;
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
function computeImageHistogram(rgbBuffer: Buffer, size: number): Float32Array {
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

/** Apply a projection matrix to a centroid embedding and L2-normalize. */
function applyProjectionToCentroid(
  centroid: number[],
  projData: ProjectionWeightsData
): number[] {
  const { inputDim, outputDim, weights } = projData;
  if (centroid.length !== inputDim) return centroid;
  const output = new Float64Array(outputDim);
  for (let i = 0; i < inputDim; i++) {
    const val = centroid[i];
    if (val === 0) continue;
    const offset = i * outputDim;
    for (let j = 0; j < outputDim; j++) {
      output[j] += val * weights[offset + j];
    }
  }
  // L2 normalize
  let norm = 0;
  for (let j = 0; j < outputDim; j++) norm += output[j] * output[j];
  norm = Math.sqrt(norm);
  const result = new Array<number>(outputDim);
  for (let j = 0; j < outputDim; j++) {
    result[j] = norm > 0 ? output[j] / norm : 0;
  }
  return result;
}

async function generateRealDatabase(
  setCode: string,
  cards: CardEntry[],
  projData: ProjectionWeightsData | null
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
    sharpFn = (await import("sharp")).default as unknown as SharpFn;
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
      const rawImageBuffer = await downloadImage(card.imageUrl);

      // Remove SAMPLE watermark from the reference image.
      // The SAMPLE text is bright+desaturated — we replace those pixels
      // with the local average of surrounding colored pixels so that
      // reference embeddings match real (unwatermarked) cards.
      const { width: imgW, height: imgH } =
        await sharpFn(rawImageBuffer).metadata();
      const rawRgb = await sharpFn(rawImageBuffer)
        .removeAlpha()
        .raw()
        .toBuffer();
      const cleanRgb = removeSampleWatermark(rawRgb, imgW!, imgH!);

      // Crop to artwork region — the most discriminative part of the card.
      // OP TCG cards have a standardized layout: art occupies roughly
      // 18%-62% vertically and 8%-92% horizontally.
      const artTop = Math.round(imgH! * 0.18);
      const artBottom = Math.round(imgH! * 0.62);
      const artLeft = Math.round(imgW! * 0.08);
      const artRight = Math.round(imgW! * 0.92);

      const imageBuffer = await sharpFn(cleanRgb, {
        raw: { width: imgW!, height: imgH!, channels: 3 },
      })
        .extract({
          left: artLeft,
          top: artTop,
          width: artRight - artLeft,
          height: artBottom - artTop,
        })
        .png()
        .toBuffer();

      // Compute color histogram from the cleaned image (HSV, skip SAMPLE-like pixels)
      const histogramBuffer = await sharpFn(imageBuffer)
        .resize(INPUT_SIZE, INPUT_SIZE, {
          fit: "contain",
          background: { r: 128, g: 128, b: 128 },
        })
        .removeAlpha()
        .raw()
        .toBuffer();
      const histogram = computeImageHistogram(histogramBuffer, INPUT_SIZE);

      // Compute dHash from the art crop (before resize, for maximum detail)
      const artCropRgb = await sharpFn(imageBuffer)
        .removeAlpha()
        .raw()
        .toBuffer();
      const artCropMeta = await sharpFn(imageBuffer).metadata();
      const dhash = computeDHashFromRgb(
        artCropRgb,
        artCropMeta.width!,
        artCropMeta.height!
      );

      // Generate augmented versions and compute embeddings for each
      const augmentedInputs = await generateAugmentedInputs(
        imageBuffer,
        sharpFn as (input: Buffer) => SharpInstance
      );
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
      let centroid = averageEmbeddings(augmentedEmbeddings);

      // Apply projection head if trained weights are available
      if (projData) {
        centroid = applyProjectionToCentroid(centroid, projData);
      }

      entries.push({
        cardCode: card.cardId,
        embedding: centroid,
        histogram: Array.from(histogram),
        color: card.color,
        dhash: dHashToHex(dhash),
      });

      process.stdout.write("OK\n");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      process.stdout.write(`FAILED (${message})\n`);
    }
  }

  model.dispose();

  const effectiveDim = projData ? projData.outputDim : EMBEDDING_DIM;

  return {
    version: "1.0.0",
    model: projData
      ? "mobilenet_v3_large_100_224+projection"
      : "mobilenet_v3_large_100_224",
    embeddingDim: effectiveDim,
    cardCount: entries.length,
    generatedAt: new Date().toISOString(),
    entries,
  };
}

async function processSet(
  setCode: string,
  mock: boolean,
  projData: ProjectionWeightsData | null
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
      db = await generateRealDatabase(setCode, rawData, projData);
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

  // Load projection weights if available
  const projPath = path.resolve("public/ml/projection-weights.json");
  const projData = mock ? null : loadProjectionFromFile(projPath);
  if (projData) {
    console.log(
      `Projection weights loaded: ${projData.inputDim}→${projData.outputDim} (${projPath})`
    );
  } else if (!mock) {
    console.log("No projection weights found — using raw 1280D embeddings");
  }

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

  const newEntries: ManifestEntry[] = [];

  for (const setCode of targetSets) {
    const entry = await processSet(setCode, mock, projData);
    if (entry) {
      newEntries.push(entry);
    }
  }

  // Merge with existing manifest instead of overwriting
  // This preserves entries for sets that were NOT regenerated in this run
  const manifestPath = path.join(OUTPUT_DIR, "manifest.json");
  const newSetCodes = new Set(newEntries.map((e) => e.setCode));

  let existingEntries: ManifestEntry[] = [];
  if (fs.existsSync(manifestPath)) {
    const existing: Manifest = JSON.parse(
      fs.readFileSync(manifestPath, "utf-8")
    );
    existingEntries = existing.sets.filter((e) => !newSetCodes.has(e.setCode));
  }

  const allEntries = [...existingEntries, ...newEntries].sort((a, b) =>
    a.setCode.localeCompare(b.setCode)
  );

  const manifest: Manifest = {
    version: "1.0.0",
    model: mock
      ? "mobilenet_v3_large_100_224_mock"
      : "mobilenet_v3_large_100_224",
    sets: allEntries,
    generatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`\nManifest written: ${manifestPath}`);
  console.log(
    `\nDone! Generated ${newEntries.length} sets, manifest has ${allEntries.length} total sets.`
  );
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
