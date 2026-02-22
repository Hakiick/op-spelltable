import { PrismaClient } from "../src/generated/prisma";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const VALID_TYPES = new Set(["Leader", "Character", "Event", "Stage", "DON!!"]);
const VALID_SINGLE_COLORS = new Set([
  "Red",
  "Green",
  "Blue",
  "Purple",
  "Black",
  "Yellow",
]);
const VALID_RARITIES = new Set([
  "C",
  "UC",
  "R",
  "SR",
  "SEC",
  "L",
  "SP",
  "PR",
  "TR",
]);

interface RawCardSet {
  code: string;
  name: string;
  releaseDate: string | null;
  cardCount: number;
}

interface RawCard {
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

function validateCard(card: RawCard, index: number): string[] {
  const errors: string[] = [];
  if (!VALID_TYPES.has(card.type)) {
    errors.push(
      `Card[${index}] ${card.cardId}: invalid type "${card.type}". Valid: ${[...VALID_TYPES].join(", ")}`
    );
  }
  const colorParts = card.color.split(" ");
  const invalidColors = colorParts.filter((c) => !VALID_SINGLE_COLORS.has(c));
  if (invalidColors.length > 0) {
    errors.push(
      `Card[${index}] ${card.cardId}: invalid color(s) "${invalidColors.join(", ")}". Valid: ${[...VALID_SINGLE_COLORS].join(", ")}`
    );
  }
  if (!VALID_RARITIES.has(card.rarity)) {
    errors.push(
      `Card[${index}] ${card.cardId}: invalid rarity "${card.rarity}". Valid: ${[...VALID_RARITIES].join(", ")}`
    );
  }
  return errors;
}

async function main(): Promise<void> {
  const adapter = new PrismaBetterSqlite3({ url: "file:./prisma/dev.db" });
  const prisma = new PrismaClient({ adapter });

  try {
    const cardsDir = join(__dirname, "../src/data/cards");

    // 1. Seed CardSets
    const setsPath = join(cardsDir, "sets.json");
    const setsRaw: RawCardSet[] = JSON.parse(readFileSync(setsPath, "utf-8"));

    console.log(`Seeding ${setsRaw.length} card sets...`);
    for (const s of setsRaw) {
      await prisma.cardSet.upsert({
        where: { code: s.code },
        update: {
          name: s.name,
          releaseDate: s.releaseDate ? new Date(s.releaseDate) : null,
          cardCount: s.cardCount,
        },
        create: {
          code: s.code,
          name: s.name,
          releaseDate: s.releaseDate ? new Date(s.releaseDate) : null,
          cardCount: s.cardCount,
        },
      });
      console.log(`  Set upserted: ${s.code} — ${s.name}`);
    }

    // 2. Seed Cards from all non-sets JSON files
    const files = readdirSync(cardsDir).filter(
      (f) => f.endsWith(".json") && f !== "sets.json"
    );

    for (const file of files) {
      const setCode = file.replace(".json", "");
      const filePath = join(cardsDir, file);
      const cards: RawCard[] = JSON.parse(readFileSync(filePath, "utf-8"));

      console.log(`\nProcessing ${file} (${cards.length} cards)...`);

      // Validate all cards first
      const allErrors: string[] = [];
      cards.forEach((card, idx) => {
        const errors = validateCard(card, idx);
        allErrors.push(...errors);
      });

      if (allErrors.length > 0) {
        console.error(`Validation errors in ${file}:`);
        allErrors.forEach((e) => console.error(`  - ${e}`));
        console.error(`Skipping ${file} due to validation errors.`);
        continue;
      }

      let upsertedCount = 0;
      for (const card of cards) {
        await prisma.card.upsert({
          where: { cardId: card.cardId },
          update: {
            name: card.name,
            type: card.type,
            color: card.color,
            cost: card.cost,
            power: card.power,
            counter: card.counter,
            attribute: card.attribute,
            effect: card.effect,
            life: card.life,
            setCode: card.setCode,
            rarity: card.rarity,
            imageUrl: card.imageUrl,
          },
          create: {
            cardId: card.cardId,
            name: card.name,
            type: card.type,
            color: card.color,
            cost: card.cost,
            power: card.power,
            counter: card.counter,
            attribute: card.attribute,
            effect: card.effect,
            life: card.life,
            setCode: card.setCode,
            rarity: card.rarity,
            imageUrl: card.imageUrl,
          },
        });
        upsertedCount++;
      }

      console.log(
        `  Set ${setCode}: ${upsertedCount} cards upserted successfully.`
      );
    }

    console.log("\nSeed completed successfully!");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
