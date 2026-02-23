import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createRoom,
  getRoomByCode,
  getRoomById,
  getPublicRooms,
  joinRoom,
  startGame,
  updateRoom,
  closeRoom,
} from "@/lib/database/rooms";

vi.mock("@/lib/database/prisma", () => ({
  prisma: {
    room: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/webrtc/room-utils", () => ({
  generateRoomCode: vi.fn(() => "ABC123"),
}));

import { prisma } from "@/lib/database/prisma";

const mockRoom = {
  id: "clr001",
  roomCode: "ABC123",
  hostPeerId: "peer-host-1",
  guestPeerId: null,
  hostUserId: "usr001",
  guestUserId: null,
  name: "Test Room",
  isPublic: true,
  status: "waiting",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

const mockRoomWithUsers = {
  ...mockRoom,
  hostUser: { id: "usr001", name: "Luffy" },
  guestUser: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createRoom", () => {
  it("creates a room with only hostPeerId", async () => {
    vi.mocked(prisma.room.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.room.create).mockResolvedValue(mockRoom);

    const result = await createRoom("peer-host-1");

    expect(result).toEqual(mockRoom);
    expect(prisma.room.create).toHaveBeenCalledWith({
      data: {
        roomCode: "ABC123",
        hostPeerId: "peer-host-1",
        status: "waiting",
        name: null,
        isPublic: false,
        hostUserId: null,
      },
    });
  });

  it("creates a room with name, isPublic, and hostUserId", async () => {
    vi.mocked(prisma.room.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.room.create).mockResolvedValue(mockRoom);

    await createRoom("peer-host-1", {
      name: "Test Room",
      isPublic: true,
      hostUserId: "usr001",
    });

    expect(prisma.room.create).toHaveBeenCalledWith({
      data: {
        roomCode: "ABC123",
        hostPeerId: "peer-host-1",
        status: "waiting",
        name: "Test Room",
        isPublic: true,
        hostUserId: "usr001",
      },
    });
  });

  it("retries when room code already exists and eventually succeeds", async () => {
    const { generateRoomCode } = await import("@/lib/webrtc/room-utils");
    vi.mocked(generateRoomCode)
      .mockReturnValueOnce("TAKEN1")
      .mockReturnValue("FREE01");

    vi.mocked(prisma.room.findUnique)
      .mockResolvedValueOnce(mockRoom) // first code is taken
      .mockResolvedValue(null); // second code is free
    vi.mocked(prisma.room.create).mockResolvedValue({
      ...mockRoom,
      roomCode: "FREE01",
    });

    const result = await createRoom();

    expect(result.roomCode).toBe("FREE01");
    expect(prisma.room.findUnique).toHaveBeenCalledTimes(2);
  });

  it("throws after max retries if all codes are taken", async () => {
    vi.mocked(prisma.room.findUnique).mockResolvedValue(mockRoom);

    await expect(createRoom()).rejects.toThrow(
      "Failed to generate a unique room code after multiple retries"
    );
    expect(prisma.room.findUnique).toHaveBeenCalledTimes(5);
  });
});

describe("getRoomByCode", () => {
  it("returns a room when found", async () => {
    vi.mocked(prisma.room.findUnique).mockResolvedValue(mockRoom);

    const result = await getRoomByCode("ABC123");

    expect(result).toEqual(mockRoom);
    expect(prisma.room.findUnique).toHaveBeenCalledWith({
      where: { roomCode: "ABC123" },
    });
  });

  it("returns null when not found", async () => {
    vi.mocked(prisma.room.findUnique).mockResolvedValue(null);

    const result = await getRoomByCode("NOTFOUND");

    expect(result).toBeNull();
  });
});

describe("getRoomById", () => {
  it("returns a room with user relations when found", async () => {
    vi.mocked(prisma.room.findUnique).mockResolvedValue(
      mockRoomWithUsers as never
    );

    const result = await getRoomById("clr001");

    expect(result).toEqual(mockRoomWithUsers);
    expect(prisma.room.findUnique).toHaveBeenCalledWith({
      where: { id: "clr001" },
      include: {
        hostUser: { select: { id: true, name: true } },
        guestUser: { select: { id: true, name: true } },
      },
    });
  });

  it("returns null when not found", async () => {
    vi.mocked(prisma.room.findUnique).mockResolvedValue(null);

    const result = await getRoomById("nonexistent");

    expect(result).toBeNull();
  });
});

describe("getPublicRooms", () => {
  it("returns mapped lobby rooms for public waiting rooms", async () => {
    vi.mocked(prisma.room.findMany).mockResolvedValue([
      mockRoomWithUsers,
    ] as never);

    const result = await getPublicRooms();

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: "clr001",
      roomCode: "ABC123",
      name: "Test Room",
      status: "waiting",
      hostName: "Luffy",
      guestName: null,
      isPublic: true,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    expect(prisma.room.findMany).toHaveBeenCalledWith({
      where: { isPublic: true, status: "waiting" },
      include: {
        hostUser: { select: { name: true } },
        guestUser: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  });

  it("returns empty array when no public rooms exist", async () => {
    vi.mocked(prisma.room.findMany).mockResolvedValue([]);

    const result = await getPublicRooms();

    expect(result).toEqual([]);
  });
});

describe("joinRoom", () => {
  it("sets guest peer id and status to ready", async () => {
    vi.mocked(prisma.room.findUnique).mockResolvedValue(mockRoom);
    const updatedRoom = {
      ...mockRoom,
      guestPeerId: "peer-guest-1",
      guestUserId: "usr002",
      status: "ready",
    };
    vi.mocked(prisma.room.update).mockResolvedValue(updatedRoom);

    const result = await joinRoom("ABC123", "peer-guest-1", "usr002");

    expect(result.status).toBe("ready");
    expect(result.guestPeerId).toBe("peer-guest-1");
    expect(prisma.room.update).toHaveBeenCalledWith({
      where: { roomCode: "ABC123" },
      data: {
        guestPeerId: "peer-guest-1",
        guestUserId: "usr002",
        status: "ready",
      },
    });
  });

  it("throws when room is not found", async () => {
    vi.mocked(prisma.room.findUnique).mockResolvedValue(null);

    await expect(joinRoom("NOTFOUND")).rejects.toThrow(
      "Room not found: NOTFOUND"
    );
  });

  it("throws when room is not in waiting status", async () => {
    vi.mocked(prisma.room.findUnique).mockResolvedValue({
      ...mockRoom,
      status: "closed",
    });

    await expect(joinRoom("ABC123")).rejects.toThrow(
      "Room ABC123 is not available for joining (status: closed)"
    );
  });
});

describe("startGame", () => {
  it("transitions status from ready to playing", async () => {
    vi.mocked(prisma.room.findUnique).mockResolvedValue({
      ...mockRoom,
      status: "ready",
    });
    const playingRoom = { ...mockRoom, status: "playing" };
    vi.mocked(prisma.room.update).mockResolvedValue(playingRoom);

    const result = await startGame("ABC123");

    expect(result.status).toBe("playing");
    expect(prisma.room.update).toHaveBeenCalledWith({
      where: { roomCode: "ABC123" },
      data: { status: "playing" },
    });
  });

  it("throws when room is not found", async () => {
    vi.mocked(prisma.room.findUnique).mockResolvedValue(null);

    await expect(startGame("NOTFOUND")).rejects.toThrow(
      "Room not found: NOTFOUND"
    );
  });

  it("throws when room is not in ready status", async () => {
    vi.mocked(prisma.room.findUnique).mockResolvedValue({
      ...mockRoom,
      status: "waiting",
    });

    await expect(startGame("ABC123")).rejects.toThrow(
      "Room ABC123 cannot start game (status: waiting)"
    );
  });
});

describe("updateRoom", () => {
  it("updates and returns the room", async () => {
    const updatedRoom = { ...mockRoom, status: "closed" };
    vi.mocked(prisma.room.update).mockResolvedValue(updatedRoom);

    const result = await updateRoom("ABC123", { status: "closed" });

    expect(result.status).toBe("closed");
    expect(prisma.room.update).toHaveBeenCalledWith({
      where: { roomCode: "ABC123" },
      data: { status: "closed" },
    });
  });
});

describe("closeRoom", () => {
  it("sets room status to closed", async () => {
    const closedRoom = { ...mockRoom, status: "closed" };
    vi.mocked(prisma.room.update).mockResolvedValue(closedRoom);

    const result = await closeRoom("ABC123");

    expect(result.status).toBe("closed");
    expect(prisma.room.update).toHaveBeenCalledWith({
      where: { roomCode: "ABC123" },
      data: { status: "closed" },
    });
  });
});
