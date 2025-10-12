import { NextRequest, NextResponse } from "next/server";
import { getMaengel, countMaengel } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get("category") || undefined;
    const status = searchParams.get("status") || undefined;
    const search = searchParams.get("search") || undefined;
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 50;
    const offset = searchParams.get("offset") ? parseInt(searchParams.get("offset")!) : 0;

    const maengel = getMaengel({
      category,
      status,
      search,
      limit,
      offset,
    });

    const total = countMaengel({ category, status, search });

    return NextResponse.json(maengel, {
      headers: {
        "X-Total-Count": total.toString(),
      },
    });
  } catch (error) {
    console.error("Error fetching maengel:", error);
    return NextResponse.json({ error: "Failed to fetch maengel" }, { status: 500 });
  }
}
