import { NextResponse } from "next/server";
import { getCardByCode } from "@/lib/database/cards";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const card = await getCardByCode(code);
    if (!card) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }
    return NextResponse.json({ data: card });
  } catch (error) {
    console.error("Failed to fetch card:", error);
    return NextResponse.json(
      { error: "Failed to fetch card" },
      { status: 500 }
    );
  }
}
