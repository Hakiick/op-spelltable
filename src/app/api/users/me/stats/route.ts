import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserById } from "@/lib/database/users";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await getUserById(session.user.id);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const winRate =
    user.gamesPlayed > 0
      ? Math.round((user.gamesWon / user.gamesPlayed) * 100) / 100
      : 0;

  return NextResponse.json({
    gamesPlayed: user.gamesPlayed,
    gamesWon: user.gamesWon,
    winRate,
  });
}
