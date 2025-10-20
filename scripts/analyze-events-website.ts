/**
 * Analyse-Script für https://braunschweig.die-region.de/
 * Untersucht die Website-Struktur und API-Calls
 */

import { chromium } from 'playwright';

async function analyzeWebsite() {
  console.log('[Analysis] Starte Browser...');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Capture all network requests
  const apiCalls: Array<{ url: string; method: string; response?: any }> = [];

  page.on('request', request => {
    const url = request.url();
    // Filtere interessante API Calls (JSON, GraphQL, etc.)
    if (url.includes('api') || url.includes('json') || url.includes('graphql') || url.includes('events')) {
      console.log(`[Request] ${request.method()} ${url}`);
    }
  });

  page.on('response', async response => {
    const url = response.url();
    const contentType = response.headers()['content-type'] || '';

    // Capture JSON responses
    if (contentType.includes('application/json') || url.includes('api')) {
      try {
        const data = await response.json();
        console.log(`[Response JSON] ${url}`);
        console.log('Data sample:', JSON.stringify(data).substring(0, 200));
        apiCalls.push({
          url,
          method: response.request().method(),
          response: data
        });
      } catch (e) {
        // Not JSON or failed to parse
      }
    }
  });

  console.log('[Analysis] Lade Website...');
  await page.goto('https://braunschweig.die-region.de/', {
    waitUntil: 'networkidle',
    timeout: 30000
  });

  console.log('\n[Analysis] Warte auf Event-Elemente...');
  await page.waitForTimeout(3000);

  // Analysiere DOM-Struktur
  const analysis = await page.evaluate(() => {
    // Finde Event-Container
    const possibleSelectors = [
      'article',
      '.event',
      '.event-item',
      '[class*="event"]',
      '[data-event]',
      '.card',
      '.listing-item'
    ];

    let eventElements: Element[] = [];
    let usedSelector = '';

    for (const selector of possibleSelectors) {
      const elements = Array.from(document.querySelectorAll(selector));
      if (elements.length > 0) {
        eventElements = elements;
        usedSelector = selector;
        break;
      }
    }

    // Analysiere erstes Event-Element
    const sampleEvent = eventElements[0];
    let eventStructure = {};

    if (sampleEvent) {
      eventStructure = {
        outerHTML: sampleEvent.outerHTML.substring(0, 500),
        textContent: sampleEvent.textContent?.substring(0, 300),
        classes: sampleEvent.className,
        attributes: Array.from(sampleEvent.attributes).map(attr => ({
          name: attr.name,
          value: attr.value
        }))
      };
    }

    // Suche nach Links zu Detail-Seiten
    const eventLinks = Array.from(document.querySelectorAll('a[href*="event"], a[href*="veranstaltung"]'))
      .map(a => (a as HTMLAnchorElement).href)
      .slice(0, 5);

    // Finde Pagination/Load More
    const paginationElements = Array.from(document.querySelectorAll('[class*="pagination"], [class*="load-more"], button'))
      .filter(el => el.textContent?.toLowerCase().includes('mehr') || el.textContent?.toLowerCase().includes('weiter'));

    // Finde Filter
    const filterElements = Array.from(document.querySelectorAll('select, [class*="filter"], [role="combobox"]'));

    return {
      eventCount: eventElements.length,
      usedSelector,
      sampleEvent: eventStructure,
      eventLinks,
      hasPagination: paginationElements.length > 0,
      paginationHTML: paginationElements[0]?.outerHTML.substring(0, 200),
      hasFilters: filterElements.length > 0,
      filterCount: filterElements.length,
      pageTitle: document.title,
      metaDescription: (document.querySelector('meta[name="description"]') as HTMLMetaElement)?.content,
    };
  });

  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║           WEBSITE ANALYSIS RESULTS                   ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  console.log('Page Info:');
  console.log(`  Title: ${analysis.pageTitle}`);
  console.log(`  Description: ${analysis.metaDescription}`);
  console.log();

  console.log('Event Elements:');
  console.log(`  Found: ${analysis.eventCount} events`);
  console.log(`  Selector: ${analysis.usedSelector}`);
  console.log(`  Has Pagination: ${analysis.hasPagination}`);
  console.log(`  Has Filters: ${analysis.hasFilters} (${analysis.filterCount} elements)`);
  console.log();

  console.log('Sample Event Structure:');
  console.log(JSON.stringify(analysis.sampleEvent, null, 2));
  console.log();

  console.log('Event Links (Sample):');
  analysis.eventLinks.forEach((link, i) => {
    console.log(`  ${i + 1}. ${link}`);
  });
  console.log();

  console.log('API Calls Detected:');
  if (apiCalls.length > 0) {
    apiCalls.forEach((call, i) => {
      console.log(`  ${i + 1}. ${call.method} ${call.url}`);
    });
  } else {
    console.log('  No API calls detected - likely server-side rendered');
  }
  console.log();

  // Scroll testen (für Infinite Scroll)
  console.log('[Analysis] Teste Scroll-Verhalten...');
  const initialCount = analysis.eventCount;
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(2000);

  const afterScrollCount = await page.evaluate(() => {
    return document.querySelectorAll('article, .event, [class*="event"]').length;
  });

  console.log(`Events vor Scroll: ${initialCount}`);
  console.log(`Events nach Scroll: ${afterScrollCount}`);
  console.log(`Infinite Scroll: ${afterScrollCount > initialCount ? 'JA' : 'NEIN'}`);
  console.log();

  // Screenshot
  await page.screenshot({ path: 'analysis-screenshot.png', fullPage: true });
  console.log('[Analysis] Screenshot gespeichert: analysis-screenshot.png');

  console.log('\n[Analysis] Drücke Enter zum Beenden (Browser bleibt offen zur manuellen Inspektion)...');
  await new Promise(resolve => process.stdin.once('data', resolve));

  await browser.close();
}

analyzeWebsite().catch(console.error);
