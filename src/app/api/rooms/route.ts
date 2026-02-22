import { NextRequest, NextResponse } from "next/server";
import { createRoom } from "@/lib/database/rooms";
import { auth } from "@/lib/auth";

interface CreateRoomBody {
  hostPeerId?: string;
  name?: string;
  isPublic?: boolean;
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

    // Read optional authenticated user id — not blocking if not authenticated
    let hostUserId: string | undefined;
    try {
      const session = await auth();
      if (session?.user?.id) {
        hostUserId = session.user.id;
      }
    } catch {
      // Session read failures are non-blocking
    }

    const room = await createRoom(body.hostPeerId, {
      name: body.name,
      isPublic: body.isPublic,
      hostUserId,
    });

    return NextResponse.json(
      {
        id: room.id,
        roomCode: room.roomCode,
        status: room.status,
        hostPeerId: room.hostPeerId,
        name: room.name,
        isPublic: room.isPublic,
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
