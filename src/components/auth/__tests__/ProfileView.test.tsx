import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ProfileView } from "@/components/auth/ProfileView";
import type { UserProfile } from "@/types/player";

vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
  }: {
    src: string;
    alt: string;
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}));

const mockProfile: UserProfile = {
  id: "usr001",
  name: "Monkey D. Luffy",
  email: "luffy@example.com",
  avatarUrl: null,
  gamesPlayed: 10,
  gamesWon: 7,
  createdAt: "2026-01-01T00:00:00.000Z",
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("ProfileView", () => {
  it("shows loading state initially", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockReturnValue(new Promise(() => undefined))
    );

    render(<ProfileView />);
    expect(screen.getByRole("status", { name: /loading profile/i })).toBeInTheDocument();
  });

  it("shows user data after fetch resolves", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockProfile),
      })
    );

    render(<ProfileView />);

    await waitFor(() => {
      expect(screen.getByText("Monkey D. Luffy")).toBeInTheDocument();
    });

    expect(screen.getByText("luffy@example.com")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("shows error when fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: "Server error" }),
      })
    );

    render(<ProfileView />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    expect(screen.getByText(/failed to load profile/i)).toBeInTheDocument();
  });

  it("shows 401 error message when unauthorized", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: "Unauthorized" }),
      })
    );

    render(<ProfileView />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    expect(screen.getByText(/must be logged in/i)).toBeInTheDocument();
  });
});
