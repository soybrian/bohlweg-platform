/**
 * Re-scrape einzelnes Event und speichere in DB
 */

import { chromium } from "playwright";
import { extractEventDataWithAI } from "../lib/ai-summary";
import { getDatabase } from "../lib/db";

const EVENT_URL = "https://braunschweig.die-region.de/veranstaltungen-detailseite/event/101064672/industriekultur-cafe-die-firma-guenther-tegtmeyer-wissenschaftliche-apparate/";

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

async function rescrapeEvent() {
  console.log('🔄 Re-scraping Event...\n');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(EVENT_URL, { waitUntil: 'networkidle', timeout: 30000 });

  // Extrahiere sauberen Text
  const pageText = await page.evaluate(() => {
    const clonedDoc = document.cloneNode(true) as Document;
    clonedDoc.querySelectorAll('script, style, nav, header, footer, noscript').forEach(el => el.remove());
    const text = clonedDoc.body.textContent || '';
    return text.replace(/\s+/g, ' ').trim();
  });

  console.log('🤖 AI-Extraktion...\n');
  const aiResult = await extractEventDataWithAI(pageText, EVENT_URL);

  if (aiResult && aiResult.event) {
    const aiData = aiResult.event;

    // Parse erste Termin
    const firstDate = aiData.dates?.[0];
    const startDate = firstDate?.date ? parseGermanDate(firstDate.date) : undefined;

    let startTime: string | undefined;
    let endTime: string | undefined;
    if (firstDate?.time) {
      const timeMatch = firstDate.time.match(/(\d{1,2}:\d{2})\s*-?\s*(\d{1,2}:\d{2})?/);
      if (timeMatch) {
        startTime = timeMatch[1];
        endTime = timeMatch[2];
      }
    }

    // Event-ID aus URL
    const idMatch = EVENT_URL.match(/\/event\/(\d+)\//);
    const externalId = idMatch ? idMatch[1] : '';

    const eventData = {
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
      price: aiData.price_info,
      isFree: aiData.is_free || (aiData.price_info && /kostenlos|frei/i.test(aiData.price_info)),
      category: aiData.category,
      url: EVENT_URL,
      status: 'active',
      scraped_at: new Date().toISOString(),
    };

    console.log('📋 Event-Daten:\n');
    console.log(`   Titel: ${eventData.title}`);
    console.log(`   Beschreibung: ${eventData.description?.substring(0, 80)}...`);
    console.log(`   Start: ${eventData.startDate} ${eventData.startTime || ''}`);
    console.log(`   Location: ${eventData.venueName}`);
    console.log(`   Adresse: ${eventData.venueAddress}, ${eventData.venuePostcode} ${eventData.venueCity}`);
    console.log(`   Veranstalter: ${eventData.organizer}`);
    console.log(`   Preis: ${eventData.price}`);

    // Speichere in DB
    console.log('\n💾 Speichere in Datenbank...\n');
    const db = getDatabase();

    db.prepare(`
      INSERT OR REPLACE INTO events (
        externalId, title, description, startDate, startTime, endTime,
        venueName, venueAddress, venuePostcode, venueCity,
        organizer, imageUrl, category, price, isFree, url, status, scraped_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      eventData.externalId,
      eventData.title,
      eventData.description,
      eventData.startDate,
      eventData.startTime,
      eventData.endTime,
      eventData.venueName,
      eventData.venueAddress,
      eventData.venuePostcode,
      eventData.venueCity,
      eventData.organizer,
      eventData.imageUrl,
      eventData.category,
      eventData.price,
      eventData.isFree ? 1 : 0,
      eventData.url,
      eventData.status,
      eventData.scraped_at
    );

    console.log('✅ Event erfolgreich in Datenbank gespeichert!\n');

    // Verifiziere
    const saved = db.prepare('SELECT * FROM events WHERE externalId = ?').get(externalId);
    console.log('🔍 Verifizierung:\n');
    console.log(saved);
  } else {
    console.log('❌ AI-Extraktion fehlgeschlagen');
  }

  await browser.close();
}

rescrapeEvent().catch(console.error);
