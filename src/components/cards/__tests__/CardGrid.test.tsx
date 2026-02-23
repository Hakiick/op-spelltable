import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import CardGrid from "@/components/cards/CardGrid";
import CardItem from "@/components/cards/CardItem";
import type { CardSummary } from "@/types/card";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

const makeCard = (overrides: Partial<CardSummary> = {}): CardSummary => ({
  id: "test-id-1",
  cardId: "OP01-001",
  name: "Monkey D. Luffy",
  type: "Leader",
  color: "Red",
  cost: 5,
  power: 5000,
  rarity: "L",
  imageUrl: null,
  setCode: "OP01",
  ...overrides,
});

describe("CardGrid", () => {
  it("renders a list of cards", () => {
    const cards: CardSummary[] = [
      makeCard({ id: "1", cardId: "OP01-001", name: "Monkey D. Luffy" }),
      makeCard({
        id: "2",
        cardId: "OP01-002",
        name: "Roronoa Zoro",
        type: "Character",
        color: "Green",
      }),
      makeCard({
        id: "3",
        cardId: "OP01-003",
        name: "Nami",
        type: "Character",
        color: "Blue",
      }),
    ];

    render(<CardGrid cards={cards} />);

    expect(screen.getByText("Monkey D. Luffy")).toBeInTheDocument();
    expect(screen.getByText("Roronoa Zoro")).toBeInTheDocument();
    expect(screen.getByText("Nami")).toBeInTheDocument();
  });

  it("renders empty state when cards array is empty", () => {
    render(<CardGrid cards={[]} />);

    expect(screen.getByText("No cards found")).toBeInTheDocument();
    expect(
      screen.getByText("Try adjusting your filters or search query.")
    ).toBeInTheDocument();
  });

  it("renders the correct number of card items", () => {
    const cards: CardSummary[] = [
      makeCard({ id: "1", cardId: "OP01-001", name: "Card One" }),
      makeCard({ id: "2", cardId: "OP01-002", name: "Card Two" }),
    ];

    render(<CardGrid cards={cards} />);

    expect(screen.getAllByRole("link")).toHaveLength(2);
  });
});

describe("CardItem", () => {
  it("renders the card name", () => {
    const card = makeCard({ name: "Monkey D. Luffy" });
    render(<CardItem card={card} />);

    expect(screen.getByText("Monkey D. Luffy")).toBeInTheDocument();
  });

  it("renders the card code (cardId)", () => {
    const card = makeCard({ cardId: "OP01-001" });
    render(<CardItem card={card} />);

    expect(screen.getByText("OP01-001")).toBeInTheDocument();
  });

  it("renders color and type badges", () => {
    const card = makeCard({ color: "Red", type: "Leader" });
    render(<CardItem card={card} />);

    expect(screen.getByText("Red")).toBeInTheDocument();
    expect(screen.getByText("Leader")).toBeInTheDocument();
  });

  it("renders the rarity badge", () => {
    const card = makeCard({ rarity: "SR" });
    render(<CardItem card={card} />);

    expect(screen.getByText("SR")).toBeInTheDocument();
  });

  it("renders cost when present", () => {
    const card = makeCard({ cost: 4 });
    render(<CardItem card={card} />);

    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("renders power when present", () => {
    const card = makeCard({ power: 6000 });
    render(<CardItem card={card} />);

    expect(screen.getByText("6000")).toBeInTheDocument();
  });

  it("links to the correct card detail URL", () => {
    const card = makeCard({ cardId: "OP01-001" });
    render(<CardItem card={card} />);

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/cards/OP01-001");
  });

  it("does not render cost when null", () => {
    const card = makeCard({ cost: null });
    render(<CardItem card={card} />);

    expect(screen.queryByText(/Cost:/)).not.toBeInTheDocument();
  });

  it("does not render power when null", () => {
    const card = makeCard({ power: null });
    render(<CardItem card={card} />);

    expect(screen.queryByText(/Power:/)).not.toBeInTheDocument();
  });
});
