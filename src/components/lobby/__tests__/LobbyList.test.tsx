import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LobbyList from "@/components/lobby/LobbyList";
import type { LobbyRoom } from "@/types/lobby";

// Mock next/navigation
const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

afterEach(() => {
  cleanup();
  pushMock.mockClear();
});

const makeRoom = (overrides: Partial<LobbyRoom> = {}): LobbyRoom => ({
  id: "room-1",
  roomCode: "ABC123",
  name: "Test Room",
  status: "waiting",
  hostName: "Luffy",
  guestName: null,
  isPublic: true,
  createdAt: new Date().toISOString(),
  ...overrides,
});

describe("LobbyList", () => {
  it("renders empty state message when no rooms", () => {
    render(<LobbyList rooms={[]} />);
    expect(screen.getByText(/Aucune partie disponible/i)).toBeInTheDocument();
  });

  it("renders loading skeletons when loading is true", () => {
    const { container } = render(<LobbyList rooms={[]} loading />);
    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("renders a room with its name", () => {
    render(<LobbyList rooms={[makeRoom({ name: "My Great Room" })]} />);
    expect(screen.getByText("My Great Room")).toBeInTheDocument();
  });

  it("renders fallback name when room.name is null", () => {
    render(<LobbyList rooms={[makeRoom({ name: null })]} />);
    expect(screen.getByText(/Partie #1/i)).toBeInTheDocument();
  });

  it("renders room code", () => {
    render(<LobbyList rooms={[makeRoom({ roomCode: "XYZ999" })]} />);
    expect(screen.getByText("XYZ999")).toBeInTheDocument();
  });

  it("renders host name when present", () => {
    render(<LobbyList rooms={[makeRoom({ hostName: "Zoro" })]} />);
    expect(screen.getByText("Zoro")).toBeInTheDocument();
  });

  it("renders multiple rooms", () => {
    const rooms = [
      makeRoom({ id: "1", roomCode: "AAA111", name: "Room A" }),
      makeRoom({ id: "2", roomCode: "BBB222", name: "Room B" }),
      makeRoom({ id: "3", roomCode: "CCC333", name: "Room C" }),
    ];
    render(<LobbyList rooms={rooms} />);
    expect(screen.getByText("Room A")).toBeInTheDocument();
    expect(screen.getByText("Room B")).toBeInTheDocument();
    expect(screen.getByText("Room C")).toBeInTheDocument();
  });

  it("navigates to room on join button click", async () => {
    const user = userEvent.setup();
    render(<LobbyList rooms={[makeRoom({ roomCode: "DEF456" })]} />);
    await user.click(screen.getByRole("button", { name: /Rejoindre/i }));
    expect(pushMock).toHaveBeenCalledWith("/room/DEF456");
  });
});
