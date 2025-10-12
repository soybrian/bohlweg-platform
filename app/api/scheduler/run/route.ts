/**
 * API Route: /api/scheduler/run
 *
 * POST: Führt alle fälligen Module aus
 */

import { NextResponse } from "next/server";
import { runScheduler } from "@/lib/scheduler";

export async function POST() {
  try {
    console.log("[API] Manual scheduler trigger");

    const results = await runScheduler();

    return NextResponse.json({
      success: true,
      modulesRun: results.length,
      results: results.map((r) => ({
        module: r.moduleKey,
        success: r.success,
        itemsScraped: r.itemsScraped,
        itemsNew: r.itemsNew,
        itemsUpdated: r.itemsUpdated,
        duration: r.duration,
        error: r.error,
      })),
    });
  } catch (error: any) {
    console.error("Error running scheduler:", error);
    return NextResponse.json(
      { error: error.message || "Failed to run scheduler" },
      { status: 500 }
    );
  }
}
