# Admin AI Enhancement Tool - Dokumentation

## Übersicht

Das Admin AI Enhancement Tool ist eine leistungsstarke Verwaltungsoberfläche zur KI-gestützten Verbesserung von Ideen-Inhalten. **AI-Enhancement geschieht jetzt automatisch beim Scraping** - Administratoren können mit einem einfachen Button alle Daten löschen und komplett neu scrapen.

## Features

### 1. Accordion-basierte Übersicht

- **Kompakte Darstellung**: Alle Ideen in einer übersichtlichen Liste
- **AI-generierte Titel**: Im Accordion-Header wird der KI-generierte Titel angezeigt
- **Status-Indikatoren**:
  - ✅ Grünes Häkchen = AI-Daten vorhanden
  - ⚠️ Gelbes Label = Benötigt AI-Verarbeitung
  - 🔄 Spinner = Wird gerade verarbeitet

### 2. Automatische AI-Enhancement beim Scraping

**Funktionsweise**:
- AI-Enhancement geschieht **automatisch** während des Scraping-Prozesses
- Jede neue Idee wird sofort mit AI-Titel, Zusammenfassung und Hashtags versehen
- Keine manuelle Nachbearbeitung notwendig

**Generierte Inhalte**:
- **AI-Titel**: Prägnanter, aussagekräftiger Titel (max. 10 Wörter)
- **AI-Zusammenfassung**: 3-Satz-Zusammenfassung der Kernpunkte
- **AI-Hashtags**: 5-10 relevante Hashtags für Klassifizierung

### 3. Reset und Neu Scrapen

**Steuerung**:
- **Ein Button**: "Alles neu scrapen" im Admin-Bereich
- **Funktion**: Löscht alle bestehenden Daten und scraped komplett neu
- **Warnung**: Bestätigungsdialog vor der Ausführung

**Verarbeitungslogik**:
1. Löscht alle Ideen und History aus der Datenbank
2. Startet komplettes Neu-Scraping mit Detail-Daten
3. Generiert automatisch AI-Daten für alle Ideen
4. Rate-Limiting: 350ms zwischen AI-Calls
5. Max. Dauer: 5 Minuten

### 4. Manuelle Nachbearbeitung

**Optional verfügbar**:
- **"Neu generieren" Button**: In jedem Accordion im Admin-Bereich
- **Verwendung**: Für Einzelfälle, wo AI-Daten aktualisiert werden sollen
- **API-Endpunkt**: `/api/ideas/[id]/enhance`

### 5. Vergleichsansicht

**Im erweiterten Accordion**:

| AI-generiert | Original |
|--------------|----------|
| AI-Titel | Original-Titel |
| AI-Zusammenfassung | Original-Beschreibung |
| AI-Hashtags | - |

## Technische Implementierung

### API-Endpunkte

#### 1. Einzelne Idee enhancen
```typescript
POST /api/ideas/[id]/enhance

Response:
{
  "success": true,
  "idea": { /* updated idea */ },
  "enhancement": {
    "aiTitle": "KI-generierter Titel",
    "aiSummary": "Zusammenfassung...",
    "aiHashtags": ["#tag1", "#tag2", ...]
  }
}
```

#### 2. Reset und Neu Scrapen
```typescript
POST /api/ideas/reset-and-scrape

Response:
{
  "success": true,
  "message": "Successfully reset and scraped all ideas",
  "itemsScraped": 267,
  "itemsNew": 267
}
```

**Warnung**: Dieser Endpunkt löscht ALLE bestehenden Ideen!

### Datenbank-Schema

**Neue Felder in `ideas` Tabelle**:
```sql
aiTitle TEXT           -- KI-generierter Titel
aiSummary TEXT         -- KI-generierte Zusammenfassung
aiHashtags TEXT        -- JSON Array mit Hashtags
```

### OpenAI Integration

**Modell**: GPT-4o-mini
**API Key**: Aus `lib/ai/openai-service.ts`

**Prompts**:

```
TITEL-GENERIERUNG:
"Erstelle einen prägnanten, aussagekräftigen Titel (max. 10 Wörter)
für diese Bürgeridee..."

ZUSAMMENFASSUNG:
"Erstelle eine prägnante Zusammenfassung (max. 3 Sätze) dieser
Bürgeridee..."

HASHTAGS:
"Erstelle 5-10 präzise Hashtags die:
- Die Hauptthemen erfassen
- Für Filterung und Suche nützlich sind
- Auf Deutsch sind"
```

## Benutzerführung

### Workflow: Komplettes Neu-Scraping

1. **Admin-Seite öffnen**: `/admin/ai-ideas`
2. **Button klicken**: "Neu scrapen" im roten Warnungs-Bereich
3. **Bestätigen**: Warndialog mit "OK" bestätigen
4. **Warten**: Scraping läuft (kann mehrere Minuten dauern)
5. **Ergebnis**: Alert zeigt Statistiken (z.B. "267 Ideen gescraped")
6. **Fertig**: Alle Ideen haben automatisch AI-Daten

### Workflow: Einzelne Idee prüfen/neu generieren

1. **Admin-Seite öffnen**: `/admin/ai-ideas`
2. **Idee auswählen**: Klick auf Accordion-Header
3. **Ansicht**: Vergleich von AI-Titel vs. Original-Titel
4. **Optional**: "Neu generieren" Button für manuelle Aktualisierung

### Workflow: Öffentliche Ideen-Seite

1. **Seite öffnen**: `/ideen`
2. **Idee anklicken**: Klick auf eine Ideen-Karte
3. **Expanded View**: Zeigt vollständige Beschreibung und alle Hashtags
4. **Schließen**: Nochmal klicken um zu schließen

## Performance-Optimierungen

### Rate-Limiting
- **350ms Pause** zwischen API-Calls
- Verhindert OpenAI Rate-Limit-Errors
- ~3 Requests pro Sekunde

### Scraping-Performance
- **Max. Dauer**: 5 Minuten (300s) für komplettes Scraping
- **Parallele Detail-Scrapes**: Mehrere Detail-Seiten gleichzeitig
- **Error-Handling**: Einzelne Fehler stoppen nicht das gesamte Scraping

### Automatische AI-Integration
- **Im Scraper integriert**: AI-Enhancement während des Scrapings
- **Kein separater Batch**: Keine manuelle Nachbearbeitung nötig
- **Rate-Limiting**: 350ms zwischen AI-Calls verhindert Überlastung

## Kosten-Schätzung

**OpenAI GPT-4o-mini Pricing**:
- Input: ~$0.150 / 1M tokens
- Output: ~$0.600 / 1M tokens

**Pro Idee mit Titel**:
- Durchschnitt: ~800 tokens (Input + Output)
- Kosten: ~$0.0005 pro Idee
- **100 Ideen**: ~$0.05
- **Alle 267 Ideen**: ~$0.13

**Kosten beim Neu-Scraping**:
- Einmaliges komplettes Scraping: ~$0.13
- Nur bei Bedarf (z.B. monatlich oder bei größeren Updates)
- Sehr günstig durch Verwendung von GPT-4o-mini

## Monitoring & Logging

### Console-Logs
```
[Reset & Scrape] Starting reset and full scrape...
[Reset & Scrape] Deleting existing data...
[Reset & Scrape] ✓ All existing data deleted
[Reset & Scrape] Starting fresh scrape with AI enhancement...

[Ideenplattform] Scrape Seite 1...
[Ideenplattform] Generating AI enhancements for: Spielplatz...
[Ideenplattform] ✓ AI Title: Spielplatz sanieren und erweitern
[Ideenplattform] 10 Ideen auf Seite 1 gefunden

[Reset & Scrape] ✓ Completed: 267 ideas scraped (267 new)
```

### Error-Handling
- **Scraping-Fehler**: Einzelne Fehler stoppen nicht das gesamte Scraping
- **AI-Fehler**: Idee wird ohne AI-Daten gespeichert, Fehler geloggt
- **User-Feedback**: Alert mit Statistiken nach Completion

## Statistiken

### Dashboard-Cards

1. **Gesamt**: Gesamtanzahl aller Ideen
2. **Mit AI**: Ideen mit vollständigen AI-Daten
3. **Ohne AI**: Ideen die noch verarbeitet werden müssen

### Berechnung
```typescript
const withAI = ideas.filter(i =>
  i.aiTitle && i.aiSummary && i.aiHashtags
).length;
```

## Best Practices

### Empfohlener Workflow

1. **Erstmaliges Setup**:
   - "Neu scrapen" Button verwenden
   - Wartet bis komplettes Scraping abgeschlossen ist
   - Alle Ideen haben automatisch AI-Daten

2. **Regelmäßige Wartung**:
   - Monatliches oder quartalsweises Neu-Scraping empfohlen
   - Nur bei größeren Updates der Original-Plattform
   - Kostet nur ~$0.13 pro komplettes Scraping

3. **Qualitätskontrolle**:
   - Stichproben-Prüfung der generierten Titel im Admin
   - Bei Bedarf einzelne Ideen mit "Neu generieren" aktualisieren
   - Vergleichsansicht nutzen (AI vs. Original)

### Performance-Tipps

- **Geduld**: Komplettes Scraping kann 3-5 Minuten dauern
- **Off-Peak**: Scraping außerhalb der Hauptnutzungszeit
- **Keine Unterbrechung**: Browser-Tab während Scraping offen lassen

## Troubleshooting

### Problem: "Fehler beim Scraping"
**Lösung**:
- OpenAI API-Key in `.env.local` prüfen
- Internetverbindung überprüfen
- Console-Logs im Browser/Terminal ansehen
- Nochmal versuchen (einzelne Fehler sind normal)

### Problem: AI-Daten werden nicht angezeigt
**Lösung**:
- Seite neu laden (Browser-Refresh mit F5)
- Prüfen ob Scraping abgeschlossen ist
- "Neu generieren" Button für einzelne Ideen verwenden

### Problem: Scraping dauert sehr lange (>10 Minuten)
**Lösung**:
- Timeout nach 5 Minuten ist normal
- Bei Abbruch: Nochmal "Neu scrapen" starten
- Browser-Tab nicht schließen während des Scrapings

## Zukunfts-Features

### Geplante Erweiterungen
- [ ] Bulk-Export der AI-Daten (CSV/JSON)
- [ ] Vergleichs-Statistiken (AI vs. Original)
- [ ] Custom-Prompts für Titel/Zusammenfassungen
- [ ] Automatisches Scheduling (Cronjob für wöchentliches Scraping)
- [ ] Progress-Bar für Scraping-Prozess im UI
- [ ] Minimalistisches Accordion-Design auch im Admin

## Links

- **Admin UI**: `/admin/ai-ideas`
- **Öffentliche Ideen-Seite**: `/ideen`
- **API Endpunkt (Reset)**: `/api/ideas/reset-and-scrape`
- **API Endpunkt (Einzeln)**: `/api/ideas/[id]/enhance`
- **Scraper**: `scrapers/ideenplattform.ts`
- **OpenAI Service**: `lib/ai/openai-service.ts`
- **Datenbank**: `lib/db/index.ts`

---

**Version**: 2.0
**Letzte Aktualisierung**: 2025-10-11
**Autor**: Claude Code

## Änderungen in Version 2.0

- ✅ **Automatische AI-Enhancement**: Geschieht jetzt während des Scrapings
- ✅ **Vereinfachte Admin-UI**: Ein Button statt komplexer Batch-Controls
- ✅ **Reset & Scrape**: Löscht alle Daten und scraped komplett neu
- ✅ **Öffentliche Accordions**: Minimalistische Accordions auf `/ideen`
- ✅ **AI-Titel**: Neue Funktion für prägnante 10-Wort-Titel
- ✅ **Kein manueller Batch**: Keine separate Nachbearbeitung mehr nötig
