/**
 * Progress Tracker
 *
 * In-Memory store für Scraping-Progress
 */

export interface ProgressUpdate {
  moduleKey: string;
  status: "running" | "completed" | "error";
  currentPage?: number;
  totalPages?: number;
  itemsScraped: number;
  itemsNew: number;
  itemsUpdated: number;
  message?: string;
  error?: string;
  timestamp: string;
}

// In-Memory Store für Progress
const progressStore = new Map<string, ProgressUpdate>();

// Event Emitter für SSE
type ProgressListener = (progress: ProgressUpdate) => void;
const listeners = new Map<string, Set<ProgressListener>>();

/**
 * Aktualisiert den Progress für ein Modul
 */
export function updateProgress(update: ProgressUpdate) {
  progressStore.set(update.moduleKey, update);

  // Notifiziere alle Listener für dieses Modul
  const moduleListeners = listeners.get(update.moduleKey);
  if (moduleListeners) {
    moduleListeners.forEach((listener) => listener(update));
  }
}

/**
 * Holt den aktuellen Progress für ein Modul
 */
export function getProgress(moduleKey: string): ProgressUpdate | undefined {
  return progressStore.get(moduleKey);
}

/**
 * Löscht den Progress für ein Modul
 */
export function clearProgress(moduleKey: string) {
  progressStore.delete(moduleKey);
}

/**
 * Registriert einen Listener für Progress-Updates
 */
export function addProgressListener(
  moduleKey: string,
  listener: ProgressListener
) {
  if (!listeners.has(moduleKey)) {
    listeners.set(moduleKey, new Set());
  }
  listeners.get(moduleKey)!.add(listener);
}

/**
 * Entfernt einen Listener
 */
export function removeProgressListener(
  moduleKey: string,
  listener: ProgressListener
) {
  const moduleListeners = listeners.get(moduleKey);
  if (moduleListeners) {
    moduleListeners.delete(listener);
    if (moduleListeners.size === 0) {
      listeners.delete(moduleKey);
    }
  }
}
