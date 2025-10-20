/**
 * Test Event-Scraping für Beatles-Event
 */

import { chromium } from "playwright";
import { extractEventDataWithAI } from "../lib/ai-summary";

const TEST_URL = "https://braunschweig.die-region.de/veranstaltungen-detailseite/event/101061060/beatles-an-bord/";

async function testBeatlesEvent() {
  console.log('🔍 Teste Beatles-Event Scraping...\n');
  console.log(`URL: ${TEST_URL}\n`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(TEST_URL, { waitUntil: 'networkidle', timeout: 30000 });

  // Extrahiere sauberen Text (wie im Scraper)
  const pageText = await page.evaluate(() => {
    const clonedDoc = document.cloneNode(true) as Document;
    clonedDoc.querySelectorAll('script, style, nav, header, footer, noscript').forEach(el => el.remove());

    const text = clonedDoc.body.textContent || '';
    return text
      .replace(/\s+/g, ' ')
      .trim();
  });

  console.log(`📄 Text-Länge: ${pageText.length} Zeichen\n`);
  console.log('📋 Text-Preview (erste 1000 Zeichen):\n');
  console.log(pageText.substring(0, 1000) + '...\n');

  // AI-Extraktion
  console.log('🤖 AI-Extraktion startet...\n');
  const aiResult = await extractEventDataWithAI(pageText, TEST_URL);

  if (aiResult && aiResult.event) {
    const ev = aiResult.event;
    console.log('✅ Erfolgreich extrahiert:\n');
    console.log(`   Titel: ${ev.title || '❌ FEHLT'}`);
    console.log(`   Beschreibung: ${ev.description ? ev.description.substring(0, 100) + '...' : '❌ FEHLT'}`);
    console.log(`   Termine: ${ev.dates && ev.dates.length > 0 ? ev.dates.length + ' gefunden' : '❌ FEHLT'}`);
    if (ev.dates && ev.dates.length > 0) {
      ev.dates.forEach((d: any, idx: number) => {
        console.log(`      ${idx + 1}. ${d.date} ${d.time || ''}`);
      });
    }
    console.log(`   Location: ${ev.location?.name || '❌ FEHLT'}`);
    console.log(`   Adresse: ${ev.location?.address || '❌ FEHLT'}`);
    console.log(`   PLZ/Stadt: ${ev.location?.postal_code || '?'} ${ev.location?.city || '?'}`);
    console.log(`   Veranstalter: ${ev.organizer?.name || '❌ FEHLT'}`);
    console.log(`   Preis: ${ev.price_info || (ev.is_free ? 'Kostenlos' : '❌ FEHLT')}`);
    console.log(`   Bilder: ${ev.image_urls && ev.image_urls.length > 0 ? ev.image_urls.length + ' gefunden' : '❌ FEHLT'}`);

    console.log('\n📊 Vollständige JSON-Daten:\n');
    console.log(JSON.stringify(ev, null, 2));
  } else {
    console.log('❌ AI-Extraktion fehlgeschlagen');
  }

  await browser.close();
}

testBeatlesEvent().catch(console.error);
