import { NextResponse } from "next/server";
import { getSets } from "@/lib/database/cards";

export async function GET() {
  try {
    const sets = await getSets();
    return NextResponse.json({ data: sets });
  } catch (error) {
    console.error("Failed to fetch sets:", error);
    return NextResponse.json(
      { error: "Failed to fetch sets" },
      { status: 500 }
    );
  }
}
