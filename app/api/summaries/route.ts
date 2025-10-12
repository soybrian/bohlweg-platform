import { NextResponse } from "next/server";
import { getAllCurrentSummaries } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/summaries
 *
 * Liefert aktuelle AI-Zusammenfassungen für Ideenplattform und Mängelmelder
 */
export async function GET() {
  try {
    const summaries = getAllCurrentSummaries();
    return NextResponse.json(summaries);
  } catch (error) {
    console.error("Error fetching summaries:", error);
    return NextResponse.json({ error: "Failed to fetch summaries" }, { status: 500 });
  }
}
