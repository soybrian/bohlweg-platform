/**
 * Migration Script: Add photoUrl column to maengel table
 *
 * This script adds the photoUrl field to existing maengel and maengel_history tables
 */

import { getDatabase, closeDatabase } from "../lib/db/index";

async function migrateMaengelSchema() {
  console.log("=== Bohlweg Platform: Migrate Mängel Schema ===\n");
  console.log("[1/2] Adding photoUrl column to maengel table...");

  try {
    const db = getDatabase();

    // Check if photoUrl column already exists
    const tableInfo = db.prepare("PRAGMA table_info(maengel)").all() as Array<{
      cid: number;
      name: string;
      type: string;
      notnull: number;
      dflt_value: any;
      pk: number;
    }>;

    const hasPhotoUrl = tableInfo.some((col) => col.name === "photoUrl");

    if (!hasPhotoUrl) {
      // Add photoUrl column to maengel table
      db.prepare("ALTER TABLE maengel ADD COLUMN photoUrl TEXT").run();
      console.log("✓ Added photoUrl column to maengel table");
    } else {
      console.log("ℹ photoUrl column already exists in maengel table");
    }

    console.log("\n[2/2] Adding photoUrl column to maengel_history table...");

    // Check if photoUrl column exists in history table
    const historyTableInfo = db.prepare("PRAGMA table_info(maengel_history)").all() as Array<{
      cid: number;
      name: string;
      type: string;
      notnull: number;
      dflt_value: any;
      pk: number;
    }>;

    const historyHasPhotoUrl = historyTableInfo.some((col) => col.name === "photoUrl");

    if (!historyHasPhotoUrl) {
      // Add photoUrl column to maengel_history table
      db.prepare("ALTER TABLE maengel_history ADD COLUMN photoUrl TEXT").run();
      console.log("✓ Added photoUrl column to maengel_history table");
    } else {
      console.log("ℹ photoUrl column already exists in maengel_history table");
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
