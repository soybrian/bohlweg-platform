import { chromium } from 'playwright';
import * as fs from 'fs';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const apiCalls: any[] = [];

  page.on('request', req => {
    const url = req.url();
    if (url.includes('braunschweig.die-region.de') && !url.endsWith('.css') && !url.endsWith('.js') && !url.endsWith('.png') && !url.endsWith('.jpg')) {
      console.log('[REQUEST]', req.method(), url);
    }
  });

  page.on('response', async res => {
    const url = res.url();
    const ct = res.headers()['content-type'] || '';

    if (ct.includes('application/json')) {
      try {
        const json = await res.json();
        apiCalls.push({ url, method: res.request().method(), data: json });
        console.log('[JSON RESPONSE]', url, 'Keys:', Object.keys(json));
      } catch {}
    }
  });

  console.log('Loading main page...\n');
  await page.goto('https://braunschweig.die-region.de/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);

  const analysis = await page.evaluate(() => {
    const eventElements = Array.from(document.querySelectorAll('[class*="event"]'));

    // Analyze first 3 events
    const samples = eventElements.slice(0, 3).map(el => {
      const links = Array.from(el.querySelectorAll('a')).map((a: any) => ({
        href: a.href,
        text: a.textContent?.trim()
      }));

      return {
        outerHTML: el.outerHTML.substring(0, 1500),
        classes: el.className,
        dataAttributes: Array.from(el.attributes)
          .filter((attr: any) => attr.name.startsWith('data-'))
          .map((attr: any) => ({ name: attr.name, value: attr.value })),
        links,
        textContent: el.textContent?.trim().substring(0, 400)
      };
    });

    // Check URL structure
    const firstLink = eventElements[0]?.querySelector('a')?.href;

    return {
      totalEvents: eventElements.length,
      samples,
      firstEventLink: firstLink,
      pageUrl: window.location.href
    };
  });

  console.log('\n=== RESULTS ===');
  console.log(`Total Events Found: ${analysis.totalEvents}`);
  console.log(`\nFirst Event Link: ${analysis.firstEventLink}`);
  console.log(`\nAPI Calls: ${apiCalls.length}`);

  if (apiCalls.length > 0) {
    console.log('\nAPI Endpoints:');
    apiCalls.forEach(call => {
      console.log(`  ${call.method} ${call.url}`);
    });
  }

  console.log('\n=== EVENT SAMPLES ===');
  analysis.samples.forEach((sample, i) => {
    console.log(`\n--- Event ${i + 1} ---`);
    console.log('Classes:', sample.classes);
    console.log('Data Attributes:', sample.dataAttributes);
    console.log('Links:', sample.links);
    console.log('HTML Sample:', sample.outerHTML);
  });

  // Save to file
  fs.writeFileSync('event-analysis.json', JSON.stringify({ analysis, apiCalls }, null, 2));
  console.log('\n✓ Analysis saved to event-analysis.json');

  // Visit detail page if exists
  if (analysis.firstEventLink) {
    console.log(`\n\nVisiting detail page: ${analysis.firstEventLink}`);
    await page.goto(analysis.firstEventLink, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const detailAnalysis = await page.evaluate(() => {
      return {
        title: document.title,
        h1: document.querySelector('h1')?.textContent,
        description: document.querySelector('[class*="description"], .description, [class*="text"]')?.textContent?.substring(0, 500),
        date: document.querySelector('[class*="date"], .date, time')?.textContent,
        location: document.querySelector('[class*="location"], [class*="venue"], .location')?.textContent,
        image: document.querySelector('img')?.src,
        bodyHTML: document.body.innerHTML.substring(0, 2000)
      };
    });

    console.log('\n=== DETAIL PAGE ===');
    console.log(detailAnalysis);

    fs.writeFileSync('event-detail-analysis.json', JSON.stringify(detailAnalysis, null, 2));
    console.log('\n✓ Detail analysis saved to event-detail-analysis.json');
  }

  await browser.close();
})();
