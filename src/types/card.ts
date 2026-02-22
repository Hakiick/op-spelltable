export type CardColor =
  | "Red"
  | "Green"
  | "Blue"
  | "Purple"
  | "Black"
  | "Yellow";

export type CardType = "Leader" | "Character" | "Event" | "Stage" | "DON!!";

export type CardRarity = "C" | "UC" | "R" | "SR" | "SEC" | "L" | "SP";

export interface CardData {
  id: string;
  cardId: string; // e.g. "OP01-001"
  name: string;
  type: CardType;
  color: CardColor;
  cost: number | null;
  power: number | null;
  counter: number | null;
  attribute: string | null;
  effect: string | null;
  set: string; // e.g. "OP01"
  rarity: CardRarity;
  imageUrl: string | null;
}
