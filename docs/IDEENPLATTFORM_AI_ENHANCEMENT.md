# Ideenplattform AI Enhancement - Prozessaufbau

## Übersicht

Dieses Dokument beschreibt die Implementierung eines KI-gestützten Systems zur erweiterten Analyse und Klassifizierung von Ideen der Braunschweiger Ideenplattform.

## Ziele

1. **Detaillierte Datenextraktion**: Vollständige Informationen aus der Detailansicht jeder Idee
2. **KI-basierte Zusammenfassungen**: Automatische Generierung von prägnanten Zusammenfassungen
3. **Intelligente Klassifizierung**: Hashtag-basierte Kategorisierung durch GPT-4o-mini
4. **Erweiterte Filterung**: Filterung nach Hashtags, Kategorien und Zeiträumen

## Architektur

### 1. Datenmodell-Erweiterung

#### Neue Felder in `ideas` Tabelle:
```sql
- votingDeadline TEXT           -- Zeitpunkt des Abstimmungsendes
- votingExpired BOOLEAN          -- Ob Abstimmungszeitraum überschritten
- supportersList TEXT            -- JSON Array mit allen Unterstützern
- aiSummary TEXT                 -- KI-generierte Zusammenfassung
- aiHashtags TEXT                -- JSON Array mit KI-generierten Hashtags
- detailScraped BOOLEAN          -- Ob Detailseite erfolgreich gescrapt wurde
- detailScrapedAt TEXT           -- Zeitpunkt des Detail-Scraping
```

### 2. Scraping-Pipeline

#### Phase 1: Übersichtsseiten-Scraping
- Sammelt Basis-Informationen aller Ideen
- Schneller Durchlauf für regelmäßige Updates

#### Phase 2: Detail-Scraping (erweitert)
Für jede Idee auf der Detailseite extrahieren:
- **Datum**: Genaues Erstellungsdatum
- **Autor**: Vollständiger Autorenname
- **Unterstützer**:
  - Anzahl der aktuellen Unterstützer
  - Maximale Anzahl Unterstützer
  - Liste aller Unterstützer-Namen (falls sichtbar)
- **Abstimmungszeitraum**:
  - Enddatum für Stimmabgabe
  - Status: aktiv/abgelaufen
- **Kategorie**: Detaillierte Kategoriezuordnung
- **Vollständiger Inhalt**: Komplette Beschreibung inkl. aller Absätze

#### Phase 3: KI-Verarbeitung

**Prompt-Template für Zusammenfassung**:
```
Erstelle eine prägnante Zusammenfassung (max. 3 Sätze) dieser Bürgeridee:

Titel: {title}
Kategorie: {category}
Inhalt: {description}

Die Zusammenfassung soll die Kernpunkte der Idee klar und verständlich darstellen.
```

**Prompt-Template für Hashtags**:
```
Analysiere diese Bürgeridee und erstelle relevante Hashtags zur Klassifizierung:

Titel: {title}
Kategorie: {category}
Inhalt: {description}

Erstelle 5-10 präzise Hashtags die:
- Die Hauptthemen erfassen
- Für Filterung und Suche nützlich sind
- Auf Deutsch sind
- Mit # beginnen

Format: #hashtag1 #hashtag2 #hashtag3 ...
```

### 3. API-Erweiterungen

#### Neue Endpunkte:

**GET `/api/ideas/hashtags`**
- Liefert alle verfügbaren Hashtags mit Anzahl
```json
{
  "hashtags": [
    { "tag": "#Verkehr", "count": 45 },
    { "tag": "#Nachhaltigkeit", "count": 32 },
    ...
  ]
}
```

**GET `/api/ideas?hashtags=tag1,tag2`**
- Filtert Ideen nach Hashtags
- Kombinierbar mit anderen Filtern

**GET `/api/ideas?votingStatus=active|expired`**
- Filtert nach Abstimmungsstatus

**GET `/api/ideas/:id/details`**
- Vollständige Detailinformationen einer Idee
```json
{
  "id": 123,
  "title": "...",
  "description": "...",
  "aiSummary": "...",
  "aiHashtags": ["#Tag1", "#Tag2"],
  "votingDeadline": "2025-12-31",
  "votingExpired": false,
  "supporters": 45,
  "maxSupporters": 50,
  "supportersList": ["Name1", "Name2", ...],
  "category": "Verkehr",
  "status": "Laufend",
  ...
}
```

### 4. Frontend-Erweiterungen

#### Filter-Komponente (erweitert):
```tsx
<IdeenFilter>
  - Kategorie-Auswahl (Dropdown/Chips)
  - Hashtag-Auswahl (Multi-Select mit Suchfunktion)
  - Status-Filter (Aktiv/Abgelaufen/Alle)
  - Abstimmungsstatus (Offen/Abgelaufen)
  - Sortierung (Datum, Unterstützer, Kategorie)
</IdeenFilter>
```

#### Ideen-Card (erweitert):
```tsx
<IdeenCard>
  - Titel
  - KI-Zusammenfassung (statt langer Beschreibung)
  - Hashtags als klickbare Chips
  - Kategorie-Badge
  - Status-Badge (mit Farbcodierung)
  - Unterstützer-Fortschritt (45/50)
  - Abstimmungsstatus-Indikator
  - Zeitstempel
</IdeenCard>
```

#### Detail-Ansicht:
```tsx
<IdeenDetail>
  - Vollständiger Titel
  - KI-Zusammenfassung (prominent)
  - Vollständige Beschreibung
  - Alle Hashtags
  - Kategorie und Status
  - Unterstützer:
    - Anzahl und Fortschrittsbalken
    - Liste der Unterstützer (optional)
  - Abstimmungsinformationen:
    - Enddatum
    - Verbleibende Zeit / Abgelaufen-Hinweis
  - Autor und Erstellungsdatum
  - Link zur Originalseite
</IdeenDetail>
```

## Implementierungsschritte

### Schritt 1: Datenbank-Schema erweitern
```bash
# Migration erstellen und ausführen
1. Schema in schema.ts erweitern
2. Migration-Script erstellen
3. Datenbank migrieren
```

### Schritt 2: OpenAI Integration
```bash
1. OpenAI SDK installieren: npm install openai
2. AI Service erstellen: lib/ai/openai-service.ts
3. Zusammenfassungs- und Hashtag-Funktionen implementieren
```

### Schritt 3: Enhanced Scraper
```bash
1. Detail-Scraping erweitern (scrapers/ideenplattform.ts)
2. Unterstützer-Parsing implementieren
3. Abstimmungszeitraum-Erkennung
4. KI-Verarbeitung integrieren
```

### Schritt 4: API erweitern
```bash
1. Neue Endpunkte erstellen
2. Filter-Logik für Hashtags implementieren
3. Aggregations-Endpunkte für Statistiken
```

### Schritt 5: Frontend implementieren
```bash
1. Filter-Komponente erstellen
2. Hashtag-Chips implementieren
3. Detail-Ansicht erweitern
4. Such- und Filterfunktionen integrieren
```

## Datenfluss

```
1. Scraper läuft periodisch
   ↓
2. Sammelt Ideen von Übersichtsseiten
   ↓
3. Für jede Idee:
   a. Detailseite aufrufen
   b. Vollständige Daten extrahieren
   c. Unterstützer und Zeiträume parsen
   ↓
4. KI-Verarbeitung:
   a. OpenAI GPT-4o-mini API aufrufen
   b. Zusammenfassung generieren
   c. Hashtags klassifizieren
   ↓
5. Datenbank speichern:
   a. Idee + erweiterte Felder
   b. Hashtags indexieren
   ↓
6. Frontend abrufen:
   a. Gefilterte/Sortierte Liste
   b. Mit KI-Zusammenfassungen
   c. Klickbare Hashtags
```

## Performance-Optimierungen

1. **Batch-Verarbeitung**: KI-Calls in Batches
2. **Caching**: Hashtag-Aggregationen cachen
3. **Selective Scraping**: Nur neue/geänderte Ideen neu scrapen
4. **Rate Limiting**: OpenAI API Rate Limits beachten

## Kosten-Schätzung

**OpenAI GPT-4o-mini**:
- Input: ~$0.150 / 1M tokens
- Output: ~$0.600 / 1M tokens
- Pro Idee: ~500 tokens (Zusammenfassung) + ~200 tokens (Hashtags)
- Bei 267 Ideen: ~187,000 tokens (~$0.15)
- Monatlich (Updates): ~$0.50

## Monitoring

- Scraping-Erfolgsrate
- KI-Verarbeitungszeit
- API-Fehlerrate
- Hashtag-Verteilung
- Filter-Nutzungsstatistiken

## Nächste Schritte

1. ✅ Prozessdokumentation erstellt
2. 🔄 Datenbank-Schema erweitern
3. ⏳ OpenAI Service implementieren
4. ⏳ Enhanced Scraper entwickeln
5. ⏳ API erweitern
6. ⏳ Frontend anpassen
7. ⏳ Testing und Deployment

---

**Status**: In Entwicklung
**Letzte Aktualisierung**: 2025-10-11
**Version**: 1.0
