/**
 * Test script to scrape a small sample of Mängel
 */
import { scrapeMaengelmelder } from "../scrapers/maengelmelder";
import { getDatabase } from "../lib/db";

async function testScraper() {
  console.log("Testing Mängelmelder scraper with detail extraction...\n");

  // Run scraper on first page only (maxPages = 1)
  const result = await scrapeMaengelmelder(true, 1);

  console.log("\nScraper Result:", result);

  // Query the database to check the extracted data
  const db = getDatabase();
  const maengel = db.prepare("SELECT externalId, title, createdAt, author, location, category, status, photoUrl FROM maengel ORDER BY id DESC LIMIT 5").all();

  console.log("\nSample data from database:");
  console.log(JSON.stringify(maengel, null, 2));

  process.exit(0);
}

testScraper().catch((error) => {
  console.error("Test failed:", error);
  process.exit(1);
});
