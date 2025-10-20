import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Track API calls
  const apiCalls: string[] = [];
  page.on('response', async response => {
    const url = response.url();
    if (url.includes('api') || url.includes('.json') || response.headers()['content-type']?.includes('application/json')) {
      apiCalls.push(`${response.request().method()} ${url}`);
    }
  });

  console.log('Loading https://braunschweig.die-region.de/ ...');
  await page.goto('https://braunschweig.die-region.de/', { waitUntil: 'networkidle' });

  await page.waitForTimeout(2000);

  const data = await page.evaluate(() => {
    const articles = document.querySelectorAll('article');
    const events = document.querySelectorAll('[class*="event"]');
    const cards = document.querySelectorAll('.card, [class*="card"]');

    const allPossible = Array.from(articles).length || Array.from(events).length || Array.from(cards).length;

    // Get first event HTML
    const firstEl = articles[0] || events[0] || cards[0];
    const sample = firstEl ? {
      html: firstEl.outerHTML.substring(0, 800),
      text: firstEl.textContent?.substring(0, 300),
      links: Array.from(firstEl.querySelectorAll('a')).map((a: any) => a.href).slice(0, 3)
    } : null;

    return {
      count: { articles: articles.length, events: events.length, cards: cards.length },
      sample,
      bodyClasses: document.body.className,
      scripts: Array.from(document.querySelectorAll('script[src]')).map((s: any) => s.src).filter(src => src.includes('vue') || src.includes('react') || src.includes('angular') || src.includes('jquery')),
    };
  });

  console.log('\n=== ANALYSIS ===');
  console.log('Counts:', data.count);
  console.log('\nBody classes:', data.bodyClasses);
  console.log('\nFrameworks:', data.scripts);
  console.log('\nAPI Calls:', apiCalls);
  console.log('\nSample Event:');
  console.log(data.sample?.html);

  await browser.close();
})();
