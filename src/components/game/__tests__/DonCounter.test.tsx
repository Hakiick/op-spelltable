import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import DonCounter from "@/components/game/DonCounter";

describe("DonCounter — rendering", () => {
  it("renders the DON!! label", () => {
    render(<DonCounter active={3} rested={2} deckRemaining={5} />);
    expect(screen.getByTestId("don-counter")).toBeInTheDocument();
  });

  it("displays the correct active count", () => {
    render(<DonCounter active={4} rested={1} deckRemaining={5} />);
    expect(screen.getByTestId("don-active-count")).toHaveTextContent("4");
  });

  it("displays the correct rested count", () => {
    render(<DonCounter active={4} rested={3} deckRemaining={3} />);
    expect(screen.getByTestId("don-rested-count")).toHaveTextContent("3");
  });

  it("displays the correct deck remaining count", () => {
    render(<DonCounter active={4} rested={3} deckRemaining={3} />);
    expect(screen.getByTestId("don-deck-count")).toHaveTextContent("3");
  });

  it("displays X/10 total indicator", () => {
    render(<DonCounter active={3} rested={2} deckRemaining={5} />);
    expect(screen.getByText("10/10")).toBeInTheDocument();
  });

  it("does not render interactive buttons when isInteractive=false", () => {
    render(
      <DonCounter
        active={3}
        rested={2}
        deckRemaining={5}
        isInteractive={false}
      />
    );
    expect(
      screen.queryByLabelText("Activate DON!! from deck")
    ).not.toBeInTheDocument();
  });

  it("renders interactive buttons when isInteractive=true", () => {
    render(
      <DonCounter
        active={3}
        rested={2}
        deckRemaining={5}
        isInteractive={true}
        onActivate={() => undefined}
        onRest={() => undefined}
        onUnrest={() => undefined}
      />
    );
    expect(
      screen.getByLabelText("Activate DON!! from deck")
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Rest active DON!!")).toBeInTheDocument();
    expect(screen.getByLabelText("Unrest a rested DON!!")).toBeInTheDocument();
  });
});

describe("DonCounter — interactions", () => {
  it("calls onActivate when Activate button is clicked", async () => {
    const user = userEvent.setup();
    const onActivate = vi.fn();
    render(
      <DonCounter
        active={0}
        rested={0}
        deckRemaining={10}
        isInteractive={true}
        onActivate={onActivate}
      />
    );
    await user.click(screen.getByLabelText("Activate DON!! from deck"));
    expect(onActivate).toHaveBeenCalledOnce();
  });

  it("calls onRest when Rest button is clicked", async () => {
    const user = userEvent.setup();
    const onRest = vi.fn();
    render(
      <DonCounter
        active={3}
        rested={0}
        deckRemaining={7}
        isInteractive={true}
        onRest={onRest}
      />
    );
    await user.click(screen.getByLabelText("Rest active DON!!"));
    expect(onRest).toHaveBeenCalledOnce();
  });

  it("calls onUnrest when Unrest button is clicked", async () => {
    const user = userEvent.setup();
    const onUnrest = vi.fn();
    render(
      <DonCounter
        active={2}
        rested={3}
        deckRemaining={5}
        isInteractive={true}
        onUnrest={onUnrest}
      />
    );
    await user.click(screen.getByLabelText("Unrest a rested DON!!"));
    expect(onUnrest).toHaveBeenCalledOnce();
  });

  it("disables Activate button when deck is empty", () => {
    render(
      <DonCounter
        active={10}
        rested={0}
        deckRemaining={0}
        isInteractive={true}
        onActivate={() => undefined}
      />
    );
    expect(screen.getByLabelText("Activate DON!! from deck")).toBeDisabled();
  });

  it("disables Rest button when active DON!! is 0", () => {
    render(
      <DonCounter
        active={0}
        rested={5}
        deckRemaining={5}
        isInteractive={true}
        onRest={() => undefined}
      />
    );
    expect(screen.getByLabelText("Rest active DON!!")).toBeDisabled();
  });

  it("disables Unrest button when rested DON!! is 0", () => {
    render(
      <DonCounter
        active={5}
        rested={0}
        deckRemaining={5}
        isInteractive={true}
        onUnrest={() => undefined}
      />
    );
    expect(screen.getByLabelText("Unrest a rested DON!!")).toBeDisabled();
  });
});
