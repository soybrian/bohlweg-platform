/**
 * Database Connection und Operations
 *
 * Stellt Datenbank-Verbindung und CRUD-Operationen mit Änderungsverfolgung bereit.
 */

import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { DB_SCHEMA, Idea, Maengel, ScraperRun, IdeaHistory, MaengelHistory, ModuleConfig, PlatformSummary } from "./schema";

const DB_PATH = path.join(process.cwd(), "data", "bohlweg.db");

const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    initializeDatabase(db);
  }
  return db;
}

function initializeDatabase(database: Database.Database) {
  database.exec(DB_SCHEMA);
  console.log("[DB] Database initialized successfully");

  // Initialisiere Standard-Module
  initializeDefaultModules(database);
}

function initializeDefaultModules(database: Database.Database) {
  const modules = [
    {
      moduleKey: "ideenplattform",
      name: "Ideenplattform",
      description: "Scrapt Ideen von mitreden.braunschweig.de/ideenplattform",
      intervalMinutes: 60,
    },
    {
      moduleKey: "maengelmelder",
      name: "Mängelmelder",
      description: "Scrapt Mängel von mitreden.braunschweig.de/maengelmelder",
      intervalMinutes: 60,
    },
  ];

  const now = new Date().toISOString();

  for (const module of modules) {
    const existing = database
      .prepare("SELECT id FROM module_config WHERE moduleKey = ?")
      .get(module.moduleKey);

    if (!existing) {
      database.prepare(`
        INSERT INTO module_config (moduleKey, name, description, enabled, intervalMinutes, createdAt, updatedAt)
        VALUES (?, ?, ?, 1, ?, ?, ?)
      `).run(
        module.moduleKey,
        module.name,
        module.description,
        module.intervalMinutes,
        now,
        now
      );
      console.log(`[DB] Initialized module: ${module.name}`);
    }
  }
}

export function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}

/**
 * Prüfe ob sich der Inhalt geändert hat
 */
function hasContentChanged(existing: Idea | Maengel, incoming: Omit<Idea | Maengel, "id" | "scraped_at" | "modified_at">): boolean {
  return (
    existing.title !== incoming.title ||
    existing.description !== incoming.description ||
    existing.status !== incoming.status ||
    existing.category !== incoming.category ||
    ("supporters" in existing && "supporters" in incoming && existing.supporters !== incoming.supporters) ||
    ("location" in existing && "location" in incoming && existing.location !== incoming.location)
  );
}

// ===== IDEA OPERATIONS =====

export function upsertIdea(idea: Omit<Idea, "id">): { isNew: boolean; id: number; hasChanged: boolean } {
  const db = getDatabase();

  const existing = db
    .prepare("SELECT * FROM ideas WHERE externalId = ?")
    .get(idea.externalId) as Idea | undefined;

  if (existing) {
    const hasChanged = hasContentChanged(existing, idea);

    if (hasChanged) {
      // Speichere alte Version in Historie
      db.prepare(`
        INSERT INTO ideas_history (idea_id, externalId, title, description, author, category, status, supporters, maxSupporters, comments, createdAt, url, changed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        existing.id,
        existing.externalId,
        existing.title,
        existing.description,
        existing.author,
        existing.category,
        existing.status,
        existing.supporters,
        existing.maxSupporters,
        existing.comments,
        existing.createdAt,
        existing.url,
        new Date().toISOString()
      );

      // Update mit modified_at und AI enhancement fields
      db.prepare(`
        UPDATE ideas SET
          title = ?,
          description = ?,
          author = ?,
          category = ?,
          status = ?,
          supporters = ?,
          maxSupporters = ?,
          comments = ?,
          commentsData = ?,
          createdAt = ?,
          url = ?,
          scraped_at = ?,
          modified_at = ?,
          votingDeadline = ?,
          votingExpired = ?,
          supportersList = ?,
          aiSummary = ?,
          aiHashtags = ?,
          aiTitle = ?,
          detailScraped = ?,
          detailScrapedAt = ?
        WHERE externalId = ?
      `).run(
        idea.title,
        idea.description,
        idea.author,
        idea.category,
        idea.status,
        idea.supporters,
        idea.maxSupporters,
        idea.comments,
        idea.commentsData || null,
        idea.createdAt,
        idea.url,
        idea.scraped_at,
        new Date().toISOString(),
        idea.votingDeadline || null,
        idea.votingExpired ? 1 : 0,
        idea.supportersList || null,
        idea.aiSummary || null,
        idea.aiHashtags || null,
        idea.aiTitle || null,
        idea.detailScraped ? 1 : 0,
        idea.detailScrapedAt || null,
        idea.externalId
      );
    } else {
      // Aktualisiere scraped_at und AI fields wenn vorhanden
      db.prepare(`
        UPDATE ideas SET
          scraped_at = ?,
          commentsData = COALESCE(?, commentsData),
          votingDeadline = COALESCE(?, votingDeadline),
          votingExpired = COALESCE(?, votingExpired),
          supportersList = COALESCE(?, supportersList),
          aiSummary = COALESCE(?, aiSummary),
          aiHashtags = COALESCE(?, aiHashtags),
          aiTitle = COALESCE(?, aiTitle),
          detailScraped = COALESCE(?, detailScraped),
          detailScrapedAt = COALESCE(?, detailScrapedAt)
        WHERE externalId = ?
      `).run(
        idea.scraped_at,
        idea.commentsData || null,
        idea.votingDeadline || null,
        idea.votingExpired ? 1 : 0,
        idea.supportersList || null,
        idea.aiSummary || null,
        idea.aiHashtags || null,
        idea.aiTitle || null,
        idea.detailScraped ? 1 : 0,
        idea.detailScrapedAt || null,
        idea.externalId
      );
    }

    return { isNew: false, id: existing.id, hasChanged };
  } else {
    const result = db.prepare(`
      INSERT INTO ideas (
        externalId, title, description, author, category, status,
        supporters, maxSupporters, comments, commentsData, createdAt, url, scraped_at,
        votingDeadline, votingExpired, supportersList, aiSummary, aiHashtags, aiTitle,
        detailScraped, detailScrapedAt
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      idea.externalId,
      idea.title,
      idea.description,
      idea.author,
      idea.category,
      idea.status,
      idea.supporters,
      idea.maxSupporters,
      idea.comments,
      idea.commentsData || null,
      idea.createdAt,
      idea.url,
      idea.scraped_at,
      idea.votingDeadline || null,
      idea.votingExpired ? 1 : 0,
      idea.supportersList || null,
      idea.aiSummary || null,
      idea.aiHashtags || null,
      idea.aiTitle || null,
      idea.detailScraped ? 1 : 0,
      idea.detailScrapedAt || null
    );
    return { isNew: true, id: result.lastInsertRowid as number, hasChanged: false };
  }
}

export function getIdeas(filters?: {
  category?: string;
  status?: string;
  search?: string;
  hashtags?: string[];
  votingStatus?: "active" | "expired" | "all";
  sortBy?: "newest" | "supporters" | "comments";
  limit?: number;
  offset?: number;
}): Idea[] {
  const db = getDatabase();
  let query = "SELECT * FROM ideas WHERE 1=1";
  const params: any[] = [];

  if (filters?.category) {
    query += " AND category = ?";
    params.push(filters.category);
  }

  if (filters?.status) {
    query += " AND status = ?";
    params.push(filters.status);
  }

  if (filters?.search) {
    query += " AND (title LIKE ? OR description LIKE ? OR aiSummary LIKE ?)";
    params.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`);
  }

  if (filters?.hashtags && filters.hashtags.length > 0) {
    // Filter by hashtags - at least one must match
    const hashtagConditions = filters.hashtags.map(() => "aiHashtags LIKE ?").join(" OR ");
    query += ` AND (${hashtagConditions})`;
    filters.hashtags.forEach(tag => {
      params.push(`%${tag}%`);
    });
  }

  if (filters?.votingStatus && filters.votingStatus !== "all") {
    if (filters.votingStatus === "active") {
      query += " AND (votingExpired = 0 OR votingExpired IS NULL)";
    } else if (filters.votingStatus === "expired") {
      query += " AND votingExpired = 1";
    }
  }

  // Sortierung nach Bedarf (Standard: newest = id ASC für zuletzt hinzugefügte, da niedrigere IDs = neuer)
  const sortBy = filters?.sortBy || "newest";
  if (sortBy === "newest") {
    query += " ORDER BY id ASC";
  } else if (sortBy === "supporters") {
    query += " ORDER BY supporters DESC";
  } else if (sortBy === "comments") {
    query += " ORDER BY comments DESC";
  }

  if (filters?.limit) {
    query += " LIMIT ?";
    params.push(filters.limit);
  }

  if (filters?.offset) {
    query += " OFFSET ?";
    params.push(filters.offset);
  }

  return db.prepare(query).all(...params) as Idea[];
}

export function countIdeas(filters?: {
  category?: string;
  status?: string;
  search?: string;
  hashtags?: string[];
  votingStatus?: "active" | "expired" | "all";
}): number {
  const db = getDatabase();
  let query = "SELECT COUNT(*) as count FROM ideas WHERE 1=1";
  const params: any[] = [];

  if (filters?.category) {
    query += " AND category = ?";
    params.push(filters.category);
  }

  if (filters?.status) {
    query += " AND status = ?";
    params.push(filters.status);
  }

  if (filters?.search) {
    query += " AND (title LIKE ? OR description LIKE ? OR aiSummary LIKE ?)";
    params.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`);
  }

  if (filters?.hashtags && filters.hashtags.length > 0) {
    const hashtagConditions = filters.hashtags.map(() => "aiHashtags LIKE ?").join(" OR ");
    query += ` AND (${hashtagConditions})`;
    filters.hashtags.forEach(tag => {
      params.push(`%${tag}%`);
    });
  }

  if (filters?.votingStatus && filters.votingStatus !== "all") {
    if (filters.votingStatus === "active") {
      query += " AND (votingExpired = 0 OR votingExpired IS NULL)";
    } else if (filters.votingStatus === "expired") {
      query += " AND votingExpired = 1";
    }
  }

  const result = db.prepare(query).get(...params) as { count: number };
  return result.count;
}

export function getIdeaHistory(ideaId: number): IdeaHistory[] {
  const db = getDatabase();
  return db
    .prepare("SELECT * FROM ideas_history WHERE idea_id = ? ORDER BY changed_at DESC")
    .all(ideaId) as IdeaHistory[];
}

/**
 * Get a single idea by ID
 */
export function getIdeaById(id: number): Idea | undefined {
  const db = getDatabase();
  return db.prepare("SELECT * FROM ideas WHERE id = ?").get(id) as Idea | undefined;
}

/**
 * Update AI enhancement fields for a specific idea
 */
export function updateIdeaAIFields(
  id: number,
  fields: {
    aiSummary?: string;
    aiHashtags?: string;
    aiTitle?: string;
  }
): void {
  const db = getDatabase();
  db.prepare(`
    UPDATE ideas SET
      aiSummary = COALESCE(?, aiSummary),
      aiHashtags = COALESCE(?, aiHashtags),
      aiTitle = COALESCE(?, aiTitle)
    WHERE id = ?
  `).run(fields.aiSummary || null, fields.aiHashtags || null, fields.aiTitle || null, id);
}

/**
 * Get all unique hashtags with their counts
 */
export function getAllHashtags(): { tag: string; count: number }[] {
  const db = getDatabase();
  const ideas = db
    .prepare("SELECT aiHashtags FROM ideas WHERE aiHashtags IS NOT NULL")
    .all() as { aiHashtags: string }[];

  const hashtagCounts: Map<string, number> = new Map();

  for (const idea of ideas) {
    try {
      const hashtags = JSON.parse(idea.aiHashtags) as string[];
      for (const tag of hashtags) {
        hashtagCounts.set(tag, (hashtagCounts.get(tag) || 0) + 1);
      }
    } catch (error) {
      // Skip invalid JSON
      continue;
    }
  }

  return Array.from(hashtagCounts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
}

// ===== MÄNGEL OPERATIONS =====

export function upsertMaengel(maengel: Omit<Maengel, "id">): { isNew: boolean; id: number; hasChanged: boolean } {
  const db = getDatabase();

  const existing = db
    .prepare("SELECT * FROM maengel WHERE externalId = ?")
    .get(maengel.externalId) as Maengel | undefined;

  if (existing) {
    const hasChanged = hasContentChanged(existing, maengel);

    if (hasChanged) {
      db.prepare(`
        INSERT INTO maengel_history (maengel_id, externalId, title, description, author, category, status, location, photoUrl, createdAt, url, changed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        existing.id,
        existing.externalId,
        existing.title,
        existing.description,
        existing.author,
        existing.category,
        existing.status,
        existing.location,
        existing.photoUrl || null,
        existing.createdAt,
        existing.url,
        new Date().toISOString()
      );

      db.prepare(`
        UPDATE maengel SET
          title = ?,
          description = ?,
          author = ?,
          category = ?,
          status = ?,
          location = ?,
          photoUrl = ?,
          createdAt = ?,
          url = ?,
          scraped_at = ?,
          modified_at = ?,
          statusHistory = ?
        WHERE externalId = ?
      `).run(
        maengel.title,
        maengel.description,
        maengel.author,
        maengel.category,
        maengel.status,
        maengel.location,
        maengel.photoUrl || null,
        maengel.createdAt,
        maengel.url,
        maengel.scraped_at,
        new Date().toISOString(),
        maengel.statusHistory || null,
        maengel.externalId
      );
    } else {
      db.prepare("UPDATE maengel SET scraped_at = ? WHERE externalId = ?")
        .run(maengel.scraped_at, maengel.externalId);
    }

    return { isNew: false, id: existing.id, hasChanged };
  } else {
    const result = db.prepare(`
      INSERT INTO maengel (externalId, title, description, author, category, status, location, photoUrl, createdAt, url, scraped_at, statusHistory)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      maengel.externalId,
      maengel.title,
      maengel.description,
      maengel.author,
      maengel.category,
      maengel.status,
      maengel.location,
      maengel.photoUrl || null,
      maengel.createdAt,
      maengel.url,
      maengel.scraped_at,
      maengel.statusHistory || null
    );
    return { isNew: true, id: result.lastInsertRowid as number, hasChanged: false };
  }
}

export function getMaengel(filters?: {
  category?: string;
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Maengel[] {
  const db = getDatabase();
  let query = "SELECT * FROM maengel WHERE 1=1";
  const params: any[] = [];

  if (filters?.category) {
    query += " AND category = ?";
    params.push(filters.category);
  }

  if (filters?.status) {
    query += " AND status = ?";
    params.push(filters.status);
  }

  if (filters?.search) {
    query += " AND (title LIKE ? OR description LIKE ? OR location LIKE ?)";
    params.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`);
  }

  query += " ORDER BY CAST(externalId AS INTEGER) DESC";

  if (filters?.limit) {
    query += " LIMIT ?";
    params.push(filters.limit);
  }

  if (filters?.offset) {
    query += " OFFSET ?";
    params.push(filters.offset);
  }

  return db.prepare(query).all(...params) as Maengel[];
}

export function countMaengel(filters?: { category?: string; status?: string; search?: string }): number {
  const db = getDatabase();
  let query = "SELECT COUNT(*) as count FROM maengel WHERE 1=1";
  const params: any[] = [];

  if (filters?.category) {
    query += " AND category = ?";
    params.push(filters.category);
  }

  if (filters?.status) {
    query += " AND status = ?";
    params.push(filters.status);
  }

  if (filters?.search) {
    query += " AND (title LIKE ? OR description LIKE ? OR location LIKE ?)";
    params.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`);
  }

  const result = db.prepare(query).get(...params) as { count: number };
  return result.count;
}

export function getMaengelHistory(maengelId: number): MaengelHistory[] {
  const db = getDatabase();
  return db
    .prepare("SELECT * FROM maengel_history WHERE maengel_id = ? ORDER BY changed_at DESC")
    .all(maengelId) as MaengelHistory[];
}

// ===== SCRAPER RUN OPERATIONS =====

export function startScraperRun(module: string): number {
  const db = getDatabase();
  const result = db.prepare(`
    INSERT INTO scraper_runs (module, startTime)
    VALUES (?, ?)
  `).run(module, new Date().toISOString());
  return result.lastInsertRowid as number;
}

export function endScraperRun(
  runId: number,
  stats: {
    itemsScraped: number;
    itemsNew: number;
    itemsUpdated: number;
    success: boolean;
    error?: string;
  }
) {
  const db = getDatabase();
  db.prepare(`
    UPDATE scraper_runs SET
      endTime = ?,
      itemsScraped = ?,
      itemsNew = ?,
      itemsUpdated = ?,
      success = ?,
      error = ?
    WHERE id = ?
  `).run(
    new Date().toISOString(),
    stats.itemsScraped,
    stats.itemsNew,
    stats.itemsUpdated,
    stats.success ? 1 : 0,
    stats.error || null,
    runId
  );
}

export function getRecentScraperRuns(limit: number = 10): ScraperRun[] {
  const db = getDatabase();
  return db
    .prepare(`
      SELECT * FROM scraper_runs
      ORDER BY startTime DESC
      LIMIT ?
    `)
    .all(limit) as ScraperRun[];
}

// ===== MODULE CONFIG OPERATIONS =====

export function getAllModules(): ModuleConfig[] {
  const db = getDatabase();
  return db.prepare("SELECT * FROM module_config ORDER BY name ASC").all() as ModuleConfig[];
}

export function getModule(moduleKey: string): ModuleConfig | undefined {
  const db = getDatabase();
  return db.prepare("SELECT * FROM module_config WHERE moduleKey = ?").get(moduleKey) as ModuleConfig | undefined;
}

export function updateModuleStatus(moduleKey: string, enabled: boolean): void {
  const db = getDatabase();
  db.prepare(`
    UPDATE module_config
    SET enabled = ?, updatedAt = ?
    WHERE moduleKey = ?
  `).run(enabled ? 1 : 0, new Date().toISOString(), moduleKey);
}

export function updateModuleInterval(moduleKey: string, intervalMinutes: number): void {
  const db = getDatabase();
  db.prepare(`
    UPDATE module_config
    SET intervalMinutes = ?, updatedAt = ?
    WHERE moduleKey = ?
  `).run(intervalMinutes, new Date().toISOString(), moduleKey);
}

export function updateModuleSettings(
  moduleKey: string,
  settings: { enabled?: boolean; intervalMinutes?: number }
): void {
  const db = getDatabase();
  const module = getModule(moduleKey);
  if (!module) throw new Error(`Module ${moduleKey} not found`);

  const enabled = settings.enabled !== undefined ? settings.enabled : module.enabled;
  const intervalMinutes = settings.intervalMinutes !== undefined ? settings.intervalMinutes : module.intervalMinutes;

  db.prepare(`
    UPDATE module_config
    SET enabled = ?, intervalMinutes = ?, updatedAt = ?
    WHERE moduleKey = ?
  `).run(enabled ? 1 : 0, intervalMinutes, new Date().toISOString(), moduleKey);
}

export function updateModuleRunTime(moduleKey: string, lastRun: string, nextRun: string): void {
  const db = getDatabase();
  db.prepare(`
    UPDATE module_config
    SET lastRun = ?, nextRun = ?, updatedAt = ?
    WHERE moduleKey = ?
  `).run(lastRun, nextRun, new Date().toISOString(), moduleKey);
}

export function getModuleDueForRun(): ModuleConfig[] {
  const db = getDatabase();
  const now = new Date().toISOString();
  return db.prepare(`
    SELECT * FROM module_config
    WHERE enabled = 1
      AND (nextRun IS NULL OR nextRun <= ?)
    ORDER BY nextRun ASC NULLS FIRST
  `).all(now) as ModuleConfig[];
}

// ===== STATISTIKEN =====

export function getStatistics() {
  const db = getDatabase();

  const ideasTotal = db.prepare("SELECT COUNT(*) as count FROM ideas").get() as { count: number };
  const ideasByCategory = db.prepare(`
    SELECT category, COUNT(*) as count
    FROM ideas
    GROUP BY category
    ORDER BY count DESC
  `).all() as { category: string; count: number }[];
  const ideasByStatus = db.prepare(`
    SELECT status, COUNT(*) as count
    FROM ideas
    GROUP BY status
    ORDER BY count DESC
  `).all() as { status: string; count: number }[];

  const maengelTotal = db.prepare("SELECT COUNT(*) as count FROM maengel").get() as { count: number };
  const maengelByCategory = db.prepare(`
    SELECT category, COUNT(*) as count
    FROM maengel
    GROUP BY category
    ORDER BY count DESC
  `).all() as { category: string; count: number }[];
  const maengelByStatus = db.prepare(`
    SELECT status, COUNT(*) as count
    FROM maengel
    GROUP BY status
    ORDER BY count DESC
  `).all() as { status: string; count: number }[];

  const recentRuns = getRecentScraperRuns(5);

  return {
    ideas: {
      total: ideasTotal.count,
      byCategory: ideasByCategory,
      byStatus: ideasByStatus,
    },
    maengel: {
      total: maengelTotal.count,
      byCategory: maengelByCategory,
      byStatus: maengelByStatus,
    },
    recentRuns,
  };
}

// ===== PLATFORM SUMMARIES =====

export function savePlatformSummary(moduleKey: string, summary: string, itemCount: number): number {
  const db = getDatabase();
  const createdAt = new Date().toISOString();
  const validUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24h

  const result = db.prepare(`
    INSERT INTO platform_summaries (moduleKey, summary, itemCount, createdAt, validUntil)
    VALUES (?, ?, ?, ?, ?)
  `).run(moduleKey, summary, itemCount, createdAt, validUntil);

  return result.lastInsertRowid as number;
}

export function getCurrentPlatformSummary(moduleKey: string): PlatformSummary | null {
  const db = getDatabase();
  const summary = db.prepare(`
    SELECT * FROM platform_summaries
    WHERE moduleKey = ?
    ORDER BY createdAt DESC
    LIMIT 1
  `).get(moduleKey) as PlatformSummary | undefined;

  return summary || null;
}

export function getAllCurrentSummaries(): PlatformSummary[] {
  const db = getDatabase();

  // Get latest summary for each module
  const ideenSummary = getCurrentPlatformSummary("ideenplattform");
  const maengelSummary = getCurrentPlatformSummary("maengelmelder");

  const summaries: PlatformSummary[] = [];
  if (ideenSummary) summaries.push(ideenSummary);
  if (maengelSummary) summaries.push(maengelSummary);

  return summaries;
}
