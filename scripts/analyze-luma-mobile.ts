/**
 * Analyze Luma Tech mobile layout
 */
import { chromium } from 'playwright';

async function analyzeLumaMobile() {
  console.log('🔍 Analyzing Luma Tech mobile layout...\n');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 }, // iPhone X size
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15'
  });

  const page = await context.newPage();

  console.log('📱 Opening https://luma.com/tech in mobile viewport...\n');
  await page.goto('https://luma.com/tech', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Analyze date header structure
  console.log('=== DATE HEADER STRUCTURE ===\n');
  const dateHeaders = await page.evaluate(() => {
    const headers = Array.from(document.querySelectorAll('[class*="date"], h2, h3'))
      .filter(el => {
        const text = el.textContent?.trim() || '';
        return text.match(/\w{3},?\s+\w{3}\s+\d{1,2}/) || text.match(/\d{1,2}\s+\w+/);
      })
      .slice(0, 3);

    return headers.map(el => ({
      tag: el.tagName,
      classes: el.className,
      text: el.textContent?.trim(),
      styles: window.getComputedStyle(el).cssText.split(';').filter(s =>
        s.includes('font') || s.includes('color') || s.includes('margin') || s.includes('padding')
      ).join('; ')
    }));
  });

  console.log('Date Headers:', JSON.stringify(dateHeaders, null, 2));

  // Analyze timeline structure
  console.log('\n=== TIMELINE STRUCTURE ===\n');
  const timelineInfo = await page.evaluate(() => {
    // Find container that holds date groups
    const containers = Array.from(document.querySelectorAll('[class*="timeline"], [class*="list"], section, main'))
      .filter(el => el.querySelectorAll('[class*="event"], [class*="card"]').length > 2);

    if (containers.length === 0) return null;

    const container = containers[0];
    const styles = window.getComputedStyle(container);

    return {
      tag: container.tagName,
      classes: container.className,
      display: styles.display,
      flexDirection: styles.flexDirection,
      gap: styles.gap,
      padding: styles.padding,
      margin: styles.margin
    };
  });

  console.log('Timeline Container:', JSON.stringify(timelineInfo, null, 2));

  // Analyze event card structure
  console.log('\n=== EVENT CARD STRUCTURE ===\n');
  const eventCards = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('[class*="event"], [class*="card"], a[href*="/event"]'))
      .slice(0, 3);

    return cards.map(card => {
      const styles = window.getComputedStyle(card);
      const img = card.querySelector('img');
      const imgStyles = img ? window.getComputedStyle(img) : null;

      return {
        tag: card.tagName,
        classes: card.className,
        display: styles.display,
        flexDirection: styles.flexDirection,
        gap: styles.gap,
        padding: styles.padding,
        margin: styles.margin,
        border: styles.border,
        borderRadius: styles.borderRadius,
        backgroundColor: styles.backgroundColor,
        image: img ? {
          width: imgStyles?.width,
          height: imgStyles?.height,
          borderRadius: imgStyles?.borderRadius,
          objectFit: imgStyles?.objectFit
        } : null,
        innerHTML: card.innerHTML.substring(0, 500)
      };
    });
  });

  console.log('Event Cards:', JSON.stringify(eventCards, null, 2));

  // Analyze typography
  console.log('\n=== TYPOGRAPHY ===\n');
  const typography = await page.evaluate(() => {
    const titleEls = Array.from(document.querySelectorAll('h1, h2, h3, h4, [class*="title"], [class*="name"]'))
      .filter(el => {
        const rect = el.getBoundingClientRect();
        return rect.width > 100 && el.textContent && el.textContent.length > 10;
      })
      .slice(0, 5);

    return titleEls.map(el => {
      const styles = window.getComputedStyle(el);
      return {
        tag: el.tagName,
        text: el.textContent?.trim().substring(0, 50),
        fontSize: styles.fontSize,
        fontWeight: styles.fontWeight,
        lineHeight: styles.lineHeight,
        color: styles.color
      };
    });
  });

  console.log('Typography:', JSON.stringify(typography, null, 2));

  // Take screenshot
  console.log('\n📸 Taking screenshot...\n');
  await page.screenshot({ path: '/tmp/luma-mobile-screenshot.png', fullPage: true });
  console.log('Screenshot saved to /tmp/luma-mobile-screenshot.png\n');

  console.log('✅ Analysis complete! Browser will stay open for 30 seconds...\n');
  await page.waitForTimeout(30000);

  await browser.close();
}

analyzeLumaMobile().catch(console.error);
