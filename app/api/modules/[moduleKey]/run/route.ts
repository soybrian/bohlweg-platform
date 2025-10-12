/**
 * API Route: /api/modules/[moduleKey]/run
 *
 * POST: Modul manuell ausführen
 */

import { NextRequest, NextResponse } from "next/server";
import { runModule, calculateNextRun } from "@/lib/scheduler";
import { getModule, updateModuleRunTime } from "@/lib/db";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ moduleKey: string }> }
) {
  try {
    const { moduleKey } = await params;

    // Prüfe ob Modul existiert
    const module = getModule(moduleKey);
    if (!module) {
      return NextResponse.json(
        { error: `Module ${moduleKey} not found` },
        { status: 404 }
      );
    }

    // Prüfe ob Modul aktiviert ist
    if (!module.enabled) {
      return NextResponse.json(
        { error: `Module ${moduleKey} is disabled` },
        { status: 400 }
      );
    }

    console.log(`[API] Manual trigger for module: ${moduleKey}`);

    // Update Run-Zeit
    const now = new Date().toISOString();
    const nextRun = calculateNextRun(module.intervalMinutes);
    updateModuleRunTime(moduleKey, now, nextRun);

    // Führe Modul aus
    const result = await runModule(moduleKey);

    return NextResponse.json({
      success: result.success,
      module: moduleKey,
      itemsScraped: result.itemsScraped,
      itemsNew: result.itemsNew,
      itemsUpdated: result.itemsUpdated,
      duration: result.duration,
      error: result.error,
      lastRun: now,
      nextRun: nextRun,
    });
  } catch (error: any) {
    console.error("Error running module:", error);
    return NextResponse.json(
      { error: error.message || "Failed to run module" },
      { status: 500 }
    );
  }
}
