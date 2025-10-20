/**
 * Analyze Luma Tech timeline structure in detail
 */
import { chromium } from 'playwright';

async function analyzeLumaTimeline() {
  console.log('🔍 Analyzing Luma Tech timeline structure...\n');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 }, // iPhone X size
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15'
  });

  const page = await context.newPage();

  console.log('📱 Opening https://luma.com/tech in mobile viewport...\n');
  await page.goto('https://luma.com/tech', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);

  // Analyze the timeline structure
  console.log('=== TIMELINE STRUCTURE ===\n');
  const timelineStructure = await page.evaluate(() => {
    // Find all month separators
    const monthSeparators = Array.from(document.querySelectorAll('.month, [class*="month"]'))
      .filter(el => {
        const text = el.textContent?.trim() || '';
        return text.match(/januar|februar|märz|april|mai|juni|juli|august|september|oktober|november|dezember/i);
      })
      .slice(0, 3);

    // Find timeline container
    const timeline = document.querySelector('.timeline');
    const timelineStyles = timeline ? window.getComputedStyle(timeline) : null;

    // Find event cards
    const eventCards = Array.from(document.querySelectorAll('.content-card')).slice(0, 5);

    return {
      timeline: timeline ? {
        classes: timeline.className,
        styles: {
          display: timelineStyles?.display,
          position: timelineStyles?.position,
          padding: timelineStyles?.padding,
          margin: timelineStyles?.margin,
        },
        html: timeline.innerHTML.substring(0, 500)
      } : null,
      monthSeparators: monthSeparators.map(el => {
        const styles = window.getComputedStyle(el);
        const colorPill = el.querySelector('.color-pill, [class*="color-pill"]');
        const colorPillStyles = colorPill ? window.getComputedStyle(colorPill) : null;

        return {
          tag: el.tagName,
          classes: el.className,
          text: el.textContent?.trim(),
          styles: {
            display: styles.display,
            alignItems: styles.alignItems,
            gap: styles.gap,
            padding: styles.padding,
            margin: styles.margin,
            fontSize: styles.fontSize,
            fontWeight: styles.fontWeight,
            color: styles.color,
          },
          colorPill: colorPill ? {
            classes: colorPill.className,
            width: colorPillStyles?.width,
            height: colorPillStyles?.height,
            borderRadius: colorPillStyles?.borderRadius,
            backgroundColor: colorPillStyles?.backgroundColor,
          } : null,
          html: el.innerHTML.substring(0, 200)
        };
      }),
      eventCards: eventCards.map(card => {
        const styles = window.getComputedStyle(card);
        return {
          classes: card.className,
          styles: {
            padding: styles.padding,
            margin: styles.margin,
            border: styles.border,
            borderRadius: styles.borderRadius,
            backgroundColor: styles.backgroundColor,
          },
          html: card.innerHTML.substring(0, 300)
        };
      })
    };
  });

  console.log('Timeline Container:', JSON.stringify(timelineStructure.timeline, null, 2));
  console.log('\n=== MONTH SEPARATORS ===\n');
  console.log(JSON.stringify(timelineStructure.monthSeparators, null, 2));
  console.log('\n=== EVENT CARDS ===\n');
  console.log(JSON.stringify(timelineStructure.eventCards, null, 2));

  // Analyze vertical line/timeline indicator
  console.log('\n=== LOOKING FOR TIMELINE LINE ===\n');
  const timelineLine = await page.evaluate(() => {
    // Look for pseudo-elements and borders that might be the timeline
    const allElements = Array.from(document.querySelectorAll('*'));
    const possibleLines = allElements.filter(el => {
      const styles = window.getComputedStyle(el);
      const before = window.getComputedStyle(el, '::before');
      const after = window.getComputedStyle(el, '::after');

      // Check if element has a vertical line via border-left, border-right, or pseudo-element
      const hasBorderLine = (
        (styles.borderLeftWidth && parseInt(styles.borderLeftWidth) > 0 && parseInt(styles.borderLeftWidth) <= 3) ||
        (styles.borderRightWidth && parseInt(styles.borderRightWidth) > 0 && parseInt(styles.borderRightWidth) <= 3)
      );

      const hasBeforeLine = before.content !== 'none' && (
        parseInt(before.width || '0') <= 3 || parseInt(before.height || '0') > 100
      );

      const hasAfterLine = after.content !== 'none' && (
        parseInt(after.width || '0') <= 3 || parseInt(after.height || '0') > 100
      );

      return hasBorderLine || hasBeforeLine || hasAfterLine;
    }).slice(0, 5);

    return possibleLines.map(el => {
      const styles = window.getComputedStyle(el);
      return {
        tag: el.tagName,
        classes: el.className.substring(0, 100),
        borderLeft: styles.borderLeft,
        borderRight: styles.borderRight,
        position: styles.position,
        left: styles.left,
        right: styles.right,
      };
    });
  });

  console.log('Possible Timeline Lines:', JSON.stringify(timelineLine, null, 2));

  console.log('\n📸 Taking screenshot...\n');
  await page.screenshot({ path: '/tmp/luma-timeline-mobile.png', fullPage: true });
  console.log('Screenshot saved to /tmp/luma-timeline-mobile.png\n');

  console.log('✅ Analysis complete! Browser will stay open for 30 seconds...\n');
  await page.waitForTimeout(30000);

  await browser.close();
}

analyzeLumaTimeline().catch(console.error);
