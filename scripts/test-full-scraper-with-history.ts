/**
 * Test script to run the full scraper and check if history is saved
 */
import { scrapeMaengelmelder } from "../scrapers/maengelmelder";
import { getDatabase } from "../lib/db";

async function testFullScraper() {
  console.log("=== Testing Full Scraper with History ===\n");

  // Run scraper on first page only
  console.log("Running scraper on first page...\n");
  const result = await scrapeMaengelmelder(true, 1);

  console.log("Scraper Result:");
  console.log("  Success:", result.success);
  console.log("  Items Scraped:", result.itemsScraped);
  console.log("  Items New:", result.itemsNew);
  console.log("  Items Updated:", result.itemsUpdated);

  // Check if we have Mangel 32241 in the database
  const db = getDatabase();
  const mangel = db.prepare("SELECT externalId, status, statusHistory FROM maengel WHERE externalId = ?").get("32241") as any;

  if (mangel) {
    console.log("\n=== Mangel 32241 from Database ===");
    console.log("  Status:", mangel.status);
    console.log("  Has statusHistory:", !!mangel.statusHistory);

    if (mangel.statusHistory) {
      const history = JSON.parse(mangel.statusHistory);
      console.log("  History entries:", history.length);
      console.log("\n  Status History:");
      history.forEach((entry: any, i: number) => {
        console.log(`    ${i + 1}. ${entry.timestamp} - ${entry.status}`);
      });
    } else {
      console.log("  No history found in database");
    }
  } else {
    console.log("\n  Mangel 32241 not found in database");
  }

  process.exit(0);
}

testFullScraper().catch((error) => {
  console.error("Test failed:", error);
  process.exit(1);
});
