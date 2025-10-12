/**
 * API Route: /api/modules/[moduleKey]
 *
 * PATCH: Modul-Einstellungen aktualisieren
 */

import { NextRequest, NextResponse } from "next/server";
import { updateModuleSettings, getModule } from "@/lib/db";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ moduleKey: string }> }
) {
  try {
    const { moduleKey } = await params;
    const body = await request.json();

    const { enabled, intervalMinutes } = body;

    // Validierung
    if (enabled !== undefined && typeof enabled !== "boolean") {
      return NextResponse.json(
        { error: "enabled must be a boolean" },
        { status: 400 }
      );
    }

    if (intervalMinutes !== undefined) {
      if (typeof intervalMinutes !== "number" || intervalMinutes < 5) {
        return NextResponse.json(
          { error: "intervalMinutes must be a number >= 5" },
          { status: 400 }
        );
      }
    }

    updateModuleSettings(moduleKey, { enabled, intervalMinutes });

    const updatedModule = getModule(moduleKey);
    return NextResponse.json(updatedModule);
  } catch (error: any) {
    console.error("Error updating module:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update module" },
      { status: 500 }
    );
  }
}
