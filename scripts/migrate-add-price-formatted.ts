/**
 * Migration: Add priceFormatted column to events table
 */

import { getDatabase } from '../lib/db';

function migrate() {
  const db = getDatabase();

  console.log('[Migration] Checking if priceFormatted column exists...');

  try {
    // Check if column already exists
    const tableInfo = db.prepare('PRAGMA table_info(events)').all() as Array<{
      cid: number;
      name: string;
      type: string;
      notnull: number;
      dflt_value: any;
      pk: number;
    }>;

    const hasColumn = tableInfo.some(col => col.name === 'priceFormatted');

    if (hasColumn) {
      console.log('[Migration] ✓ Column priceFormatted already exists. Nothing to do.');
      return;
    }

    console.log('[Migration] Adding priceFormatted column to events table...');

    // Add the column
    db.prepare(`
      ALTER TABLE events
      ADD COLUMN priceFormatted TEXT
    `).run();

    console.log('[Migration] ✓ Successfully added priceFormatted column!');

    // Verify
    const updatedTableInfo = db.prepare('PRAGMA table_info(events)').all() as Array<{
      name: string;
    }>;
    const columns = updatedTableInfo.map(col => col.name);
    console.log('[Migration] Current columns:', columns.join(', '));

  } catch (error) {
    console.error('[Migration] Error:', error);
    throw error;
  }
}

migrate();
