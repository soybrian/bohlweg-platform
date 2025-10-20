/**
 * Test verbesserter Event-Extraktion
 */

import { chromium } from "playwright";
import { extractEventDataWithAI } from "../lib/ai-summary";

const TEST_URL = "https://braunschweig.die-region.de/veranstaltungen-detailseite/event/101064672/industriekultur-cafe-die-firma-guenther-tegtmeyer-wissenschaftliche-apparate/";

async function testImprovedExtraction() {
  console.log('🧪 Teste verbesserte Event-Extraktion...\n');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(TEST_URL, { waitUntil: 'networkidle', timeout: 30000 });

  // Extrahiere sauberen Text (wie im neuen Scraper)
  const pageText = await page.evaluate(() => {
    const clonedDoc = document.cloneNode(true) as Document;
    clonedDoc.querySelectorAll('script, style, nav, header, footer, noscript').forEach(el => el.remove());

    const text = clonedDoc.body.textContent || '';
    return text
      .replace(/\s+/g, ' ')
      .trim();
  });

  console.log(`📄 Extrahierter Text-Länge: ${pageText.length} Zeichen\n`);
  console.log('📋 Text-Preview (erste 500 Zeichen):\n');
  console.log(pageText.substring(0, 500) + '...\n');

  // AI-Extraktion
  console.log('🤖 AI-Extraktion startet...\n');
  const aiResult = await extractEventDataWithAI(pageText, TEST_URL);

  if (aiResult && aiResult.event) {
    console.log('✅ AI-Extraktion erfolgreich!\n');
    console.log(JSON.stringify(aiResult.event, null, 2));

    // Vollständigkeits-Check
    console.log('\n📊 Vollständigkeits-Check:');
    const checks = {
      '  Titel': aiResult.event.title && aiResult.event.title.length > 5,
      '  Beschreibung': aiResult.event.description && aiResult.event.description.length > 50,
      '  Termine': aiResult.event.dates && aiResult.event.dates.length > 0,
      '  Location Name': aiResult.event.location?.name && aiResult.event.location.name.length > 3,
      '  Location Adresse': aiResult.event.location?.address && aiResult.event.location.address.length > 3,
      '  Veranstalter': aiResult.event.organizer?.name && aiResult.event.organizer.name.length > 3,
      '  Bilder': aiResult.event.image_urls && aiResult.event.image_urls.length > 0,
    };

    Object.entries(checks).forEach(([name, ok]) => {
      console.log(`${ok ? '✅' : '❌'} ${name}`);
    });
  } else {
    console.log('❌ AI-Extraktion fehlgeschlagen\n');
  }

  await browser.close();
}

testImprovedExtraction().catch(console.error);
