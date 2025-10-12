import { NextRequest, NextResponse } from "next/server";
import { getIdeaById, updateIdeaAIFields } from "@/lib/db";
import { enhanceIdea } from "@/lib/ai/openai-service";

export const dynamic = "force-dynamic";

/**
 * POST /api/ideas/[id]/enhance
 * Enhances a single idea with AI (title, summary, hashtags)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idString } = await params;
    const id = parseInt(idString);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid idea ID" }, { status: 400 });
    }

    // Get the idea
    const idea = getIdeaById(id);
    if (!idea) {
      return NextResponse.json({ error: "Idea not found" }, { status: 404 });
    }

    console.log(`[AI Enhancement] Processing idea ${id}: ${idea.title}`);

    // Generate AI enhancements
    const enhancement = await enhanceIdea(
      {
        title: idea.title,
        category: idea.category,
        description: idea.description,
      },
      true // include title
    );

    // Update database
    updateIdeaAIFields(id, {
      aiSummary: enhancement.summary,
      aiHashtags: JSON.stringify(enhancement.hashtags),
      aiTitle: enhancement.aiTitle,
    });

    console.log(`[AI Enhancement] Successfully enhanced idea ${id}`);

    // Return the enhanced idea
    const updatedIdea = getIdeaById(id);

    return NextResponse.json({
      success: true,
      idea: updatedIdea,
      enhancement: {
        aiTitle: enhancement.aiTitle,
        aiSummary: enhancement.summary,
        aiHashtags: enhancement.hashtags,
      },
    });
  } catch (error) {
    console.error("[AI Enhancement] Error:", error);
    return NextResponse.json(
      { error: "Failed to enhance idea", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
