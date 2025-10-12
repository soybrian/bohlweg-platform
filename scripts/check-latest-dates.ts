import { getDatabase } from "../lib/db";

const db = getDatabase();

// Get the 5 most recently created Mängel (by ID, which should be scraping order)
const latest = db.prepare("SELECT id, externalId, title, createdAt FROM maengel ORDER BY id DESC LIMIT 10").all();

console.log("Latest scraped Mängel:\n");
latest.forEach((m: any) => {
  console.log(`ID ${m.id} (External: ${m.externalId})`);
  console.log(`  Title: ${m.title.substring(0, 50)}...`);
  console.log(`  Date: ${m.createdAt}`);
  console.log("");
});
