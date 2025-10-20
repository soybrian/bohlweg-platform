/**
 * Test Event Scraping für einzelnes Event
 */

import { chromium } from "playwright";
import { extractEventDataWithAI } from "../lib/ai-summary";

const TEST_URL = "https://braunschweig.die-region.de/veranstaltungen-detailseite/event/101109184/jens-uwe-dyffort-roswitha-von-den-driesch-pressure/";

async function testSingleEvent() {
  console.log('🔍 Teste Event-Scraping...\n');
  console.log(`URL: ${TEST_URL}\n`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(TEST_URL, { waitUntil: 'networkidle', timeout: 30000 });
  const htmlContent = await page.content();

  console.log(`📄 HTML-Länge: ${htmlContent.length} Zeichen\n`);

  // Test AI-Extraktion
  console.log('🤖 AI-Extraktion startet...\n');
  const aiResult = await extractEventDataWithAI(htmlContent, TEST_URL);

  if (aiResult && aiResult.event) {
    console.log('✅ AI-Extraktion erfolgreich!\n');
    console.log('📋 Extrahierte Daten:\n');
    console.log(JSON.stringify(aiResult.event, null, 2));

    // Zeige Vollständigkeit
    console.log('\n📊 Vollständigkeit:');
    const fields = {
      'Titel': aiResult.event.title,
      'Beschreibung': aiResult.event.description,
      'Termine': aiResult.event.dates,
      'Location Name': aiResult.event.location?.name,
      'Location Adresse': aiResult.event.location?.address,
      'Location PLZ': aiResult.event.location?.postal_code,
      'Location Stadt': aiResult.event.location?.city,
      'Veranstalter Name': aiResult.event.organizer?.name,
      'Veranstalter Telefon': aiResult.event.organizer?.phone,
      'Veranstalter Email': aiResult.event.organizer?.email,
      'Preis-Info': aiResult.event.price_info,
      'Ist kostenlos': aiResult.event.is_free,
      'Bilder': aiResult.event.image_urls,
    };

    Object.entries(fields).forEach(([name, value]) => {
      const status = value ? '✅' : '❌';
      const preview = value ? (Array.isArray(value) ? `${value.length} Items` : String(value).substring(0, 50)) : 'FEHLT';
      console.log(`  ${status} ${name}: ${preview}`);
    });
  } else {
    console.log('❌ AI-Extraktion fehlgeschlagen\n');
  }

  await browser.close();
}

testSingleEvent().catch(console.error);
