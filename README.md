# Bohlweg Platform

**Modulare Informationsplattform für Braunschweiger Journalisten**

Bohlweg ist eine performante, modulbasierte Plattform, die städtische Informationen aus Braunschweig aggregiert und in einem modernen Dashboard präsentiert. Die Plattform scrapt automatisch Daten von verschiedenen Quellen und stellt sie für Journalisten übersichtlich dar.

## 📋 Features

- ✨ **Glass Fluid Design** - Modernes, mobil-optimiertes UI mit Glasmorphismus-Effekten
- 🔄 **Asynchrones Scraping** - Performantes, nicht-blockierendes Daten-Scraping
- 🗂️ **Modulare Architektur** - Einfach erweiterbar mit neuen Datenquellen
- 🔍 **Live-Suche** - Echtzeit-Filterung durch alle Datensätze
- 📊 **Dashboard mit Statistiken** - Übersichtliche Darstellung aller wichtigen Metriken
- 📱 **Mobile First** - Vollständig responsive und für mobile Geräte optimiert
- 🐳 **Docker-Support** - Einfaches Deployment mit Docker

## 🏗️ Architektur

```
bohlweg-platform/
├── app/                      # Next.js App Router
│   ├── api/                  # API Routes
│   │   ├── ideas/           # Ideenplattform API
│   │   ├── maengel/         # Mängelmelder API
│   │   └── stats/           # Statistik API
│   ├── globals.css          # Globale Styles mit Glass Fluid Effekten
│   ├── layout.tsx           # Root Layout
│   └── page.tsx             # Haupt-Dashboard
├── components/              # React Komponenten (erweiterbar)
├── lib/                     # Shared Libraries
│   ├── db/                  # Datenbank-Layer
│   │   ├── index.ts        # DB Operations
│   │   └── schema.ts       # Schema Definitionen
│   └── utils.ts            # Utility Functions
├── scrapers/                # Scraper Module
│   ├── ideenplattform.ts   # Ideenplattform Scraper
│   ├── maengelmelder.ts    # Mängelmelder Scraper
│   └── scheduler.ts        # Cron Scheduler
├── data/                    # SQLite Datenbank (wird automatisch erstellt)
├── public/                  # Statische Assets
├── docker-compose.yml       # Docker Compose Config
├── Dockerfile              # Docker Build Config
└── README.md               # Diese Datei
```

## 🚀 Quick Start

### Voraussetzungen

- Node.js 18+
- npm oder yarn
- (Optional) Docker & Docker Compose

### Installation

1. **Repository klonen und Dependencies installieren**

```bash
cd bohlweg-platform
npm install
```

2. **Playwright Browser installieren**

```bash
npx playwright install chromium
```

3. **Datenbank initialisieren**

Die Datenbank wird automatisch beim ersten Start erstellt. Optional kann sie manuell initialisiert werden:

```bash
npm run setup-db
```

4. **Entwicklungsserver starten**

```bash
npm run dev
```

Die Anwendung ist nun unter `http://localhost:3000` erreichbar.

## 📊 Module

### 1. Ideenplattform Scraper

Scrapt Bürger-Ideen von https://mitreden.braunschweig.de/ideenplattform

**Gesammelte Daten:**
- Titel und Beschreibung der Idee
- Autor und Erstellungsdatum
- Kategorie (Verkehr, Stadtgrün, etc.)
- Status (Laufend, Umgesetzt, etc.)
- Unterstützer-Anzahl
- Kommentar-Anzahl

**Manuell ausführen:**
```bash
npx ts-node scrapers/ideenplattform.ts
```

### 2. Mängelmelder Scraper

Scrapt gemeldete Mängel von https://mitreden.braunschweig.de/maengelmelder

**Gesammelte Daten:**
- Titel und Beschreibung des Mangels
- Autor und Meldedatum
- Kategorie (Straßenschäden, Beleuchtung, etc.)
- Bearbeitungsstatus
- Standort/Adresse

**Manuell ausführen:**
```bash
npx ts-node scrapers/maengelmelder.ts
```

### 3. Scheduler

Führt die Scraper automatisch in regelmäßigen Abständen aus.

**Standard-Schedule:**
- Ideenplattform: Täglich um 6:00 Uhr
- Mängelmelder: Täglich um 6:30 Uhr

**Scheduler starten:**
```bash
npm run scraper
```

**Alle Scraper sofort ausführen:**
```bash
npx ts-node scrapers/scheduler.ts --now
```

**Nur Ideenplattform scrapen:**
```bash
npx ts-node scrapers/scheduler.ts --ideenplattform
```

**Nur Mängelmelder scrapen:**
```bash
npx ts-node scrapers/scheduler.ts --maengelmelder
```

## 🎨 Dashboard Features

### Live-Suche
- Durchsucht alle Titel, Beschreibungen, Kategorien und Standorte
- Echtzeit-Filterung ohne Seiten-Reload
- Funktioniert sowohl für Ideen als auch Mängel

### Statistiken
- Gesamt-Anzahl Ideen und Mängel
- Verteilung nach Kategorien
- Verteilung nach Status
- Aktuelle Scraper-Runs

### Filter
- Nach Kategorie filtern
- Nach Status filtern
- Kombinierbar mit Suche

## 🗄️ Datenbank

Die Plattform verwendet **SQLite** (better-sqlite3) für optimale Performance.

**Tabellen:**
- `ideas` - Ideen von der Ideenplattform
- `maengel` - Mängel vom Mängelmelder
- `scraper_runs` - History der Scraper-Ausführungen

**Datenbank-Pfad:**
```
data/bohlweg.db
```

## 🐳 Docker Deployment (Production)

### Voraussetzungen

- Docker 20.10+
- Docker Compose v2.0+

### Environment-Variablen konfigurieren

Erstelle eine `.env` Datei basierend auf `.env.example`:

```bash
cp .env.example .env
```

**Wichtige Production-Einstellungen:**

```bash
# .env
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
DATABASE_PATH=/app/data/bohlweg.db
PORT=3000
```

### Production Build erstellen

```bash
# 1. Production Build testen
npm run build

# 2. Docker Image bauen
docker-compose build

# 3. Container starten
docker-compose up -d
```

Die Anwendung läuft auf Port 3000 mit:
- **Web-Service**: Next.js Application (http://localhost:3000)
- **Scraper-Service**: Automatischer Scheduler für tägliches Scraping

### Docker-Container verwalten

```bash
# Status anzeigen
docker-compose ps

# Logs anzeigen
docker-compose logs -f web
docker-compose logs -f scraper

# Container stoppen
docker-compose stop

# Container neu starten
docker-compose restart

# Container stoppen und entfernen
docker-compose down

# Container stoppen und Volumes löschen (ACHTUNG: Datenbank wird gelöscht!)
docker-compose down -v
```

### Production-Datenbank-Backup

```bash
# Backup erstellen
docker-compose exec web cp /app/data/bohlweg.db /app/data/bohlweg-backup-$(date +%Y%m%d).db

# Oder von Host-System
cp data/bohlweg.db data/bohlweg-backup-$(date +%Y%m%d).db
```

### Health Check

Die Docker-Container haben integrierte Health Checks:

```bash
# Health Status prüfen
docker-compose ps

# Manual health check
curl http://localhost:3000/api/stats
```

### Nur Docker (ohne Compose)

```bash
# Image bauen
docker build -t bohlweg-platform .

# Container starten
docker run -d \
  --name bohlweg-web \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  -e NODE_ENV=production \
  -e NEXT_TELEMETRY_DISABLED=1 \
  --restart unless-stopped \
  bohlweg-platform
```

### Production-Checkliste

- [ ] `.env` Datei mit Production-Werten erstellt
- [ ] `npm run build` erfolgreich durchgeführt
- [ ] Docker-Container mit Health Checks gestartet
- [ ] Datenbank-Backups konfiguriert
- [ ] Logs werden überwacht
- [ ] Port 3000 ist erreichbar (oder via Reverse Proxy)

## 🔧 Konfiguration

### Scraper-Schedule anpassen

Bearbeite `scrapers/scheduler.ts`:

```typescript
const CONFIG = {
  ideenplattform: {
    schedule: "0 6 * * *", // Cron-Format
    maxPages: 5,
    enabled: true,
  },
  // ...
};
```

### Cron-Format

```
* * * * *
│ │ │ │ │
│ │ │ │ └─ Wochentag (0-7)
│ │ │ └─── Monat (1-12)
│ │ └───── Tag (1-31)
│ └─────── Stunde (0-23)
└───────── Minute (0-59)
```

**Beispiele:**
- `0 6 * * *` - Täglich um 6:00 Uhr
- `*/30 * * * *` - Alle 30 Minuten
- `0 */6 * * *` - Alle 6 Stunden
- `0 0 * * 0` - Jeden Sonntag um Mitternacht

## 📝 API Endpoints

### GET /api/ideas
Liefert alle Ideen

**Query Parameter:**
- `category` - Filter nach Kategorie
- `status` - Filter nach Status
- `search` - Volltextsuche
- `limit` - Max. Anzahl Ergebnisse (default: 50)
- `offset` - Pagination Offset

**Beispiel:**
```bash
curl "http://localhost:3000/api/ideas?category=Verkehr&limit=10"
```

### GET /api/maengel
Liefert alle Mängel

**Query Parameter:** Wie /api/ideas

### GET /api/stats
Liefert Dashboard-Statistiken

## 🧪 Development

### Build für Production

```bash
npm run build
npm start
```

### TypeScript kompilieren

```bash
npx tsc
```

### Linting

```bash
npm run lint
```

## 🆕 Neue Module hinzufügen

1. **Neuen Scraper erstellen**

Erstelle eine neue Datei in `scrapers/`:

```typescript
// scrapers/new-module.ts
import { chromium } from "playwright";

export async function scrapeNewModule() {
  // Scraping-Logik
}
```

2. **Datenbank-Schema erweitern**

Füge neues Interface und Tabelle in `lib/db/schema.ts` hinzu.

3. **DB-Operationen hinzufügen**

Erweitere `lib/db/index.ts` mit CRUD-Operationen.

4. **API Route erstellen**

Erstelle neue Route in `app/api/new-module/route.ts`.

5. **Scheduler erweitern**

Füge neues Modul in `scrapers/scheduler.ts` hinzu.

6. **UI anpassen**

Erweitere das Dashboard in `app/page.tsx`.

## 📊 Performance

- **Asynchrones Scraping:** Nicht-blockierende Ausführung
- **Indexierte Datenbank:** Schnelle Queries durch Indizes
- **WAL-Modus:** Write-Ahead Logging für bessere Concurrency
- **Pagination:** Effiziente Daten-Verarbeitung großer Mengen
- **Caching:** Browser-Caching für statische Assets

## 🔒 Sicherheit

- Keine Authentifizierung in dieser Version (read-only Dashboard)
- SQL Injection-Schutz durch Prepared Statements
- XSS-Schutz durch React's automatisches Escaping
- Rate-Limiting für Scraper (1 Sekunde Pause zwischen Seiten)

## 🐛 Troubleshooting

### Playwright-Fehler

```bash
npx playwright install
```

### Datenbank-Fehler

Lösche die Datenbank und starte neu:

```bash
rm -rf data/
npm run dev
```

### Port bereits in Verwendung

Ändere den Port in `package.json`:

```json
"dev": "next dev -p 3001"
```

## 📜 Lizenz

ISC

## 👥 Contributing

Contributions sind willkommen! Bitte erstelle einen Pull Request.

## 📞 Kontakt

Bei Fragen oder Problemen erstelle bitte ein Issue im Repository.

---

**Made with ❤️ for Braunschweig Journalists**
