/**
 * Test AI Event Extraction
 */

import { chromium } from "playwright";
import { extractEventDataWithAI } from "../lib/ai-summary";

const EVENT_URL = "https://braunschweig.die-region.de/veranstaltungen-detailseite/event/101109184/jens-uwe-dyffort-roswitha-von-den-driesch-pressure/";

async function testAIExtraction() {
  console.log('🚀 Teste AI-Extraktion...\n');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(EVENT_URL, { waitUntil: 'networkidle', timeout: 30000 });
  const htmlContent = await page.content();

  console.log(`📄 HTML-Länge: ${htmlContent.length} Zeichen\n`);

  const extracted = await extractEventDataWithAI(htmlContent, EVENT_URL);

  console.log('\n✅ Extrahierte Daten:\n');
  console.log(JSON.stringify(extracted, null, 2));

  await browser.close();
}

testAIExtraction().catch(console.error);
