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
  const [rescraping, setRescraping] = useState(false);

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

    setRescraping(true);
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
      setRescraping(false);
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
        {/* Reset and Scrape Control */}
        <div className="glass-card border border-red-500/20 mb-4">
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
              disabled={rescraping}
              className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg text-sm text-red-300 font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 flex-shrink-0"
            >
              {rescraping ? (
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
    </div>
  );
}
