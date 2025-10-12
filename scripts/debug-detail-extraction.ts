import { chromium } from "playwright";

async function testDetailExtraction() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto("https://mitreden.braunschweig.de/node/32283", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("article", { timeout: 5000 });

  // Test using evaluate to extract from DOM
  const data = await page.evaluate(() => {
    const article = document.querySelector("article");
    if (!article) return null;

    // Get time
    const timeEl = article.querySelector("time");
    const createdAt = timeEl?.textContent?.trim() || "";

    // Get author - look for text between "Gespeichert von" and "am"
    const articleText = article.textContent || "";
    const authorMatch = articleText.match(/Gespeichert von\s+(\S+)\s+am/);
    const author = authorMatch?.[1] || "Anonym";

    // Get all elements after article
    const allElements: string[] = [];
    let current = article.nextElementSibling;
    let elemIndex = 0;
    while (current && elemIndex < 20) {
      const text = current.textContent?.trim() || "";
      if (text) {
        allElements.push(`${current.tagName}: ${text.substring(0, 100)}`);
      }
      current = current.nextElementSibling;
      elemIndex++;
    }

    // Look for location in the body
    const bodyText = document.body.textContent || "";
    const locationMatch = bodyText.match(/([A-Za-zäöüßÄÖÜ\s\-\.]+\s+\d+[a-z]?,?\s+\d{5}\s+Braunschweig)/);
    const location = locationMatch?.[1]?.trim() || "";

    // Look for status
    const statusMatch = articleText.match(/(Unbearbeitet|in Bearbeitung|Erledigt)/);
    const status = statusMatch?.[1] || "Offen";

    // Look for category
    const categories = ["Straßen-, Radweg- und Gehwegschäden", "Wilde Müllkippe", "Poller defekt"];
    let category = "";
    for (const cat of categories) {
      if (articleText.includes(cat)) {
        category = cat;
        break;
      }
    }

    return {
      createdAt,
      author,
      location,
      status,
      category,
      allElements,
    };
  });

  console.log("Extracted data:");
  console.log("  Date:", data?.createdAt);
  console.log("  Author:", data?.author);
  console.log("  Location:", data?.location);
  console.log("  Status:", data?.status);
  console.log("  Category:", data?.category);
  console.log("\nElements after article:");
  data?.allElements.forEach((el, i) => console.log(`  ${i}:`, el));

  await browser.close();
}

testDetailExtraction().catch(console.error);
