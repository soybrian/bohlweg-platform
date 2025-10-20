# Docker Deployment Guide

## Schnellstart

```bash
# 1. Repository klonen (falls noch nicht geschehen)
cd /Users/brian/bohlweg/bohlweg-platform

# 2. Docker Compose starten
docker-compose up -d

# 3. Logs anschauen
docker-compose logs -f

# 4. Status prüfen
docker-compose ps
```

## Services

Nach dem Start laufen **2 Container**:

### 1. Web Service (`bohlweg-web`)
- **Port**: 3000
- **Funktion**: Next.js Web-Anwendung
- **URL**: http://localhost:3000
- **Health Check**: Prüft alle 30s ob `/api/stats` antwortet

### 2. Scraper Service (`bohlweg-scraper`)
- **Funktion**: Automatischer Cron-Scheduler
- **Schedule**:
  - **Ideenplattform**: Täglich um **6:00 Uhr** (Berlin Zeit)
  - **Mängelmelder**: Täglich um **6:30 Uhr** (Berlin Zeit)
- **Timezone**: Europe/Berlin (automatisch konfiguriert)

## Timezone-Konfiguration

Die Container verwenden automatisch **Europe/Berlin** Timezone:

1. ✅ Environment Variable: `TZ=Europe/Berlin`
2. ✅ Volume Mounts: `/etc/localtime` und `/etc/timezone` vom Host
3. ✅ Scheduler-Wrapper loggt Timezone beim Start

**Beispiel-Output:**
```
╔═══════════════════════════════════════════════════════════╗
║         Bohlweg Platform - Scraper Scheduler             ║
╚═══════════════════════════════════════════════════════════╝

[Scheduler] Start Time: 2025-10-18T14:30:00.123Z
[Scheduler] Timezone: Europe/Berlin
[Scheduler] Local Time: 18.10.2025, 16:30:00
[Scheduler] Environment TZ: Europe/Berlin

[Scheduler] Starte Scraper-Scheduler...
[Scheduler] Ideenplattform-Scraper geplant: 0 6 * * *
[Scheduler] Mängelmelder-Scraper geplant: 30 6 * * *
[Scheduler] Scheduler erfolgreich gestartet!
```

## Wichtige Commands

### Status & Monitoring

```bash
# Container-Status anzeigen
docker-compose ps

# Live-Logs (Web)
docker-compose logs -f web

# Live-Logs (Scraper)
docker-compose logs -f scraper

# Alle Logs der letzten Stunde
docker-compose logs --since 1h

# Nur Fehler anzeigen
docker-compose logs | grep -i error
```

### Scraper manuell triggern

```bash
# Beide Scraper sofort ausführen (ohne auf Cron zu warten)
docker-compose exec scraper node dist/scrapers/scheduler.js --now

# Nur Ideenplattform
docker-compose exec scraper node dist/scrapers/scheduler.js --ideenplattform

# Nur Mängelmelder
docker-compose exec scraper node dist/scrapers/scheduler.js --maengelmelder
```

### Container-Management

```bash
# Container neu starten
docker-compose restart

# Nur Scraper neu starten
docker-compose restart scraper

# Container stoppen
docker-compose stop

# Container stoppen und entfernen
docker-compose down

# Container + Volumes löschen (⚠️ Datenbank wird gelöscht!)
docker-compose down -v

# Neu bauen (nach Code-Änderungen)
docker-compose build

# Neu bauen ohne Cache
docker-compose build --no-cache

# Rebuild + Neustart
docker-compose up -d --build
```

### Debugging

```bash
# In Web-Container einsteigen
docker-compose exec web sh

# In Scraper-Container einsteigen
docker-compose exec scraper sh

# Datenbank direkt abfragen
docker-compose exec web node -e "
  const db = require('better-sqlite3')('./data/bohlweg.db');
  const runs = db.prepare('SELECT * FROM scraper_runs ORDER BY startTime DESC LIMIT 5').all();
  console.table(runs);
"

# Timezone im Container prüfen
docker-compose exec scraper date
docker-compose exec scraper node -e "console.log(new Date().toString())"

# Disk Space Check
docker-compose exec web df -h
```

## Scheduler-Konfiguration anpassen

**Datei**: `scrapers/scheduler.ts`

```typescript
const CONFIG = {
  ideenplattform: {
    schedule: "0 6 * * *",     // Cron-Expression
    maxPages: 5,                // Anzahl Seiten
    enabled: true,              // Aktiviert?
  },
  maengelmelder: {
    schedule: "30 6 * * *",
    maxPages: 5,
    enabled: true,
  },
};
```

**Cron-Syntax Beispiele:**
- `"0 6 * * *"` - Täglich um 6:00
- `"0 */6 * * *"` - Alle 6 Stunden
- `"*/30 * * * *"` - Alle 30 Minuten
- `"0 3 * * 1-5"` - Montag-Freitag um 3:00
- `"0 0 * * 0"` - Jeden Sonntag um Mitternacht

**Nach Änderungen:**
```bash
docker-compose up -d --build scraper
```

## Persistenz

### Datenbank
- **Location**: `./data/bohlweg.db`
- **Shared**: Beide Container greifen auf gleiche DB zu
- **Backup**: `cp data/bohlweg.db data/bohlweg-backup-$(date +%Y%m%d).db`

### Playwright Browser
- **Location**: `/ms-playwright` (im Container)
- **Size**: ~200MB (Chromium)
- **Installation**: Automatisch beim Build

## Ressourcen

### Shared Memory
- **Size**: 2GB pro Container
- **Warum**: Playwright Chromium braucht viel RAM
- **Bei Problemen**: `shm_size: '4gb'` in docker-compose.yml

### Health Checks
- **Interval**: 30 Sekunden
- **Timeout**: 10 Sekunden
- **Retries**: 3
- **Start Period**: 40 Sekunden

## Troubleshooting

### Problem: Scraper startet nicht

```bash
# Logs prüfen
docker-compose logs scraper

# Häufige Fehler:
# - "Cannot find module 'dist/scrapers/scheduler.js'"
#   → Lösung: docker-compose build --no-cache

# - "Error: EACCES: permission denied, open './data/bohlweg.db'"
#   → Lösung: sudo chown -R 1001:1001 ./data

# - "TimeoutError: page.goto: Timeout 30000ms exceeded"
#   → Lösung: Internet-Verbindung prüfen
```

### Problem: Falsche Timezone

```bash
# Timezone prüfen
docker-compose exec scraper date
docker-compose exec scraper cat /etc/timezone

# Falls falsch, prüfe:
cat /etc/timezone  # Auf Host-System
ls -la /etc/localtime

# Manuell setzen:
# 1. In docker-compose.yml prüfen: TZ=Europe/Berlin
# 2. docker-compose down && docker-compose up -d
```

### Problem: Out of Memory

```bash
# Memory Usage prüfen
docker stats

# Container-Memory-Limits setzen:
# docker-compose.yml:
#   scraper:
#     mem_limit: 4g
#     memswap_limit: 4g
```

## Production Checklist

- [ ] `.env` Datei erstellt (falls nötig für API Keys)
- [ ] Datenbank-Backup-Script eingerichtet
- [ ] Monitoring/Alerting konfiguriert (optional)
- [ ] SSL/HTTPS via Reverse Proxy (nginx/traefik)
- [ ] Firewall-Regeln konfiguriert
- [ ] Docker Auto-Update aktiviert (watchtower)

## Environment Variables

Erstelle eine `.env` Datei (optional):

```bash
# .env
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
TZ=Europe/Berlin
OPENAI_API_KEY=sk-...  # Falls AI Features genutzt werden
```

Dann in docker-compose.yml:
```yaml
services:
  web:
    env_file:
      - .env
```

## Reverse Proxy (nginx)

Beispiel nginx-Konfiguration:

```nginx
server {
    listen 80;
    server_name bohlweg.example.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Support

Bei Problemen:
1. Logs checken: `docker-compose logs -f`
2. GitHub Issues: https://github.com/your-repo/issues
3. Documentation: README.md, CLAUDE.md
