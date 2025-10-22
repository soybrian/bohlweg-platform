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
    const afterWork = searchParams.get("afterWork") === "true";
    const weekend = searchParams.get("weekend") === "true";
    const free = searchParams.get("free") === "true";
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const db = getDatabase();

  let query = `SELECT * FROM events WHERE startDate IS NOT NULL AND startDate >= date('now', 'localtime')`;
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

  // Filter: After Work (events starting at 15:00 or later, OR currently running and ending after 15:00)
  if (afterWork) {
    query += ` AND (startTime >= '15:00' OR (endTime IS NOT NULL AND endTime >= '15:00'))`;
  }

  // Filter: Weekend (Saturday=6 or Sunday=0)
  if (weekend) {
    query += ` AND (strftime('%w', startDate) = '0' OR strftime('%w', startDate) = '6')`;
  }

  // Filter: Free events
  if (free) {
    query += ` AND isFree = 1`;
  }

  // Sortiere nach Datum aufsteigend (nächste Events zuerst)
  query += ` ORDER BY startDate ASC, startTime ASC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const events = db.prepare(query).all(...params);

  // Add dates_count to each event and convert isFree to boolean
  const eventsWithDatesCount = events.map((event: any) => {
    const datesCount = db.prepare('SELECT COUNT(*) as count FROM event_dates WHERE event_id = ?').get(event.id) as { count: number };
    return {
      ...event,
      isFree: Boolean(event.isFree),
      dates_count: datesCount.count
    };
  });

  // Count total
  let countQuery = `SELECT COUNT(*) as total FROM events WHERE startDate IS NOT NULL AND startDate >= date('now', 'localtime')`;
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

  // Filter: After Work
  if (afterWork) {
    countQuery += ` AND (startTime >= '15:00' OR (endTime IS NOT NULL AND endTime >= '15:00'))`;
  }

  // Filter: Weekend
  if (weekend) {
    countQuery += ` AND (strftime('%w', startDate) = '0' OR strftime('%w', startDate) = '6')`;
  }

  // Filter: Free events
  if (free) {
    countQuery += ` AND isFree = 1`;
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
