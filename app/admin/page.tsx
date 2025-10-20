"use client";

import { useState, useEffect } from "react";
import { Settings, Power, Clock, Activity, ChevronRight, Play, CheckCircle, XCircle, RefreshCw, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Module {
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

interface ProgressState {
  status: "running" | "completed" | "error";
  currentPage?: number;
  totalPages?: number;
  itemsScraped: number;
  itemsNew: number;
  itemsUpdated: number;
  message?: string;
  error?: string;
}

export default function AdminPage() {
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<{ moduleKey: string; success: boolean; message: string } | null>(null);
  const [progress, setProgress] = useState<Map<string, ProgressState>>(new Map());
  const [rescrapingIdeas, setRescrapingIdeas] = useState(false);
  const [rescrapingEvents, setRescrapingEvents] = useState(false);
  const [showEventsModal, setShowEventsModal] = useState(false);
  const [showIdeasModal, setShowIdeasModal] = useState(false);

  useEffect(() => {
    loadModules();
  }, []);

  const loadModules = async () => {
    try {
      const res = await fetch("/api/modules");
      if (res.ok) {
        const data = await res.json();
        setModules(data);
      }
    } catch (error) {
      console.error("Error loading modules:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleModule = async (moduleKey: string, currentEnabled: boolean) => {
    setUpdating(moduleKey);
    try {
      const res = await fetch(`/api/modules/${moduleKey}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !currentEnabled }),
      });

      if (res.ok) {
        const updated = await res.json();
        setModules((prev) =>
          prev.map((m) => (m.moduleKey === moduleKey ? updated : m))
        );
      }
    } catch (error) {
      console.error("Error toggling module:", error);
    } finally {
      setUpdating(null);
    }
  };

  const updateInterval = async (moduleKey: string, intervalMinutes: number) => {
    setUpdating(moduleKey);
    try {
      const res = await fetch(`/api/modules/${moduleKey}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intervalMinutes }),
      });

      if (res.ok) {
        const updated = await res.json();
        setModules((prev) =>
          prev.map((m) => (m.moduleKey === moduleKey ? updated : m))
        );
      }
    } catch (error) {
      console.error("Error updating interval:", error);
    } finally {
      setUpdating(null);
    }
  };

  const resetAndScrape = async () => {
    const confirmed = confirm(
      "⚠️ WARNUNG: Dies löscht ALLE bestehenden Ideen und scraped alles neu!\n\n" +
        "Alle Ideen werden neu gescraped und automatisch mit AI-Titeln, " +
        "Zusammenfassungen und Hashtags versehen.\n\n" +
        "Dies kann mehrere Minuten dauern.\n\n" +
        "Fortfahren?"
    );

    if (!confirmed) return;

    setRescrapingIdeas(true);
    try {
      const res = await fetch("/api/ideas/reset-and-scrape", {
        method: "POST",
      });

      if (res.ok) {
        const data = await res.json();
        alert(
          `✓ Erfolgreich abgeschlossen!\n\n` +
            `Gescraped: ${data.itemsScraped} Ideen\n` +
            `Neu: ${data.itemsNew}\n\n` +
            `Alle Ideen wurden mit AI-Daten versehen.`
        );
      } else {
        const data = await res.json();
        alert(`Fehler beim Scraping: ${data.error || "Unbekannter Fehler"}`);
      }
    } catch (error) {
      console.error("Error in reset and scrape:", error);
      alert("Fehler beim Scraping");
    } finally {
      setRescrapingIdeas(false);
    }
  };

  const confirmAndScrapeEvents = async () => {
    setShowEventsModal(false);
    setRescrapingEvents(true);

    try {
      const res = await fetch("/api/events/reset-and-scrape", {
        method: "POST",
      });

      if (res.ok) {
        const data = await res.json();
        alert(
          `✓ Erfolgreich abgeschlossen!\n\n` +
            `Gescraped: ${data.itemsScraped} Events\n` +
            `Neu: ${data.itemsNew}\n` +
            `Aktualisiert: ${data.itemsUpdated}\n\n` +
            `Alle Events wurden mit AI-Extraktion gescraped.`
        );
        loadModules();
      } else {
        const data = await res.json();
        alert(`Fehler beim Scraping: ${data.error || "Unbekannter Fehler"}`);
      }
    } catch (error) {
      console.error("Error in reset and scrape events:", error);
      alert("Fehler beim Scraping");
    } finally {
      setRescrapingEvents(false);
    }
  };

  const runModule = async (moduleKey: string) => {
    setRunning(moduleKey);
    setRunResult(null);

    // SSE Connection für Live Progress
    const eventSource = new EventSource(`/api/modules/${moduleKey}/progress`);

    eventSource.onmessage = (event) => {
      try {
        if (event.data && event.data.trim()) {
          const progressData = JSON.parse(event.data);
          setProgress((prev) => {
            const newMap = new Map(prev);
            newMap.set(moduleKey, progressData);
            return newMap;
          });
        }
      } catch (e) {
        console.error("Error parsing SSE data:", e);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    try {
      const res = await fetch(`/api/modules/${moduleKey}/run`, {
        method: "POST",
      });

      const data = await res.json();

      if (res.ok) {
        setRunResult({
          moduleKey,
          success: true,
          message: `✓ ${data.itemsScraped} Items (${data.itemsNew} neu, ${data.itemsUpdated} aktualisiert) in ${(data.duration / 1000).toFixed(1)}s`,
        });
        // Reload modules um updated lastRun/nextRun zu bekommen
        loadModules();
      } else {
        setRunResult({
          moduleKey,
          success: false,
          message: `✗ Fehler: ${data.error}`,
        });
      }
    } catch (error: any) {
      console.error("Error running module:", error);
      setRunResult({
        moduleKey,
        success: false,
        message: `✗ Fehler: ${error.message}`,
      });
    } finally {
      eventSource.close();
      setRunning(null);
      // Clear progress after completion
      setTimeout(() => {
        setProgress((prev) => {
          const newMap = new Map(prev);
          newMap.delete(moduleKey);
          return newMap;
        });
      }, 3000);
      // Clear result after 5 seconds
      setTimeout(() => setRunResult(null), 5000);
    }
  };

  const formatTime = (isoString?: string) => {
    if (!isoString) return "Nie";
    const date = new Date(isoString);
    return new Intl.DateTimeFormat("de-DE", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(date);
  };

  const intervalOptions = [
    { value: 5, label: "5 Minuten" },
    { value: 15, label: "15 Minuten" },
    { value: 30, label: "30 Minuten" },
    { value: 60, label: "1 Stunde" },
    { value: 120, label: "2 Stunden" },
    { value: 240, label: "4 Stunden" },
    { value: 360, label: "6 Stunden" },
    { value: 720, label: "12 Stunden" },
    { value: 1440, label: "24 Stunden" },
  ];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <nav className="glass-card sticky top-0 z-50 mb-4 mx-4 md:mx-6 mt-3 md:mt-4 border border-white/10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg md:text-xl font-medium text-white flex items-center gap-1.5">
              <Settings size={18} />
              Admin
            </h1>
            <p className="text-[10px] md:text-xs text-white/40">Modul-Verwaltung</p>
          </div>
          <a
            href="/"
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 text-white/50 hover:text-white/80 hover:bg-white/5"
          >
            <ChevronRight size={14} className="rotate-180" />
            Zurück
          </a>
        </div>
      </nav>

      <div className="px-4 md:px-6">
        {/* Reset and Scrape Control - Ideen */}
        <div className="glass-card border border-red-500/20 mb-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
                <RefreshCw size={16} className="text-red-400" />
                Ideen komplett neu scrapen
              </h2>
              <p className="text-xs text-white/60">
                Löscht alle bestehenden Ideen und scraped alles komplett neu mit automatischer AI-Verarbeitung (Titel, Zusammenfassungen, Hashtags).
                <br />
                <span className="text-red-300/80">⚠️ Dies ist eine destruktive Operation!</span>
              </p>
            </div>
            <button
              onClick={resetAndScrape}
              disabled={rescrapingIdeas}
              className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg text-sm text-red-300 font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 flex-shrink-0"
            >
              {rescrapingIdeas ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Scraping...
                </>
              ) : (
                <>
                  <RefreshCw size={16} />
                  Neu scrapen
                </>
              )}
            </button>
          </div>
        </div>

        {/* Reset and Scrape Control - Events */}
        <div className="glass-card border border-blue-500/20 mb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
                <RefreshCw size={16} className="text-blue-400" />
                Events komplett neu scrapen
              </h2>
              <p className="text-xs text-white/60">
                Löscht alle bestehenden Events und scraped alle ~450 Events komplett neu mit GPT-4o-mini AI-Extraktion für maximale Datenqualität.
                <br />
                <span className="text-blue-300/80">⏱️ Dauert ca. 10-15 Minuten</span>
                {" · "}
                <span className="text-red-300/80">⚠️ Destruktive Operation!</span>
              </p>
            </div>
            <button
              onClick={() => setShowEventsModal(true)}
              disabled={rescrapingEvents}
              className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 rounded-lg text-sm text-blue-300 font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 flex-shrink-0"
            >
              {rescrapingEvents ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Scraping...
                </>
              ) : (
                <>
                  <RefreshCw size={16} />
                  Neu scrapen
                </>
              )}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-3">
          {loading ? (
            <div className="glass-card text-center py-10 border border-white/10">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-white/10 border-t-white/50 mx-auto mb-2"></div>
              <p className="text-white/30 text-xs">Lade Module...</p>
            </div>
          ) : (
            modules.map((module) => (
              <div
                key={module.id}
                className="glass-card border border-white/10 hover:bg-white/5 transition-all"
              >
                <div className="flex flex-col gap-3">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1.5">
                        <h3 className="text-base font-medium text-white">
                          {module.name}
                        </h3>
                        <div
                          className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            module.enabled ? "bg-green-500" : "bg-white/20"
                          )}
                        />
                      </div>
                      <p className="text-xs text-white/50 mb-2">
                        {module.description}
                      </p>
                    </div>

                    {/* Toggle */}
                    <button
                      onClick={() => toggleModule(module.moduleKey, module.enabled)}
                      disabled={updating === module.moduleKey}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border",
                        module.enabled
                          ? "bg-green-500/20 text-green-200 border-green-500/30 hover:bg-green-500/30"
                          : "bg-white/10 text-white/50 border-white/10 hover:bg-white/15",
                        updating === module.moduleKey && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <Power size={14} />
                      {module.enabled ? "Aktiv" : "Inaktiv"}
                    </button>
                  </div>

                  {/* Live Progress */}
                  {progress.get(module.moduleKey) && (
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg px-2.5 py-2.5">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <div className="animate-spin rounded-full h-3 w-3 border-2 border-blue-500/30 border-t-blue-500"></div>
                          <span className="text-xs font-medium text-blue-200">
                            {progress.get(module.moduleKey)?.message || "Wird ausgeführt..."}
                          </span>
                        </div>
                        {progress.get(module.moduleKey)?.currentPage && (
                          <span className="text-[10px] text-blue-200/60">
                            Seite {progress.get(module.moduleKey)?.currentPage}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-3 text-[10px] text-blue-200/80">
                        <span>{progress.get(module.moduleKey)?.itemsScraped || 0} Items</span>
                        <span>{progress.get(module.moduleKey)?.itemsNew || 0} neu</span>
                        <span>{progress.get(module.moduleKey)?.itemsUpdated || 0} aktualisiert</span>
                      </div>
                    </div>
                  )}

                  {/* Run Result */}
                  {runResult && runResult.moduleKey === module.moduleKey && (
                    <div
                      className={cn(
                        "flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs",
                        runResult.success
                          ? "bg-green-500/20 text-green-200 border border-green-500/30"
                          : "bg-red-500/20 text-red-200 border border-red-500/30"
                      )}
                    >
                      {runResult.success ? (
                        <CheckCircle size={14} />
                      ) : (
                        <XCircle size={14} />
                      )}
                      {runResult.message}
                    </div>
                  )}

                  {/* Settings */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-3 border-t border-white/10">
                    {/* Interval */}
                    <div>
                      <label className="text-[10px] text-white/30 uppercase tracking-wide mb-1.5 block">
                        Frequenz
                      </label>
                      <select
                        value={module.intervalMinutes}
                        onChange={(e) =>
                          updateInterval(module.moduleKey, parseInt(e.target.value))
                        }
                        disabled={updating === module.moduleKey}
                        className="w-full bg-white/10 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-white/20"
                      >
                        {intervalOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Last Run */}
                    <div>
                      <label className="text-[10px] text-white/30 uppercase tracking-wide mb-1.5 block">
                        Letzter Lauf
                      </label>
                      <div className="flex items-center gap-1.5 text-xs text-white/50">
                        <Clock size={12} />
                        {formatTime(module.lastRun)}
                      </div>
                    </div>

                    {/* Next Run */}
                    <div>
                      <label className="text-[10px] text-white/30 uppercase tracking-wide mb-1.5 block">
                        Nächster Lauf
                      </label>
                      <div className="flex items-center gap-1.5 text-xs text-white/50">
                        <Activity size={12} />
                        {formatTime(module.nextRun)}
                      </div>
                    </div>

                    {/* Run Now Button */}
                    <div>
                      <label className="text-[10px] text-white/30 uppercase tracking-wide mb-1.5 block">
                        Aktion
                      </label>
                      <button
                        onClick={() => runModule(module.moduleKey)}
                        disabled={running === module.moduleKey || !module.enabled}
                        className={cn(
                          "w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border",
                          running === module.moduleKey
                            ? "bg-white/5 text-white/30 border-white/10 cursor-not-allowed"
                            : module.enabled
                            ? "bg-white/10 text-white border-white/10 hover:bg-white/15"
                            : "bg-white/5 text-white/20 border-white/10 cursor-not-allowed"
                        )}
                      >
                        {running === module.moduleKey ? (
                          <>
                            <div className="animate-spin rounded-full h-3 w-3 border-2 border-white/20 border-t-white/50"></div>
                            Läuft...
                          </>
                        ) : (
                          <>
                            <Play size={12} />
                            Jetzt ausführen
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Events Scraping Modal */}
      {showEventsModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setShowEventsModal(false)}
        >
          <div
            className="glass-card border border-blue-500/30 max-w-md w-full animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 bg-blue-500/20 border border-blue-500/30 rounded-lg">
                <RefreshCw size={20} className="text-blue-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-semibold text-white mb-1">
                  Events komplett neu scrapen?
                </h3>
                <p className="text-xs text-white/60">
                  Diese Aktion wird alle bestehenden Events löschen
                </p>
              </div>
            </div>

            <div className="space-y-3 mb-4">
              <div className="glass-card bg-blue-500/5 border border-blue-500/20">
                <h4 className="text-xs font-semibold text-white/80 mb-2">Was passiert:</h4>
                <ul className="space-y-1.5 text-xs text-white/60">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-0.5">•</span>
                    <span>Alle bestehenden Events werden gelöscht</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-0.5">•</span>
                    <span>~450 Events werden neu gescraped</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-0.5">•</span>
                    <span>GPT-4o-mini extrahiert alle Daten automatisch</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-0.5">•</span>
                    <span>Dauer: ca. 10-15 Minuten</span>
                  </li>
                </ul>
              </div>

              <div className="glass-card bg-red-500/5 border border-red-500/20">
                <div className="flex items-start gap-2">
                  <span className="text-red-400 text-lg">⚠️</span>
                  <div>
                    <h4 className="text-xs font-semibold text-red-300 mb-1">Destruktive Operation</h4>
                    <p className="text-xs text-white/60">
                      Diese Aktion kann nicht rückgängig gemacht werden.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowEventsModal(false)}
                className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm text-white/70 font-medium transition-all"
              >
                Abbrechen
              </button>
              <button
                onClick={confirmAndScrapeEvents}
                className="flex-1 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 rounded-lg text-sm text-blue-300 font-medium transition-all flex items-center justify-center gap-2"
              >
                <RefreshCw size={14} />
                Jetzt scrapen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
