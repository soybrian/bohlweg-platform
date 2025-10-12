/**
 * OpenAI Service for AI-Enhanced Features
 *
 * Uses GPT-4o-mini for:
 * - Generating concise summaries of ideas
 * - Creating relevant hashtags for classification
 */

import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface IdeaContent {
  title: string;
  category: string;
  description: string;
}

export interface AIEnhancement {
  summary: string;
  hashtags: string[];
  aiTitle?: string;
}

/**
 * Generate a concise summary of an idea (max 3 sentences)
 */
export async function generateSummary(idea: IdeaContent): Promise<string> {
  try {
    const prompt = `Erstelle eine prägnante Zusammenfassung (max. 3 Sätze) dieser Bürgeridee:

Titel: ${idea.title}
Kategorie: ${idea.category}
Inhalt: ${idea.description}

Die Zusammenfassung soll die Kernpunkte der Idee klar und verständlich darstellen.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Du bist ein hilfreicher Assistent, der prägnante Zusammenfassungen von Bürgerideen erstellt.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 150,
    });

    return response.choices[0]?.message?.content?.trim() || "";
  } catch (error) {
    console.error("[OpenAI] Error generating summary:", error);
    throw error;
  }
}

/**
 * Generate relevant hashtags for classification (5-10 hashtags)
 */
export async function generateHashtags(idea: IdeaContent): Promise<string[]> {
  try {
    const prompt = `Analysiere diese Bürgeridee und erstelle relevante Hashtags zur Klassifizierung:

Titel: ${idea.title}
Kategorie: ${idea.category}
Inhalt: ${idea.description}

Erstelle 5-10 präzise Hashtags die:
- Die Hauptthemen erfassen
- Für Filterung und Suche nützlich sind
- Auf Deutsch sind
- Mit # beginnen

Format: #hashtag1 #hashtag2 #hashtag3 ...`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Du bist ein hilfreicher Assistent, der relevante Hashtags für Bürgerideen erstellt.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.5,
      max_tokens: 100,
    });

    const content = response.choices[0]?.message?.content?.trim() || "";

    // Extract hashtags from response
    const hashtags = content
      .split(/\s+/)
      .filter((word) => word.startsWith("#"))
      .map((tag) => tag.toLowerCase())
      .filter((tag, index, self) => self.indexOf(tag) === index); // Remove duplicates

    return hashtags;
  } catch (error) {
    console.error("[OpenAI] Error generating hashtags:", error);
    throw error;
  }
}

/**
 * Generate AI title for an idea
 */
export async function generateTitle(idea: IdeaContent): Promise<string> {
  try {
    const prompt = `Erstelle einen prägnanten, aussagekräftigen Titel (max. 10 Wörter) für diese Bürgeridee:

Originaltitel: ${idea.title}
Kategorie: ${idea.category}
Inhalt: ${idea.description}

Der Titel soll:
- Die Kernbotschaft klar vermitteln
- Prägnant und einprägsam sein
- Auf Deutsch sein
- Maximal 10 Wörter haben

Antworte NUR mit dem Titel, ohne weitere Erklärungen.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Du bist ein hilfreicher Assistent, der prägnante Titel für Bürgerideen erstellt.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 50,
    });

    return response.choices[0]?.message?.content?.trim() || "";
  } catch (error) {
    console.error("[OpenAI] Error generating title:", error);
    throw error;
  }
}

/**
 * Generate both summary and hashtags in one call
 * More efficient than calling separately
 */
export async function enhanceIdea(idea: IdeaContent, includeTitle: boolean = false): Promise<AIEnhancement> {
  try {
    const prompt = includeTitle
      ? `Analysiere diese Bürgeridee und erstelle:

1. Einen prägnanten Titel (max. 10 Wörter)
2. Eine Zusammenfassung (max. 3 Sätze), die vermittelt, worum es in dieser Idee wirklich geht
3. 5-10 relevante Hashtags für Klassifizierung

Kontext: Dies ist eine Idee von Einwohnern, die ihr Stadtleben verbessern oder sicherer gestalten möchten.

Idee:
Originaltitel: ${idea.title}
Kategorie: ${idea.category}
Inhalt: ${idea.description}

Die Zusammenfassung soll dem Leser klar vermitteln:
- Was ist das konkrete Anliegen oder Problem?
- Welche Verbesserung für das Stadtleben wird vorgeschlagen?
- Welchen Nutzen hätte die Umsetzung für die Bürger?

Antworte im folgenden Format:
TITEL: [dein Titel hier]
ZUSAMMENFASSUNG: [deine Zusammenfassung hier]
HASHTAGS: #tag1 #tag2 #tag3 ...`
      : `Analysiere diese Bürgeridee und erstelle:

1. Eine Zusammenfassung (max. 3 Sätze), die vermittelt, worum es in dieser Idee wirklich geht
2. 5-10 relevante Hashtags für Klassifizierung

Kontext: Dies ist eine Idee von Einwohnern, die ihr Stadtleben verbessern oder sicherer gestalten möchten.

Idee:
Titel: ${idea.title}
Kategorie: ${idea.category}
Inhalt: ${idea.description}

Die Zusammenfassung soll dem Leser klar vermitteln:
- Was ist das konkrete Anliegen oder Problem?
- Welche Verbesserung für das Stadtleben wird vorgeschlagen?
- Welchen Nutzen hätte die Umsetzung für die Bürger?

Antworte im folgenden Format:
ZUSAMMENFASSUNG: [deine Zusammenfassung hier]
HASHTAGS: #tag1 #tag2 #tag3 ...`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Du bist ein hilfreicher Assistent, der Bürgerideen analysiert und zusammenfasst.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.6,
      max_tokens: includeTitle ? 300 : 250,
    });

    const content = response.choices[0]?.message?.content?.trim() || "";

    // Parse response
    const titleMatch = includeTitle ? content.match(/TITEL:\s*(.+?)(?=\nZUSAMMENFASSUNG:|$)/s) : null;
    const summaryMatch = content.match(/ZUSAMMENFASSUNG:\s*(.+?)(?=\nHASHTAGS:|$)/s);
    const hashtagsMatch = content.match(/HASHTAGS:\s*(.+)/s);

    const aiTitle = titleMatch?.[1]?.trim() || undefined;
    const summary = summaryMatch?.[1]?.trim() || "";
    const hashtagsText = hashtagsMatch?.[1]?.trim() || "";

    const hashtags = hashtagsText
      .split(/\s+/)
      .filter((word) => word.startsWith("#"))
      .map((tag) => tag.toLowerCase())
      .filter((tag, index, self) => self.indexOf(tag) === index);

    return {
      summary,
      hashtags,
      aiTitle,
    };
  } catch (error) {
    console.error("[OpenAI] Error enhancing idea:", error);
    throw error;
  }
}

/**
 * Batch process multiple ideas
 * Rate limiting: max 3 requests per second
 */
export async function batchEnhanceIdeas(
  ideas: IdeaContent[],
  onProgress?: (current: number, total: number) => void
): Promise<Map<string, AIEnhancement>> {
  const results = new Map<string, AIEnhancement>();
  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  console.log(`[OpenAI] Starting batch enhancement for ${ideas.length} ideas...`);

  for (let i = 0; i < ideas.length; i++) {
    const idea = ideas[i];
    try {
      const enhancement = await enhanceIdea(idea);
      results.set(idea.title, enhancement);

      if (onProgress) {
        onProgress(i + 1, ideas.length);
      }

      console.log(`[OpenAI] Enhanced ${i + 1}/${ideas.length}: ${idea.title}`);

      // Rate limiting: wait 350ms between requests (< 3 req/s)
      if (i < ideas.length - 1) {
        await delay(350);
      }
    } catch (error) {
      console.error(`[OpenAI] Failed to enhance idea "${idea.title}":`, error);
      // Continue with next idea even if one fails
    }
  }

  console.log(`[OpenAI] Batch enhancement completed. ${results.size}/${ideas.length} successful.`);
  return results;
}

/**
 * Answer a custom question about ideas or issues (Mängel)
 */
export async function answerCustomQuestion(
  question: string,
  items: Array<{ title: string; description: string; category: string; status: string }>,
  itemType: "ideas" | "maengel"
): Promise<string> {
  try {
    const itemLabel = itemType === "ideas" ? "Bürgerideen" : "Mängelmeldungen";
    const contextLimit = 10; // Limit context to first 10 items to stay within token limits
    const contextItems = items.slice(0, contextLimit);

    const context = contextItems
      .map((item, i) => `${i + 1}. Titel: ${item.title}\n   Kategorie: ${item.category}\n   Status: ${item.status}\n   Beschreibung: ${item.description}`)
      .join("\n\n");

    const prompt = `Du bist ein hilfreicher Assistent, der Fragen über ${itemLabel} aus Braunschweig beantwortet.

Kontext - Aktuelle ${itemLabel} (${contextItems.length} von ${items.length} insgesamt):

${context}

Frage des Nutzers: ${question}

Beantworte die Frage basierend auf den bereitgestellten ${itemLabel}. Sei präzise und hilfreich. Wenn die Frage nicht mit den verfügbaren Daten beantwortet werden kann, sage das höflich.`;

    const response = await openai.chat.completions.create({
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
    });

    return response.choices[0]?.message?.content?.trim() || "Keine Antwort verfügbar.";
  } catch (error) {
    console.error("[OpenAI] Error answering custom question:", error);
    throw error;
  }
}
