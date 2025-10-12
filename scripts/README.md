# Bohlweg Platform - Skripte

Dieses Verzeichnis enthält Hilfs-Skripte für die Verwaltung der Bohlweg Platform.

## Reset & Re-Scrape

### TypeScript Version

```bash
npm run reset-scrape
```

oder

```bash
npx ts-node scripts/reset-and-scrape.ts
```

### Shell Version

```bash
./scripts/reset-and-scrape.sh
```

**Was macht das Skript?**

1. **Löscht die bestehende Datenbank** (`data/bohlweg.db`) inkl. WAL und SHM Dateien
2. **Initialisiert eine neue Datenbank** mit dem aktuellen Schema
3. **Scrapt die Ideenplattform** - durchläuft ALLE Seiten und speichert alle Ideen
4. **Scrapt den Mängelmelder** - durchläuft ALLE Seiten und speichert alle Mängel

**Wann sollte man es verwenden?**

- Nach Änderungen am Datenbankschema
- Wenn die Datenbank korrupt ist
- Für einen kompletten Neustart mit frischen Daten
- Zum Testen nach Code-Änderungen

**Hinweis:** Das Skript kann je nach Anzahl der Seiten mehrere Minuten dauern, da es:
- Alle Übersichtsseiten durchgeht (mit Pagination)
- Jede Detail-Seite einzeln scrapt für vollständige Beschreibungen
- Wartezeiten zwischen Requests einhält (1 Sekunde)

## Einzelne Scraper ausführen

### Nur Ideenplattform scrapen

```bash
npm run scrape-ideas
```

oder

```bash
npx ts-node scrapers/ideenplattform.ts
```

### Nur Mängelmelder scrapen

```bash
npm run scrape-maengel
```

oder

```bash
npx ts-node scrapers/maengelmelder.ts
```

## Ausgabe-Beispiel

```
=== Bohlweg Platform: Reset & Re-Scrape ===

[1/4] Lösche bestehende Datenbank...
✓ Datenbank erfolgreich gelöscht
✓ WAL-Datei gelöscht
✓ SHM-Datei gelöscht

[2/4] Initialisiere neue Datenbank...
[DB] Database initialized successfully
✓ Datenbank erfolgreich initialisiert

[3/4] Starte Scraping der Ideenplattform...
────────────────────────────────────────
[Ideenplattform] Starte Scraping...
[Ideenplattform] Seite geladen
[Ideenplattform] Scrape Seite 1...
[Ideenplattform] 15 Ideen auf Seite 1 gefunden
[Ideenplattform] Scrape Seite 2...
...
[Ideenplattform] Scraping abgeschlossen: 45 Items (45 neu, 0 aktualisiert)
────────────────────────────────────────
✓ Ideenplattform erfolgreich gescraped
  → 45 Ideen gefunden
  → 45 neue Einträge

[4/4] Starte Scraping des Mängelmelders...
────────────────────────────────────────
[Mängelmelder] Starte Scraping...
...

=== Reset & Re-Scrape abgeschlossen ===
```

## Technische Details

- **TypeScript:** Nutzt ts-node für direkte TypeScript-Ausführung
- **Fehlerbehandlung:** Skript beendet sich mit Exit-Code 1 bei Fehlern
- **Datenbank-Verwaltung:** Schließt die Datenbank-Verbindung sauber nach Abschluss
- **Logging:** Ausführliche Konsolen-Ausgabe für Debugging

## Troubleshooting

**Problem:** "Cannot find module" Fehler

```bash
npm install
```

**Problem:** Permission denied beim Shell-Skript

```bash
chmod +x scripts/reset-and-scrape.sh
```

**Problem:** Scraping dauert zu lange

- Das ist normal - jede Seite wird einzeln gescrapt
- Der Scraper wartet 1 Sekunde zwischen Seiten
- Bei vielen Seiten kann es 5-10 Minuten dauern

**Problem:** Browser-Fehler (Playwright)

```bash
npx playwright install chromium
```
