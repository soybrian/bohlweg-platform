import { NextRequest, NextResponse } from "next/server";
import { getIdeas, countIdeas } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get("category") || undefined;
    const status = searchParams.get("status") || undefined;
    const search = searchParams.get("search") || undefined;
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 50;
    const offset = searchParams.get("offset") ? parseInt(searchParams.get("offset")!) : 0;

    // Parse hashtags from comma-separated string
    const hashtagsParam = searchParams.get("hashtags");
    const hashtags = hashtagsParam ? hashtagsParam.split(",").map(tag => tag.trim()) : undefined;

    // Parse voting status
    const votingStatus = searchParams.get("votingStatus") as "active" | "expired" | "all" | null;

    // Parse sort option (default: newest)
    const sortBy = searchParams.get("sortBy") as "newest" | "supporters" | "comments" | null;

    const ideas = getIdeas({
      category,
      status,
      search,
      hashtags,
      votingStatus: votingStatus || undefined,
      sortBy: sortBy || "newest",
      limit,
      offset,
    });

    const total = countIdeas({
      category,
      status,
      search,
      hashtags,
      votingStatus: votingStatus || undefined,
    });

    return NextResponse.json(ideas, {
      headers: {
        "X-Total-Count": total.toString(),
      },
    });
  } catch (error) {
    console.error("Error fetching ideas:", error);
    return NextResponse.json({ error: "Failed to fetch ideas" }, { status: 500 });
  }
}
