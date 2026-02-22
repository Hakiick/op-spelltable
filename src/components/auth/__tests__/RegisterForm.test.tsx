import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RegisterForm } from "@/components/auth/RegisterForm";

vi.mock("next-auth/react", () => ({
  signIn: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) => <a href={href}>{children}</a>,
}));

describe("RegisterForm", () => {
  it("renders name input", () => {
    render(<RegisterForm />);
    expect(screen.getByLabelText("Display name")).toBeInTheDocument();
  });

  it("renders email input", () => {
    render(<RegisterForm />);
    expect(screen.getByLabelText("Email address")).toBeInTheDocument();
  });

  it("renders password input", () => {
    render(<RegisterForm />);
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  it("renders confirm password input", () => {
    render(<RegisterForm />);
    expect(screen.getByLabelText("Confirm password")).toBeInTheDocument();
  });

  it("renders submit button", () => {
    render(<RegisterForm />);
    expect(
      screen.getByRole("button", { name: /create account/i })
    ).toBeInTheDocument();
  });

  it("shows link to login page", () => {
    render(<RegisterForm />);
    const link = screen.getByRole("link", { name: /sign in/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/auth/login");
  });
});
