/**
 * Teste AI-Extraktion mit mehreren echten Events
 */

import { chromium } from "playwright";
import { extractEventDataWithAI } from "../lib/ai-summary";

const TEST_URLS = [
  "https://braunschweig.die-region.de/veranstaltungen-detailseite/event/101110553/zaubershow-nico-tobi-halloween/",
  "https://braunschweig.die-region.de/veranstaltungen-detailseite/event/100990596/heiligabend-fruehstuecksbuffet/",
  "https://braunschweig.die-region.de/veranstaltungen-detailseite/event/101056571/heinz-groening-verschollen-im-weihnachtsstollen-250/",
];

async function testMultipleEvents() {
  console.log('🧪 Teste AI-Extraktion mit mehreren Events...\n');

  const browser = await chromium.launch({ headless: true });

  for (let i = 0; i < TEST_URLS.length; i++) {
    const url = TEST_URLS[i];
    console.log(`\n${'='.repeat(80)}`);
    console.log(`[${i + 1}/${TEST_URLS.length}] Testing: ${url}`);
    console.log('='.repeat(80));

    try {
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

      // Extrahiere sauberen Text
      const pageText = await page.evaluate(() => {
        const clonedDoc = document.cloneNode(true) as Document;
        clonedDoc.querySelectorAll('script, style, nav, header, footer, noscript').forEach(el => el.remove());

        const text = clonedDoc.body.textContent || '';
        return text
          .replace(/\s+/g, ' ')
          .trim();
      });

      console.log(`\n📄 Text-Länge: ${pageText.length} Zeichen`);

      // AI-Extraktion
      const aiResult = await extractEventDataWithAI(pageText, url);

      if (aiResult && aiResult.event) {
        const ev = aiResult.event;
        console.log('\n✅ Erfolgreich extrahiert:');
        console.log(`   Titel: ${ev.title || '❌ FEHLT'}`);
        console.log(`   Beschreibung: ${ev.description ? ev.description.substring(0, 80) + '...' : '❌ FEHLT'}`);
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

        // Score
        let score = 0;
        if (ev.title) score++;
        if (ev.description && ev.description.length > 50) score++;
        if (ev.dates && ev.dates.length > 0) score++;
        if (ev.location?.name && ev.location.name.length > 3) score++;
        if (ev.location?.address) score++;
        if (ev.organizer?.name) score++;
        if (ev.price_info || ev.is_free) score++;
        if (ev.image_urls && ev.image_urls.length > 0) score++;

        console.log(`\n📊 Vollständigkeit: ${score}/8 (${Math.round(score/8*100)}%)`);
      } else {
        console.log('\n❌ AI-Extraktion fehlgeschlagen');
      }

      await page.close();
    } catch (error) {
      console.error(`\n❌ Fehler: ${error}`);
    }
  }

  await browser.close();
  console.log('\n' + '='.repeat(80));
  console.log('✨ Tests abgeschlossen!\n');
}

testMultipleEvents().catch(console.error);
