/**
 * Quick Action Prompts
 *
 * Definiert die vordefinierten Fragen für die Quick Action Buttons
 * in der Research-Oberfläche.
 */

export interface QuickAction {
  label: string;
  question: string;
}

/**
 * Quick Actions für die Ideenplattform
 */
export const ideenQuickActions: QuickAction[] = [
  {
    label: "Zusammenfassung erstellen",
    question: "Erstelle eine kurze Übersicht: Was bewegt die Bürger gerade? Welche Themen und Anliegen stehen im Vordergrund? Gib mir einen kompakten Überblick ohne Details zu einzelnen Ideen."
  },
  {
    label: "Häufigste Kategorien",
    question: "Was sind die häufigsten Kategorien?"
  },
  {
    label: "Top Themen",
    question: "Welche Themen werden am meisten diskutiert?"
  },
  {
    label: "Status-Übersicht",
    question: "Gib mir eine Übersicht über die verschiedenen Status der Ideen."
  },
];

/**
 * Quick Actions für den Mängelmelder
 */
export const maengelQuickActions: QuickAction[] = [
  {
    label: "Zusammenfassung erstellen",
    question: "Erstelle eine kurze Übersicht: Welche Probleme und Mängel beschäftigen die Bürger aktuell? Was sind die Hauptanliegen? Gib mir einen kompakten Überblick ohne Details zu einzelnen Meldungen."
  },
  {
    label: "Häufigste Kategorien",
    question: "Was sind die häufigsten Kategorien?"
  },
  {
    label: "Status-Übersicht",
    question: "Gib mir eine Übersicht über die verschiedenen Status der Mängel."
  },
  {
    label: "Dringende Mängel",
    question: "Welche Mängel sollten prioritär bearbeitet werden?"
  },
];

/**
 * Quick Actions für Events
 */
export const eventsQuickActions: QuickAction[] = [
  {
    label: "Was läuft diese Woche?",
    question: "Welche Events finden diese Woche statt? Gib mir eine Übersicht mit Datum und Veranstaltungsort."
  },
  {
    label: "Kostenlose Events",
    question: "Welche kostenlosen Events gibt es in den nächsten 6 Wochen?"
  },
  {
    label: "Ich brauche was Rockiges",
    question: "Zeig mir Rock-, Metal- und alternative Musik-Events. Ich suche etwas mit härterer Gitarrenmusik!"
  },
  {
    label: "Wochenend-Highlights",
    question: "Was sind die Highlights am kommenden Wochenende? Gib mir die Top-Events."
  },
  {
    label: "Veranstaltungsorte",
    question: "Welche Veranstaltungsorte haben die meisten Events in den nächsten Wochen?"
  },
];
