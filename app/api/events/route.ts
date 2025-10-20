import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const search = searchParams.get("search") || "";
    const category = searchParams.get("category") || "";
    const venue = searchParams.get("venue") || "";
    const startDate = searchParams.get("startDate") || "";
    const endDate = searchParams.get("endDate") || "";
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const db = getDatabase();

  let query = `SELECT * FROM events WHERE startDate IS NOT NULL AND startDate >= date('now')`;
  const params: any[] = [];

  if (search) {
    query += ` AND (title LIKE ? OR description LIKE ? OR venueName LIKE ? OR organizer LIKE ?)`;
    const searchPattern = `%${search}%`;
    params.push(searchPattern, searchPattern, searchPattern, searchPattern);
  }

  if (category) {
    query += ` AND category = ?`;
    params.push(category);
  }

  if (venue) {
    query += ` AND venueName = ?`;
    params.push(venue);
  }

  if (startDate) {
    query += ` AND startDate >= ?`;
    params.push(startDate);
  }

  if (endDate) {
    query += ` AND startDate <= ?`;
    params.push(endDate);
  }

  // Sortiere nach Datum aufsteigend (nächste Events zuerst)
  query += ` ORDER BY startDate ASC, startTime ASC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const events = db.prepare(query).all(...params);

  // Add dates_count to each event
  const eventsWithDatesCount = events.map((event: any) => {
    const datesCount = db.prepare('SELECT COUNT(*) as count FROM event_dates WHERE event_id = ?').get(event.id) as { count: number };
    return {
      ...event,
      dates_count: datesCount.count
    };
  });

  // Count total
  let countQuery = `SELECT COUNT(*) as total FROM events WHERE startDate IS NOT NULL AND startDate >= date('now')`;
  const countParams: any[] = [];

  if (search) {
    countQuery += ` AND (title LIKE ? OR description LIKE ? OR venueName LIKE ? OR organizer LIKE ?)`;
    const searchPattern = `%${search}%`;
    countParams.push(searchPattern, searchPattern, searchPattern, searchPattern);
  }

  if (category) {
    countQuery += ` AND category = ?`;
    countParams.push(category);
  }

  if (venue) {
    countQuery += ` AND venueName = ?`;
    countParams.push(venue);
  }

  if (startDate) {
    countQuery += ` AND startDate >= ?`;
    countParams.push(startDate);
  }

  if (endDate) {
    countQuery += ` AND startDate <= ?`;
    countParams.push(endDate);
  }

  const { total } = db.prepare(countQuery).get(...countParams) as { total: number };

    return NextResponse.json({
      events: eventsWithDatesCount,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Events API Error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch events",
        message: error instanceof Error ? error.message : String(error),
        events: [],
        total: 0,
        limit: 0,
        offset: 0
      },
      { status: 500 }
    );
  }
}
