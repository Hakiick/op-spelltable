import { NextRequest, NextResponse } from "next/server";
import { createRoom } from "@/lib/database/rooms";

interface CreateRoomBody {
  hostPeerId?: string;
}

export async function POST(request: NextRequest) {
  try {
    let body: CreateRoomBody = {};

    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const text = await request.text();
      if (text.trim().length > 0) {
        body = JSON.parse(text) as CreateRoomBody;
      }
    }

    const room = await createRoom(body.hostPeerId);

    return NextResponse.json(
      {
        id: room.id,
        roomCode: room.roomCode,
        status: room.status,
        hostPeerId: room.hostPeerId,
        createdAt: room.createdAt,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create room:", error);
    return NextResponse.json(
      { error: "Failed to create room" },
      { status: 500 }
    );
  }
}
