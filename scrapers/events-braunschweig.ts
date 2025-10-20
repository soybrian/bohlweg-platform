/**
 * Events Scraper für braunschweig.die-region.de
 *
 * Schneller, effizienter Scraper mit:
 * - "Mehr laden" Button-Clicking für alle Events
 * - Paralleles Detail-Scraping (3 gleichzeitig)
 * - Rate Limiting & Error Handling
 */

import { chromium, Browser, BrowserContext, Page } from "playwright";
import { upsertEvent, startScraperRun, endScraperRun } from "../lib/db";
import type { EventItem } from "../lib/db/schema";
import { extractEventDataWithAI } from "../lib/ai-summary";

const BASE_URL = "https://braunschweig.die-region.de/";

interface ScrapedEvent {
  externalId: string;
  title: string;
  description?: string;
  shortDescription?: string;
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  venueName?: string;
  venueAddress?: string;
  venuePostcode?: string;
  venueCity?: string;
  organizer?: string;
  imageUrl?: string;
  category?: string;
  moodCategory?: string;
  price?: string;
  isFree?: boolean;
  ticketUrl?: string;
  url: string;
  status?: string;
  detailScraped?: boolean;
  detailScrapedAt?: string;
  allDates?: Array<{ date: string; startTime?: string; endTime?: string }>; // Multiple dates
}

/**
 * Parse Datum aus deutschem Format zu ISO
 * "18. Oktober 2025" → "2025-10-18"
 */
function parseGermanDate(text: string): string | undefined {
  const monthNames = ['januar', 'februar', 'märz', 'april', 'mai', 'juni',
                      'juli', 'august', 'september', 'oktober', 'november', 'dezember'];

  const match = text.toLowerCase().match(/(\d{1,2})\.\s*(\w+)(?:\s+(\d{4}))?/);
  if (!match) return undefined;

  const day = match[1].padStart(2, '0');
  const monthName = match[2];
  const year = match[3] || new Date().getFullYear().toString();

  const monthIndex = monthNames.findIndex(m => monthName.includes(m));
  if (monthIndex === -1) return undefined;

  const month = (monthIndex + 1).toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * PHASE 1: Sammle alle Event-URLs durch Klicken von "Mehr laden"
 */
async function collectAllEventUrls(page: Page, maxClicks: number = 100): Promise<string[]> {
  console.log('[Events] Lade Hauptseite...');
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });

  const eventUrls: Set<string> = new Set();
  let clickCount = 0;

  while (clickCount < maxClicks) {
    // Extrahiere alle sichtbaren Event-URLs
    const urls = await page.$$eval(
      'a[href*="/veranstaltungen-detailseite/event/"]',
      (links) => links.map(a => (a as HTMLAnchorElement).href)
    );

    const before = eventUrls.size;
    urls.forEach(url => eventUrls.add(url));
    const added = eventUrls.size - before;

    console.log(`[Events] ${eventUrls.size} Events gefunden (+${added})...`);

    // Finde "Mehr laden" Button
    const moreButton = await page.$('a:has-text("Mehr laden")');
    if (!moreButton) {
      console.log('[Events] Kein "Mehr laden" Button gefunden - alle Events geladen');
      break;
    }

    try {
      // Klicke Button und warte auf neue Inhalte
      await moreButton.click();
      await page.waitForTimeout(1500); // Warte auf AJAX-Response
      clickCount++;

      // Wenn keine neuen Events hinzukamen, breche ab
      if (added === 0 && clickCount > 3) {
        console.log('[Events] Keine neuen Events mehr - fertig');
        break;
      }
    } catch (error) {
      console.log('[Events] Fehler beim Klicken "Mehr laden":', error);
      break;
    }
  }

  console.log(`[Events] ✓ ${eventUrls.size} Event-URLs gesammelt`);
  return Array.from(eventUrls);
}

/**
 * PHASE 2: Scrape Detail-Seite für vollständige Event-Informationen
 * Nutzt GPT-4o-mini für bessere Datenextraktion
 */
async function scrapeEventDetail(browser: Browser, url: string, useAI: boolean = true): Promise<ScrapedEvent | null> {
  let context: BrowserContext | null = null;

  try {
    context = await browser.newContext();
    const page = await context.newPage();

    // Blockiere Bilder/CSS für Geschwindigkeit (außer bei AI-Extraktion)
    if (!useAI) {
      await page.route('**/*.{png,jpg,jpeg,gif,svg,css,woff,woff2}', route => route.abort());
    }

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(500);

    // Event-ID aus URL extrahieren
    const idMatch = url.match(/\/event\/(\d+)\//);
    const externalId = idMatch ? idMatch[1] : '';

    // Wenn AI-Extraktion aktiviert ist
    if (useAI && process.env.OPENAI_API_KEY) {
      // Extrahiere strukturierten Text aus der Seite (besser als rohes HTML)
      const pageText = await page.evaluate(() => {
        // Entferne Scripts, Styles, Navigation etc.
        const clonedDoc = document.cloneNode(true) as Document;
        clonedDoc.querySelectorAll('script, style, nav, header, footer, noscript').forEach(el => el.remove());

        // Hole Text und reinige ihn
        const text = clonedDoc.body.textContent || '';
        return text
          .replace(/\s+/g, ' ')  // Mehrfache Leerzeichen/Newlines durch ein Leerzeichen ersetzen
          .trim();
      });

      const aiResult = await extractEventDataWithAI(pageText, url);

      if (aiResult && aiResult.event) {
        await context.close();

        const aiData = aiResult.event;

        // Parse erste Termin für startDate/startTime
        const firstDate = aiData.dates?.[0];
        const startDate = firstDate?.date ? parseGermanDate(firstDate.date) : undefined;

        // Zeit parsen (Format: "18:00" oder "18:00 - 22:00")
        let startTime: string | undefined;
        let endTime: string | undefined;
        if (firstDate?.time) {
          const timeMatch = firstDate.time.match(/(\d{1,2}:\d{2})\s*-?\s*(\d{1,2}:\d{2})?/);
          if (timeMatch) {
            startTime = timeMatch[1];
            endTime = timeMatch[2];
          }
        }

        // Parse ALLE Termine für event_dates Tabelle
        const allDates = aiData.dates?.map((d: any) => {
          const parsedDate = d.date ? parseGermanDate(d.date) : undefined;
          if (!parsedDate) return null;

          let dateStartTime: string | undefined;
          let dateEndTime: string | undefined;
          if (d.time) {
            const timeMatch = d.time.match(/(\d{1,2}:\d{2})\s*-?\s*(\d{1,2}:\d{2})?/);
            if (timeMatch) {
              dateStartTime = timeMatch[1];
              dateEndTime = timeMatch[2];
            }
          }

          return {
            date: parsedDate,
            startTime: dateStartTime,
            endTime: dateEndTime
          };
        }).filter((d: any) => d !== null) || [];

        const scrapedEvent: ScrapedEvent = {
          externalId,
          title: aiData.title || 'Unbekanntes Event',
          description: aiData.description,
          startDate,
          startTime,
          endTime,
          venueName: aiData.location?.name,
          venueAddress: aiData.location?.address,
          venuePostcode: aiData.location?.postal_code,
          venueCity: aiData.location?.city || 'Braunschweig',
          organizer: aiData.organizer?.name,
          imageUrl: aiData.image_urls?.[0],
          moodCategory: aiData.mood_category,
          price: aiData.price_info,
          isFree: aiData.is_free || (aiData.price_info && /kostenlos|frei/i.test(aiData.price_info)),
          ticketUrl: aiData.ticket_url,
          url,
          status: 'active',
          detailScraped: true,
          detailScrapedAt: new Date().toISOString(),
          allDates: allDates.length > 0 ? allDates : undefined,
        };

        console.log(`[AI Extract] Parsed event: ${scrapedEvent.title} - ${scrapedEvent.startDate || 'no date'} (${allDates.length} dates)`);
        return scrapedEvent;
      }
    }

    // Fallback: Klassisches Scraping
    const eventData = await page.evaluate((currentUrl) => {
      // Event-ID aus URL extrahieren
      const idMatch = currentUrl.match(/\/event\/(\d+)\//);
      const externalId = idMatch ? idMatch[1] : '';

      // Titel
      const h1 = document.querySelector('h1');
      const title = h1?.textContent?.trim() || '';

      // Organisator (meistens über h1)
      const organizerEl = document.querySelector('.article-author, [class*="author"]');
      const organizer = organizerEl?.textContent?.trim() || '';

      // Datum extrahieren (verschiedene Selektoren probieren)
      const dateSelectors = [
        '.event-date',
        '[class*="date"]',
        '.article-date',
        'time'
      ];

      let dateText = '';
      for (const selector of dateSelectors) {
        const el = document.querySelector(selector);
        if (el && el.textContent) {
          dateText = el.textContent.trim();
          if (dateText.length > 3) break;
        }
      }

      // Zeit extrahieren (z.B. "19:00 - 01:00 Uhr")
      const timeMatch = dateText.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
      const startTime = timeMatch ? `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}` : undefined;
      const endTime = timeMatch ? `${timeMatch[3].padStart(2, '0')}:${timeMatch[4]}` : undefined;

      // Beschreibung
      const descSelectors = [
        '.event-description',
        '[class*="description"]',
        '.article-text',
        'article p'
      ];

      let description = '';
      for (const selector of descSelectors) {
        const els = document.querySelectorAll(selector);
        if (els.length > 0) {
          description = Array.from(els)
            .map(el => el.textContent?.trim())
            .filter(t => t && t.length > 20)
            .join('\n\n');
          if (description) break;
        }
      }

      // Venue (Location)
      const venueSelectors = [
        '.event-location',
        '[class*="location"]',
        '[class*="venue"]'
      ];

      let venueText = '';
      for (const selector of venueSelectors) {
        const el = document.querySelector(selector);
        if (el && el.textContent) {
          venueText = el.textContent.trim();
          if (venueText.length > 3) break;
        }
      }

      // Parse Venue (Format: "Name, Straße Nr, PLZ, Stadt")
      const venueParts = venueText.split(',').map(s => s.trim());
      const venueName = venueParts[0] || undefined;
      const venueAddress = venueParts[1] || undefined;
      const venuePostcode = venueParts[2] || undefined;
      const venueCity = venueParts[3] || 'Braunschweig';

      // Bild
      const imgEl = document.querySelector('article img, .event-image img, [class*="event"] img');
      const imageUrl = (imgEl as HTMLImageElement)?.src || undefined;

      // Preis
      const priceSelectors = ['.event-price', '[class*="price"]', '[class*="eintritt"]'];
      let priceText = '';
      for (const selector of priceSelectors) {
        const el = document.querySelector(selector);
        if (el && el.textContent) {
          priceText = el.textContent.trim();
          break;
        }
      }

      const isFree = /kostenlos|frei|free|eintritt\s*frei/i.test(priceText + description);

      return {
        externalId,
        title,
        description: description || undefined,
        dateText,
        startTime,
        endTime,
        venueName,
        venueAddress,
        venuePostcode,
        venueCity,
        organizer: organizer || undefined,
        imageUrl,
        price: priceText || undefined,
        isFree,
      };
    }, url);

    await context.close();

    // Parse Datum
    const startDate = parseGermanDate(eventData.dateText);

    return {
      externalId: eventData.externalId,
      title: eventData.title,
      description: eventData.description,
      startDate,
      startTime: eventData.startTime,
      endTime: eventData.endTime,
      venueName: eventData.venueName,
      venueAddress: eventData.venueAddress,
      venuePostcode: eventData.venuePostcode,
      venueCity: eventData.venueCity || 'Braunschweig',
      organizer: eventData.organizer,
      imageUrl: eventData.imageUrl,
      price: eventData.price,
      isFree: eventData.isFree,
      url,
      status: 'active',
      detailScraped: true,
      detailScrapedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`[Events] Fehler bei ${url}:`, error);
    if (context) await context.close().catch(() => {});
    return null;
  }
}

/**
 * PHASE 3: Paralleles Detail-Scraping mit Rate Limiting
 * Speichert Events direkt nach dem Scraping in die Datenbank
 */
async function scrapeAllEventDetails(
  browser: Browser,
  urls: string[],
  concurrency: number = 3
): Promise<{ itemsScraped: number; itemsNew: number; itemsUpdated: number }> {
  let itemsScraped = 0;
  let itemsNew = 0;
  let itemsUpdated = 0;
  const total = urls.length;
  const scraped_at = new Date().toISOString();

  console.log(`[Events] Scrape ${total} Detail-Seiten (${concurrency} parallel)...`);

  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);
    const progress = Math.round((i / total) * 100);

    console.log(`[Events] Batch ${Math.floor(i/concurrency) + 1}/${Math.ceil(total/concurrency)} (${progress}%)...`);

    const batchPromises = batch.map(url => scrapeEventDetail(browser, url));
    const batchResults = await Promise.all(batchPromises);

    // Speichere Events SOFORT in Datenbank
    for (const event of batchResults) {
      if (event) {
        try {
          const { allDates, ...eventData } = event;
          const eventWithTimestamp: Omit<EventItem, 'id'> = { ...eventData, scraped_at };
          const result = upsertEvent(eventWithTimestamp, allDates);
          itemsScraped++;
          if (result.isNew) itemsNew++;
          if (result.hasChanged) itemsUpdated++;
        } catch (error) {
          console.error(`[Events] Fehler beim Speichern von ${event.externalId}:`, error);
        }
      }
    }

    // Rate Limiting: 500ms zwischen Batches
    if (i + concurrency < urls.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log(`[Events] ✓ ${itemsScraped}/${total} Events erfolgreich gescrapt und gespeichert`);
  return { itemsScraped, itemsNew, itemsUpdated };
}

/**
 * MAIN SCRAPER FUNCTION
 */
export async function scrapeEventsBraunschweig(
  maxEvents?: number
): Promise<{ success: boolean; itemsScraped: number; itemsNew: number; itemsUpdated: number; error?: string }> {
  const runId = startScraperRun("events-braunschweig");

  let itemsScraped = 0;
  let itemsNew = 0;
  let itemsUpdated = 0;

  try {
    console.log('[Events] Starte Browser...');
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

    // PHASE 1: Sammle alle Event-URLs
    const eventUrls = await collectAllEventUrls(page, 100);

    // Optional: Limitiere Anzahl
    const urlsToScrape = maxEvents ? eventUrls.slice(0, maxEvents) : eventUrls;

    // PHASE 2: Scrape Details parallel und speichere direkt in Datenbank
    const result = await scrapeAllEventDetails(browser, urlsToScrape, 3);
    itemsScraped = result.itemsScraped;
    itemsNew = result.itemsNew;
    itemsUpdated = result.itemsUpdated;

    await browser.close();

    console.log(`[Events] ✓ Scraping abgeschlossen: ${itemsScraped} Events (${itemsNew} neu, ${itemsUpdated} aktualisiert)`);

    endScraperRun(runId, { itemsScraped, itemsNew, itemsUpdated, success: true });

    return { success: true, itemsScraped, itemsNew, itemsUpdated };
  } catch (error) {
    console.error('[Events] Fehler beim Scraping:', error);

    const errorMessage = error instanceof Error ? error.message : String(error);
    endScraperRun(runId, { itemsScraped, itemsNew, itemsUpdated, success: false, error: errorMessage });

    return { success: false, itemsScraped, itemsNew, itemsUpdated, error: errorMessage };
  }
}

// CLI Interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const maxEvents = args.includes('--limit') ? parseInt(args[args.indexOf('--limit') + 1]) : undefined;

  scrapeEventsBraunschweig(maxEvents)
    .then((result) => {
      console.log("\n✓ Scraping abgeschlossen:", result);
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error("\n✗ Unerwarteter Fehler:", error);
      process.exit(1);
    });
}
