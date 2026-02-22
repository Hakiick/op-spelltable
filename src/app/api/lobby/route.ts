import { NextResponse } from "next/server";
import { getPublicRooms } from "@/lib/database/rooms";

export async function GET() {
  try {
    const rooms = await getPublicRooms();
    return NextResponse.json({ rooms });
  } catch (error) {
    console.error("Failed to fetch lobby rooms:", error);
    return NextResponse.json(
      { error: "Failed to fetch lobby rooms" },
      { status: 500 }
    );
  }
}
