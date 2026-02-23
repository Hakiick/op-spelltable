import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import CardZone from "@/components/game/CardZone";
import type { CardData } from "@/types/card";

function makeCard(overrides: Partial<CardData> = {}): CardData {
  return {
    id: "mock-id",
    cardId: "OP01-001",
    name: "Monkey D. Luffy",
    type: "Character",
    color: "Red",
    cost: 3,
    power: 3000,
    counter: 1000,
    attribute: "Strike",
    effect: null,
    life: null,
    setCode: "OP01",
    rarity: "C",
    imageUrl: null,
    ...overrides,
  };
}

describe("CardZone — variant: leader", () => {
  it("renders the label", () => {
    render(<CardZone variant="leader" label="Leader" />);
    expect(screen.getByText("Leader")).toBeInTheDocument();
  });

  it("renders a placeholder when no card is provided", () => {
    render(<CardZone variant="leader" label="Leader" cards={[]} />);
    expect(screen.getByText("Leader")).toBeInTheDocument();
  });

  it("renders the leader card name when a card is provided", () => {
    const leader = makeCard({ name: "Monkey D. Luffy", type: "Leader" });
    render(<CardZone variant="leader" label="Leader" cards={[leader]} />);
    expect(screen.getByText("Monkey D. Luffy")).toBeInTheDocument();
  });
});

describe("CardZone — variant: characters", () => {
  it("renders the label", () => {
    render(<CardZone variant="characters" label="Characters" />);
    expect(screen.getByText("Characters")).toBeInTheDocument();
  });

  it("renders 5 card slots", () => {
    render(<CardZone variant="characters" label="Characters" cards={[]} />);
    const emptySlots = screen.getAllByLabelText("Empty card slot");
    expect(emptySlots).toHaveLength(5);
  });

  it("renders filled cards and empty slots to total 5", () => {
    const cards = [
      makeCard({ id: "1", name: "Zoro" }),
      makeCard({ id: "2", name: "Nami" }),
    ];
    render(<CardZone variant="characters" label="Characters" cards={cards} />);
    // 2 filled + 3 empty
    expect(screen.getByLabelText("Zoro")).toBeInTheDocument();
    expect(screen.getByLabelText("Nami")).toBeInTheDocument();
    expect(screen.getAllByLabelText("Empty card slot")).toHaveLength(3);
  });

  it("renders a character area list", () => {
    render(<CardZone variant="characters" label="Characters" cards={[]} />);
    expect(
      screen.getByRole("list", { name: "Character area" })
    ).toBeInTheDocument();
  });
});

describe("CardZone — variant: stage", () => {
  it("renders the label", () => {
    render(<CardZone variant="stage" label="Stage" />);
    expect(screen.getByText("Stage")).toBeInTheDocument();
  });

  it("renders an empty slot when no stage card", () => {
    render(<CardZone variant="stage" label="Stage" cards={[]} />);
    expect(screen.getByLabelText("Empty card slot")).toBeInTheDocument();
  });

  it("renders the stage card name when provided", () => {
    const stage = makeCard({ name: "Thousand Sunny", type: "Stage" });
    render(<CardZone variant="stage" label="Stage" cards={[stage]} />);
    expect(screen.getByLabelText("Thousand Sunny")).toBeInTheDocument();
  });
});

describe("CardZone — variant: don", () => {
  it("renders the label", () => {
    render(<CardZone variant="don" label="DON!!" />);
    expect(screen.getByText("DON!!")).toBeInTheDocument();
  });

  it("displays active and rested counts", () => {
    render(
      <CardZone variant="don" label="DON!!" activeCount={6} restedCount={2} />
    );
    expect(
      screen.getByLabelText("DON!! Active: 6, Rested: 2")
    ).toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("displays zero counts by default", () => {
    render(<CardZone variant="don" label="DON!!" />);
    const zeros = screen.getAllByText("0");
    expect(zeros.length).toBeGreaterThanOrEqual(2);
  });
});

describe("CardZone — variant: life", () => {
  it("renders the label", () => {
    render(<CardZone variant="life" label="Life" />);
    expect(screen.getByText("Life")).toBeInTheDocument();
  });

  it("displays the life count", () => {
    render(<CardZone variant="life" label="Life" life={4} />);
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByLabelText("Life: 4 cards")).toBeInTheDocument();
  });
});

describe("CardZone — variant: deck", () => {
  it("renders the label", () => {
    render(<CardZone variant="deck" label="Deck" />);
    expect(screen.getByText("Deck")).toBeInTheDocument();
  });

  it("displays the deck count", () => {
    render(<CardZone variant="deck" label="Deck" count={35} />);
    expect(screen.getByText("35")).toBeInTheDocument();
    expect(screen.getByLabelText("Deck: 35 cards")).toBeInTheDocument();
  });
});

describe("CardZone — variant: trash", () => {
  it("renders the label", () => {
    render(<CardZone variant="trash" label="Trash" />);
    expect(screen.getByText("Trash")).toBeInTheDocument();
  });

  it("displays count from cards array", () => {
    const cards = [makeCard({ id: "1" }), makeCard({ id: "2" })];
    render(<CardZone variant="trash" label="Trash" cards={cards} />);
    expect(screen.getByLabelText("Trash: 2 cards")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("displays count prop when cards is empty", () => {
    render(<CardZone variant="trash" label="Trash" cards={[]} count={0} />);
    expect(screen.getByLabelText("Trash: 0 cards")).toBeInTheDocument();
  });
});

describe("CardZone — data-variant attribute", () => {
  it("sets data-variant on the root element", () => {
    const { container } = render(<CardZone variant="leader" label="Leader" />);
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute("data-variant")).toBe("leader");
  });
});
