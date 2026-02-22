import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import GameBoard from "@/components/game/GameBoard";
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
    leader: makeCard({ name: "Luffy", type: "Leader", life: 5 }),
    characters: [makeCard({ id: "c1", name: "Zoro" })],
    stage: null,
    donDeck: 4,
    costArea: { active: 6, rested: 2 },
    life: 5,
    trash: [],
    deck: 40,
    hand: 5,
    ...overrides,
  };
}

describe("GameBoard", () => {
  it("renders the game board container", () => {
    render(
      <GameBoard
        localBoard={makeMockBoard()}
        opponentBoard={makeMockBoard()}
      />
    );
    expect(screen.getByTestId("game-board")).toBeInTheDocument();
  });

  it("renders both local and opponent player areas", () => {
    render(
      <GameBoard
        localBoard={makeMockBoard()}
        opponentBoard={makeMockBoard()}
      />
    );
    expect(screen.getByTestId("local-area")).toBeInTheDocument();
    expect(screen.getByTestId("opponent-area")).toBeInTheDocument();
  });

  it("renders the phase indicator", () => {
    render(
      <GameBoard
        localBoard={makeMockBoard()}
        opponentBoard={makeMockBoard()}
        gamePhase="main"
        turnNumber={3}
      />
    );
    expect(screen.getByTestId("phase-indicator")).toBeInTheDocument();
    expect(screen.getByText("Turn 3")).toBeInTheDocument();
    expect(screen.getByText("Main Phase")).toBeInTheDocument();
  });

  it("renders each GamePhase correctly", () => {
    const phases = ["refresh", "draw", "don", "main", "end"] as const;
    const labels = ["Refresh Phase", "Draw Phase", "DON!! Phase", "Main Phase", "End Phase"];

    phases.forEach((phase, i) => {
      const { unmount } = render(
        <GameBoard
          localBoard={makeMockBoard()}
          opponentBoard={makeMockBoard()}
          gamePhase={phase}
        />
      );
      expect(screen.getByText(labels[i])).toBeInTheDocument();
      unmount();
    });
  });

  it("shows 'Your turn' badge when isLocalTurn=true", () => {
    render(
      <GameBoard
        localBoard={makeMockBoard()}
        opponentBoard={makeMockBoard()}
        isLocalTurn={true}
      />
    );
    expect(screen.getByText("Your turn")).toBeInTheDocument();
  });

  it("does not show 'Your turn' badge when isLocalTurn=false", () => {
    render(
      <GameBoard
        localBoard={makeMockBoard()}
        opponentBoard={makeMockBoard()}
        isLocalTurn={false}
      />
    );
    expect(screen.queryByText("Your turn")).not.toBeInTheDocument();
  });

  it("renders local player name", () => {
    render(
      <GameBoard
        localBoard={makeMockBoard()}
        opponentBoard={makeMockBoard()}
        localPlayerName="MaxPlayer"
        opponentPlayerName="RivalPlayer"
      />
    );
    expect(screen.getByText("You: MaxPlayer")).toBeInTheDocument();
    expect(screen.getByText("Opponent: RivalPlayer")).toBeInTheDocument();
  });

  it("uses default values when optional props are omitted", () => {
    render(
      <GameBoard
        localBoard={makeMockBoard()}
        opponentBoard={makeMockBoard()}
      />
    );
    // Default: turn 1
    expect(screen.getByText("Turn 1")).toBeInTheDocument();
    // Default phase: main
    expect(screen.getByText("Main Phase")).toBeInTheDocument();
  });

  it("renders all seven zone labels (twice — one per player)", () => {
    render(
      <GameBoard
        localBoard={makeMockBoard()}
        opponentBoard={makeMockBoard()}
      />
    );
    // Each PlayerArea renders: Leader, Characters, Stage, DON!!, Life, Deck, Trash
    const leaderLabels = screen.getAllByText("Leader");
    expect(leaderLabels).toHaveLength(2);

    const deckLabels = screen.getAllByText("Deck");
    expect(deckLabels).toHaveLength(2);
  });

  it("has aria-label for phase indicator", () => {
    render(
      <GameBoard
        localBoard={makeMockBoard()}
        opponentBoard={makeMockBoard()}
        gamePhase="draw"
        turnNumber={2}
      />
    );
    expect(
      screen.getByLabelText("Turn 2, Draw phase")
    ).toBeInTheDocument();
  });
});
