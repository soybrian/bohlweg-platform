import { getDatabase } from "../lib/db";

const db = getDatabase();

// Get maengel descriptions to check for status info
const maengel = db.prepare("SELECT externalId, title, description FROM maengel WHERE description LIKE '%Bearbeitung%' OR description LIKE '%Unbearbeitet%' LIMIT 10").all();

console.log("Searching for mangel with status info in description...\n");
maengel.forEach((m: any) => {
  console.log("=== Mangel", m.externalId, "===");
  console.log("Title:", m.title);
  console.log("Description:");
  console.log(m.description);
  console.log("");
});

if (maengel.length === 0) {
  console.log("No problematic descriptions found. Checking first 5 maengel:");
  const all = db.prepare("SELECT externalId, title, description FROM maengel LIMIT 5").all();
  all.forEach((m: any) => {
    console.log("=== Mangel", m.externalId, "===");
    console.log("Description:", m.description?.substring(0, 150));
    console.log("");
  });
}
