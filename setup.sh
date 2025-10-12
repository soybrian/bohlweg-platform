#!/bin/bash

# Bohlweg Platform Setup Script
# Dieses Script richtet die Entwicklungsumgebung ein

echo "🚀 Bohlweg Platform - Setup"
echo "================================"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js ist nicht installiert!"
    echo "Bitte installiere Node.js 18+ von https://nodejs.org"
    exit 1
fi

echo "✅ Node.js $(node --version) gefunden"
echo ""

# Install dependencies
echo "📦 Installiere Dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Fehler beim Installieren der Dependencies"
    exit 1
fi

echo "✅ Dependencies installiert"
echo ""

# Install Playwright browsers
echo "🌐 Installiere Playwright Browser..."
npx playwright install chromium

if [ $? -ne 0 ]; then
    echo "❌ Fehler beim Installieren von Playwright"
    exit 1
fi

echo "✅ Playwright Browser installiert"
echo ""

# Create data directory
echo "📁 Erstelle Datenverzeichnis..."
mkdir -p data

echo "✅ Datenverzeichnis erstellt"
echo ""

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Erstelle .env Datei..."
    cp .env.example .env
    echo "✅ .env Datei erstellt"
else
    echo "ℹ️  .env Datei existiert bereits"
fi

echo ""
echo "================================"
echo "✨ Setup abgeschlossen!"
echo ""
echo "Nächste Schritte:"
echo ""
echo "1. Entwicklungsserver starten:"
echo "   npm run dev"
echo ""
echo "2. Daten scrapen (in einem neuen Terminal):"
echo "   npx ts-node scrapers/scheduler.ts --now"
echo ""
echo "3. Dashboard öffnen:"
echo "   http://localhost:3000"
echo ""
echo "Oder mit Docker:"
echo "   docker-compose up -d"
echo ""
echo "================================"
