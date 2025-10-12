import { getDatabase } from "../lib/db";

const db = getDatabase();

const oct = db.prepare("SELECT id, externalId, createdAt FROM maengel WHERE createdAt LIKE '%12.10.2025%' ORDER BY id DESC LIMIT 5").all();
console.log("October 12 Mängel IDs:");
oct.forEach((m: any) => console.log(`ID ${m.id}: ${m.externalId} - ${m.createdAt}`));

const latest = db.prepare("SELECT id, externalId, createdAt FROM maengel ORDER BY id DESC LIMIT 5").all();
console.log("\nLatest IDs in DB:");
latest.forEach((m: any) => console.log(`ID ${m.id}: ${m.externalId} - ${m.createdAt}`));
