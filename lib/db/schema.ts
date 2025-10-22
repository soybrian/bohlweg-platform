/**
 * Database Schema Definition for Bohlweg Platform
 *
 * Diese Datei definiert das Datenbankschema für die verschiedenen Module.
 * Verwendete Datenbank: SQLite (better-sqlite3)
 */

export interface Idea {
  id: number;
  externalId: string;
  title: string;
  description: string;
  author: string;
  category: string;
  status: string;
  supporters: number;
  maxSupporters: number;
  comments: number;
  commentsData?: string; // JSON array of comment objects
  createdAt: string;
  url: string;
  scraped_at: string;
  modified_at?: string;
  // AI Enhancement Fields
  votingDeadline?: string;
  votingExpired?: boolean;
  supportersList?: string; // JSON array
  aiSummary?: string;
  aiHashtags?: string; // JSON array
  aiTitle?: string; // AI-generated title
  detailScraped?: boolean;
  detailScrapedAt?: string;
}

export interface Maengel {
  id: number;
  externalId: string;
  title: string;
  description: string;
  author: string;
  category: string;
  status: string;
  location: string;
  photoUrl?: string;
  createdAt: string;
  url: string;
  scraped_at: string;
  modified_at?: string;
  statusHistory?: string; // JSON array of status history entries
}

export interface MaengelStatusHistoryEntry {
  timestamp: string;
  status: string;
}

export interface IdeaHistory {
  id: number;
  idea_id: number;
  externalId: string;
  title: string;
  description: string;
  author: string;
  category: string;
  status: string;
  supporters: number;
  maxSupporters: number;
  comments: number;
  createdAt: string;
  url: string;
  changed_at: string;
}

export interface MaengelHistory {
  id: number;
  maengel_id: number;
  externalId: string;
  title: string;
  description: string;
  author: string;
  category: string;
  status: string;
  location: string;
  photoUrl?: string;
  createdAt: string;
  url: string;
  changed_at: string;
}

export interface ScraperRun {
  id: number;
  module: string;
  startTime: string;
  endTime: string;
  itemsScraped: number;
  itemsNew: number;
  itemsUpdated: number;
  success: boolean;
  error?: string;
}

export interface ModuleConfig {
  id: number;
  moduleKey: string;
  name: string;
  description: string;
  enabled: boolean;
  intervalMinutes: number;
  lastRun?: string;
  nextRun?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformSummary {
  id: number;
  moduleKey: string; // 'ideenplattform' or 'maengelmelder'
  summary: string; // 3-4 sentences AI-generated summary
  itemCount: number; // Number of items analyzed
  createdAt: string;
  validUntil?: string; // Summary valid until next scraping
}

export interface EventItem {
  id: number;
  externalId: string;
  title: string;
  description?: string;
  shortDescription?: string;
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  venueName?: string;
  venueAddress?: string;
  venuePostcode?: string;
  venueCity?: string;
  organizer?: string;
  imageUrl?: string;
  category?: string;
  categories?: string; // JSON array
  price?: string;
  priceFormatted?: string; // AI-extracted lowest regular price (e.g. "12€", "7,50€")
  isFree?: boolean;
  ticketUrl?: string; // URL to buy tickets
  organizerWebsite?: string; // Organizer's homepage (from "Webseite der Veranstaltung")
  url: string;
  status?: string;
  scraped_at: string;
  modified_at?: string;
  detailScraped?: boolean;
  detailScrapedAt?: string;
}

export interface EventDate {
  id: number;
  event_id: number;
  externalId: string; // Same as parent event
  date: string; // ISO format: YYYY-MM-DD
  startTime?: string; // HH:MM
  endTime?: string; // HH:MM
  created_at: string;
}

export const DB_SCHEMA = `
-- Ideen von der Ideenplattform
CREATE TABLE IF NOT EXISTS ideas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  externalId TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  author TEXT,
  category TEXT,
  status TEXT,
  supporters INTEGER DEFAULT 0,
  maxSupporters INTEGER DEFAULT 50,
  comments INTEGER DEFAULT 0,
  commentsData TEXT,
  createdAt TEXT,
  url TEXT,
  scraped_at TEXT NOT NULL,
  modified_at TEXT,
  -- AI Enhancement Fields
  votingDeadline TEXT,
  votingExpired BOOLEAN DEFAULT 0,
  supportersList TEXT,
  aiSummary TEXT,
  aiHashtags TEXT,
  aiTitle TEXT,
  detailScraped BOOLEAN DEFAULT 0,
  detailScrapedAt TEXT,
  UNIQUE(externalId)
);

-- Mängel vom Mängelmelder
CREATE TABLE IF NOT EXISTS maengel (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  externalId TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  author TEXT,
  category TEXT,
  status TEXT,
  location TEXT,
  photoUrl TEXT,
  createdAt TEXT,
  url TEXT,
  scraped_at TEXT NOT NULL,
  modified_at TEXT,
  statusHistory TEXT,
  UNIQUE(externalId)
);

-- Historie der Ideen-Änderungen
CREATE TABLE IF NOT EXISTS ideas_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  idea_id INTEGER NOT NULL,
  externalId TEXT NOT NULL,
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
  changed_at TEXT NOT NULL,
  FOREIGN KEY(idea_id) REFERENCES ideas(id)
);

-- Historie der Mängel-Änderungen
CREATE TABLE IF NOT EXISTS maengel_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  maengel_id INTEGER NOT NULL,
  externalId TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  author TEXT,
  category TEXT,
  status TEXT,
  location TEXT,
  photoUrl TEXT,
  createdAt TEXT,
  url TEXT,
  changed_at TEXT NOT NULL,
  FOREIGN KEY(maengel_id) REFERENCES maengel(id)
);

-- Scraper Run History
CREATE TABLE IF NOT EXISTS scraper_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  module TEXT NOT NULL,
  startTime TEXT NOT NULL,
  endTime TEXT,
  itemsScraped INTEGER DEFAULT 0,
  itemsNew INTEGER DEFAULT 0,
  itemsUpdated INTEGER DEFAULT 0,
  success BOOLEAN DEFAULT 0,
  error TEXT
);

-- Module Konfiguration
CREATE TABLE IF NOT EXISTS module_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  moduleKey TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN DEFAULT 1,
  intervalMinutes INTEGER DEFAULT 60,
  lastRun TEXT,
  nextRun TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

-- Indexe für bessere Performance
CREATE INDEX IF NOT EXISTS idx_ideas_category ON ideas(category);
CREATE INDEX IF NOT EXISTS idx_ideas_status ON ideas(status);
CREATE INDEX IF NOT EXISTS idx_ideas_scraped_at ON ideas(scraped_at);
CREATE INDEX IF NOT EXISTS idx_ideas_modified_at ON ideas(modified_at);
CREATE INDEX IF NOT EXISTS idx_ideas_voting_expired ON ideas(votingExpired);
CREATE INDEX IF NOT EXISTS idx_ideas_detail_scraped ON ideas(detailScraped);

CREATE INDEX IF NOT EXISTS idx_maengel_category ON maengel(category);
CREATE INDEX IF NOT EXISTS idx_maengel_status ON maengel(status);
CREATE INDEX IF NOT EXISTS idx_maengel_scraped_at ON maengel(scraped_at);
CREATE INDEX IF NOT EXISTS idx_maengel_modified_at ON maengel(modified_at);

CREATE INDEX IF NOT EXISTS idx_ideas_history_idea_id ON ideas_history(idea_id);
CREATE INDEX IF NOT EXISTS idx_ideas_history_changed_at ON ideas_history(changed_at);

CREATE INDEX IF NOT EXISTS idx_maengel_history_maengel_id ON maengel_history(maengel_id);
CREATE INDEX IF NOT EXISTS idx_maengel_history_changed_at ON maengel_history(changed_at);

CREATE INDEX IF NOT EXISTS idx_scraper_runs_module ON scraper_runs(module);
CREATE INDEX IF NOT EXISTS idx_scraper_runs_startTime ON scraper_runs(startTime);

CREATE INDEX IF NOT EXISTS idx_module_config_enabled ON module_config(enabled);
CREATE INDEX IF NOT EXISTS idx_module_config_nextRun ON module_config(nextRun);

-- Platform Summaries für Journalisten
CREATE TABLE IF NOT EXISTS platform_summaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  moduleKey TEXT NOT NULL,
  summary TEXT NOT NULL,
  itemCount INTEGER NOT NULL,
  createdAt TEXT NOT NULL,
  validUntil TEXT
);

CREATE INDEX IF NOT EXISTS idx_platform_summaries_moduleKey ON platform_summaries(moduleKey);
CREATE INDEX IF NOT EXISTS idx_platform_summaries_createdAt ON platform_summaries(createdAt);

-- Events von braunschweig.die-region.de
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  externalId TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  shortDescription TEXT,
  startDate TEXT,
  endDate TEXT,
  startTime TEXT,
  endTime TEXT,
  venueName TEXT,
  venueAddress TEXT,
  venuePostcode TEXT,
  venueCity TEXT DEFAULT 'Braunschweig',
  organizer TEXT,
  imageUrl TEXT,
  category TEXT,
  categories TEXT,
  moodCategory TEXT,
  price TEXT,
  isFree BOOLEAN DEFAULT 0,
  ticketUrl TEXT,
  url TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  scraped_at TEXT NOT NULL,
  modified_at TEXT,
  detailScraped BOOLEAN DEFAULT 0,
  detailScrapedAt TEXT,
  UNIQUE(externalId)
);

CREATE INDEX IF NOT EXISTS idx_events_startDate ON events(startDate);
CREATE INDEX IF NOT EXISTS idx_events_category ON events(category);
CREATE INDEX IF NOT EXISTS idx_events_city ON events(venueCity);
CREATE INDEX IF NOT EXISTS idx_events_scraped_at ON events(scraped_at);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);

-- Event Dates (Multiple dates for recurring events)
CREATE TABLE IF NOT EXISTS event_dates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL,
  externalId TEXT NOT NULL,
  date TEXT NOT NULL,
  startTime TEXT,
  endTime TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_event_dates_event_id ON event_dates(event_id);
CREATE INDEX IF NOT EXISTS idx_event_dates_externalId ON event_dates(externalId);
CREATE INDEX IF NOT EXISTS idx_event_dates_date ON event_dates(date);
`;
