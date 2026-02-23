import type { Metadata } from "next";
import SoloGameClient from "@/components/game/SoloGameClient";
import type { PlayerBoard } from "@/types/game";
import type { CardData } from "@/types/card";

export const metadata: Metadata = {
  title: "Solo Test — OP SpellTable",
  description:
    "Test the game board, camera, and card recognition in solo mode.",
};

function makeMockLeader(cardId: string, name: string): CardData {
  return {
    id: `mock-${cardId}`,
    cardId,
    name,
    type: "Leader",
    color: "Red",
    cost: null,
    power: 5000,
    counter: null,
    attribute: "Strike",
    effect: "When you play this card, draw 1 card.",
    life: 5,
    setCode: "OP01",
    rarity: "L",
    imageUrl: null,
  };
}

function makeMockCharacter(
  cardId: string,
  name: string,
  cost: number
): CardData {
  return {
    id: `mock-${cardId}`,
    cardId,
    name,
    type: "Character",
    color: "Red",
    cost,
    power: cost * 1000,
    counter: 1000,
    attribute: "Strike",
    effect: null,
    life: null,
    setCode: "OP01",
    rarity: "C",
    imageUrl: null,
  };
}

function makeMockStage(cardId: string, name: string): CardData {
  return {
    id: `mock-${cardId}`,
    cardId,
    name,
    type: "Stage",
    color: "Red",
    cost: 1,
    power: null,
    counter: null,
    attribute: null,
    effect: "Your Characters gain +1000 power.",
    life: null,
    setCode: "OP01",
    rarity: "UC",
    imageUrl: null,
  };
}

function createMockBoard(): PlayerBoard {
  return {
    leader: makeMockLeader("OP01-001", "Monkey D. Luffy"),
    characters: [
      makeMockCharacter("OP01-016", "Roronoa Zoro", 3),
      makeMockCharacter("OP01-022", "Nami", 2),
      makeMockCharacter("OP01-025", "Usopp", 2),
    ],
    stage: makeMockStage("OP01-116", "Thousand Sunny"),
    donDeck: 10,
    costArea: { active: 0, rested: 0 },
    life: 5,
    trash: [],
    deck: 35,
    hand: 5,
  };
}

export default function SoloGamePage() {
  const localBoard = createMockBoard();

  const opponentBoard: PlayerBoard = {
    ...createMockBoard(),
    leader: makeMockLeader("OP01-002", "Portgas D. Ace"),
    characters: [
      makeMockCharacter("OP01-030", "Shanks", 5),
      makeMockCharacter("OP01-035", "Marco", 4),
    ],
    donDeck: 6,
    costArea: { active: 4, rested: 0 },
    life: 3,
    deck: 28,
    hand: 4,
  };

  return (
    <main className="min-h-dvh bg-gray-950">
      <SoloGameClient
        initialLocalBoard={localBoard}
        opponentBoard={opponentBoard}
      />
    </main>
  );
}
