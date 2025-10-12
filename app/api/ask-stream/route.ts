import { NextRequest } from "next/server";
import { getIdeas, getMaengel } from "@/lib/db";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const { question, itemType } = await req.json();

    if (!question || !itemType) {
      return new Response(
        JSON.stringify({ error: "Question and itemType are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!["ideas", "maengel"].includes(itemType)) {
      return new Response(
        JSON.stringify({ error: "itemType must be 'ideas' or 'maengel'" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
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
      return new Response(
        JSON.stringify({ error: "No data available to answer questions" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Prepare context for OpenAI
    const itemLabel = itemType === "ideas" ? "Bürgerideen" : "Mängelmeldungen";
    const contextLimit = 10;
    const contextItems = items.slice(0, contextLimit);

    const context = contextItems
      .map((item, i) => `${i + 1}. Titel: ${item.title}\n   Kategorie: ${item.category}\n   Status: ${item.status}\n   Beschreibung: ${item.description}`)
      .join("\n\n");

    const prompt = `Du bist ein hilfreicher Assistent, der Fragen über ${itemLabel} aus Braunschweig beantwortet.

Kontext - Aktuelle ${itemLabel} (${contextItems.length} von ${items.length} insgesamt):

${context}

Frage des Nutzers: ${question}

Beantworte die Frage basierend auf den bereitgestellten ${itemLabel}. Sei präzise und hilfreich. Wenn die Frage nicht mit den verfügbaren Daten beantwortet werden kann, sage das höflich.`;

    // Create streaming response
    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Du bist ein hilfreicher Assistent für die Stadt Braunschweig, der Fragen über ${itemLabel} beantwortet.`,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 500,
      stream: true,
    });

    // Create a ReadableStream to pipe the OpenAI stream to the client
    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || "";
            if (content) {
              controller.enqueue(encoder.encode(content));
            }
          }
          controller.close();
        } catch (error) {
          console.error("[API] Error streaming response:", error);
          controller.error(error);
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "X-Item-Count": items.length.toString(),
      },
    });
  } catch (error) {
    console.error("[API] Error answering question:", error);
    return new Response(
      JSON.stringify({ error: "Failed to answer question" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
