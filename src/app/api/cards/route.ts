import { NextRequest, NextResponse } from "next/server";
import { getCards } from "@/lib/database/cards";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const params = {
      page: searchParams.get("page")
        ? Number(searchParams.get("page"))
        : undefined,
      limit: searchParams.get("limit")
        ? Number(searchParams.get("limit"))
        : undefined,
      search: searchParams.get("search") ?? undefined,
      color: searchParams.get("color") ?? undefined,
      type: searchParams.get("type") ?? undefined,
      set: searchParams.get("set") ?? undefined,
      cost: searchParams.get("cost")
        ? Number(searchParams.get("cost"))
        : undefined,
      rarity: searchParams.get("rarity") ?? undefined,
    };
    const result = await getCards(params);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to fetch cards:", error);
    return NextResponse.json(
      { error: "Failed to fetch cards" },
      { status: 500 }
    );
  }
}
