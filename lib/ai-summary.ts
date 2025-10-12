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
 */
export async function generateIdeenSummary(limit: number = 30): Promise<string> {
  const db = getDatabase();

  // Hole die neuesten Ideen
  const ideas = db
    .prepare("SELECT title, description, category, status, supporters FROM ideas ORDER BY CAST(externalId AS INTEGER) DESC LIMIT ?")
    .all(limit) as Idea[];

  if (ideas.length === 0) {
    return "Aktuell sind keine Ideen vorhanden.";
  }

  // Erstelle Prompt für GPT
  const ideasText = ideas.map((idea, i) =>
    `${i + 1}. "${idea.title}" (${idea.category}, ${idea.supporters} Unterstützer) - ${idea.description?.substring(0, 150)}...`
  ).join("\n\n");

  const prompt = `Analysiere die folgenden ${ideas.length} Bürgerideen aus Braunschweig und erstelle eine prägnante 3-4 Sätze Zusammenfassung für Journalisten.

Fokus:
- Welche Hauptthemen beschäftigen die Bürger?
- Welche Wünsche und Verbesserungsvorschläge gibt es?
- Welche Trends oder Muster sind erkennbar?

Die Zusammenfassung soll professionell, sachlich und informativ sein.

Ideen:
${ideasText}

Zusammenfassung (3-4 Sätze):`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 300,
      messages: [{
        role: "user",
        content: prompt
      }]
    });

    const summary = response.choices[0]?.message?.content || "";
    return summary.trim();
  } catch (error) {
    console.error("[AI Summary] Fehler bei Ideen-Zusammenfassung:", error);
    throw error;
  }
}

/**
 * Generiere eine 3-4 Sätze Zusammenfassung für Mängelmelder
 */
export async function generateMaengelSummary(limit: number = 30): Promise<string> {
  const db = getDatabase();

  // Hole die neuesten Mängel
  const maengel = db
    .prepare("SELECT title, description, category, status, location FROM maengel ORDER BY CAST(externalId AS INTEGER) DESC LIMIT ?")
    .all(limit) as Maengel[];

  if (maengel.length === 0) {
    return "Aktuell sind keine Mängel gemeldet.";
  }

  // Erstelle Prompt für GPT
  const maengelText = maengel.map((mangel, i) =>
    `${i + 1}. "${mangel.title}" (${mangel.category}, ${mangel.status}) - ${mangel.description?.substring(0, 150)}...`
  ).join("\n\n");

  const prompt = `Analysiere die folgenden ${maengel.length} gemeldeten Mängel aus Braunschweig und erstelle eine prägnante 3-4 Sätze Zusammenfassung für Journalisten.

Fokus:
- Welche Hauptprobleme werden gemeldet?
- In welchen Bereichen häufen sich Beschwerden?
- Welche Dringlichkeit oder Muster sind erkennbar?

Die Zusammenfassung soll professionell, sachlich und informativ sein.

Mängel:
${maengelText}

Zusammenfassung (3-4 Sätze):`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 300,
      messages: [{
        role: "user",
        content: prompt
      }]
    });

    const summary = response.choices[0]?.message?.content || "";
    return summary.trim();
  } catch (error) {
    console.error("[AI Summary] Fehler bei Mängel-Zusammenfassung:", error);
    throw error;
  }
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
