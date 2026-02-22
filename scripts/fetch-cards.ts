/**
 * Fetches card data from OPTCG API (https://www.optcgapi.com)
 * and writes JSON files to src/data/cards/
 *
 * Usage: npx tsx scripts/fetch-cards.ts
 */

import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CARDS_DIR = join(__dirname, "../src/data/cards");
const BASE_URL = "https://www.optcgapi.com/api";

// Target sets to fetch
const OP_SETS = [
  "OP-01",
  "OP-02",
  "OP-03",
  "OP-04",
  "OP-05",
  "OP-06",
  "OP-07",
  "OP-08",
  "OP-09",
];
const EB_SETS = ["EB-01"];
const ST_SETS = [
  "ST-01",
  "ST-02",
  "ST-03",
  "ST-04",
  "ST-05",
  "ST-06",
  "ST-07",
  "ST-08",
  "ST-09",
  "ST-10",
  "ST-11",
  "ST-12",
  "ST-13",
  "ST-14",
  "ST-15",
  "ST-16",
  "ST-17",
  "ST-18",
];

interface ApiCard {
  card_set_id: string;
  card_name: string;
  set_id: string;
  set_name: string;
  card_type: string;
  card_color: string;
  rarity: string;
  card_cost: string;
  card_power: string;
  counter_amount: number;
  attribute: string;
  card_text: string;
  sub_types: string;
  life: string | null;
  card_image: string;
  card_image_id: string;
}

interface OutputCard {
  cardId: string;
  name: string;
  type: string;
  color: string;
  cost: number | null;
  power: number | null;
  counter: number | null;
  attribute: string | null;
  effect: string | null;
  life: number | null;
  setCode: string;
  rarity: string;
  imageUrl: string | null;
}

interface SetInfo {
  code: string;
  name: string;
  releaseDate: string | null;
  cardCount: number;
}

function parseNullableString(val: string | null | undefined): string | null {
  if (!val || val === "NULL" || val === "null" || val.trim() === "") return null;
  return val;
}

function parseNullableNumber(val: string | null | undefined): number | null {
  if (!val || val === "NULL" || val === "null" || val.trim() === "") return null;
  const num = Number(val);
  return isNaN(num) ? null : num;
}

function normalizeSetCode(apiSetId: string): string {
  // "OP-01" → "OP01", "ST-02" → "ST02", "EB-01" → "EB01"
  return apiSetId.replace("-", "");
}

function transformCard(card: ApiCard): OutputCard {
  const type = card.card_type;
  const counter =
    type === "Character" && card.counter_amount > 0
      ? card.counter_amount
      : null;

  return {
    cardId: card.card_set_id,
    name: card.card_name,
    type,
    color: card.card_color,
    cost: parseNullableNumber(card.card_cost),
    power: parseNullableNumber(card.card_power),
    counter,
    attribute: parseNullableString(card.attribute),
    effect: parseNullableString(card.card_text),
    life: parseNullableNumber(card.life as string),
    setCode: normalizeSetCode(card.set_id),
    rarity: card.rarity,
    imageUrl: card.card_image ?? null,
  };
}

async function fetchWithRetry(
  url: string,
  retries = 3
): Promise<ApiCard[] | null> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.error(`  HTTP ${res.status} for ${url}`);
        if (res.status === 404) return null;
        await sleep(2000 * (i + 1));
        continue;
      }
      return (await res.json()) as ApiCard[];
    } catch (err) {
      console.error(`  Fetch error (attempt ${i + 1}): ${err}`);
      await sleep(2000 * (i + 1));
    }
  }
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchSet(
  setId: string,
  endpoint: "sets" | "decks"
): Promise<{ cards: OutputCard[]; setName: string } | null> {
  const url = `${BASE_URL}/${endpoint}/${setId}/`;
  console.log(`Fetching ${url}...`);

  const data = await fetchWithRetry(url);
  if (!data || data.length === 0) {
    console.error(`  No data returned for ${setId}`);
    return null;
  }

  const setName = data[0].set_name;

  // Deduplicate by card_set_id (API may include alt-art variants)
  const seen = new Set<string>();
  const uniqueCards: OutputCard[] = [];

  for (const card of data) {
    if (!seen.has(card.card_set_id)) {
      seen.add(card.card_set_id);
      uniqueCards.push(transformCard(card));
    }
  }

  // Sort by card ID
  uniqueCards.sort((a, b) => a.cardId.localeCompare(b.cardId));

  return { cards: uniqueCards, setName };
}

async function main(): Promise<void> {
  mkdirSync(CARDS_DIR, { recursive: true });

  const allSets: SetInfo[] = [];
  const allSetIds = [
    ...OP_SETS.map((id) => ({ id, endpoint: "sets" as const })),
    ...EB_SETS.map((id) => ({ id, endpoint: "sets" as const })),
    ...ST_SETS.map((id) => ({ id, endpoint: "decks" as const })),
  ];

  let totalCards = 0;

  for (const { id, endpoint } of allSetIds) {
    const result = await fetchSet(id, endpoint);
    if (!result) {
      console.error(`Skipping ${id} — no data`);
      continue;
    }

    const code = normalizeSetCode(id);
    const filePath = join(CARDS_DIR, `${code}.json`);
    writeFileSync(filePath, JSON.stringify(result.cards, null, 2) + "\n");
    console.log(
      `  Wrote ${code}.json — ${result.cards.length} cards (${result.setName})`
    );

    allSets.push({
      code,
      name: result.setName,
      releaseDate: null,
      cardCount: result.cards.length,
    });

    totalCards += result.cards.length;

    // Rate limiting — 500ms between requests
    await sleep(500);
  }

  // Sort sets by code
  allSets.sort((a, b) => a.code.localeCompare(b.code));

  // Write sets.json
  const setsPath = join(CARDS_DIR, "sets.json");
  writeFileSync(setsPath, JSON.stringify(allSets, null, 2) + "\n");
  console.log(`\nWrote sets.json — ${allSets.length} sets`);
  console.log(`Total: ${totalCards} cards across ${allSets.length} sets`);
}

main().catch((err) => {
  console.error("Fetch failed:", err);
  process.exit(1);
});
