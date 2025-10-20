/**
 * Scraper Scheduler
 *
 * Dieser Scheduler führt die Scraper-Module in regelmäßigen Abständen aus.
 * Verwendet node-cron für zeitgesteuerte Ausführung.
 *
 * Standard-Schedule:
 * - Ideenplattform: Täglich um 6:00 Uhr
 * - Mängelmelder: Täglich um 6:30 Uhr
 */

import cron from "node-cron";
import { scrapeIdeenplattform } from "./ideenplattform";
import { scrapeMaengelmelder } from "./maengelmelder";
import { scrapeEventsBraunschweig } from "./events-braunschweig";

// Konfiguration
const CONFIG = {
  ideenplattform: {
    schedule: "0 6 * * *", // Täglich um 6:00 Uhr
    maxPages: 5,
    enabled: true,
  },
  maengelmelder: {
    schedule: "30 6 * * *", // Täglich um 6:30 Uhr
    maxPages: 5,
    enabled: true,
  },
  "events-braunschweig": {
    schedule: "0 7 * * *", // Täglich um 7:00 Uhr
    maxEvents: undefined, // Alle Events
    enabled: true,
  },
};

/**
 * Wrapper-Funktion für sicheres Scraping
 */
async function safeScrape(
  name: string,
  scraper: () => Promise<any>
): Promise<void> {
  console.log(`\n[Scheduler] Starte ${name} - ${new Date().toISOString()}`);

  try {
    const result = await scraper();
    console.log(`[Scheduler] ${name} abgeschlossen:`, result);
  } catch (error) {
    console.error(`[Scheduler] Fehler bei ${name}:`, error);
  }
}

/**
 * Starte den Scheduler
 */
export function startScheduler() {
  console.log("[Scheduler] Starte Scraper-Scheduler...\n");

  // Ideenplattform Schedule
  if (CONFIG.ideenplattform.enabled) {
    console.log(
      `[Scheduler] Ideenplattform-Scraper geplant: ${CONFIG.ideenplattform.schedule}`
    );

    cron.schedule(CONFIG.ideenplattform.schedule, () => {
      safeScrape("Ideenplattform", () =>
        scrapeIdeenplattform(true, CONFIG.ideenplattform.maxPages)
      );
    });
  }

  // Mängelmelder Schedule
  if (CONFIG.maengelmelder.enabled) {
    console.log(
      `[Scheduler] Mängelmelder-Scraper geplant: ${CONFIG.maengelmelder.schedule}`
    );

    cron.schedule(CONFIG.maengelmelder.schedule, () => {
      safeScrape("Mängelmelder", () =>
        scrapeMaengelmelder(true, CONFIG.maengelmelder.maxPages)
      );
    });
  }

  // Events Braunschweig Schedule
  if (CONFIG["events-braunschweig"].enabled) {
    console.log(
      `[Scheduler] Events-Scraper geplant: ${CONFIG["events-braunschweig"].schedule}`
    );

    cron.schedule(CONFIG["events-braunschweig"].schedule, () => {
      safeScrape("Events Braunschweig", () =>
        scrapeEventsBraunschweig(CONFIG["events-braunschweig"].maxEvents)
      );
    });
  }

  console.log("\n[Scheduler] Scheduler erfolgreich gestartet!");
  console.log("[Scheduler] Drücke Ctrl+C zum Beenden.\n");
}

/**
 * Führe alle Scraper sofort aus (für Testing)
 */
export async function runAllScrapersNow() {
  console.log("[Scheduler] Führe alle Scraper sofort aus...\n");

  if (CONFIG.ideenplattform.enabled) {
    await safeScrape("Ideenplattform", () =>
      scrapeIdeenplattform(true, CONFIG.ideenplattform.maxPages)
    );
  }

  if (CONFIG.maengelmelder.enabled) {
    await safeScrape("Mängelmelder", () =>
      scrapeMaengelmelder(true, CONFIG.maengelmelder.maxPages)
    );
  }

  if (CONFIG["events-braunschweig"].enabled) {
    await safeScrape("Events Braunschweig", () =>
      scrapeEventsBraunschweig(CONFIG["events-braunschweig"].maxEvents)
    );
  }

  console.log("\n[Scheduler] Alle Scraper abgeschlossen!");
}

// CLI Interface
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes("--now") || args.includes("-n")) {
    // Führe alle Scraper sofort aus
    runAllScrapersNow()
      .then(() => {
        console.log("\n[Scheduler] Scraping abgeschlossen. Beende...");
        process.exit(0);
      })
      .catch((error) => {
        console.error("\n[Scheduler] Fehler beim Scraping:", error);
        process.exit(1);
      });
  } else if (args.includes("--ideenplattform") || args.includes("-i")) {
    // Führe nur Ideenplattform aus
    safeScrape("Ideenplattform", () =>
      scrapeIdeenplattform(true, CONFIG.ideenplattform.maxPages)
    )
      .then(() => {
        console.log("\n[Scheduler] Scraping abgeschlossen. Beende...");
        process.exit(0);
      })
      .catch((error) => {
        console.error("\n[Scheduler] Fehler beim Scraping:", error);
        process.exit(1);
      });
  } else if (args.includes("--maengelmelder") || args.includes("-m")) {
    // Führe nur Mängelmelder aus
    safeScrape("Mängelmelder", () =>
      scrapeMaengelmelder(true, CONFIG.maengelmelder.maxPages)
    )
      .then(() => {
        console.log("\n[Scheduler] Scraping abgeschlossen. Beende...");
        process.exit(0);
      })
      .catch((error) => {
        console.error("\n[Scheduler] Fehler beim Scraping:", error);
        process.exit(1);
      });
  } else if (args.includes("--events") || args.includes("-e")) {
    // Führe nur Events-Scraper aus
    safeScrape("Events Braunschweig", () =>
      scrapeEventsBraunschweig(CONFIG["events-braunschweig"].maxEvents)
    )
      .then(() => {
        console.log("\n[Scheduler] Scraping abgeschlossen. Beende...");
        process.exit(0);
      })
      .catch((error) => {
        console.error("\n[Scheduler] Fehler beim Scraping:", error);
        process.exit(1);
      });
  } else {
    // Starte den Scheduler (läuft dauerhaft)
    startScheduler();

    // Optional: Führe beim Start einmal aus
    if (args.includes("--initial")) {
      console.log(
        "[Scheduler] Führe initialen Scrape-Durchlauf aus...\n"
      );
      runAllScrapersNow();
    }
  }
}
