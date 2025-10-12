/**
 * Migration Script: Add AI Enhancement Fields to Ideas Table
 *
 * This script adds new columns for AI-enhanced features:
 * - votingDeadline: Deadline for voting
 * - votingExpired: Whether voting period has expired
 * - supportersList: JSON array of all supporters
 * - aiSummary: AI-generated summary
 * - aiHashtags: AI-generated hashtags
 * - detailScraped: Whether detail page was scraped
 * - detailScrapedAt: Timestamp of detail scraping
 */

import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "data", "bohlweg.db");

function migrate() {
  console.log("[Migration] Starting migration for ideas table...");

  const db = new Database(DB_PATH);

  try {
    // Check if columns already exist
    const tableInfo = db.prepare("PRAGMA table_info(ideas)").all() as any[];
    const existingColumns = tableInfo.map((col) => col.name);

    const columnsToAdd = [
      { name: "votingDeadline", type: "TEXT" },
      { name: "votingExpired", type: "BOOLEAN DEFAULT 0" },
      { name: "supportersList", type: "TEXT" },
      { name: "aiSummary", type: "TEXT" },
      { name: "aiHashtags", type: "TEXT" },
      { name: "detailScraped", type: "BOOLEAN DEFAULT 0" },
      { name: "detailScrapedAt", type: "TEXT" },
    ];

    let added = 0;
    for (const column of columnsToAdd) {
      if (!existingColumns.includes(column.name)) {
        console.log(`[Migration] Adding column: ${column.name}`);
        db.exec(`ALTER TABLE ideas ADD COLUMN ${column.name} ${column.type}`);
        added++;
      } else {
        console.log(`[Migration] Column ${column.name} already exists, skipping`);
      }
    }

    // Create new indexes
    console.log("[Migration] Creating indexes...");

    const indexes = [
      "CREATE INDEX IF NOT EXISTS idx_ideas_voting_expired ON ideas(votingExpired)",
      "CREATE INDEX IF NOT EXISTS idx_ideas_detail_scraped ON ideas(detailScraped)",
    ];

    for (const indexSql of indexes) {
      try {
        db.exec(indexSql);
        console.log("[Migration] Index created successfully");
      } catch (error) {
        console.log("[Migration] Index may already exist, continuing...");
      }
    }

    console.log(`[Migration] Migration completed successfully! ${added} columns added.`);
  } catch (error) {
    console.error("[Migration] Error during migration:", error);
    throw error;
  } finally {
    db.close();
  }
}

// Run migration
if (require.main === module) {
  migrate();
}

export { migrate };
