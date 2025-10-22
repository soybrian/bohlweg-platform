/**
 * Webhook: Full Events Rescrape
 *
 * Deletes ALL events and rescraped everything from scratch.
 * Use this when you want to completely refresh the events database.
 *
 * Usage: POST /api/webhooks/events-full-rescrape
 */

import { NextResponse } from 'next/server';
import { deleteAllEvents } from '@/lib/db';
import { scrapeEventsBraunschweig } from '@/scrapers/events-braunschweig';

export async function POST() {
  const startTime = Date.now();

  try {
    console.log('[Webhook] Starting full events rescrape...');

    // 1. Delete all existing events
    const deleted = deleteAllEvents();
    console.log(`[Webhook] Deleted ${deleted.eventsDeleted} events and ${deleted.datesDeleted} event dates`);

    // 2. Run full scraper
    const scrapeResult = await scrapeEventsBraunschweig();

    const duration = Math.round((Date.now() - startTime) / 1000);

    return NextResponse.json({
      success: scrapeResult.success,
      deleted: {
        events: deleted.eventsDeleted,
        dates: deleted.datesDeleted
      },
      scraped: {
        total: scrapeResult.itemsScraped,
        new: scrapeResult.itemsNew,
        updated: scrapeResult.itemsUpdated
      },
      duration: `${duration}s`,
      error: scrapeResult.error
    });

  } catch (error) {
    console.error('[Webhook] Error during full rescrape:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
