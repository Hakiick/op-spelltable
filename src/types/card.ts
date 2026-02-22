export type CardColor =
  | "Red"
  | "Green"
  | "Blue"
  | "Purple"
  | "Black"
  | "Yellow";

export type CardType = "Leader" | "Character" | "Event" | "Stage" | "DON!!";

export type CardRarity = "C" | "UC" | "R" | "SR" | "SEC" | "L" | "SP";

export type CardAttribute =
  | "Strike"
  | "Slash"
  | "Special"
  | "Ranged"
  | "Wisdom";

export interface CardSetData {
  id: string;
  code: string;
  name: string;
  releaseDate: string | null;
  cardCount: number;
}

export interface CardData {
  id: string;
  cardId: string; // e.g. "OP01-001"
  name: string;
  type: CardType;
  color: CardColor;
  cost: number | null;
  power: number | null;
  counter: number | null;
  attribute: CardAttribute | null;
  effect: string | null;
  life: number | null;
  setCode: string; // e.g. "OP01"
  rarity: CardRarity;
  imageUrl: string | null;
  set?: CardSetData;
}

export interface CardSummary {
  id: string;
  cardId: string;
  name: string;
  type: CardType;
  color: CardColor;
  cost: number | null;
  power: number | null;
  rarity: CardRarity;
  imageUrl: string | null;
  setCode: string;
}
