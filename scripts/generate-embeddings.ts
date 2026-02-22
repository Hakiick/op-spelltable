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
}

interface EmbeddingEntry {
  cardCode: string;
  embedding: number[];
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

const EMBEDDING_DIM = 1024;
const MODEL_URL =
  "https://tfhub.dev/google/tfjs-model/imagenet/mobilenet_v3_small_100_224/feature_vector/5/default/1";
const INPUT_SIZE = 224;
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
    model: "mobilenet_v3_small_100_224_mock",
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

async function generateRealDatabase(
  setCode: string,
  cards: CardEntry[]
): Promise<EmbeddingDatabase> {
  console.log(
    `  [real] Loading MobileNetV3 model for ${setCode} (${cards.length} cards)...`
  );

  // Dynamic imports to avoid load-time errors in environments without native bindings
  let tf: typeof import("@tensorflow/tfjs");
  let sharp: typeof import("sharp");

  try {
    tf = await import("@tensorflow/tfjs");
  } catch {
    console.error(
      "  ERROR: Could not load @tensorflow/tfjs. Try --mock flag instead."
    );
    throw new Error("TensorFlow.js unavailable");
  }

  try {
    sharp = (await import("sharp")).default as unknown as typeof import("sharp");
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

      // Resize with sharp
      const resizedBuffer = await (sharp as unknown as (input: Buffer) => { resize: (w: number, h: number) => { raw: () => { toBuffer: () => Promise<Buffer> } } })(imageBuffer)
        .resize(INPUT_SIZE, INPUT_SIZE)
        .raw()
        .toBuffer();

      // Convert to Float32Array normalized to [-1, 1]
      const float32 = new Float32Array(INPUT_SIZE * INPUT_SIZE * 3);
      for (let i = 0; i < INPUT_SIZE * INPUT_SIZE; i++) {
        float32[i * 3] = resizedBuffer[i * 3] / 127.5 - 1;
        float32[i * 3 + 1] = resizedBuffer[i * 3 + 1] / 127.5 - 1;
        float32[i * 3 + 2] = resizedBuffer[i * 3 + 2] / 127.5 - 1;
      }

      // Run inference (manually manage tensors)
      const inputTensor = tf.tensor4d(float32, [
        1,
        INPUT_SIZE,
        INPUT_SIZE,
        3,
      ]);
      const rawOutput = model.predict(inputTensor);
      inputTensor.dispose();

      // model.predict returns Tensor | Tensor[] — unwrap if needed
      const outputTensor = (
        Array.isArray(rawOutput) ? rawOutput[0] : rawOutput
      ) as import("@tensorflow/tfjs").Tensor;

      const embeddingData = await outputTensor.data();
      outputTensor.dispose();

      entries.push({
        cardCode: card.cardId,
        embedding: Array.from(embeddingData),
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
    model: "mobilenet_v3_small_100_224",
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
    model: mock ? "mobilenet_v3_small_100_224_mock" : "mobilenet_v3_small_100_224",
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
