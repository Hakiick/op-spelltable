import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LoginForm } from "@/components/auth/LoginForm";

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

describe("LoginForm", () => {
  it("renders email input", () => {
    render(<LoginForm />);
    expect(screen.getByLabelText("Email address")).toBeInTheDocument();
  });

  it("renders password input", () => {
    render(<LoginForm />);
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  it("renders submit button", () => {
    render(<LoginForm />);
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("shows link to register page", () => {
    render(<LoginForm />);
    const link = screen.getByRole("link", { name: /register/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/auth/register");
  });
});
