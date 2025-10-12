/**
 * Scheduler Service
 *
 * Führt Module basierend auf ihrer Konfiguration automatisch aus.
 */

import { getModuleDueForRun, updateModuleRunTime, startScraperRun, endScraperRun } from "../db";
import { scrapeIdeenplattform } from "../../scrapers/ideenplattform";
import { scrapeMaengelmelder } from "../../scrapers/maengelmelder";

export interface SchedulerResult {
  moduleKey: string;
  success: boolean;
  itemsScraped: number;
  itemsNew: number;
  itemsUpdated: number;
  error?: string;
  duration: number;
}

/**
 * Führt ein spezifisches Modul aus
 */
export async function runModule(moduleKey: string): Promise<SchedulerResult> {
  const startTime = Date.now();

  console.log(`[Scheduler] Starting module: ${moduleKey}`);

  let result;

  try {
    if (moduleKey === "ideenplattform") {
      result = await scrapeIdeenplattform(true);
    } else if (moduleKey === "maengelmelder") {
      result = await scrapeMaengelmelder(true);
    } else {
      throw new Error(`Unknown module: ${moduleKey}`);
    }

    const duration = Date.now() - startTime;

    console.log(`[Scheduler] Module ${moduleKey} completed in ${duration}ms: ${result.itemsScraped} items (${result.itemsNew} new, ${result.itemsUpdated} updated)`);

    return {
      moduleKey,
      success: result.success,
      itemsScraped: result.itemsScraped,
      itemsNew: result.itemsNew,
      itemsUpdated: result.itemsUpdated,
      error: result.error,
      duration,
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[Scheduler] Module ${moduleKey} failed:`, error);

    return {
      moduleKey,
      success: false,
      itemsScraped: 0,
      itemsNew: 0,
      itemsUpdated: 0,
      error: error.message || String(error),
      duration,
    };
  }
}

/**
 * Berechnet den nächsten Run-Zeitpunkt
 */
export function calculateNextRun(intervalMinutes: number): string {
  const now = new Date();
  const nextRun = new Date(now.getTime() + intervalMinutes * 60 * 1000);
  return nextRun.toISOString();
}

/**
 * Führt alle fälligen Module aus
 */
export async function runScheduler(): Promise<SchedulerResult[]> {
  console.log("[Scheduler] Checking for modules due to run...");

  const modules = getModuleDueForRun();

  if (modules.length === 0) {
    console.log("[Scheduler] No modules due to run");
    return [];
  }

  console.log(`[Scheduler] Found ${modules.length} module(s) to run`);

  const results: SchedulerResult[] = [];

  for (const module of modules) {
    const now = new Date().toISOString();
    const nextRun = calculateNextRun(module.intervalMinutes);

    // Update Run-Zeit BEVOR wir starten
    updateModuleRunTime(module.moduleKey, now, nextRun);

    // Führe Modul aus
    const result = await runModule(module.moduleKey);
    results.push(result);
  }

  return results;
}

/**
 * Startet einen Interval-basierten Scheduler
 * Prüft alle 60 Sekunden ob Module fällig sind
 */
export function startSchedulerDaemon(checkIntervalSeconds: number = 60) {
  console.log(`[Scheduler] Daemon started, checking every ${checkIntervalSeconds}s`);

  const interval = setInterval(async () => {
    try {
      await runScheduler();
    } catch (error) {
      console.error("[Scheduler] Error in scheduler daemon:", error);
    }
  }, checkIntervalSeconds * 1000);

  // Initial run
  runScheduler().catch(console.error);

  return interval;
}
