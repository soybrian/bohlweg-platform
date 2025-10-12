import { NextRequest, NextResponse } from "next/server";
import { getIdeaHistory } from "@/lib/db";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ideaId = parseInt(id);

    if (isNaN(ideaId)) {
      return NextResponse.json({ error: "Invalid idea ID" }, { status: 400 });
    }

    const history = getIdeaHistory(ideaId);
    return NextResponse.json(history);
  } catch (error) {
    console.error("Error fetching idea history:", error);
    return NextResponse.json({ error: "Failed to fetch idea history" }, { status: 500 });
  }
}
