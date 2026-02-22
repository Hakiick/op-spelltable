import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserById, updateUserProfile } from "@/lib/database/users";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await getUserById(session.user.id);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
    gamesPlayed: user.gamesPlayed,
    gamesWon: user.gamesWon,
    createdAt: user.createdAt.toISOString(),
  });
}

interface PatchBody {
  name?: unknown;
  avatarUrl?: unknown;
}

export async function PATCH(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as PatchBody;

  const updateData: { name?: string; avatarUrl?: string } = {};

  if (body.name !== undefined) {
    if (typeof body.name !== "string" || body.name.trim().length === 0) {
      return NextResponse.json(
        { error: "Name must be a non-empty string" },
        { status: 400 }
      );
    }
    updateData.name = body.name.trim();
  }

  if (body.avatarUrl !== undefined) {
    if (typeof body.avatarUrl !== "string") {
      return NextResponse.json(
        { error: "avatarUrl must be a string" },
        { status: 400 }
      );
    }
    updateData.avatarUrl = body.avatarUrl;
  }

  const user = await updateUserProfile(session.user.id, updateData);

  return NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
    gamesPlayed: user.gamesPlayed,
    gamesWon: user.gamesWon,
    createdAt: user.createdAt.toISOString(),
  });
}
