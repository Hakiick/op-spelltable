import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import Home from "./page";

describe("Home page", () => {
  it("renders the heading", () => {
    render(<Home />);
    expect(
      screen.getByRole("heading", { name: /op spelltable/i })
    ).toBeInTheDocument();
  });

  it("renders the play button", () => {
    render(<Home />);
    expect(
      screen.getByRole("button", { name: /play now/i })
    ).toBeInTheDocument();
  });

  it("renders the browse cards button", () => {
    render(<Home />);
    expect(
      screen.getByRole("button", { name: /browse cards/i })
    ).toBeInTheDocument();
  });
});
