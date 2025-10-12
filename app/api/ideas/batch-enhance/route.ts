import { NextRequest, NextResponse } from "next/server";
import { getIdeas, updateIdeaAIFields } from "@/lib/db";
import { enhanceIdea } from "@/lib/ai/openai-service";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes for batch processing

/**
 * POST /api/ideas/batch-enhance
 * Batch enhances multiple ideas with AI
 * Query params:
 * - limit: number of ideas to process (default: 10)
 * - forceReprocess: whether to reprocess ideas that already have AI data (default: false)
 */
export async function POST(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "10");
    const forceReprocess = searchParams.get("forceReprocess") === "true";

    console.log(`[Batch AI Enhancement] Starting batch enhancement (limit: ${limit}, forceReprocess: ${forceReprocess})`);

    // Get ideas that need AI enhancement
    const allIdeas = getIdeas({ limit: 1000 }); // Get more ideas to filter from
    const ideasToProcess = allIdeas
      .filter((idea) => {
        if (forceReprocess) return true;
        // Only process ideas without AI data
        return !idea.aiSummary || !idea.aiHashtags || !idea.aiTitle;
      })
      .slice(0, limit);

    if (ideasToProcess.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No ideas need AI enhancement",
        processed: 0,
        failed: 0,
      });
    }

    console.log(`[Batch AI Enhancement] Found ${ideasToProcess.length} ideas to process`);

    const results = {
      processed: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Process ideas with rate limiting
    for (let i = 0; i < ideasToProcess.length; i++) {
      const idea = ideasToProcess[i];
      try {
        console.log(`[Batch AI Enhancement] Processing ${i + 1}/${ideasToProcess.length}: ${idea.title}`);

        const enhancement = await enhanceIdea(
          {
            title: idea.title,
            category: idea.category,
            description: idea.description,
          },
          true // include title
        );

        updateIdeaAIFields(idea.id, {
          aiSummary: enhancement.summary,
          aiHashtags: JSON.stringify(enhancement.hashtags),
          aiTitle: enhancement.aiTitle,
        });

        results.processed++;

        // Rate limiting: 350ms between requests
        if (i < ideasToProcess.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 350));
        }
      } catch (error) {
        console.error(`[Batch AI Enhancement] Failed to process idea ${idea.id}:`, error);
        results.failed++;
        results.errors.push(`Idea ${idea.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    console.log(`[Batch AI Enhancement] Completed: ${results.processed} processed, ${results.failed} failed`);

    return NextResponse.json({
      success: true,
      processed: results.processed,
      failed: results.failed,
      errors: results.errors,
    });
  } catch (error) {
    console.error("[Batch AI Enhancement] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to batch enhance ideas",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
