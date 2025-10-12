/**
 * Reset Database und vollständiges Re-Scraping
 *
 * Dieses Skript:
 * 1. Löscht die bestehende Datenbank
 * 2. Initialisiert eine neue Datenbank mit dem aktuellen Schema
 * 3. Führt vollständiges Scraping beider Module durch
 */

import fs from "fs";
import path from "path";
import { getDatabase, closeDatabase } from "../lib/db";
import { scrapeIdeenplattform } from "../scrapers/ideenplattform";
import { scrapeMaengelmelder } from "../scrapers/maengelmelder";

const DB_PATH = path.join(process.cwd(), "data", "bohlweg.db");

async function resetAndScrape() {
  console.log("=== Bohlweg Platform: Reset & Re-Scrape ===\n");

  // Schritt 1: Datenbank löschen
  console.log("[1/4] Lösche bestehende Datenbank...");
  try {
    if (fs.existsSync(DB_PATH)) {
      fs.unlinkSync(DB_PATH);
      console.log("✓ Datenbank erfolgreich gelöscht");
    } else {
      console.log("ℹ Keine bestehende Datenbank gefunden");
    }

    // Auch WAL und SHM Dateien löschen falls vorhanden
    const walPath = `${DB_PATH}-wal`;
    const shmPath = `${DB_PATH}-shm`;
    if (fs.existsSync(walPath)) {
      fs.unlinkSync(walPath);
      console.log("✓ WAL-Datei gelöscht");
    }
    if (fs.existsSync(shmPath)) {
      fs.unlinkSync(shmPath);
      console.log("✓ SHM-Datei gelöscht");
    }
  } catch (error) {
    console.error("✗ Fehler beim Löschen der Datenbank:", error);
    process.exit(1);
  }

  console.log("");

  // Schritt 2: Neue Datenbank initialisieren
  console.log("[2/4] Initialisiere neue Datenbank...");
  try {
    const db = getDatabase();
    console.log("✓ Datenbank erfolgreich initialisiert");
    closeDatabase();
  } catch (error) {
    console.error("✗ Fehler beim Initialisieren der Datenbank:", error);
    process.exit(1);
  }

  console.log("");

  // Schritt 3: Ideenplattform scrapen
  console.log("[3/4] Starte Scraping der Ideenplattform...");
  console.log("────────────────────────────────────────");
  try {
    const ideenResult = await scrapeIdeenplattform(true);
    console.log("────────────────────────────────────────");
    if (ideenResult.success) {
      console.log("✓ Ideenplattform erfolgreich gescraped");
      console.log(`  → ${ideenResult.itemsScraped} Ideen gefunden`);
      console.log(`  → ${ideenResult.itemsNew} neue Einträge`);
    } else {
      console.error("✗ Fehler beim Scraping der Ideenplattform:", ideenResult.error);
    }
  } catch (error) {
    console.error("✗ Unerwarteter Fehler beim Scraping der Ideenplattform:", error);
  }

  console.log("");

  // Schritt 4: Mängelmelder scrapen
  console.log("[4/4] Starte Scraping des Mängelmelders...");
  console.log("────────────────────────────────────────");
  try {
    const maengelResult = await scrapeMaengelmelder(true);
    console.log("────────────────────────────────────────");
    if (maengelResult.success) {
      console.log("✓ Mängelmelder erfolgreich gescraped");
      console.log(`  → ${maengelResult.itemsScraped} Mängel gefunden`);
      console.log(`  → ${maengelResult.itemsNew} neue Einträge`);
    } else {
      console.error("✗ Fehler beim Scraping des Mängelmelders:", maengelResult.error);
    }
  } catch (error) {
    console.error("✗ Unerwarteter Fehler beim Scraping des Mängelmelders:", error);
  }

  console.log("");
  console.log("=== Reset & Re-Scrape abgeschlossen ===");

  // Datenbank-Verbindung sauber schließen
  closeDatabase();

  process.exit(0);
}

// Skript ausführen
resetAndScrape().catch((error) => {
  console.error("Kritischer Fehler:", error);
  closeDatabase();
  process.exit(1);
});
