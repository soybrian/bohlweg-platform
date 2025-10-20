import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
import { scrapeEventsBraunschweig } from "@/scrapers/events-braunschweig";

/**
 * Reset und Re-Scrape aller Events
 * Löscht alle bestehenden Events und scraped alles neu mit AI-Extraktion
 */
export async function POST() {
  try {
    console.log('[Reset & Scrape Events] Starting...');
    const db = getDatabase();

    // 1. Lösche alle Events
    console.log('[Reset & Scrape Events] Deleting all existing events...');
    const deleteResult = db.prepare("DELETE FROM events").run();
    console.log(`[Reset & Scrape Events] Deleted ${deleteResult.changes} events`);

    // 2. Scrape alle Events neu (ohne Limit, nutzt AI-Extraktion)
    console.log('[Reset & Scrape Events] Starting full scrape with AI extraction...');
    const result = await scrapeEventsBraunschweig();

    console.log('[Reset & Scrape Events] Completed:', result);

    return NextResponse.json({
      success: result.success,
      itemsScraped: result.itemsScraped,
      itemsNew: result.itemsNew,
      itemsUpdated: result.itemsUpdated,
      message: result.success
        ? `Successfully scraped ${result.itemsScraped} events (${result.itemsNew} new, ${result.itemsUpdated} updated)`
        : `Scraping failed: ${result.error}`,
    });
  } catch (error) {
    console.error("[Reset & Scrape Events] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to reset and scrape events",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
