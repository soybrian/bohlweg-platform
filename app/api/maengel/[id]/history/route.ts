import { NextRequest, NextResponse } from "next/server";
import { getMaengelHistory } from "@/lib/db";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const maengelId = parseInt(id);

    if (isNaN(maengelId)) {
      return NextResponse.json({ error: "Invalid maengel ID" }, { status: 400 });
    }

    const history = getMaengelHistory(maengelId);
    return NextResponse.json(history);
  } catch (error) {
    console.error("Error fetching maengel history:", error);
    return NextResponse.json({ error: "Failed to fetch maengel history" }, { status: 500 });
  }
}
