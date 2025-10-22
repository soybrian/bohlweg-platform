/**
 * Webhook: Incremental Events Update
 *
 * Scrapes only NEW events that don't exist in the database yet.
 * Existing events are left unchanged.
 *
 * Usage: POST /api/webhooks/events-incremental
 */

import { NextResponse } from 'next/server';
import { chromium } from 'playwright';
import { getExistingEventIds, upsertEvent, startScraperRun, endScraperRun } from '@/lib/db';
import { collectAllEventUrls, scrapeEventDetail } from '@/scrapers/events-braunschweig';

export async function POST() {
  const startTime = Date.now();
  const runId = startScraperRun("events-incremental");

  let itemsScraped = 0;
  let itemsNew = 0;
  let skipped = 0;

  try {
    console.log('[Webhook] Starting incremental events update...');

    // 1. Get existing event IDs from database
    const existingIds = new Set(getExistingEventIds());
    console.log(`[Webhook] Found ${existingIds.size} existing events in database`);

    // 2. Launch browser and collect all event URLs
    const browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });

    const page = await browser.newPage();
    const eventUrls = await collectAllEventUrls(page, 100);
    await page.close();

    console.log(`[Webhook] Found ${eventUrls.length} events on website`);

    // 3. Filter for NEW events only
    const newEventUrls = eventUrls.filter(url => {
      const idMatch = url.match(/\/event\/(\d+)\//);
      const externalId = idMatch ? idMatch[1] : '';
      return externalId && !existingIds.has(externalId);
    });

    console.log(`[Webhook] ${newEventUrls.length} new events to scrape, ${eventUrls.length - newEventUrls.length} skipped (already exist)`);
    skipped = eventUrls.length - newEventUrls.length;

    // 4. Scrape only new events (parallel processing)
    const CONCURRENCY = 3;
    for (let i = 0; i < newEventUrls.length; i += CONCURRENCY) {
      const batch = newEventUrls.slice(i, i + CONCURRENCY);

      const results = await Promise.all(
        batch.map(async (url) => {
          try {
            const eventData = await scrapeEventDetail(browser, url, true);
            if (eventData) {
              const result = upsertEvent({
                ...eventData,
                scraped_at: new Date().toISOString()
              }, eventData.allDates);
              itemsScraped++;
              if (result.isNew) itemsNew++;
              return { success: true, url };
            }
            return { success: false, url, error: 'No data scraped' };
          } catch (err) {
            console.error(`[Webhook] Error scraping ${url}:`, err);
            return { success: false, url, error: err instanceof Error ? err.message : 'Unknown error' };
          }
        })
      );

      console.log(`[Webhook] Batch ${Math.floor(i / CONCURRENCY) + 1}/${Math.ceil(newEventUrls.length / CONCURRENCY)} complete`);
    }

    await browser.close();

    // 5. End scraper run
    endScraperRun(runId, {
      itemsScraped,
      itemsNew,
      itemsUpdated: itemsScraped - itemsNew,
      success: true
    });

    const duration = Math.round((Date.now() - startTime) / 1000);

    return NextResponse.json({
      success: true,
      total: eventUrls.length,
      new: itemsNew,
      skipped: skipped,
      duration: `${duration}s`
    });

  } catch (error) {
    console.error('[Webhook] Error during incremental update:', error);

    endScraperRun(runId, {
      itemsScraped,
      itemsNew,
      itemsUpdated: itemsScraped - itemsNew,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
