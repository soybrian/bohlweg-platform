/**
 * Debug script to analyze a specific event page
 */
import { chromium } from 'playwright';

const url = 'https://braunschweig.die-region.de/veranstaltungen-detailseite/event/101064672/industriekultur-cafe-die-firma-guenther-tegtmeyer-wissenschaftliche-apparate/';

async function debugEventPage() {
  console.log('Starte Browser...');
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  console.log('Lade Seite:', url);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Extract raw HTML structure
  const pageStructure = await page.evaluate(() => {
    // Get all text content
    const bodyText = document.body.textContent?.replace(/\s+/g, ' ').trim().substring(0, 2000);

    // Find main content area
    const mainContent = document.querySelector('main, article, .content, [role="main"]');
    const mainHTML = mainContent?.innerHTML.substring(0, 2000) || 'No main content found';

    // Find all headings
    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4'))
      .map(h => `${h.tagName}: ${h.textContent?.trim()}`)
      .slice(0, 10);

    // Find all elements with class containing 'event', 'date', 'time', 'location', 'venue'
    const eventElements = Array.from(document.querySelectorAll('[class*="event"], [class*="date"], [class*="time"], [class*="location"], [class*="venue"], [class*="ort"]'))
      .map(el => ({
        tag: el.tagName,
        class: el.className,
        text: el.textContent?.trim().substring(0, 100)
      }))
      .slice(0, 20);

    // Find all paragraphs
    const paragraphs = Array.from(document.querySelectorAll('p'))
      .map(p => p.textContent?.trim())
      .filter(t => t && t.length > 20)
      .slice(0, 5);

    // Find all links with ticket or more info
    const links = Array.from(document.querySelectorAll('a'))
      .filter(a => {
        const href = a.getAttribute('href') || '';
        const text = a.textContent?.toLowerCase() || '';
        return href.includes('ticket') || text.includes('ticket') || text.includes('mehr') || text.includes('info');
      })
      .map(a => ({
        text: a.textContent?.trim(),
        href: a.getAttribute('href')
      }))
      .slice(0, 10);

    return {
      bodyText,
      mainHTML,
      headings,
      eventElements,
      paragraphs,
      links
    };
  });

  console.log('\n=== PAGE STRUCTURE ===');
  console.log('\n--- Body Text (first 2000 chars) ---');
  console.log(pageStructure.bodyText);

  console.log('\n--- Headings ---');
  pageStructure.headings.forEach(h => console.log(h));

  console.log('\n--- Event-related Elements ---');
  pageStructure.eventElements.forEach(el => {
    console.log(`${el.tag}.${el.class}:`, el.text);
  });

  console.log('\n--- Paragraphs ---');
  pageStructure.paragraphs.forEach((p, i) => console.log(`P${i+1}:`, p));

  console.log('\n--- Links ---');
  pageStructure.links.forEach(l => console.log(`"${l.text}" -> ${l.href}`));

  console.log('\n--- Main Content HTML (first 2000 chars) ---');
  console.log(pageStructure.mainHTML);

  // Try the current scraper logic
  console.log('\n\n=== TESTING CURRENT SCRAPER LOGIC ===');
  const scrapedData = await page.evaluate(() => {
    // Event-ID aus URL extrahieren
    const idMatch = window.location.href.match(/\/event\/(\d+)\//);
    const externalId = idMatch ? idMatch[1] : '';

    // Titel
    const h1 = document.querySelector('h1');
    const title = h1?.textContent?.trim() || '';

    // Organisator
    const organizerEl = document.querySelector('.article-author, [class*="author"]');
    const organizer = organizerEl?.textContent?.trim() || '';

    // Datum extrahieren
    const dateSelectors = [
      '.event-date',
      '[class*="date"]',
      '.article-date',
      'time'
    ];

    let dateText = '';
    let dateSelector = '';
    for (const selector of dateSelectors) {
      const el = document.querySelector(selector);
      if (el && el.textContent) {
        dateText = el.textContent.trim();
        dateSelector = selector;
        if (dateText.length > 3) break;
      }
    }

    // Beschreibung
    const descSelectors = [
      '.event-description',
      '[class*="description"]',
      '.article-text',
      'article p'
    ];

    let description = '';
    let descSelector = '';
    for (const selector of descSelectors) {
      const els = document.querySelectorAll(selector);
      if (els.length > 0) {
        description = Array.from(els)
          .map(el => el.textContent?.trim())
          .filter(t => t && t.length > 20)
          .join('\n\n');
        descSelector = selector;
        if (description) break;
      }
    }

    // Venue (Location)
    const venueSelectors = [
      '.event-location',
      '[class*="location"]',
      '[class*="venue"]',
      '[class*="ort"]'
    ];

    let venueText = '';
    let venueSelector = '';
    for (const selector of venueSelectors) {
      const el = document.querySelector(selector);
      if (el && el.textContent) {
        venueText = el.textContent.trim();
        venueSelector = selector;
        if (venueText.length > 3) break;
      }
    }

    // Bild
    const imgEl = document.querySelector('article img, .event-image img, [class*="event"] img');
    const imageUrl = (imgEl as HTMLImageElement)?.src || '';

    return {
      externalId,
      title,
      titleFound: !!h1,
      organizer,
      organizerSelector: organizerEl ? 'found' : 'not found',
      dateText,
      dateSelector,
      description,
      descSelector,
      descriptionLength: description.length,
      venueText,
      venueSelector,
      imageUrl
    };
  });

  console.log('\nScraped Data:');
  console.log(JSON.stringify(scrapedData, null, 2));

  console.log('\n\nPress any key to close browser...');
  await page.waitForTimeout(60000); // Keep open for 1 minute to inspect
  await browser.close();
}

debugEventPage().catch(console.error);
