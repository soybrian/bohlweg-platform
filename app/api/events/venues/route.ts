import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";

export async function GET() {
  try {
    const db = getDatabase();

    // Get unique venues with event counts, sorted by count
    const venues = db.prepare(`
      SELECT
        venueName,
        COUNT(*) as eventCount
      FROM events
      WHERE venueName IS NOT NULL
        AND venueName != ''
        AND status = 'active'
      GROUP BY venueName
      ORDER BY eventCount DESC
    `).all() as Array<{ venueName: string; eventCount: number }>;

    return NextResponse.json({
      venues: venues.map(v => v.venueName),
      counts: venues.reduce((acc, v) => ({ ...acc, [v.venueName]: v.eventCount }), {})
    });
  } catch (error) {
    console.error("Venues API Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch venues", venues: [] },
      { status: 500 }
    );
  }
}
