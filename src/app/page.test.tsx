import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import Home from "./page";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

describe("Home page", () => {
  it("renders the heading", () => {
    render(<Home />);
    expect(
      screen.getByRole("heading", { name: /op spelltable/i })
    ).toBeInTheDocument();
  });

  it("renders the play now link pointing to /lobby", () => {
    render(<Home />);
    const link = screen.getByRole("link", { name: /jouer maintenant/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/lobby");
  });

  it("renders the browse cards link pointing to /cards", () => {
    render(<Home />);
    const link = screen.getByRole("link", { name: /parcourir les cartes/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/cards");
  });
});
