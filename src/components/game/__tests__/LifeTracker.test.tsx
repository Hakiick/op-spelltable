import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import LifeTracker from "@/components/game/LifeTracker";

/** Helpers */
function faceDown(n: number): boolean[] {
  return Array(n).fill(true);
}

describe("LifeTracker — rendering", () => {
  it("renders the life tracker container", () => {
    render(<LifeTracker lifeCards={faceDown(5)} />);
    expect(screen.getByTestId("life-tracker")).toBeInTheDocument();
  });

  it("displays the correct life count", () => {
    render(<LifeTracker lifeCards={faceDown(4)} />);
    expect(screen.getByTestId("life-count")).toHaveTextContent("4");
  });

  it("renders all life cards as face-down by default", () => {
    render(<LifeTracker lifeCards={faceDown(3)} />);
    const faceDownCards = screen.getAllByLabelText(/face-down/i);
    expect(faceDownCards).toHaveLength(3);
  });

  it("renders a revealed card correctly", () => {
    const cards = [true, false, true]; // middle card is revealed
    render(<LifeTracker lifeCards={cards} />);
    expect(screen.getByLabelText("Life card 2 — revealed")).toBeInTheDocument();
  });

  it("renders 0 life cards with empty state placeholder", () => {
    render(<LifeTracker lifeCards={[]} />);
    expect(screen.getByTestId("life-count")).toHaveTextContent("0");
  });

  it("does not render Lose Life button when isInteractive=false", () => {
    render(<LifeTracker lifeCards={faceDown(5)} isInteractive={false} />);
    expect(screen.queryByTestId("lose-life-button")).not.toBeInTheDocument();
  });

  it("renders Lose Life button when isInteractive=true", () => {
    render(
      <LifeTracker
        lifeCards={faceDown(5)}
        isInteractive={true}
        onLoseLife={() => undefined}
      />
    );
    expect(screen.getByTestId("lose-life-button")).toBeInTheDocument();
  });
});

describe("LifeTracker — interactions", () => {
  it("calls onReveal with the correct index when a face-down card is clicked", async () => {
    const user = userEvent.setup();
    const onReveal = vi.fn();
    render(
      <LifeTracker
        lifeCards={faceDown(3)}
        isInteractive={true}
        onReveal={onReveal}
      />
    );
    // Click the first face-down card
    const card = screen.getByLabelText("Life card 1 — face-down");
    await user.click(card);
    expect(onReveal).toHaveBeenCalledWith(0);
  });

  it("calls onReveal with index 2 for the third card", async () => {
    const user = userEvent.setup();
    const onReveal = vi.fn();
    render(
      <LifeTracker
        lifeCards={faceDown(3)}
        isInteractive={true}
        onReveal={onReveal}
      />
    );
    const card = screen.getByLabelText("Life card 3 — face-down");
    await user.click(card);
    expect(onReveal).toHaveBeenCalledWith(2);
  });

  it("does not call onReveal on a revealed card", async () => {
    const user = userEvent.setup();
    const onReveal = vi.fn();
    render(
      <LifeTracker
        lifeCards={[false]} // already revealed
        isInteractive={true}
        onReveal={onReveal}
      />
    );
    const card = screen.getByLabelText("Life card 1 — revealed");
    await user.click(card);
    expect(onReveal).not.toHaveBeenCalled();
  });

  it("calls onLoseLife when Lose Life button is clicked", async () => {
    const user = userEvent.setup();
    const onLoseLife = vi.fn();
    render(
      <LifeTracker
        lifeCards={faceDown(3)}
        isInteractive={true}
        onLoseLife={onLoseLife}
      />
    );
    await user.click(screen.getByTestId("lose-life-button"));
    expect(onLoseLife).toHaveBeenCalledOnce();
  });

  it("disables Lose Life button when no life cards remain", () => {
    render(
      <LifeTracker
        lifeCards={[]}
        isInteractive={true}
        onLoseLife={() => undefined}
      />
    );
    expect(screen.getByTestId("lose-life-button")).toBeDisabled();
  });
});
