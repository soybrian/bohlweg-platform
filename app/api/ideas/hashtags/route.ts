import { NextResponse } from "next/server";
import { getAllHashtags } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/ideas/hashtags
 * Returns all unique hashtags with their counts
 */
export async function GET() {
  try {
    const hashtags = getAllHashtags();

    return NextResponse.json({
      hashtags,
      total: hashtags.length,
    });
  } catch (error) {
    console.error("Error fetching hashtags:", error);
    return NextResponse.json({ error: "Failed to fetch hashtags" }, { status: 500 });
  }
}
