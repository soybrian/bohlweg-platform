import { getDatabase } from "../lib/db";

const db = getDatabase();

// Get recent maengel to check dates
const maengel = db.prepare("SELECT externalId, createdAt FROM maengel ORDER BY id DESC LIMIT 20").all();

console.log("Recent Mängel dates:\n");
maengel.forEach((m: any) => {
  const preview = m.createdAt.length > 100 ? m.createdAt.substring(0, 100) + "..." : m.createdAt;
  console.log(`${m.externalId}: ${preview}`);
});
