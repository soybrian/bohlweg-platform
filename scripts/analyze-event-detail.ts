/**
 * Analyze Event Detail Page Structure
 */

import { chromium } from "playwright";

const EVENT_URL = "https://braunschweig.die-region.de/veranstaltungen-detailseite/event/101109184/jens-uwe-dyffort-roswitha-von-den-driesch-pressure/";

async function analyzeEventDetail() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('Loading event detail page...');
  await page.goto(EVENT_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1000);

  // Extract full HTML content
  const html = await page.content();

  // Extract visible text content
  const textContent = await page.evaluate(() => {
    // Get main content area
    const main = document.querySelector('main') || document.body;
    return main.innerText;
  });

  // Extract structured data
  const eventData = await page.evaluate(() => {
    const data: any = {};

    // Title
    data.title = document.querySelector('h1')?.textContent?.trim() || '';

    // Date & Time
    const dateTimeElements = Array.from(document.querySelectorAll('*')).filter(el => {
      const text = el.textContent || '';
      return text.match(/\d{1,2}\.\s*\w+\s*\d{4}/) || text.match(/\d{1,2}:\d{2}/);
    });
    data.dateTimeInfo = dateTimeElements.slice(0, 5).map(el => ({
      tag: el.tagName,
      class: el.className,
      text: el.textContent?.trim()
    }));

    // Venue/Location
    const locationElements = Array.from(document.querySelectorAll('*')).filter(el => {
      const text = el.textContent?.toLowerCase() || '';
      return text.includes('veranstaltungsort') || text.includes('adresse') || text.includes('ort');
    });
    data.locationInfo = locationElements.slice(0, 5).map(el => ({
      tag: el.tagName,
      class: el.className,
      text: el.textContent?.trim()?.substring(0, 200)
    }));

    // Description
    const descElements = document.querySelectorAll('p, .description, [class*="text"], [class*="content"]');
    data.descriptions = Array.from(descElements).slice(0, 10).map(el => ({
      tag: el.tagName,
      class: el.className,
      text: el.textContent?.trim()?.substring(0, 200)
    }));

    // Images
    const images = Array.from(document.querySelectorAll('img')).map(img => ({
      src: (img as HTMLImageElement).src,
      alt: (img as HTMLImageElement).alt
    }));
    data.images = images.slice(0, 5);

    // All visible content blocks
    const contentBlocks = Array.from(document.querySelectorAll('div[class*="event"], section, article')).map(el => ({
      class: el.className,
      text: el.textContent?.trim()?.substring(0, 300)
    }));
    data.contentBlocks = contentBlocks.slice(0, 10);

    return data;
  });

  console.log('\n=== EVENT DATA STRUCTURE ===\n');
  console.log(JSON.stringify(eventData, null, 2));

  console.log('\n=== TEXT CONTENT (first 2000 chars) ===\n');
  console.log(textContent.substring(0, 2000));

  await browser.close();
}

analyzeEventDetail().catch(console.error);
