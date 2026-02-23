import { NextResponse } from "next/server";
import { getRoomByCode, getRoomById, updateRoom } from "@/lib/database/rooms";

interface UpdateRoomBody {
  hostPeerId?: string;
  guestPeerId?: string;
  guestUserId?: string;
  status?: string;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const room = await getRoomByCode(code);

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    // Fetch with user relations for enriched response
    const roomWithUsers = await getRoomById(room.id);

    return NextResponse.json({
      id: room.id,
      roomCode: room.roomCode,
      hostPeerId: room.hostPeerId,
      guestPeerId: room.guestPeerId,
      status: room.status,
      name: room.name,
      isPublic: room.isPublic,
      hostUser: roomWithUsers?.hostUser ?? null,
      guestUser: roomWithUsers?.guestUser ?? null,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
    });
  } catch (error) {
    console.error("Failed to fetch room:", error);
    return NextResponse.json(
      { error: "Failed to fetch room" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;

    const existing = await getRoomByCode(code);
    if (!existing) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const body = (await request.json()) as UpdateRoomBody;

    const updateData: Partial<{
      hostPeerId: string;
      guestPeerId: string;
      guestUserId: string;
      status: string;
    }> = {};

    if (body.hostPeerId !== undefined) updateData.hostPeerId = body.hostPeerId;
    if (body.guestPeerId !== undefined)
      updateData.guestPeerId = body.guestPeerId;
    if (body.guestUserId !== undefined)
      updateData.guestUserId = body.guestUserId;
    if (body.status !== undefined) updateData.status = body.status;

    const room = await updateRoom(code, updateData);

    return NextResponse.json({
      id: room.id,
      roomCode: room.roomCode,
      hostPeerId: room.hostPeerId,
      guestPeerId: room.guestPeerId,
      status: room.status,
      name: room.name,
      isPublic: room.isPublic,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
    });
  } catch (error) {
    console.error("Failed to update room:", error);
    return NextResponse.json(
      { error: "Failed to update room" },
      { status: 500 }
    );
  }
}
