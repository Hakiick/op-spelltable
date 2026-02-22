import { notFound } from "next/navigation";
import type { Metadata } from "next";
import GameClient from "@/components/game/GameClient";
import { getRoomById } from "@/lib/database/rooms";
import type { PlayerBoard } from "@/types/game";
import type { CardData } from "@/types/card";

interface GamePageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata(_props: GamePageProps): Promise<Metadata> {
  return {
    title: "Game — OP SpellTable",
    description: "One Piece TCG remote play game session.",
  };
}

/** Creates a mock leader card for demonstration purposes */
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

/** Creates a mock character card for demonstration purposes */
function makeMockCharacter(cardId: string, name: string, cost: number): CardData {
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

/** Creates a mock stage card for demonstration purposes */
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

/** Returns a realistic mock player board for testing/demo purposes */
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

export default async function GamePage({ params }: GamePageProps) {
  const { id } = await params;

  // Fetch room by ID to verify it exists and get the roomCode
  const room = await getRoomById(id);
  if (!room) {
    notFound();
  }

  const initialLocalBoard = createMockBoard();

  // Opponent board — static, not interactive from this client
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
    <main className="min-h-screen bg-gray-950">
      {/* Game session debug info — only in dev */}
      <div className="sr-only" aria-hidden="true">
        Game session: {id}
      </div>

      <GameClient
        initialLocalBoard={initialLocalBoard}
        opponentBoard={opponentBoard}
        localPlayerName="You"
        opponentPlayerName="Opponent"
        sessionId={id}
        roomCode={room.roomCode}
      />
    </main>
  );
}
