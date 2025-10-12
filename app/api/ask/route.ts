import { NextRequest, NextResponse } from "next/server";
import { getIdeas, getMaengel } from "@/lib/db";
import { answerCustomQuestion } from "@/lib/ai/openai-service";

export async function POST(req: NextRequest) {
  try {
    const { question, itemType } = await req.json();

    if (!question || !itemType) {
      return NextResponse.json(
        { error: "Question and itemType are required" },
        { status: 400 }
      );
    }

    if (!["ideas", "maengel"].includes(itemType)) {
      return NextResponse.json(
        { error: "itemType must be 'ideas' or 'maengel'" },
        { status: 400 }
      );
    }

    // Fetch relevant items based on type
    let items: Array<{ title: string; description: string; category: string; status: string }> = [];

    if (itemType === "ideas") {
      const ideas = getIdeas({
        sortBy: "newest",
        limit: 30,
        offset: 0,
      });

      items = ideas.map((idea) => ({
        title: idea.title,
        description: idea.description,
        category: idea.category,
        status: idea.status,
      }));
    } else if (itemType === "maengel") {
      const maengel = getMaengel({
        limit: 30,
        offset: 0,
      });

      items = maengel.map((mangel) => ({
        title: mangel.title,
        description: mangel.description,
        category: mangel.category,
        status: mangel.status,
      }));
    }

    if (items.length === 0) {
      return NextResponse.json(
        { error: "No data available to answer questions" },
        { status: 404 }
      );
    }

    // Get answer from OpenAI
    const answer = await answerCustomQuestion(question, items, itemType);

    return NextResponse.json({ answer, itemCount: items.length });
  } catch (error) {
    console.error("[API] Error answering question:", error);
    return NextResponse.json(
      { error: "Failed to answer question" },
      { status: 500 }
    );
  }
}
