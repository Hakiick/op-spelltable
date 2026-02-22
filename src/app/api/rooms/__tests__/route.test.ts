import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/database/rooms", () => ({
  createRoom: vi.fn(),
  getRoomByCode: vi.fn(),
  getRoomById: vi.fn(),
  updateRoom: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockResolvedValue(null),
}));

import { createRoom, getRoomByCode, getRoomById, updateRoom } from "@/lib/database/rooms";
import { POST as createRoomHandler } from "@/app/api/rooms/route";
import {
  GET as getRoomHandler,
  PATCH as updateRoomHandler,
} from "@/app/api/rooms/[code]/route";

const mockRoom = {
  id: "clr001",
  roomCode: "ABC123",
  hostPeerId: "peer-host-1",
  guestPeerId: null,
  hostUserId: null,
  guestUserId: null,
  name: null,
  isPublic: false,
  status: "waiting",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

const mockRoomWithUsers = {
  ...mockRoom,
  hostUser: null,
  guestUser: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/rooms", () => {
  it("creates a room and returns 201 with room data", async () => {
    vi.mocked(createRoom).mockResolvedValue(mockRoom);

    const request = new Request("http://localhost:3000/api/rooms", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ hostPeerId: "peer-host-1" }),
    });

    const response = await createRoomHandler(request as never);
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.roomCode).toBe("ABC123");
    expect(json.status).toBe("waiting");
    expect(json.hostPeerId).toBe("peer-host-1");
    expect(createRoom).toHaveBeenCalledWith(
      "peer-host-1",
      expect.objectContaining({ name: undefined, isPublic: undefined })
    );
  });

  it("creates a room with name and isPublic", async () => {
    const namedRoom = { ...mockRoom, name: "My Battle", isPublic: true };
    vi.mocked(createRoom).mockResolvedValue(namedRoom);

    const request = new Request("http://localhost:3000/api/rooms", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ hostPeerId: "peer-host-1", name: "My Battle", isPublic: true }),
    });

    const response = await createRoomHandler(request as never);
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.name).toBe("My Battle");
    expect(json.isPublic).toBe(true);
    expect(createRoom).toHaveBeenCalledWith(
      "peer-host-1",
      expect.objectContaining({ name: "My Battle", isPublic: true })
    );
  });

  it("creates a room without hostPeerId when body is empty", async () => {
    vi.mocked(createRoom).mockResolvedValue({ ...mockRoom, hostPeerId: null });

    const request = new Request("http://localhost:3000/api/rooms", {
      method: "POST",
    });

    const response = await createRoomHandler(request as never);
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.hostPeerId).toBeNull();
    expect(createRoom).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ name: undefined, isPublic: undefined })
    );
  });

  it("returns 500 when createRoom throws", async () => {
    vi.mocked(createRoom).mockRejectedValue(new Error("DB error"));

    const request = new Request("http://localhost:3000/api/rooms", {
      method: "POST",
    });

    const response = await createRoomHandler(request as never);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json).toEqual({ error: "Failed to create room" });
  });
});

describe("GET /api/rooms/[code]", () => {
  it("returns 200 with room data when room is found", async () => {
    vi.mocked(getRoomByCode).mockResolvedValue(mockRoom);
    vi.mocked(getRoomById).mockResolvedValue(mockRoomWithUsers as never);

    const response = await getRoomHandler(
      new Request("http://localhost:3000/api/rooms/ABC123"),
      { params: Promise.resolve({ code: "ABC123" }) }
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.roomCode).toBe("ABC123");
    expect(json.hostPeerId).toBe("peer-host-1");
    expect(json.guestPeerId).toBeNull();
    expect(json.status).toBe("waiting");
    expect(getRoomByCode).toHaveBeenCalledWith("ABC123");
  });

  it("returns 404 when room is not found", async () => {
    vi.mocked(getRoomByCode).mockResolvedValue(null);

    const response = await getRoomHandler(
      new Request("http://localhost:3000/api/rooms/NOTFOUND"),
      { params: Promise.resolve({ code: "NOTFOUND" }) }
    );
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json).toEqual({ error: "Room not found" });
  });

  it("returns 500 when getRoomByCode throws", async () => {
    vi.mocked(getRoomByCode).mockRejectedValue(new Error("DB error"));

    const response = await getRoomHandler(
      new Request("http://localhost:3000/api/rooms/ABC123"),
      { params: Promise.resolve({ code: "ABC123" }) }
    );
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json).toEqual({ error: "Failed to fetch room" });
  });
});

describe("PATCH /api/rooms/[code]", () => {
  it("updates the room and returns 200 with updated data", async () => {
    const updatedRoom = { ...mockRoom, guestPeerId: "peer-guest-1", status: "ready" };
    vi.mocked(getRoomByCode).mockResolvedValue(mockRoom);
    vi.mocked(updateRoom).mockResolvedValue(updatedRoom);

    const response = await updateRoomHandler(
      new Request("http://localhost:3000/api/rooms/ABC123", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ guestPeerId: "peer-guest-1", status: "ready" }),
      }),
      { params: Promise.resolve({ code: "ABC123" }) }
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.guestPeerId).toBe("peer-guest-1");
    expect(json.status).toBe("ready");
    expect(updateRoom).toHaveBeenCalledWith("ABC123", {
      guestPeerId: "peer-guest-1",
      status: "ready",
    });
  });

  it("updates guestUserId and status to playing", async () => {
    const updatedRoom = {
      ...mockRoom,
      guestUserId: "usr002",
      status: "playing",
    };
    vi.mocked(getRoomByCode).mockResolvedValue(mockRoom);
    vi.mocked(updateRoom).mockResolvedValue(updatedRoom);

    const response = await updateRoomHandler(
      new Request("http://localhost:3000/api/rooms/ABC123", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ guestUserId: "usr002", status: "playing" }),
      }),
      { params: Promise.resolve({ code: "ABC123" }) }
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.status).toBe("playing");
    expect(updateRoom).toHaveBeenCalledWith("ABC123", {
      guestUserId: "usr002",
      status: "playing",
    });
  });

  it("returns 404 when room is not found on PATCH", async () => {
    vi.mocked(getRoomByCode).mockResolvedValue(null);

    const response = await updateRoomHandler(
      new Request("http://localhost:3000/api/rooms/NOTFOUND", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "closed" }),
      }),
      { params: Promise.resolve({ code: "NOTFOUND" }) }
    );
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json).toEqual({ error: "Room not found" });
  });

  it("returns 500 when updateRoom throws", async () => {
    vi.mocked(getRoomByCode).mockResolvedValue(mockRoom);
    vi.mocked(updateRoom).mockRejectedValue(new Error("DB error"));

    const response = await updateRoomHandler(
      new Request("http://localhost:3000/api/rooms/ABC123", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "closed" }),
      }),
      { params: Promise.resolve({ code: "ABC123" }) }
    );
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json).toEqual({ error: "Failed to update room" });
  });
});
