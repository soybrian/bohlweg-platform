import { getDatabase } from "../lib/db";
import { formatRelativeTime } from "../lib/utils";

const db = getDatabase();

// Find Mängel from October 10-12, 2025
const recent = db.prepare(`
  SELECT externalId, title, createdAt
  FROM maengel
  WHERE createdAt LIKE '%10.10.2025%'
     OR createdAt LIKE '%11.10.2025%'
     OR createdAt LIKE '%12.10.2025%'
  ORDER BY createdAt DESC
  LIMIT 10
`).all();

console.log("Recent October Mängel (10-12.10.2025):\n");
recent.forEach((m: any) => {
  console.log(`${m.externalId}: ${m.title.substring(0, 40)}...`);
  console.log(`  Raw: ${m.createdAt}`);
  console.log(`  Formatted: ${formatRelativeTime(m.createdAt)}`);
  console.log("");
});

if (recent.length === 0) {
  console.log("No Mängel from October 10-12 found yet.");
  console.log("The scraper needs to continue to reach these newer entries.");
}
