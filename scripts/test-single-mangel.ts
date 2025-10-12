/**
 * Test script to scrape a single Mangel detail view
 */
import { chromium } from "playwright";

async function testSingleMangel() {
  console.log("Testing single Mangel detail extraction...\n");

  const browser = await chromium.launch({
    headless: false, // Show browser for debugging
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox']
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  const externalId = "32283";
  const url = `https://mitreden.braunschweig.de/maengelmelder?map_idea=${externalId}`;

  console.log(`Navigating to: ${url}`);
  await page.goto(url, { waitUntil: "domcontentloaded" });

  console.log("Waiting for content to load...");
  await page.waitForTimeout(3000);

  // Find all articles
  const allArticles = await page.$$("article");
  console.log(`\nFound ${allArticles.length} articles`);

  for (let i = 0; i < allArticles.length; i++) {
    const article = allArticles[i];
    const hasTime = await article.$("time");
    const text = (await article.textContent())?.substring(0, 200);

    console.log(`\nArticle ${i + 1}:`);
    console.log(`  Has <time>: ${hasTime ? "YES" : "NO"}`);
    console.log(`  Text preview: ${text}...`);

    if (hasTime) {
      const timeText = await hasTime.textContent();
      console.log(`  Time content: "${timeText}"`);

      // Extract other fields
      const fullText = await article.textContent();
      const authorMatch = fullText?.match(/Gespeichert von\s+(\S+)\s+am/);
      console.log(`  Author: ${authorMatch?.[1] || "NOT FOUND"}`);

      // Check for location
      const genericEls = await article.$$("generic");
      console.log(`  Generic elements: ${genericEls.length}`);
      for (let j = 0; j < Math.min(genericEls.length, 5); j++) {
        const genText = (await genericEls[j].textContent())?.substring(0, 100);
        console.log(`    Generic ${j}: ${genText}`);
      }
    }
  }

  console.log("\n\nPress Ctrl+C to exit...");
  await new Promise(() => {}); // Keep browser open
}

testSingleMangel().catch((error) => {
  console.error("Test failed:", error);
  process.exit(1);
});
