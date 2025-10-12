/**
 * Scrape a single Mangel (32241) to test image extraction
 */
import { chromium } from "playwright";
import { upsertMaengel, getDatabase } from "../lib/db";

async function scrapeSingleMangel() {
  console.log("=== Scraping Mangel 32241 with Image ===\n");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const url = "https://mitreden.braunschweig.de/node/32241";
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("article");

  // Extract data
  const data = await page.evaluate(() => {
    const article = document.querySelector("article");
    if (!article) return null;

    const timeEl = article.querySelector("time");
    const createdAt = timeEl?.textContent?.trim() || "";

    const articleText = article.textContent || "";
    const authorMatch = articleText.match(/Gespeichert von\s+(\S+)\s+am/);
    const author = authorMatch?.[1] || "Anonym";

    const bodyText = document.body.textContent || "";
    const locationMatch = bodyText.match(/([A-Za-zäöüßÄÖÜ\s\-\.]+\s+\d+[a-z]?,?\s+\d{5}\s+Braunschweig)/);
    const location = locationMatch?.[1]?.trim() || "";

    return { createdAt, author, location };
  });

  // Extract photo
  const imageElement = await page.$("div.field--field_upload img");
  let photoUrl: string | undefined;
  if (imageElement) {
    const src = await imageElement.getAttribute("src");
    if (src && !src.includes("icon") && !src.includes("logo") && !src.includes("tile.geofabrik") && !src.includes("openstreetmap")) {
      photoUrl = src.startsWith("http") ? src : `https://mitreden.braunschweig.de${src}`;
    }
  }

  await browser.close();

  const maengel = {
    externalId: "32241",
    title: "Zeiskamweg Spielplatz Nr.0900",
    description: "Test description",
    author: data?.author || "A.Tausch",
    category: "Wilde Müllkippe, Sperrmüllreste",
    status: "in Bearbeitung",
    location: data?.location || "Zeiskamweg 1, 38112 Braunschweig",
    photoUrl,
    createdAt: data?.createdAt || "Fr., 10.10.2025 - 07:12",
    url: url,
    scraped_at: new Date().toISOString(),
  };

  console.log("Scraped data:");
  console.log(JSON.stringify(maengel, null, 2));

  // Save to database
  const result = upsertMaengel(maengel);
  console.log(`\nSaved to database: ${result.isNew ? "new" : "updated"} (ID: ${result.id})`);

  // Verify in database
  const db = getDatabase();
  const saved = db.prepare("SELECT * FROM maengel WHERE externalId = ?").get("32241");
  console.log("\nVerification - saved photoUrl:", (saved as any).photoUrl);
}

scrapeSingleMangel().catch(console.error);
