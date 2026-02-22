import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CreateRoomForm from "@/components/lobby/CreateRoomForm";

// Mock next/navigation
const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

beforeEach(() => {
  pushMock.mockClear();
  vi.restoreAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("CreateRoomForm", () => {
  it("renders the room name input", () => {
    render(<CreateRoomForm />);
    expect(screen.getByPlaceholderText("Nom de la partie")).toBeInTheDocument();
  });

  it("renders the public toggle checkbox checked by default", () => {
    render(<CreateRoomForm />);
    const checkbox = screen.getByRole("checkbox", { name: /publique/i });
    expect(checkbox).toBeChecked();
  });

  it("renders the submit button", () => {
    render(<CreateRoomForm />);
    expect(
      screen.getByRole("button", { name: /Créer une partie/i })
    ).toBeInTheDocument();
  });

  it("navigates to room on successful creation", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ roomCode: "XYZ123" }),
      })
    );

    render(<CreateRoomForm />);
    await user.click(
      screen.getByRole("button", { name: /Créer une partie/i })
    );

    // Wait for async navigation
    await vi.waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/room/XYZ123");
    });
  });

  it("shows error message on fetch failure", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Server error" }),
      })
    );

    render(<CreateRoomForm />);
    await user.click(
      screen.getByRole("button", { name: /Créer une partie/i })
    );

    await vi.waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });

  it("disables button while loading", async () => {
    const user = userEvent.setup();
    // Never resolves fetch to keep loading state
    vi.stubGlobal(
      "fetch",
      vi.fn().mockReturnValue(new Promise(() => {}))
    );

    render(<CreateRoomForm />);
    const button = screen.getByRole("button", { name: /Créer une partie/i });
    await user.click(button);

    expect(
      screen.getByRole("button", { name: /Création\.\.\./i })
    ).toBeDisabled();
  });

  it("sends name and isPublic to the API", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ roomCode: "AAA111" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<CreateRoomForm />);
    await user.type(screen.getByPlaceholderText("Nom de la partie"), "Ma Partie");
    await user.click(
      screen.getByRole("button", { name: /Créer une partie/i })
    );

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/rooms",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("Ma Partie"),
        })
      );
    });
  });
});
