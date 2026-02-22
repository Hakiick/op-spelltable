import { prisma } from "@/lib/database/prisma";
import { generateRoomCode } from "@/lib/webrtc/room-utils";
import type { Room } from "@/generated/prisma";

export type { Room };

/**
 * Creates a new room with a generated unique room code.
 * Retries if the generated code collides with an existing one.
 */
export async function createRoom(hostPeerId?: string): Promise<Room> {
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
      },
    });
  }

  throw new Error("Failed to generate a unique room code after multiple retries");
}

/**
 * Retrieves a room by its room code.
 * Returns null if not found.
 */
export async function getRoomByCode(code: string): Promise<Room | null> {
  return prisma.room.findUnique({ where: { roomCode: code } });
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
