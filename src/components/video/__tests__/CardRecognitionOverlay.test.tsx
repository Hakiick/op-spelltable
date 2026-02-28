import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import CardRecognitionOverlay from "@/components/video/CardRecognitionOverlay";
import type { CardRecognitionState } from "@/types/ml";

function makeState(
  overrides?: Partial<CardRecognitionState>
): CardRecognitionState {
  return {
    status: "ready",
    lastResult: null,
    topCandidates: [],
    detectedCards: [],
    identifiedCards: [],
    error: null,
    isActive: false,
    loadingProgress: 0,
    fps: 0,
    ...overrides,
  };
}

describe("CardRecognitionOverlay", () => {
  it('renders toggle button with "Start Recognition" text when not active', () => {
    render(
      <CardRecognitionOverlay
        state={makeState()}
        isActive={false}
        isUsingWorker={false}
        onToggle={vi.fn()}
      />
    );

    const btn = screen.getByRole("button", { name: /start card recognition/i });
    expect(btn).toBeInTheDocument();
  });

  it('renders "Stop Recognition" when active', () => {
    render(
      <CardRecognitionOverlay
        state={makeState({ status: "ready" })}
        isActive={true}
        isUsingWorker={false}
        onToggle={vi.fn()}
      />
    );

    const btn = screen.getByRole("button", { name: /stop card recognition/i });
    expect(btn).toBeInTheDocument();
  });

  it("shows FPS counter when active", () => {
    render(
      <CardRecognitionOverlay
        state={makeState({ fps: 12 })}
        isActive={true}
        isUsingWorker={false}
        onToggle={vi.fn()}
      />
    );

    expect(screen.getByText("FPS: 12.0")).toBeInTheDocument();
  });

  it("hides FPS counter when not active", () => {
    render(
      <CardRecognitionOverlay
        state={makeState({ fps: 12 })}
        isActive={false}
        isUsingWorker={false}
        onToggle={vi.fn()}
      />
    );

    expect(screen.queryByText(/FPS:/)).not.toBeInTheDocument();
  });

  it("shows recognized card code and confidence when a card is detected", () => {
    render(
      <CardRecognitionOverlay
        state={makeState({
          status: "ready",
          lastResult: {
            cardCode: "OP01-001",
            confidence: 0.85,
            candidateCount: 1,
            durationMs: 45,
          },
        })}
        isActive={true}
        isUsingWorker={false}
        onToggle={vi.fn()}
      />
    );

    expect(screen.getByText("OP01-001")).toBeInTheDocument();
    expect(screen.getByText("Confidence: 85%")).toBeInTheDocument();
  });

  it('shows "No card detected" when active with no match', () => {
    render(
      <CardRecognitionOverlay
        state={makeState({
          status: "ready",
          lastResult: {
            cardCode: null,
            confidence: 0,
            candidateCount: 0,
            durationMs: 20,
          },
        })}
        isActive={true}
        isUsingWorker={false}
        onToggle={vi.fn()}
      />
    );

    expect(screen.getByText("No card detected")).toBeInTheDocument();
  });

  it("shows loading indicator when status is loading", () => {
    render(
      <CardRecognitionOverlay
        state={makeState({ status: "loading", loadingProgress: 0 })}
        isActive={false}
        isUsingWorker={false}
        onToggle={vi.fn()}
      />
    );

    expect(screen.getByText("Loading ML model...")).toBeInTheDocument();
  });

  it("shows loading progress percentage when loadingProgress > 0", () => {
    render(
      <CardRecognitionOverlay
        state={makeState({ status: "loading", loadingProgress: 60 })}
        isActive={false}
        isUsingWorker={false}
        onToggle={vi.fn()}
      />
    );

    expect(screen.getByText("60%")).toBeInTheDocument();
  });

  it("shows error message when status is error", () => {
    render(
      <CardRecognitionOverlay
        state={makeState({ status: "error", error: "Model failed to load" })}
        isActive={false}
        isUsingWorker={false}
        onToggle={vi.fn()}
      />
    );

    expect(screen.getByText("Model failed to load")).toBeInTheDocument();
  });

  it("shows Retry button on error", () => {
    render(
      <CardRecognitionOverlay
        state={makeState({ status: "error", error: "Model failed to load" })}
        isActive={false}
        isUsingWorker={false}
        onToggle={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("calls onToggle when toggle button is clicked", () => {
    const onToggle = vi.fn();

    render(
      <CardRecognitionOverlay
        state={makeState()}
        isActive={false}
        isUsingWorker={false}
        onToggle={onToggle}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: /start card recognition/i })
    );
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it("calls onToggle when Retry button is clicked on error", () => {
    const onToggle = vi.fn();

    render(
      <CardRecognitionOverlay
        state={makeState({ status: "error", error: "Something went wrong" })}
        isActive={false}
        isUsingWorker={false}
        onToggle={onToggle}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('shows "Worker" indicator when isUsingWorker is true and active', () => {
    render(
      <CardRecognitionOverlay
        state={makeState()}
        isActive={true}
        isUsingWorker={true}
        onToggle={vi.fn()}
      />
    );

    expect(screen.getByText("Worker")).toBeInTheDocument();
  });

  it('shows "Main" indicator when isUsingWorker is false and active', () => {
    render(
      <CardRecognitionOverlay
        state={makeState()}
        isActive={true}
        isUsingWorker={false}
        onToggle={vi.fn()}
      />
    );

    expect(screen.getByText("Main")).toBeInTheDocument();
  });

  it("toggle button meets minimum touch target size (min-h-11)", () => {
    render(
      <CardRecognitionOverlay
        state={makeState()}
        isActive={false}
        isUsingWorker={false}
        onToggle={vi.fn()}
      />
    );

    const btn = screen.getByRole("button", { name: /start card recognition/i });
    expect(btn.className).toContain("min-h-11");
    expect(btn.className).toContain("min-w-11");
  });
});
