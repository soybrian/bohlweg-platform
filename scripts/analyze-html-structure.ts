/**
 * Analysiere HTML-Struktur einer Event-Seite
 */

import { chromium } from "playwright";

const TEST_URL = "https://braunschweig.die-region.de/veranstaltungen-detailseite/event/101109184/jens-uwe-dyffort-roswitha-von-den-driesch-pressure/";

async function analyzeHTML() {
  console.log('🔍 Analysiere HTML-Struktur...\n');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(TEST_URL, { waitUntil: 'networkidle', timeout: 30000 });

  // Extrahiere wichtige Informationen
  const data = await page.evaluate(() => {
    const result: any = {};

    // Titel
    const h1 = document.querySelector('h1');
    result.title = h1?.textContent?.trim();

    // Alle Texte mit "Datum", "Zeit", "Uhr"
    const allText = document.body.innerText;
    const dateMatches = allText.match(/\d{1,2}\.\s*\w+\s*\d{4}/g);
    const timeMatches = allText.match(/\d{1,2}:\d{2}/g);
    result.foundDates = dateMatches;
    result.foundTimes = timeMatches;

    // Suche nach Location-Info
    const locationKeywords = ['veranstaltungsort', 'location', 'adresse', 'ort'];
    result.locationTexts = [];
    for (const keyword of locationKeywords) {
      const elements = Array.from(document.querySelectorAll('*')).filter(el =>
        el.textContent?.toLowerCase().includes(keyword)
      );
      elements.forEach(el => {
        if (el.textContent && el.textContent.length < 200) {
          result.locationTexts.push(el.textContent.trim());
        }
      });
    }

    // Suche nach Veranstalter
    const organizerKeywords = ['veranstalter', 'organisator', 'von:'];
    result.organizerTexts = [];
    for (const keyword of organizerKeywords) {
      const elements = Array.from(document.querySelectorAll('*')).filter(el =>
        el.textContent?.toLowerCase().includes(keyword)
      );
      elements.forEach(el => {
        if (el.textContent && el.textContent.length < 200) {
          result.organizerTexts.push(el.textContent.trim());
        }
      });
    }

    // Alle Bilder
    const images = Array.from(document.querySelectorAll('img')).map(img => ({
      src: (img as HTMLImageElement).src,
      alt: (img as HTMLImageElement).alt
    }));
    result.images = images.filter(img => img.src && !img.src.includes('logo'));

    // Beschreibung (lange Textblöcke)
    const paragraphs = Array.from(document.querySelectorAll('p, div')).filter(el => {
      const text = el.textContent?.trim() || '';
      return text.length > 100 && text.length < 2000;
    }).map(el => el.textContent?.trim());
    result.descriptions = paragraphs.slice(0, 3);

    return result;
  });

  console.log('📋 Gefundene Daten:\n');
  console.log('Titel:', data.title);
  console.log('\nGefundene Daten:', data.foundDates);
  console.log('Gefundene Zeiten:', data.foundTimes);
  console.log('\nLocation-Texte:', data.locationTexts.slice(0, 5));
  console.log('\nVeranstalter-Texte:', data.organizerTexts.slice(0, 5));
  console.log('\nBilder:', data.images.slice(0, 3));
  console.log('\nBeschreibungen:', data.descriptions);

  await browser.close();
}

analyzeHTML().catch(console.error);
