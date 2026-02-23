import { prisma } from "@/lib/database/prisma";
import { generateRoomCode } from "@/lib/webrtc/room-utils";
import type { Room } from "@/generated/prisma";
import type { LobbyRoom } from "@/types/lobby";

export type { Room };

export interface RoomWithUsers extends Room {
  hostUser: { id: string; name: string } | null;
  guestUser: { id: string; name: string } | null;
}

/**
 * Creates a new room with a generated unique room code.
 * Retries if the generated code collides with an existing one.
 */
export async function createRoom(
  hostPeerId?: string,
  options?: {
    name?: string;
    isPublic?: boolean;
    hostUserId?: string;
  }
): Promise<Room> {
  const MAX_RETRIES = 5;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const roomCode = generateRoomCode();
    const existing = await prisma.room.findUnique({ where: { roomCode } });
    if (existing) continue;

    return await prisma.room.create({
      data: {
        roomCode,
        hostPeerId: hostPeerId ?? null,
        status: "waiting",
        name: options?.name ?? null,
        isPublic: options?.isPublic ?? false,
        hostUserId: options?.hostUserId ?? null,
      },
    });
  }

  throw new Error(
    "Failed to generate a unique room code after multiple retries"
  );
}

/**
 * Retrieves a room by its room code.
 * Returns null if not found.
 */
export async function getRoomByCode(code: string): Promise<Room | null> {
  return prisma.room.findUnique({ where: { roomCode: code } });
}

/**
 * Retrieves a room by its ID, including user relations.
 * Returns null if not found.
 */
export async function getRoomById(id: string): Promise<RoomWithUsers | null> {
  return prisma.room.findUnique({
    where: { id },
    include: {
      hostUser: { select: { id: true, name: true } },
      guestUser: { select: { id: true, name: true } },
    },
  });
}

/**
 * Returns all public rooms currently in "waiting" status,
 * including host and guest display names.
 */
export async function getPublicRooms(): Promise<LobbyRoom[]> {
  const rooms = await prisma.room.findMany({
    where: {
      isPublic: true,
      status: "waiting",
    },
    include: {
      hostUser: { select: { name: true } },
      guestUser: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return rooms.map((room) => ({
    id: room.id,
    roomCode: room.roomCode,
    name: room.name,
    status: room.status,
    hostName: room.hostUser?.name ?? null,
    guestName: room.guestUser?.name ?? null,
    isPublic: room.isPublic,
    createdAt: room.createdAt.toISOString(),
  }));
}

/**
 * Joins a room by setting the guest peer ID and optional guest user ID.
 * The room must currently be in "waiting" status.
 */
export async function joinRoom(
  roomCode: string,
  guestPeerId?: string,
  guestUserId?: string
): Promise<Room> {
  const room = await prisma.room.findUnique({ where: { roomCode } });
  if (!room) {
    throw new Error(`Room not found: ${roomCode}`);
  }
  if (room.status !== "waiting") {
    throw new Error(
      `Room ${roomCode} is not available for joining (status: ${room.status})`
    );
  }

  return prisma.room.update({
    where: { roomCode },
    data: {
      guestPeerId: guestPeerId ?? null,
      guestUserId: guestUserId ?? null,
      status: "ready",
    },
  });
}

/**
 * Starts a game by transitioning the room status from "ready" to "playing".
 */
export async function startGame(roomCode: string): Promise<Room> {
  const room = await prisma.room.findUnique({ where: { roomCode } });
  if (!room) {
    throw new Error(`Room not found: ${roomCode}`);
  }
  if (room.status !== "ready") {
    throw new Error(
      `Room ${roomCode} cannot start game (status: ${room.status})`
    );
  }

  return prisma.room.update({
    where: { roomCode },
    data: { status: "playing" },
  });
}

/**
 * Updates room fields by room code.
 * Only the provided fields are updated.
 */
export async function updateRoom(
  code: string,
  data: Partial<{
    hostPeerId: string;
    guestPeerId: string;
    guestUserId: string;
    status: string;
  }>
): Promise<Room> {
  return prisma.room.update({
    where: { roomCode: code },
    data,
  });
}

/**
 * Closes a room by setting its status to "closed".
 */
export async function closeRoom(code: string): Promise<Room> {
  return prisma.room.update({
    where: { roomCode: code },
    data: { status: "closed" },
  });
}
