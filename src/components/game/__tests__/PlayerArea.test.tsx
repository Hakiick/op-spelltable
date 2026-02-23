import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import PlayerArea from "@/components/game/PlayerArea";
import type { PlayerBoard } from "@/types/game";
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

function makeMockBoard(overrides: Partial<PlayerBoard> = {}): PlayerBoard {
  return {
    leader: makeCard({ name: "Monkey D. Luffy", type: "Leader", life: 5 }),
    characters: [
      makeCard({ id: "c1", name: "Roronoa Zoro" }),
      makeCard({ id: "c2", name: "Nami" }),
    ],
    stage: makeCard({ id: "s1", name: "Thousand Sunny", type: "Stage" }),
    donDeck: 4,
    costArea: { active: 6, rested: 2 },
    life: 4,
    trash: [],
    deck: 35,
    hand: 5,
    ...overrides,
  };
}

describe("PlayerArea — local player", () => {
  it("renders the player area with testid", () => {
    render(<PlayerArea board={makeMockBoard()} isOpponent={false} />);
    expect(screen.getByTestId("local-area")).toBeInTheDocument();
  });

  it("renders player name when provided", () => {
    render(
      <PlayerArea
        board={makeMockBoard()}
        isOpponent={false}
        playerName="Player One"
      />
    );
    expect(screen.getByText("You: Player One")).toBeInTheDocument();
  });

  it("renders all zone labels", () => {
    render(<PlayerArea board={makeMockBoard()} isOpponent={false} />);
    expect(screen.getByText("Leader")).toBeInTheDocument();
    expect(screen.getByText("Characters")).toBeInTheDocument();
    expect(screen.getByText("Stage")).toBeInTheDocument();
    expect(screen.getByText("DON!!")).toBeInTheDocument();
    expect(screen.getByText("Life")).toBeInTheDocument();
    expect(screen.getByText("Deck")).toBeInTheDocument();
    expect(screen.getByText("Trash")).toBeInTheDocument();
  });

  it("shows hand count for local player", () => {
    render(
      <PlayerArea board={makeMockBoard({ hand: 7 })} isOpponent={false} />
    );
    expect(screen.getByLabelText("Hand: 7 cards")).toBeInTheDocument();
  });

  it("renders leader card name", () => {
    const board = makeMockBoard();
    render(<PlayerArea board={board} isOpponent={false} />);
    expect(screen.getByText("Monkey D. Luffy")).toBeInTheDocument();
  });

  it("renders character cards", () => {
    const board = makeMockBoard();
    render(<PlayerArea board={board} isOpponent={false} />);
    expect(screen.getByLabelText("Roronoa Zoro")).toBeInTheDocument();
    expect(screen.getByLabelText("Nami")).toBeInTheDocument();
  });

  it("renders stage card", () => {
    const board = makeMockBoard();
    render(<PlayerArea board={board} isOpponent={false} />);
    expect(screen.getByLabelText("Thousand Sunny")).toBeInTheDocument();
  });

  it("renders DON!! counts", () => {
    render(
      <PlayerArea
        board={makeMockBoard({ costArea: { active: 6, rested: 2 } })}
        isOpponent={false}
      />
    );
    expect(
      screen.getByLabelText("DON!! Active: 6, Rested: 2")
    ).toBeInTheDocument();
  });

  it("renders deck count", () => {
    render(
      <PlayerArea board={makeMockBoard({ deck: 35 })} isOpponent={false} />
    );
    expect(screen.getByLabelText("Deck: 35 cards")).toBeInTheDocument();
  });

  it("renders life count", () => {
    render(
      <PlayerArea board={makeMockBoard({ life: 4 })} isOpponent={false} />
    );
    expect(screen.getByLabelText("Life: 4 cards")).toBeInTheDocument();
  });
});

describe("PlayerArea — opponent", () => {
  it("renders the opponent area with testid", () => {
    render(<PlayerArea board={makeMockBoard()} isOpponent={true} />);
    expect(screen.getByTestId("opponent-area")).toBeInTheDocument();
  });

  it("renders opponent name when provided", () => {
    render(
      <PlayerArea
        board={makeMockBoard()}
        isOpponent={true}
        playerName="Rival"
      />
    );
    expect(screen.getByText("Opponent: Rival")).toBeInTheDocument();
  });

  it("renders all zone labels for opponent", () => {
    render(<PlayerArea board={makeMockBoard()} isOpponent={true} />);
    expect(screen.getByText("Leader")).toBeInTheDocument();
    expect(screen.getByText("Characters")).toBeInTheDocument();
    expect(screen.getByText("Stage")).toBeInTheDocument();
    expect(screen.getByText("DON!!")).toBeInTheDocument();
    expect(screen.getByText("Life")).toBeInTheDocument();
    expect(screen.getByText("Deck")).toBeInTheDocument();
    expect(screen.getByText("Trash")).toBeInTheDocument();
  });

  it("shows opponent hand count", () => {
    render(<PlayerArea board={makeMockBoard({ hand: 4 })} isOpponent={true} />);
    expect(screen.getByLabelText("Opponent hand: 4 cards")).toBeInTheDocument();
  });
});

describe("PlayerArea — null slots", () => {
  it("handles null leader gracefully", () => {
    const board = makeMockBoard({ leader: null });
    render(<PlayerArea board={board} isOpponent={false} />);
    // No error thrown; zone is still rendered
    expect(screen.getByText("Leader")).toBeInTheDocument();
  });

  it("handles null stage gracefully", () => {
    const board = makeMockBoard({ stage: null });
    render(<PlayerArea board={board} isOpponent={false} />);
    expect(screen.getByText("Stage")).toBeInTheDocument();
  });

  it("handles empty characters array", () => {
    const board = makeMockBoard({ characters: [] });
    render(<PlayerArea board={board} isOpponent={false} />);
    expect(screen.getByText("Characters")).toBeInTheDocument();
    // All 5 slots are empty
    expect(screen.getAllByLabelText("Empty card slot")).toHaveLength(5);
  });
});
