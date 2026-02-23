import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import CardDetailOverlay from "@/components/game/CardDetailOverlay";
import type { CardData } from "@/types/card";

function makeCardData(overrides: Partial<CardData> = {}): CardData {
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
    effect: "Rush (This card can attack on the turn it is played.)",
    life: null,
    setCode: "OP01",
    rarity: "C",
    imageUrl: null,
    ...overrides,
  };
}

describe("CardDetailOverlay", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders nothing when cardCode is null", () => {
    const onClose = vi.fn();
    const { container } = render(
      <CardDetailOverlay cardCode={null} onClose={onClose} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows a loading state when cardCode is provided", async () => {
    // Never resolves, so loading stays true
    vi.mocked(fetch).mockReturnValueOnce(new Promise(() => {}));

    render(<CardDetailOverlay cardCode="OP01-001" onClose={vi.fn()} />);

    expect(screen.getByLabelText("Loading card details")).toBeInTheDocument();
  });

  it("displays card data after successful fetch", async () => {
    const card = makeCardData();
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: card }), { status: 200 })
    );

    render(<CardDetailOverlay cardCode="OP01-001" onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Monkey D. Luffy")).toBeInTheDocument();
    });

    expect(screen.getByText("OP01-001")).toBeInTheDocument();
    expect(screen.getByText("Character")).toBeInTheDocument();
    expect(screen.getByText("Red")).toBeInTheDocument();
    expect(screen.getByText("C")).toBeInTheDocument();
    expect(
      screen.getByText("Rush (This card can attack on the turn it is played.)")
    ).toBeInTheDocument();
  });

  it("displays stats for the card", async () => {
    const card = makeCardData({ cost: 5, power: 6000, counter: 1000 });
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: card }), { status: 200 })
    );

    render(<CardDetailOverlay cardCode="OP01-001" onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Monkey D. Luffy")).toBeInTheDocument();
    });

    // Stat labels should all be visible
    expect(screen.getByText("Cost")).toBeInTheDocument();
    expect(screen.getByText("Power")).toBeInTheDocument();
    expect(screen.getByText("Counter")).toBeInTheDocument();
    // Cost value (exact)
    expect(screen.getByText("5")).toBeInTheDocument();
    // Power and counter values are locale-formatted (e.g. "6,000" or "6000")
    // — check the body text contains the numeric values
    const bodyText = document.body.textContent ?? "";
    expect(bodyText).toMatch(/6.?000/);
  });

  it("displays life stat for Leader cards", async () => {
    const card = makeCardData({ type: "Leader", life: 4, cost: null });
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: card }), { status: 200 })
    );

    render(<CardDetailOverlay cardCode="OP01-001" onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Monkey D. Luffy")).toBeInTheDocument();
    });

    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("Life")).toBeInTheDocument();
  });

  it("shows error message when fetch fails", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Card not found" }), { status: 404 })
    );

    render(<CardDetailOverlay cardCode="BAD-001" onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Card not found.")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("calls onClose when Escape key is pressed", async () => {
    vi.mocked(fetch).mockReturnValueOnce(new Promise(() => {}));

    const onClose = vi.fn();
    render(<CardDetailOverlay cardCode="OP01-001" onClose={onClose} />);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when backdrop is clicked", () => {
    vi.mocked(fetch).mockReturnValueOnce(new Promise(() => {}));

    const onClose = vi.fn();
    render(<CardDetailOverlay cardCode="OP01-001" onClose={onClose} />);

    // The backdrop is the outer fixed div — click it directly
    const backdrop = screen.getByRole("dialog").parentElement!;
    fireEvent.click(backdrop);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not call onClose when dialog content is clicked", () => {
    vi.mocked(fetch).mockReturnValueOnce(new Promise(() => {}));

    const onClose = vi.fn();
    render(<CardDetailOverlay cardCode="OP01-001" onClose={onClose} />);

    const dialog = screen.getByRole("dialog");
    fireEvent.click(dialog);

    expect(onClose).not.toHaveBeenCalled();
  });

  it("calls onClose when the close button is clicked", () => {
    vi.mocked(fetch).mockReturnValueOnce(new Promise(() => {}));

    const onClose = vi.fn();
    render(<CardDetailOverlay cardCode="OP01-001" onClose={onClose} />);

    const closeButton = screen.getByRole("button", {
      name: "Close card detail",
    });
    fireEvent.click(closeButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("has correct aria attributes", () => {
    vi.mocked(fetch).mockReturnValueOnce(new Promise(() => {}));

    render(<CardDetailOverlay cardCode="OP01-001" onClose={vi.fn()} />);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "card-detail-title");
  });

  it("does not add Escape listener when cardCode is null", () => {
    const onClose = vi.fn();
    render(<CardDetailOverlay cardCode={null} onClose={onClose} />);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).not.toHaveBeenCalled();
  });
});
