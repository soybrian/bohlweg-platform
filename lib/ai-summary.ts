/**
 * AI Summary Service
 *
 * Generiert automatische Zusammenfassungen von Ideen und Mängeln
 * für Journalisten und schnelle Informationsbeschaffung.
 */

import OpenAI from "openai";
import { getDatabase } from "./db";
import type { Idea, Maengel, PlatformSummary } from "./db/schema";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generiere eine 3-4 Sätze Zusammenfassung für Ideenplattform
 * DEAKTIVIERT: Funktion generiert keine AI-Zusammenfassung mehr
 */
export async function generateIdeenSummary(limit: number = 30): Promise<string> {
  console.log("[AI Summary] generateIdeenSummary ist deaktiviert");
  return "AI-Zusammenfassung ist deaktiviert.";
}

/**
 * Generiere eine 3-4 Sätze Zusammenfassung für Mängelmelder
 * DEAKTIVIERT: Funktion generiert keine AI-Zusammenfassung mehr
 */
export async function generateMaengelSummary(limit: number = 30): Promise<string> {
  console.log("[AI Summary] generateMaengelSummary ist deaktiviert");
  return "AI-Zusammenfassung ist deaktiviert.";
}

/**
 * Speichere eine Zusammenfassung in der Datenbank
 */
export function saveSummary(moduleKey: string, summary: string, itemCount: number): number {
  const db = getDatabase();

  const createdAt = new Date().toISOString();
  const validUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 Stunden gültig

  const result = db.prepare(`
    INSERT INTO platform_summaries (moduleKey, summary, itemCount, createdAt, validUntil)
    VALUES (?, ?, ?, ?, ?)
  `).run(moduleKey, summary, itemCount, createdAt, validUntil);

  return result.lastInsertRowid as number;
}

/**
 * Extrahiere strukturierte Event-Daten aus Text/HTML mit GPT-4o-mini
 * Akzeptiert sowohl HTML als auch extrahierten Text
 */
export async function extractEventDataWithAI(content: string, url: string): Promise<any> {
  try {
    // Begrenze auf 30k Zeichen für Token-Limits
    const truncatedContent = content.substring(0, 30000);

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Du bist ein Experte für die Extraktion strukturierter Event-Daten.

Extrahiere ALLE tatsächlichen Event-Informationen und gebe sie als JSON zurück.

JSON-Struktur:
{
  "event": {
    "title": string (der echte Event-Titel),
    "description": string (die vollständige Beschreibung/Text des Events - mindestens 2-3 Sätze wenn vorhanden),
    "dates": [{"date": "DD. Monat YYYY", "time": "HH:MM - HH:MM"}] (alle Termine - extrahiere ALLE Daten!),
    "location": {
      "name": string (echter Veranstaltungsort-Name - z.B. "Allgemeiner Konsumverein"),
      "address": string (echte Straße + Hausnummer - z.B. "Hinter Liebfrauen 2"),
      "postal_code": string (echte PLZ - z.B. "38100"),
      "city": string (echte Stadt - z.B. "Braunschweig")
    },
    "organizer": {
      "name": string (echter Veranstalter-Name),
      "address": string (wenn verfügbar),
      "phone": string (wenn verfügbar),
      "email": string (wenn verfügbar),
      "website": string (wenn verfügbar - vollständige URL)
    },
    "category": string (Event-Kategorie),
    "mood_category": string (EINE der folgenden Kategorien basierend auf der Event-Beschreibung):
      - "Das crazy" (für skurrile, außergewöhnliche, verrückte Events - z.B. experimentelle Kunst, ungewöhnliche Performances)
      - "Lustig" (für Comedy, humorvolle Shows, unterhaltsame Events die zum Lachen bringen)
      - "Interessant" (für kulturell/intellektuell anspruchsvolle Events - Ausstellungen, Vorträge, klassische Konzerte)
      - "Kann man sich geben" (für solide, angenehme Events ohne besondere Highlights - Standard-Veranstaltungen),
    "price_info": string (Preis-Information),
    "is_free": boolean (true wenn kostenlos),
    "ticket_url": string (vollständige URL zum Ticket-Kauf wenn vorhanden - z.B. Links die "Tickets kaufen" oder "Jetzt buchen" heißen),
    "image_urls": [string] (alle vollständigen Bild-URLs)
  }
}

KRITISCH WICHTIG:
- Extrahiere NUR echte Daten
- NIEMALS erfundene/Platzhalter-Daten verwenden
- Wenn ein Feld nicht vorhanden: setze auf null oder ""
- Textinhalte VOLLSTÄNDIG übernehmen
- Suche nach Links wie "Tickets kaufen", "Jetzt buchen", oder ähnlichen Begriffen für ticket_url
- Wähle die mood_category basierend auf Ton, Inhalt und Zielgruppe des Events
- Antworte NUR mit gültigem JSON`
        },
        {
          role: "user",
          content: `Extrahiere alle Event-Daten aus diesem Inhalt:\n\n${truncatedContent}`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    const responseContent = response.choices[0]?.message?.content;
    if (!responseContent) {
      throw new Error("No response from OpenAI");
    }

    const extracted = JSON.parse(responseContent);
    console.log(`[AI Extract] Erfolgreich extrahiert für ${url}`);
    return extracted;
  } catch (error) {
    console.error(`[AI Extract] Fehler bei ${url}:`, error);
    return null;
  }
}

/**
 * Hole die aktuelle Zusammenfassung für ein Modul
 */
export function getCurrentSummary(moduleKey: string): PlatformSummary | null {
  const db = getDatabase();

  const summary = db.prepare(`
    SELECT * FROM platform_summaries
    WHERE moduleKey = ?
    ORDER BY createdAt DESC
    LIMIT 1
  `).get(moduleKey) as PlatformSummary | undefined;

  return summary || null;
}

/**
 * Generiere und speichere Zusammenfassung für ein Modul
 */
export async function generateAndSaveSummary(moduleKey: "ideenplattform" | "maengelmelder"): Promise<PlatformSummary> {
  console.log(`[AI Summary] Generiere Zusammenfassung für ${moduleKey}...`);

  let summary: string;
  let itemCount: number;

  if (moduleKey === "ideenplattform") {
    const db = getDatabase();
    const ideas = db.prepare("SELECT COUNT(*) as count FROM ideas ORDER BY CAST(externalId AS INTEGER) DESC LIMIT 30").get() as { count: number };
    itemCount = Math.min(ideas.count, 30);
    summary = await generateIdeenSummary(30);
  } else {
    const db = getDatabase();
    const maengel = db.prepare("SELECT COUNT(*) as count FROM maengel ORDER BY CAST(externalId AS INTEGER) DESC LIMIT 30").get() as { count: number };
    itemCount = Math.min(maengel.count, 30);
    summary = await generateMaengelSummary(30);
  }

  const id = saveSummary(moduleKey, summary, itemCount);

  console.log(`[AI Summary] Zusammenfassung gespeichert (ID: ${id})`);

  return {
    id,
    moduleKey,
    summary,
    itemCount,
    createdAt: new Date().toISOString(),
    validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  };
}
