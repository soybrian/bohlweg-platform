# Bohlweg Platform - Development Guide

**Für Claude und andere Entwickler**

Dieses Dokument beschreibt die interne Architektur und Entwicklungs-Workflows der Bohlweg Platform.

## 🏗️ Architektur-Übersicht

### Tech Stack

- **Frontend:** Next.js 15 (App Router), React 19, TypeScript
- **Styling:** Tailwind CSS mit Glass Fluid Design
- **Database:** SQLite (better-sqlite3)
- **Scraping:** Playwright für robustes Browser-Automation
- **Scheduling:** node-cron für zeitgesteuerte Scraper-Ausführung
- **Deployment:** Docker & Docker Compose

### Design Patterns

1. **Modulares Design:** Jeder Scraper ist ein unabhängiges Modul
2. **Repository Pattern:** Datenbank-Operationen sind in `lib/db/index.ts` gekapselt
3. **Separation of Concerns:** UI, Business Logic und Data Layer sind getrennt
4. **API Routes:** RESTful API für Frontend-Backend-Kommunikation

## 📁 Projekt-Struktur (Detailliert)

```
bohlweg-platform/
│
├── app/                              # Next.js App Router (React 19)
│   ├── api/                          # API Routes (Server-Side)
│   │   ├── ideas/route.ts           # GET /api/ideas - Ideenplattform Daten
│   │   ├── maengel/route.ts         # GET /api/maengel - Mängelmelder Daten
│   │   └── stats/route.ts           # GET /api/stats - Dashboard Statistiken
│   ├── globals.css                   # Global Styles + Glass Fluid CSS
│   ├── layout.tsx                    # Root Layout mit Gradient Background
│   └── page.tsx                      # Dashboard mit Live-Suche und Stats
│
├── components/                       # Wiederverwendbare React Komponenten
│   └── (Platz für zukünftige Komponenten)
│
├── lib/                              # Shared Libraries
│   ├── db/                           # Database Layer
│   │   ├── index.ts                 # DB Operations (CRUD, Stats, Scraper Runs)
│   │   └── schema.ts                # Schema Definitionen + SQL DDL
│   └── utils.ts                      # Utility Functions (cn, formatDate, etc.)
│
├── scrapers/                         # Scraper Module
│   ├── ideenplattform.ts            # Ideenplattform Scraper mit Playwright
│   ├── maengelmelder.ts             # Mängelmelder Scraper mit Playwright
│   └── scheduler.ts                  # Cron Scheduler für alle Scraper
│
├── data/                             # SQLite Database (automatisch erstellt)
│   └── bohlweg.db                    # SQLite Database File
│
├── public/                           # Statische Assets
│
├── docker-compose.yml                # Docker Compose für multi-container setup
├── Dockerfile                        # Docker Build Configuration
├── .gitignore                        # Git Ignore Rules
├── next.config.ts                    # Next.js Configuration
├── package.json                      # Dependencies und Scripts
├── postcss.config.mjs                # PostCSS Config für Tailwind
├── tailwind.config.ts                # Tailwind CSS Configuration
├── tsconfig.json                     # TypeScript Configuration
├── README.md                         # User-facing Documentation
└── DEVELOPMENT.md                    # This file
```

## 🔧 Entwicklungs-Workflow

### 1. Setup

```bash
# Dependencies installieren
npm install

# Playwright Browser installieren
npx playwright install chromium

# Dev Server starten
npm run dev
```

### 2. Scraper entwickeln/testen

```bash
# Einzelnen Scraper testen
npx ts-node scrapers/ideenplattform.ts
npx ts-node scrapers/maengelmelder.ts

# Alle Scraper sofort ausführen
npx ts-node scrapers/scheduler.ts --now

# Scheduler im Entwicklungs-Modus starten
npx ts-node scrapers/scheduler.ts --initial
```

### 3. Datenbank inspizieren

```bash
# SQLite CLI öffnen
sqlite3 data/bohlweg.db

# Nützliche SQL Queries:
.tables                          # Alle Tabellen anzeigen
SELECT * FROM ideas LIMIT 5;     # Erste 5 Ideen
SELECT * FROM maengel LIMIT 5;   # Erste 5 Mängel
SELECT * FROM scraper_runs;      # Scraper History
```

### 4. API testen

```bash
# Mit curl
curl "http://localhost:3000/api/ideas"
curl "http://localhost:3000/api/ideas?category=Verkehr&limit=5"
curl "http://localhost:3000/api/maengel?search=Fahrrad"
curl "http://localhost:3000/api/stats"

# Mit httpie (wenn installiert)
http localhost:3000/api/ideas
http localhost:3000/api/stats
```

## 🗄️ Datenbank-Schema

### Ideas Table

```sql
CREATE TABLE ideas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  externalId TEXT UNIQUE NOT NULL,    -- ID von der Website
  title TEXT NOT NULL,
  description TEXT,
  author TEXT,
  category TEXT,
  status TEXT,
  supporters INTEGER DEFAULT 0,
  maxSupporters INTEGER DEFAULT 50,
  comments INTEGER DEFAULT 0,
  createdAt TEXT,
  url TEXT,
  scraped_at TEXT NOT NULL
);
```

### Maengel Table

```sql
CREATE TABLE maengel (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  externalId TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  author TEXT,
  category TEXT,
  status TEXT,
  location TEXT,                      -- Adresse/Standort
  createdAt TEXT,
  url TEXT,
  scraped_at TEXT NOT NULL
);
```

### Scraper Runs Table

```sql
CREATE TABLE scraper_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  module TEXT NOT NULL,               -- 'ideenplattform' oder 'maengelmelder'
  startTime TEXT NOT NULL,
  endTime TEXT,
  itemsScraped INTEGER DEFAULT 0,
  itemsNew INTEGER DEFAULT 0,
  itemsUpdated INTEGER DEFAULT 0,
  success BOOLEAN DEFAULT 0,
  error TEXT
);
```

## 🔄 Scraper-Logik

### Workflow eines Scrapers

1. **Start:** `startScraperRun()` - Erstellt Eintrag in `scraper_runs`
2. **Navigate:** Playwright öffnet Browser und navigiert zur Seite
3. **Extract:** Daten werden aus HTML extrahiert
4. **Upsert:** `upsertIdea()` / `upsertMaengel()` - Insert oder Update
5. **Pagination:** Weiter zur nächsten Seite (wenn vorhanden)
6. **End:** `endScraperRun()` - Aktualisiert Statistiken

### Error Handling

- **Try-Catch:** Jeder Scraper hat globales try-catch
- **Item-Level:** Fehler bei einzelnen Items werden geloggt, aber nicht geworfen
- **Graceful Degradation:** Bei Fehler werden bereits gesammelte Daten gespeichert
- **Logging:** Alle Fehler werden in `scraper_runs.error` gespeichert

### Anti-Blocking Maßnahmen

- **Delay:** 1 Sekunde Pause zwischen Seiten-Requests
- **User Agent:** Playwright verwendet realistischen Browser
- **Headless:** Kann auf `false` gesetzt werden für Debugging

## 🎨 UI/UX Design

### Glass Fluid Style

Das UI verwendet Glasmorphismus-Effekte:

```css
.glass {
  @apply bg-white/10 backdrop-blur-lg border border-white/20 shadow-xl;
}

.glass-card {
  @apply glass rounded-2xl p-6 transition-all duration-300
         hover:bg-white/20 hover:shadow-2xl;
}
```

### Responsive Design

- **Mobile First:** Design startet bei 320px
- **Breakpoints:** sm (640px), md (768px), lg (1024px), xl (1280px)
- **Flexbox & Grid:** Für responsive Layouts

### Animations

- **fade-in:** Staggered entrance animations
- **hover-lift:** Subtle hover elevation
- **fluid-animation:** Pulsing effects für Live-Data

## 📡 API Design

### RESTful Conventions

- **GET /api/ideas** - Liste aller Ideen
- **GET /api/maengel** - Liste aller Mängel
- **GET /api/stats** - Dashboard Statistiken

### Query Parameters

Alle List-Endpoints unterstützen:
- `category` - Filter nach Kategorie
- `status` - Filter nach Status
- `search` - Volltextsuche
- `limit` - Max. Anzahl Ergebnisse
- `offset` - Pagination

### Response Format

```json
// GET /api/ideas
[
  {
    "id": 1,
    "externalId": "32181",
    "title": "Fahrradabstellplätze",
    "description": "Mehr Fahrradabstellplätze am Rudolfplatz",
    "author": "hallo",
    "category": "Verkehr",
    "status": "Laufend",
    "supporters": 1,
    "maxSupporters": 50,
    "comments": 0,
    "createdAt": "Mi., 08.10.2025 - 20:02",
    "url": "https://mitreden.braunschweig.de/node/32181",
    "scraped_at": "2025-10-09T18:30:00.000Z"
  }
]
```

## 🐳 Docker

### Development mit Docker

```bash
# Build Image
docker build -t bohlweg-platform .

# Run Container
docker run -p 3000:3000 -v $(pwd)/data:/app/data bohlweg-platform

# Mit Docker Compose
docker-compose up -d
docker-compose logs -f
docker-compose down
```

### Multi-Container Setup

- **web:** Next.js Application (Port 3000)
- **scraper:** Cron Scheduler (shared database)

## 🧪 Testing

### Manual Testing Checklist

- [ ] Dashboard lädt und zeigt Statistiken
- [ ] Live-Suche funktioniert
- [ ] Tab-Wechsel zwischen Ideen und Mängel
- [ ] Links zu externen Seiten funktionieren
- [ ] Mobile Ansicht ist responsive
- [ ] Scraper laufen ohne Fehler
- [ ] API Endpoints liefern korrek Daten
- [ ] Docker Build funktioniert

## 🚀 Deployment

### Production Build

```bash
npm run build
npm start
```

### Environment Variables

```env
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
```

### Docker Deployment

```bash
docker-compose up -d
```

## 🔄 Erweiterungen

### Neues Modul hinzufügen

1. **Scraper erstellen** in `scrapers/new-module.ts`
2. **Schema erweitern** in `lib/db/schema.ts`
3. **DB Ops** in `lib/db/index.ts`
4. **API Route** in `app/api/new-module/route.ts`
5. **Scheduler** in `scrapers/scheduler.ts` erweitern
6. **UI** in `app/page.tsx` anpassen

### Bekannte Kategorien

**Ideenplattform:**
- Finanzen
- Verkehr
- Schule und Kultur
- Allgemeine Verwaltung
- Stadtgrün und Umwelt
- Wirtschaft
- Soziales, Jugend und Gesundheit
- Recht, Sicherheit und Ordnung
- Bauen und Planung

**Mängelmelder:**
- Poller defekt
- Ampel defekt (Taste/Licht)
- Illegale Plakatierung
- Wilde Müllkippe, Sperrmüllreste
- Straßenschild / Verkehrszeichen defekt
- Straßenkanaldeckel defekt
- Straßen-, Radweg- und Gehwegschäden
- Gully / Bachablauf verstopft
- Friedhofsunterhaltung
- abgemeldete Fahrzeuge
- Fahrradwracks
- Straßenbeleuchtung / Laterne defekt
- Spielplatzunterhaltung

## 📚 Nützliche Ressourcen

- [Next.js Docs](https://nextjs.org/docs)
- [Playwright Docs](https://playwright.dev)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)
- [node-cron](https://github.com/node-cron/node-cron)

## 🐛 Known Issues

### Scraper

- [ ] Pagination könnte bei sehr vielen Seiten optimiert werden
- [ ] Category/Status Erkennung könnte robuster sein
- [ ] Keine Retry-Logik bei temporären Netzwerkfehlern

### UI

- [ ] Keine Dark Mode Toggle (nur durch System)
- [ ] Keine Persistierung von Such-Queries
- [ ] Keine Benachrichtigungen bei neuen Daten

### Database

- [ ] Keine Volltextsuche-Indizes (FTRE)
- [ ] Keine Auto-Cleanup von alten Daten
- [ ] Keine Backups

## 💡 Future Ideas

- [ ] GraphQL API für komplexere Queries
- [ ] WebSocket für Live-Updates
- [ ] Admin Panel für manuelle Scraper-Steuerung
- [ ] Export-Funktionen (CSV, JSON, PDF)
- [ ] Email-Benachrichtigungen bei neuen Ideen/Mängeln
- [ ] Sentiment-Analyse der Beschreibungen
- [ ] Geo-Visualisierung der Mängel auf Karte
- [ ] Trending-Algorithmus für wichtige Themen
- [ ] RSS Feed für Journalisten

## 📝 Code Style

- **TypeScript:** Strict mode enabled
- **Naming:** camelCase für Variablen, PascalCase für Types/Interfaces
- **Comments:** JSDoc für Funktionen, Inline für komplexe Logik
- **Async:** async/await bevorzugt über Promises
- **Error Handling:** Explizite try-catch Blöcke

---

**Happy Coding! 🚀**
