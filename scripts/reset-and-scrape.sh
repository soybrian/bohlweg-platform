#!/bin/bash

# Reset Database und vollständiges Re-Scraping
# Dieses Skript löscht die Datenbank und führt ein komplettes Re-Scraping durch

echo "=== Bohlweg Platform: Reset & Re-Scrape ==="
echo ""

# Schritt 1: Datenbank löschen
echo "[1/2] Lösche bestehende Datenbank..."
if [ -f "data/bohlweg.db" ]; then
    rm -f data/bohlweg.db
    echo "✓ Datenbank gelöscht"
fi

if [ -f "data/bohlweg.db-wal" ]; then
    rm -f data/bohlweg.db-wal
    echo "✓ WAL-Datei gelöscht"
fi

if [ -f "data/bohlweg.db-shm" ]; then
    rm -f data/bohlweg.db-shm
    echo "✓ SHM-Datei gelöscht"
fi

echo ""

# Schritt 2: TypeScript Skript ausführen
echo "[2/2] Führe Reset & Re-Scrape Skript aus..."
npx ts-node scripts/reset-and-scrape.ts

echo ""
echo "Fertig!"
