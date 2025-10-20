# Events Scraper - Implementierungsplan
## Website: https://braunschweig.die-region.de/

> **Analysiert am:** 2025-10-18
> **Status:** Planning Phase
> **Geschätzte Implementierungszeit:** 4-6 Stunden

---

## 1. Website-Analyse Zusammenfassung

### ✅ Was ich herausgefunden habe:

**Technische Architektur:**
- **Server-Side Rendered (SSR)** - Keine API-Calls, HTML wird direkt vom Server geliefert
- **152 Events** auf der Hauptseite sichtbar
- **Pagination via "Mehr laden" Button** - AJAX-basiert, lädt mehr Events nach
- **Event Detail-Seiten** unter `/veranstaltungen-detailseite/event/{ID}/{slug}/`

**Event-Struktur auf der Übersichtsseite:**
```
Event-Link: https://braunschweig.die-region.de/veranstaltungen-detailseite/event/101062390/synthcity-night-das-neon-festival-des-jahres/

Extrahierbare Daten:
✓ Event-ID: 101062390
✓ Titel: "SYNTHCITY NIGHT - Das Neon-Festival des Jahres!"
✓ Datum: "18. Oktober"
✓ Uhrzeit: "19:00 - 01:00 Uhr"
✓ Venue: "KufA Haus"
✓ Adresse: "Westbahnhof 13, 38118, Braunschweig"
✓ Veranstalter: "Frank Tobian"
```

**"Mehr laden" Button:**
```html
<a href="/?tx_gcevents_eventlisting[action]=list&
         tx_gcevents_eventlisting[controller]=Event&
         tx_gcevents_eventlisting[cUid]=27111&
         tx_gcevents_eventlisting[dayFlag]=0&
         tx_gcevents_eventlisting[more]=10&
         tx_gcevents_eventlisting[startdate]=2025-10-18&
         type=672342022&
         cHash=5f5439b02f03f60fa401cb135fddf4d9#event21039">
    Mehr laden
</a>
```

**Wichtige Erkenntnisse:**
1. ✅ **Kein API** - HTML Parsing erforderlich
2. ✅ **Pagination-Mechanismus** - Parameter `more=10` lädt jeweils 10 weitere Events
3. ✅ **Eindeutige Event-IDs** - In URL eingebettet (`/event/{ID}/`)
4. ✅ **Detail-Seiten verfügbar** - Für vollständige Event-Infos
5. ⚠️ **Hash-Parameter `cHash`** - Möglicherweise CSRF-Protection (muss beim Scraping extrahiert werden)

---

## 2. Scraper-Architektur

### **Strategie: Hybrid Scraping (Übersicht + Details)**

```
┌────────────────────────────────────────────────────────────────┐
│                    SCRAPER WORKFLOW                            │
└────────────────────────────────────────────────────────────────┘

1. ÜBERSICHTSSEITE SCRAPEN
   ├─ Lade https://braunschweig.die-region.de/
   ├─ Extrahiere alle Event-Links + Basis-Daten
   ├─ Klicke "Mehr laden" (solange verfügbar)
   └─ Sammle alle Event-IDs

2. DETAIL-SEITEN SCRAPEN (parallel)
   ├─ Für jede Event-ID: Besuche Detail-Seite
   ├─ Extrahiere vollständige Daten:
   │  ├─ Vollständige Beschreibung
   │  ├─ Bild-URL
   │  ├─ Kategorien/Tags
   │  ├─ Preis-Informationen
   │  ├─ Ticket-Links
   │  └─ Organisator-Details
   └─ Rate Limiting: Max 3 parallel, 500ms Pause

3. DATENBANK-SPEICHERUNG
   ├─ Upsert: Event-ID als Unique Key
   ├─ Change Tracking: Historie bei Änderungen
   └─ Status: scraped_at, modified_at

4. AI ENHANCEMENT (Optional)
   ├─ Kategorisierung (Musik, Theater, Sport, ...)
   ├─ Hashtag-Generierung
   └─ Zusammenfassungen für lange Beschreibungen
```

---

## 3. Datenbank-Schema

### **Neue Tabelle: `events`**

```sql
CREATE TABLE IF NOT EXISTS events (
  -- Primary Key
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  externalId TEXT UNIQUE NOT NULL,  -- z.B. "101062390"

  -- Basis-Informationen
  title TEXT NOT NULL,
  description TEXT,
  shortDescription TEXT,            -- Aus Übersicht

  -- Datum & Zeit
  startDate TEXT,                    -- ISO 8601: "2025-10-18"
  endDate TEXT,                      -- Bei mehrtägigen Events
  startTime TEXT,                    -- "19:00"
  endTime TEXT,                      -- "01:00"
  allDay BOOLEAN DEFAULT 0,          -- Ganztägiges Event?

  -- Ort
  venueName TEXT,                    -- "KufA Haus"
  venueAddress TEXT,                 -- "Westbahnhof 13"
  venuePostcode TEXT,                -- "38118"
  venueCity TEXT,                    -- "Braunschweig"
  venueLatitude REAL,                -- Optional: Geocoding
  venueLongitude REAL,

  -- Organisator
  organizer TEXT,                    -- "Frank Tobian"

  -- Medien
  imageUrl TEXT,
  imageThumbnailUrl TEXT,

  -- Kategorien & Tags
  category TEXT,                     -- Primäre Kategorie
  categories TEXT,                   -- JSON Array: ["Musik", "Party"]
  tags TEXT,                         -- JSON Array: ["Halloween", "Neon"]

  -- Ticket-Informationen
  price TEXT,                        -- "15€" oder "Kostenlos"
  priceMin REAL,                     -- 15.00
  priceMax REAL,                     -- 20.00
  ticketUrl TEXT,                    -- Link zum Ticketshop
  isFree BOOLEAN DEFAULT 0,

  -- URLs
  url TEXT NOT NULL,                 -- Detail-Seite URL
  sourceUrl TEXT,                    -- Externe Event-URL (falls vorhanden)

  -- Status
  status TEXT DEFAULT 'active',      -- active, cancelled, postponed
  featured BOOLEAN DEFAULT 0,        -- Hervorgehobenes Event?

  -- Scraping Metadata
  scraped_at TEXT NOT NULL,
  modified_at TEXT,
  detailScraped BOOLEAN DEFAULT 0,
  detailScrapedAt TEXT,

  -- AI Enhancement
  aiSummary TEXT,
  aiHashtags TEXT,                   -- JSON Array
  aiCategory TEXT,                   -- AI-generierte Hauptkategorie

  -- Constraints
  UNIQUE(externalId)
);

-- Indizes für Performance
CREATE INDEX IF NOT EXISTS idx_events_startDate ON events(startDate);
CREATE INDEX IF NOT EXISTS idx_events_category ON events(category);
CREATE INDEX IF NOT EXISTS idx_events_city ON events(venueCity);
CREATE INDEX IF NOT EXISTS idx_events_scraped_at ON events(scraped_at);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_featured ON events(featured);

-- Historie-Tabelle
CREATE TABLE IF NOT EXISTS events_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL,
  externalId TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  startDate TEXT,
  endDate TEXT,
  status TEXT,
  changed_at TEXT NOT NULL,
  FOREIGN KEY(event_id) REFERENCES events(id)
);

CREATE INDEX IF NOT EXISTS idx_events_history_event_id ON events_history(event_id);
CREATE INDEX IF NOT EXISTS idx_events_history_changed_at ON events_history(changed_at);
```

---

## 4. Scraper-Implementation

### **Datei-Struktur:**

```
scrapers/
├── events-braunschweig.ts       # Haupt-Scraper
├── events-parser.ts             # HTML-Parsing-Logik
└── scheduler.ts                 # Update: Events-Scraper hinzufügen

lib/
├── db/
│   ├── index.ts                 # Update: Events CRUD-Operationen
│   └── schema.ts                # Update: Events Schema
└── ai/
    └── openai-service.ts        # Update: Event-Enhancement

app/
└── api/
    └── events/
        ├── route.ts             # GET /api/events
        ├── [id]/
        │   └── route.ts         # GET /api/events/:id
        └── categories/
            └── route.ts         # GET /api/events/categories
```

### **Haupt-Scraper: `scrapers/events-braunschweig.ts`**

```typescript
import { chromium, Browser, Page } from 'playwright';
import { upsertEvent, startScraperRun, endScraperRun } from '../lib/db';
import { parseEventListItem, parseEventDetail } from './events-parser';

const BASE_URL = 'https://braunschweig.die-region.de/';

interface ScrapedEvent {
  externalId: string;
  title: string;
  shortDescription?: string;
  startDate?: string;
  startTime?: string;
  endTime?: string;
  venueName?: string;
  venueAddress?: string;
  organizer?: string;
  url: string;
  // ... weitere Felder
}

/**
 * PHASE 1: Scrape Übersichtsseite + "Mehr laden"
 */
async function scrapeEventList(page: Page, maxClicks: number = 10): Promise<string[]> {
  const eventUrls: Set<string> = new Set();

  await page.goto(BASE_URL, { waitUntil: 'networkidle' });

  let clickCount = 0;
  while (clickCount < maxClicks) {
    // Extrahiere alle aktuell sichtbaren Event-Links
    const urls = await page.evaluate(() => {
      return Array.from(
        document.querySelectorAll('a[href*="/veranstaltungen-detailseite/event/"]')
      ).map(a => (a as HTMLAnchorElement).href);
    });

    urls.forEach(url => eventUrls.add(url));
    console.log(`[Events] ${eventUrls.size} Events gefunden...`);

    // Klicke "Mehr laden" Button
    const moreButton = await page.$('a:has-text("Mehr laden")');
    if (!moreButton) {
      console.log('[Events] Kein "Mehr laden" Button mehr gefunden');
      break;
    }

    try {
      await Promise.all([
        page.waitForResponse(res => res.url().includes('tx_gcevents'), { timeout: 10000 }),
        moreButton.click()
      ]);

      await page.waitForTimeout(1000); // Warte auf neue Events
      clickCount++;
    } catch (error) {
      console.log('[Events] Fehler beim Laden weiterer Events:', error);
      break;
    }
  }

  return Array.from(eventUrls);
}

/**
 * PHASE 2: Scrape Detail-Seiten (parallel mit Concurrency-Limit)
 */
async function scrapeEventDetails(
  browser: Browser,
  urls: string[],
  concurrency: number = 3
): Promise<ScrapedEvent[]> {
  const events: ScrapedEvent[] = [];

  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);

    const batchPromises = batch.map(async (url) => {
      const context = await browser.newContext();
      const page = await context.newPage();

      try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });

        const eventData = await page.evaluate(() => {
          // HTML-Parsing Logik (siehe unten)
          return parseEventDetailPage();
        });

        await context.close();
        return eventData;
      } catch (error) {
        console.error(`[Events] Fehler bei ${url}:`, error);
        await context.close();
        return null;
      }
    });

    const batchResults = await Promise.all(batchPromises);
    events.push(...batchResults.filter(e => e !== null));

    // Rate Limiting
    if (i + concurrency < urls.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return events;
}

/**
 * MAIN SCRAPER FUNCTION
 */
export async function scrapeEventsBraunschweig(
  maxEvents?: number
): Promise<{ success: boolean; itemsScraped: number; itemsNew: number; itemsUpdated: number }> {
  const runId = startScraperRun('events-braunschweig');

  let itemsScraped = 0;
  let itemsNew = 0;
  let itemsUpdated = 0;

  try {
    console.log('[Events] Starte Browser...');
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    // PHASE 1: Sammle alle Event-URLs
    console.log('[Events] Sammle Event-URLs...');
    const eventUrls = await scrapeEventList(page, 50); // Max 50x "Mehr laden"
    console.log(`[Events] ${eventUrls.length} Event-URLs gefunden`);

    const urlsToScrape = maxEvents ? eventUrls.slice(0, maxEvents) : eventUrls;

    // PHASE 2: Scrape Detail-Seiten
    console.log('[Events] Scrape Detail-Seiten...');
    const events = await scrapeEventDetails(browser, urlsToScrape, 3);

    // PHASE 3: Speichere in Datenbank
    const scraped_at = new Date().toISOString();
    for (const event of events) {
      const result = upsertEvent({ ...event, scraped_at });
      itemsScraped++;
      if (result.isNew) itemsNew++;
      if (result.hasChanged) itemsUpdated++;
    }

    await browser.close();

    console.log(`[Events] Scraping abgeschlossen: ${itemsScraped} Events (${itemsNew} neu, ${itemsUpdated} aktualisiert)`);

    endScraperRun(runId, { itemsScraped, itemsNew, itemsUpdated, success: true });

    return { success: true, itemsScraped, itemsNew, itemsUpdated };
  } catch (error) {
    console.error('[Events] Fehler beim Scraping:', error);

    const errorMessage = error instanceof Error ? error.message : String(error);
    endScraperRun(runId, { itemsScraped, itemsNew, itemsUpdated, success: false, error: errorMessage });

    return { success: false, itemsScraped, itemsNew, itemsUpdated, error: errorMessage };
  }
}
```

### **Parser: `scrapers/events-parser.ts`**

```typescript
/**
 * Parse Event-Details von der Detail-Seite
 * Diese Funktion läuft im Browser-Context (page.evaluate)
 */
export function parseEventDetailPage() {
  // Extrahiere Event-ID aus URL
  const url = window.location.href;
  const idMatch = url.match(/\/event\/(\d+)\//);
  const externalId = idMatch ? idMatch[1] : '';

  // Titel
  const title = document.querySelector('h1')?.textContent?.trim() || '';

  // Beschreibung
  const descriptionEl = document.querySelector('.event-description, [class*="description"]');
  const description = descriptionEl?.textContent?.trim() || '';

  // Datum & Zeit
  const dateTimeEl = document.querySelector('.event-datetime, [class*="datetime"]');
  const dateTimeText = dateTimeEl?.textContent || '';

  // Parse Datum (z.B. "18. Oktober 2025")
  const dateMatch = dateTimeText.match(/(\d{1,2})\.\s*(\w+)(?:\s+(\d{4}))?/);
  const monthNames = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
                      'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

  let startDate = '';
  if (dateMatch) {
    const day = dateMatch[1].padStart(2, '0');
    const monthName = dateMatch[2];
    const year = dateMatch[3] || new Date().getFullYear().toString();
    const monthIndex = monthNames.findIndex(m => m.toLowerCase() === monthName.toLowerCase());
    const month = (monthIndex + 1).toString().padStart(2, '0');
    startDate = `${year}-${month}-${day}`;
  }

  // Parse Zeit (z.B. "19:00 - 01:00 Uhr")
  const timeMatch = dateTimeText.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
  const startTime = timeMatch ? `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}` : '';
  const endTime = timeMatch ? `${timeMatch[3].padStart(2, '0')}:${timeMatch[4]}` : '';

  // Venue
  const venueEl = document.querySelector('.event-location, [class*="location"]');
  const venueText = venueEl?.textContent?.trim() || '';
  const venueLines = venueText.split(',').map(s => s.trim());

  const venueName = venueLines[0] || '';
  const venueAddress = venueLines[1] || '';
  const venuePostcode = venueLines[2] || '';
  const venueCity = venueLines[3] || 'Braunschweig';

  // Organisator
  const organizerEl = document.querySelector('.event-organizer, [class*="organizer"]');
  const organizer = organizerEl?.textContent?.trim() || '';

  // Bild
  const imageEl = document.querySelector('.event-image img, [class*="event"] img');
  const imageUrl = (imageEl as HTMLImageElement)?.src || '';

  // Kategorien (falls vorhanden)
  const categoryEls = Array.from(document.querySelectorAll('.event-category, [class*="category"]'));
  const categories = categoryEls.map(el => el.textContent?.trim() || '').filter(c => c);

  // Preis
  const priceEl = document.querySelector('.event-price, [class*="price"]');
  const priceText = priceEl?.textContent?.trim() || '';
  const isFree = /kostenlos|frei|free/i.test(priceText);

  return {
    externalId,
    title,
    description,
    startDate,
    startTime,
    endTime,
    venueName,
    venueAddress,
    venuePostcode,
    venueCity,
    organizer,
    imageUrl,
    categories: JSON.stringify(categories),
    price: priceText,
    isFree,
    url: window.location.href
  };
}
```

---

## 5. Performance-Optimierungen

### **Strategie 1: Incremental Scraping**
```typescript
// Nur neue/geänderte Events scrapen
async function getExistingEventIds(): Promise<Set<string>> {
  const db = getDatabase();
  const rows = db.prepare('SELECT externalId FROM events').all();
  return new Set(rows.map(r => r.externalId));
}

// In scrapeEventDetails():
const existingIds = await getExistingEventIds();
const newUrls = eventUrls.filter(url => {
  const idMatch = url.match(/\/event\/(\d+)\//);
  return idMatch && !existingIds.has(idMatch[1]);
});

console.log(`[Events] ${newUrls.length} neue Events zum Scrapen`);
```

### **Strategie 2: Parallel Processing**
```typescript
// 3 Browser-Contexts gleichzeitig (wie bei Ideenplattform)
const concurrency = 3;
// Rate Limiting: 500ms zwischen Batches
await new Promise(resolve => setTimeout(resolve, 500));
```

### **Strategie 3: Caching**
```typescript
// Cache Event-Liste für 1 Stunde
const CACHE_DURATION = 60 * 60 * 1000; // 1 Stunde
let cachedEventUrls: { urls: string[]; timestamp: number } | null = null;

if (cachedEventUrls && Date.now() - cachedEventUrls.timestamp < CACHE_DURATION) {
  console.log('[Events] Verwende gecachte Event-Liste');
  eventUrls = cachedEventUrls.urls;
} else {
  eventUrls = await scrapeEventList(page, 50);
  cachedEventUrls = { urls: eventUrls, timestamp: Date.now() };
}
```

---

## 6. Scheduler-Integration

### **Update: `scrapers/scheduler.ts`**

```typescript
const CONFIG = {
  ideenplattform: { /* ... */ },
  maengelmelder: { /* ... */ },

  // NEU: Events-Scraper
  'events-braunschweig': {
    schedule: "0 7 * * *",       // Täglich um 7:00 Uhr
    maxEvents: undefined,         // Alle Events scrapen
    enabled: true,
  },
};

// In startScheduler():
if (CONFIG['events-braunschweig'].enabled) {
  cron.schedule(CONFIG['events-braunschweig'].schedule, () => {
    safeScrape("Events Braunschweig", () =>
      scrapeEventsBraunschweig(CONFIG['events-braunschweig'].maxEvents)
    );
  });
}
```

---

## 7. API Endpoints

### **`app/api/events/route.ts`**

```typescript
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const category = searchParams.get('category');
  const startDate = searchParams.get('startDate'); // "2025-10-18"
  const endDate = searchParams.get('endDate');
  const search = searchParams.get('search');
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');

  const db = getDatabase();

  let query = 'SELECT * FROM events WHERE 1=1';
  const params: any[] = [];

  if (category) {
    query += ' AND (category = ? OR categories LIKE ?)';
    params.push(category, `%"${category}"%`);
  }

  if (startDate) {
    query += ' AND startDate >= ?';
    params.push(startDate);
  }

  if (endDate) {
    query += ' AND startDate <= ?';
    params.push(endDate);
  }

  if (search) {
    query += ' AND (title LIKE ? OR description LIKE ? OR venueName LIKE ?)';
    const searchPattern = `%${search}%`;
    params.push(searchPattern, searchPattern, searchPattern);
  }

  query += ' ORDER BY startDate ASC, startTime ASC';
  query += ` LIMIT ${limit} OFFSET ${offset}`;

  const events = db.prepare(query).all(...params);

  // Total count für Pagination
  let countQuery = 'SELECT COUNT(*) as total FROM events WHERE 1=1';
  const countParams: any[] = [];
  if (category) {
    countQuery += ' AND (category = ? OR categories LIKE ?)';
    countParams.push(category, `%"${category}"%`);
  }
  // ... weitere Filter

  const { total } = db.prepare(countQuery).get(...countParams) as { total: number };

  return Response.json(events, {
    headers: {
      'X-Total-Count': total.toString(),
      'X-Offset': offset.toString(),
      'X-Limit': limit.toString()
    }
  });
}
```

---

## 8. UI Integration (Optional)

### **Neue Seite: `app/research/events/page.tsx`**

Ähnlich wie `ideas/page.tsx`, aber für Events:
- Kalender-View (nach Datum sortiert)
- Filter: Kategorie, Datum-Range, Ort
- Map-View (falls Geocoding implementiert)
- Event-Detail-Modal

---

## 9. Implementierungs-Roadmap

### **Phase 1: MVP (2-3 Stunden)**
- [x] Website-Analyse abgeschlossen
- [ ] Datenbank-Schema erstellen
- [ ] Basis-Scraper implementieren (ohne "Mehr laden")
- [ ] Einfache HTML-Parsing-Logik
- [ ] Erste 50 Events scrapen & speichern

### **Phase 2: Full Scraping (1-2 Stunden)**
- [ ] "Mehr laden" Logik implementieren
- [ ] Detail-Seiten-Scraping (parallel)
- [ ] Change Tracking
- [ ] Error Handling & Retries

### **Phase 3: Optimierung (1 Stunde)**
- [ ] Incremental Scraping
- [ ] Performance-Tuning
- [ ] Scheduler-Integration
- [ ] Logging & Monitoring

### **Phase 4: AI & Enhancements (Optional, 2 Stunden)**
- [ ] Event-Kategorisierung via AI
- [ ] Hashtag-Generierung
- [ ] Geocoding (Adresse → Lat/Lng)
- [ ] Duplicate Detection

### **Phase 5: Frontend (Optional, 3-4 Stunden)**
- [ ] API Endpoints
- [ ] Events Research-Seite
- [ ] Kalender-View
- [ ] Filter & Search
- [ ] Map-Integration

---

## 10. Risiken & Herausforderungen

### ⚠️ **Potenzielle Probleme:**

1. **`cHash` Parameter**
   - Problem: "Mehr laden" erfordert möglicherweise valides Hash
   - Lösung: Hash aus vorherigem Response extrahieren

2. **Rate Limiting**
   - Problem: Website könnte bei zu vielen Requests blocken
   - Lösung: 500ms-1s Pause zwischen Batches, User-Agent setzen

3. **Dynamic Content**
   - Problem: Manche Daten könnten per JavaScript nachgeladen werden
   - Lösung: `waitForTimeout` + `networkidle` Event abwarten

4. **Datum-Parsing**
   - Problem: Deutsche Datumsformate ("18. Oktober")
   - Lösung: Custom Parser mit Month-Mapping

5. **Fehlende Daten**
   - Problem: Nicht alle Events haben vollständige Infos
   - Lösung: Fallbacks, nullable Felder in DB

---

## 11. Geschätzte Performance

```
Annahmen:
- ~500 Events total auf Website
- "Mehr laden" zeigt jeweils 10 Events
- Detail-Scraping: 3 parallel, 2s pro Event

Rechnung:
1. Event-Liste scrapen: 50 Klicks x 1s = ~50s
2. Detail-Scraping: 500 Events / 3 parallel x 2s = ~333s (5.5 Min)
3. DB Operations: 500 x 0.01s = ~5s

Total: ~6-7 Minuten für vollständigen Scrape

Optimiert (Incremental):
- Nur neue Events (ca. 20/Tag): ~20s + 13s Detail = ~35 Sekunden
```

---

## 12. Nächste Schritte

**Willst du, dass ich:**
1. ✅ **Sofort implementieren** - Ich baue den kompletten Scraper jetzt
2. ⏸️ **Nur MVP** - Basis-Version ohne "Mehr laden" + Details
3. 🔄 **Plan überarbeiten** - Andere Prioritäten oder Anpassungen?

Gib mir grünes Licht und ich fange an! 🚀
