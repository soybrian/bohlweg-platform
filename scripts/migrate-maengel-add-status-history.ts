/**
 * Migration Script: Add statusHistory column to maengel table
 *
 * This script adds the statusHistory field to store the official processing history from the website
 */

import { getDatabase, closeDatabase } from "../lib/db/index";

async function migrateMaengelSchema() {
  console.log("=== Bohlweg Platform: Migrate Mängel Schema ===\n");
  console.log("[1/1] Adding statusHistory column to maengel table...");

  try {
    const db = getDatabase();

    // Check if statusHistory column already exists
    const tableInfo = db.prepare("PRAGMA table_info(maengel)").all() as Array<{
      cid: number;
      name: string;
      type: string;
      notnull: number;
      dflt_value: any;
      pk: number;
    }>;

    const hasStatusHistory = tableInfo.some((col) => col.name === "statusHistory");

    if (!hasStatusHistory) {
      // Add statusHistory column to maengel table
      db.prepare("ALTER TABLE maengel ADD COLUMN statusHistory TEXT").run();
      console.log("✓ Added statusHistory column to maengel table");
    } else {
      console.log("ℹ statusHistory column already exists in maengel table");
    }

    console.log("\n✓ Migration completed successfully!");
    closeDatabase();
    process.exit(0);
  } catch (error) {
    console.error("✗ Migration failed:", error);
    closeDatabase();
    process.exit(1);
  }
}

// Execute migration
migrateMaengelSchema().catch((error) => {
  console.error("Critical error:", error);
  closeDatabase();
  process.exit(1);
});
