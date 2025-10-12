import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
import { scrapeIdeenplattform } from "@/scrapers/ideenplattform";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes

/**
 * POST /api/ideas/reset-and-scrape
 * Deletes all existing ideas and scrapes everything from scratch
 * WARNING: This is a destructive operation!
 */
export async function POST() {
  try {
    console.log("[Reset & Scrape] Starting reset and full scrape...");

    const db = getDatabase();

    // Delete all existing ideas and history
    console.log("[Reset & Scrape] Deleting existing data...");
    db.prepare("DELETE FROM ideas_history").run();
    db.prepare("DELETE FROM ideas").run();
    console.log("[Reset & Scrape] ✓ All existing data deleted");

    // Start fresh scraping with AI enhancement
    console.log("[Reset & Scrape] Starting fresh scrape with AI enhancement...");
    const result = await scrapeIdeenplattform(true); // scrapeDetails = true

    if (result.success) {
      console.log(
        `[Reset & Scrape] ✓ Completed: ${result.itemsScraped} ideas scraped (${result.itemsNew} new)`
      );
      return NextResponse.json({
        success: true,
        message: "Successfully reset and scraped all ideas",
        itemsScraped: result.itemsScraped,
        itemsNew: result.itemsNew,
      });
    } else {
      console.error(`[Reset & Scrape] ✗ Scraping failed: ${result.error}`);
      return NextResponse.json(
        {
          success: false,
          error: result.error || "Scraping failed",
          itemsScraped: result.itemsScraped,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[Reset & Scrape] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to reset and scrape",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
