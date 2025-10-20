/**
 * Überprüfe die Qualität der gescrapten Event-Daten
 * Analysiert 10 zufällige Events auf Vollständigkeit
 */

import { getDatabase } from "../lib/db";
import type { EventItem } from "../lib/db/schema";

const db = getDatabase();

// Hole 10 zufällige Events mit verschiedenen Eigenschaften
const events = db.prepare(`
  SELECT * FROM events
  WHERE status = 'active'
  AND startDate IS NOT NULL
  ORDER BY RANDOM()
  LIMIT 10
`).all() as EventItem[];

console.log('\n🔍 EVENT-QUALITÄT ANALYSE - 10 Zufällige Events\n');
console.log('='.repeat(80));

let totalScore = 0;
const maxScore = 10; // 10 Felder pro Event

events.forEach((event, index) => {
  console.log(`\n[${index + 1}] Event ID: ${event.externalId} - ${event.title}`);
  console.log('-'.repeat(80));

  let score = 0;
  const fields = {
    '✓ Titel': event.title ? true : false,
    '✓ Beschreibung': event.description && event.description.length > 50 ? true : false,
    '✓ Start-Datum': event.startDate ? true : false,
    '✓ Start-Zeit': event.startTime ? true : false,
    '✓ Venue-Name': event.venueName ? true : false,
    '✓ Venue-Adresse': event.venueAddress ? true : false,
    '✓ Stadt': event.venueCity ? true : false,
    '✓ Veranstalter': event.organizer ? true : false,
    '✓ Bild-URL': event.imageUrl ? true : false,
    '✓ Preis-Info': event.price || event.isFree ? true : false,
  };

  Object.entries(fields).forEach(([field, hasValue]) => {
    if (hasValue) score++;
    const status = hasValue ? '✅' : '❌';
    console.log(`  ${status} ${field}`);
  });

  // Zeige Sample-Daten
  console.log('\n  📋 Daten-Sample:');
  if (event.description) {
    console.log(`     Beschreibung: ${event.description.substring(0, 100)}...`);
  }
  if (event.startDate && event.startTime) {
    console.log(`     Termin: ${event.startDate} um ${event.startTime}`);
  }
  if (event.venueName) {
    console.log(`     Location: ${event.venueName}${event.venueAddress ? ', ' + event.venueAddress : ''}`);
  }
  if (event.organizer) {
    console.log(`     Veranstalter: ${event.organizer}`);
  }
  if (event.price) {
    console.log(`     Preis: ${event.price}`);
  }

  console.log(`\n  📊 Vollständigkeit: ${score}/${maxScore} (${Math.round(score/maxScore*100)}%)`);
  console.log(`  🔗 URL: ${event.url}`);

  totalScore += score;
});

console.log('\n' + '='.repeat(80));
console.log(`\n📊 GESAMT-SCORE: ${totalScore}/${maxScore * events.length} (${Math.round(totalScore/(maxScore * events.length)*100)}%)`);
console.log(`\n✅ Analysierte Events: ${events.length}`);

// Zusätzliche Statistiken
console.log('\n📈 STATISTIKEN:');
const stats = db.prepare(`
  SELECT
    COUNT(*) as total,
    COUNT(description) as hasDescription,
    COUNT(startTime) as hasStartTime,
    COUNT(venueName) as hasVenue,
    COUNT(organizer) as hasOrganizer,
    COUNT(imageUrl) as hasImage,
    COUNT(CASE WHEN isFree = 1 OR price IS NOT NULL THEN 1 END) as hasPriceInfo
  FROM events
  WHERE status = 'active'
`).get() as any;

console.log(`  Events gesamt: ${stats.total}`);
console.log(`  Mit Beschreibung: ${stats.hasDescription} (${Math.round(stats.hasDescription/stats.total*100)}%)`);
console.log(`  Mit Start-Zeit: ${stats.hasStartTime} (${Math.round(stats.hasStartTime/stats.total*100)}%)`);
console.log(`  Mit Venue: ${stats.hasVenue} (${Math.round(stats.hasVenue/stats.total*100)}%)`);
console.log(`  Mit Veranstalter: ${stats.hasOrganizer} (${Math.round(stats.hasOrganizer/stats.total*100)}%)`);
console.log(`  Mit Bild: ${stats.hasImage} (${Math.round(stats.hasImage/stats.total*100)}%)`);
console.log(`  Mit Preis-Info: ${stats.hasPriceInfo} (${Math.round(stats.hasPriceInfo/stats.total*100)}%)`);

console.log('\n✨ Analyse abgeschlossen!\n');
