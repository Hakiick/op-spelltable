import { describe, it, expect, vi, beforeEach } from "vitest";
import type { LobbyRoom } from "@/types/lobby";

vi.mock("@/lib/database/rooms", () => ({
  getPublicRooms: vi.fn(),
}));

import { getPublicRooms } from "@/lib/database/rooms";
import { GET as getLobbyHandler } from "@/app/api/lobby/route";

const mockLobbyRoom: LobbyRoom = {
  id: "clr001",
  roomCode: "ABC123",
  name: "Luffy vs Zoro",
  status: "waiting",
  hostName: "Luffy",
  guestName: null,
  isPublic: true,
  createdAt: "2026-01-01T00:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/lobby", () => {
  it("returns 200 with list of public rooms", async () => {
    vi.mocked(getPublicRooms).mockResolvedValue([mockLobbyRoom]);

    const response = await getLobbyHandler();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.rooms).toHaveLength(1);
    expect(json.rooms[0]).toEqual(mockLobbyRoom);
    expect(getPublicRooms).toHaveBeenCalledTimes(1);
  });

  it("returns 200 with empty array when no public rooms exist", async () => {
    vi.mocked(getPublicRooms).mockResolvedValue([]);

    const response = await getLobbyHandler();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.rooms).toEqual([]);
  });

  it("returns 500 when getPublicRooms throws", async () => {
    vi.mocked(getPublicRooms).mockRejectedValue(new Error("DB error"));

    const response = await getLobbyHandler();
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json).toEqual({ error: "Failed to fetch lobby rooms" });
  });
});
