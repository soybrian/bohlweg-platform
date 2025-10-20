/**
 * Exact analysis of Luma timeline structure
 */
import { chromium } from 'playwright';

async function analyzeLumaTimelineExact() {
  console.log('🔍 Analyzing Luma timeline EXACTLY...\n');

  const browser = await chromium.launch({ headless: false });

  // Desktop analysis
  console.log('=== DESKTOP ANALYSIS ===\n');
  const desktopContext = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const desktopPage = await desktopContext.newPage();
  await desktopPage.goto('https://luma.com/tech', { waitUntil: 'networkidle', timeout: 30000 });
  await desktopPage.waitForTimeout(2000);

  const desktopTimeline = await desktopPage.evaluate(() => {
    // Find the timeline line
    const timelineLine = document.querySelector('.timeline .line, [class*="timeline"] [class*="line"]');
    const timelineLineStyles = timelineLine ? window.getComputedStyle(timelineLine) : null;

    // Find date titles
    const dateTitles = Array.from(document.querySelectorAll('.date-title, [class*="date-title"]')).slice(0, 3);

    // Find dots
    const dots = Array.from(document.querySelectorAll('.dot, [class*="dot"]'))
      .filter(el => {
        const styles = window.getComputedStyle(el);
        return parseInt(styles.width) < 20 && parseInt(styles.height) < 20;
      })
      .slice(0, 3);

    return {
      timelineLine: timelineLine ? {
        tag: timelineLine.tagName,
        classes: timelineLine.className,
        position: timelineLineStyles?.position,
        left: timelineLineStyles?.left,
        top: timelineLineStyles?.top,
        bottom: timelineLineStyles?.bottom,
        width: timelineLineStyles?.width,
        height: timelineLineStyles?.height,
        borderLeft: timelineLineStyles?.borderLeft,
        background: timelineLineStyles?.background,
      } : null,
      dateTitles: dateTitles.map(el => {
        const rect = el.getBoundingClientRect();
        const styles = window.getComputedStyle(el);
        return {
          classes: el.className,
          text: el.textContent?.trim(),
          position: styles.position,
          left: styles.left,
          top: styles.top,
          offsetLeft: (el as HTMLElement).offsetLeft,
          offsetTop: (el as HTMLElement).offsetTop,
        };
      }),
      dots: dots.map(el => {
        const rect = el.getBoundingClientRect();
        const styles = window.getComputedStyle(el);
        const parent = el.parentElement;
        const parentStyles = parent ? window.getComputedStyle(parent) : null;

        return {
          classes: el.className,
          width: styles.width,
          height: styles.height,
          borderRadius: styles.borderRadius,
          background: styles.background,
          position: styles.position,
          left: styles.left,
          top: styles.top,
          transform: styles.transform,
          parentClasses: parent?.className,
          parentPosition: parentStyles?.position,
        };
      })
    };
  });

  console.log('Desktop Timeline Line:', JSON.stringify(desktopTimeline.timelineLine, null, 2));
  console.log('\nDesktop Date Titles:', JSON.stringify(desktopTimeline.dateTitles, null, 2));
  console.log('\nDesktop Dots:', JSON.stringify(desktopTimeline.dots, null, 2));

  await desktopPage.screenshot({ path: '/tmp/luma-desktop-timeline.png', fullPage: false });
  console.log('\n📸 Desktop screenshot saved to /tmp/luma-desktop-timeline.png\n');

  // Mobile analysis
  console.log('\n=== MOBILE ANALYSIS ===\n');
  const mobileContext = await browser.newContext({
    viewport: { width: 375, height: 812 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15'
  });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto('https://luma.com/tech', { waitUntil: 'networkidle', timeout: 30000 });
  await mobilePage.waitForTimeout(2000);

  const mobileTimeline = await mobilePage.evaluate(() => {
    // Find the timeline line
    const timelineLine = document.querySelector('.timeline .line, [class*="timeline"] [class*="line"]');
    const timelineLineStyles = timelineLine ? window.getComputedStyle(timelineLine) : null;

    // Find first few visible date sections
    const dateSections = Array.from(document.querySelectorAll('.timeline-section')).slice(0, 3);

    return {
      timelineLine: timelineLine ? {
        tag: timelineLine.tagName,
        classes: timelineLine.className,
        position: timelineLineStyles?.position,
        left: timelineLineStyles?.left,
        top: timelineLineStyles?.top,
        bottom: timelineLineStyles?.bottom,
        width: timelineLineStyles?.width,
        height: timelineLineStyles?.height,
        borderLeft: timelineLineStyles?.borderLeft,
        borderRight: timelineLineStyles?.borderRight,
        background: timelineLineStyles?.background,
      } : null,
      dateSections: dateSections.map(section => {
        const dot = section.querySelector('.dot, [class*="dot"]');
        const dotStyles = dot ? window.getComputedStyle(dot) : null;
        const title = section.querySelector('.date-title, .timeline-title');

        return {
          sectionClasses: section.className,
          dotClasses: dot?.className,
          dotWidth: dotStyles?.width,
          dotHeight: dotStyles?.height,
          dotBackground: dotStyles?.background,
          dotPosition: dotStyles?.position,
          dotLeft: dotStyles?.left,
          dotTop: dotStyles?.top,
          titleText: title?.textContent?.trim(),
        };
      })
    };
  });

  console.log('Mobile Timeline Line:', JSON.stringify(mobileTimeline.timelineLine, null, 2));
  console.log('\nMobile Date Sections:', JSON.stringify(mobileTimeline.dateSections, null, 2));

  await mobilePage.screenshot({ path: '/tmp/luma-mobile-timeline.png', fullPage: true });
  console.log('\n📸 Mobile screenshot saved to /tmp/luma-mobile-timeline.png\n');

  console.log('✅ Analysis complete! Browser will stay open for inspection...\n');
  await desktopPage.waitForTimeout(60000);

  await browser.close();
}

analyzeLumaTimelineExact().catch(console.error);
