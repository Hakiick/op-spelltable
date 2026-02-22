import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import RecognitionPanel from "@/components/video/RecognitionPanel";
import type { RecognitionOutput, RecognitionResult } from "@/types/ml";

const noMatch: RecognitionOutput = {
  cardCode: null,
  confidence: 0,
  candidateCount: 0,
  durationMs: 10,
};

const singleMatch: RecognitionOutput = {
  cardCode: "OP01-001",
  confidence: 0.85,
  candidateCount: 1,
  durationMs: 45,
};

const candidates: RecognitionResult[] = [
  { cardCode: "OP01-001", confidence: 0.85, candidateCount: 3, durationMs: 45 },
  { cardCode: "OP01-002", confidence: 0.55, candidateCount: 3, durationMs: 45 },
  { cardCode: "OP01-003", confidence: 0.30, candidateCount: 3, durationMs: 45 },
];

describe("RecognitionPanel", () => {
  it('shows "No card detected" when lastResult is null', () => {
    render(<RecognitionPanel lastResult={null} topCandidates={[]} />);
    expect(screen.getByText("No card detected")).toBeInTheDocument();
  });

  it('shows "No card detected" when lastResult has cardCode null', () => {
    render(<RecognitionPanel lastResult={noMatch} topCandidates={[]} />);
    expect(screen.getByText("No card detected")).toBeInTheDocument();
  });

  it("shows card code when result is present", () => {
    render(<RecognitionPanel lastResult={singleMatch} topCandidates={[]} />);
    expect(screen.getByText("OP01-001")).toBeInTheDocument();
  });

  it("shows confidence percentage for single match", () => {
    render(<RecognitionPanel lastResult={singleMatch} topCandidates={[]} />);
    expect(screen.getByText("85%")).toBeInTheDocument();
  });

  it("shows duration in ms for single match", () => {
    render(<RecognitionPanel lastResult={singleMatch} topCandidates={[]} />);
    expect(screen.getByText("45ms")).toBeInTheDocument();
  });

  it("shows multiple candidates when topCandidates has more than one entry", () => {
    render(
      <RecognitionPanel lastResult={candidates[0]} topCandidates={candidates} />
    );

    expect(screen.getByText("OP01-001")).toBeInTheDocument();
    expect(screen.getByText("OP01-002")).toBeInTheDocument();
    expect(screen.getByText("OP01-003")).toBeInTheDocument();
  });

  it("shows confidence percentage for each candidate", () => {
    render(
      <RecognitionPanel lastResult={candidates[0]} topCandidates={candidates} />
    );

    expect(screen.getByText("85%")).toBeInTheDocument();
    expect(screen.getByText("55%")).toBeInTheDocument();
    expect(screen.getByText("30%")).toBeInTheDocument();
  });

  it("shows rank numbers for multiple candidates", () => {
    render(
      <RecognitionPanel lastResult={candidates[0]} topCandidates={candidates} />
    );

    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("shows duration only once (for the top result) with multiple candidates", () => {
    render(
      <RecognitionPanel lastResult={candidates[0]} topCandidates={candidates} />
    );

    const durationElements = screen.getAllByText("45ms");
    expect(durationElements).toHaveLength(1);
  });

  it("renders as a region with accessible label", () => {
    render(<RecognitionPanel lastResult={null} topCandidates={[]} />);
    expect(
      screen.getByRole("region", { name: /card recognition results/i })
    ).toBeInTheDocument();
  });
});
