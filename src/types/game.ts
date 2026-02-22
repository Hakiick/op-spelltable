import type { CardData } from "./card";

export type GamePhase =
  | "refresh"
  | "draw"
  | "don"
  | "main"
  | "end";

export type GameStatus = "waiting" | "playing" | "finished";

export interface GameZone {
  cards: CardData[];
}

export interface PlayerBoard {
  leader: CardData | null;
  characters: CardData[]; // max 5
  stage: CardData | null;
  donDeck: number; // remaining DON!! cards in deck
  costArea: { active: number; rested: number };
  life: number; // face-down cards count
  trash: CardData[];
  deck: number; // remaining cards in main deck
  hand: number; // opponent only sees count
}

export interface GameState {
  id: string;
  status: GameStatus;
  currentPhase: GamePhase;
  turnPlayer: string; // playerId
  turnNumber: number;
  players: [string, string]; // [player1Id, player2Id]
  boards: Record<string, PlayerBoard>;
  createdAt: string;
  updatedAt: string;
}
