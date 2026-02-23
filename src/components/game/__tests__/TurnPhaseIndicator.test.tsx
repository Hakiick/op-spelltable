import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import TurnPhaseIndicator from "@/components/game/TurnPhaseIndicator";

describe("TurnPhaseIndicator — rendering", () => {
  it("renders the indicator container", () => {
    render(
      <TurnPhaseIndicator phase="main" turnNumber={1} isLocalTurn={false} />
    );
    expect(screen.getByTestId("turn-phase-indicator")).toBeInTheDocument();
  });

  it("renders all 5 phase labels", () => {
    render(
      <TurnPhaseIndicator phase="refresh" turnNumber={1} isLocalTurn={false} />
    );
    expect(screen.getByText("Refresh")).toBeInTheDocument();
    expect(screen.getByText("Draw")).toBeInTheDocument();
    expect(screen.getByText("DON!!")).toBeInTheDocument();
    expect(screen.getByText("Main")).toBeInTheDocument();
    expect(screen.getByText("End")).toBeInTheDocument();
  });

  it("displays the correct turn number", () => {
    render(
      <TurnPhaseIndicator phase="draw" turnNumber={5} isLocalTurn={false} />
    );
    expect(screen.getByText("Turn 5")).toBeInTheDocument();
  });

  it("shows 'Your turn' when isLocalTurn=true", () => {
    render(
      <TurnPhaseIndicator phase="main" turnNumber={2} isLocalTurn={true} />
    );
    expect(screen.getByText("Your turn")).toBeInTheDocument();
  });

  it('shows "Opponent\'s turn" when isLocalTurn=false', () => {
    render(
      <TurnPhaseIndicator phase="main" turnNumber={2} isLocalTurn={false} />
    );
    expect(screen.getByText("Opponent's turn")).toBeInTheDocument();
  });

  it("marks the active phase with aria-current=step", () => {
    render(
      <TurnPhaseIndicator phase="don" turnNumber={1} isLocalTurn={false} />
    );
    const donPhase = screen.getByText("DON!!").closest("[aria-current='step']");
    expect(donPhase).toBeInTheDocument();
  });

  it("does not render Next Phase button when onNextPhase is not provided", () => {
    render(
      <TurnPhaseIndicator phase="main" turnNumber={1} isLocalTurn={true} />
    );
    expect(screen.queryByTestId("next-phase-button")).not.toBeInTheDocument();
  });

  it("does not render Next Phase button when isLocalTurn=false", () => {
    render(
      <TurnPhaseIndicator
        phase="main"
        turnNumber={1}
        isLocalTurn={false}
        onNextPhase={() => undefined}
      />
    );
    expect(screen.queryByTestId("next-phase-button")).not.toBeInTheDocument();
  });

  it("renders Next Phase button when isLocalTurn=true and onNextPhase is provided", () => {
    render(
      <TurnPhaseIndicator
        phase="main"
        turnNumber={1}
        isLocalTurn={true}
        onNextPhase={() => undefined}
      />
    );
    expect(screen.getByTestId("next-phase-button")).toBeInTheDocument();
  });

  it("has correct aria-label combining turn and phase info", () => {
    render(
      <TurnPhaseIndicator phase="draw" turnNumber={3} isLocalTurn={true} />
    );
    expect(
      screen.getByLabelText(/Turn 3, Draw phase.*your turn/i)
    ).toBeInTheDocument();
  });
});

describe("TurnPhaseIndicator — interactions", () => {
  it("calls onNextPhase when Next Phase button is clicked", async () => {
    const user = userEvent.setup();
    const onNextPhase = vi.fn();
    render(
      <TurnPhaseIndicator
        phase="main"
        turnNumber={1}
        isLocalTurn={true}
        onNextPhase={onNextPhase}
      />
    );
    await user.click(screen.getByTestId("next-phase-button"));
    expect(onNextPhase).toHaveBeenCalledOnce();
  });
});
