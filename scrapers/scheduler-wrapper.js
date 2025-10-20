#!/usr/bin/env node
/**
 * Scheduler Wrapper
 * Startet den Scheduler mit Timezone-Logging und Error Handling
 */

// Log Timezone beim Start
console.log("╔═══════════════════════════════════════════════════════════╗");
console.log("║         Bohlweg Platform - Scraper Scheduler             ║");
console.log("╚═══════════════════════════════════════════════════════════╝");
console.log("");
console.log(`[Scheduler] Start Time: ${new Date().toISOString()}`);
console.log(`[Scheduler] Timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
console.log(`[Scheduler] Local Time: ${new Date().toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })}`);
console.log(`[Scheduler] Environment TZ: ${process.env.TZ || 'not set'}`);
console.log("");

// Starte den eigentlichen Scheduler
try {
  require('./dist/scrapers/scheduler.js');
} catch (error) {
  console.error("[Scheduler] Fatal error loading scheduler:", error);
  process.exit(1);
}

// Graceful shutdown handler
process.on('SIGTERM', () => {
  console.log("\n[Scheduler] Received SIGTERM, shutting down gracefully...");
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log("\n[Scheduler] Received SIGINT, shutting down gracefully...");
  process.exit(0);
});
