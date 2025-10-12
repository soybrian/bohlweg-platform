"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronRight, Sparkles, Loader2, RefreshCw, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Idea {
  id: number;
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
  aiSummary?: string;
  aiHashtags?: string;
  aiTitle?: string;
}

interface AIEnhancement {
  aiTitle?: string;
  aiSummary: string;
  aiHashtags: string[];
}

export default function AIIdeasPage() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [enhancingId, setEnhancingId] = useState<number | null>(null);
  const [rescraping, setRescraping] = useState(false);

  useEffect(() => {
    loadIdeas();
  }, []);

  const loadIdeas = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ideas?limit=100");
      if (res.ok) {
        const data = await res.json();
        setIdeas(data);
      }
    } catch (error) {
      console.error("Error loading ideas:", error);
    } finally {
      setLoading(false);
    }
  };

  const enhanceIdea = async (id: number) => {
    setEnhancingId(id);
    try {
      const res = await fetch(`/api/ideas/${id}/enhance`, {
        method: "POST",
      });

      if (res.ok) {
        const data = await res.json();
        // Update the idea in the list
        setIdeas((prev) =>
          prev.map((idea) =>
            idea.id === id
              ? {
                  ...idea,
                  aiTitle: data.enhancement.aiTitle,
                  aiSummary: data.enhancement.aiSummary,
                  aiHashtags: JSON.stringify(data.enhancement.aiHashtags),
                }
              : idea
          )
        );
      } else {
        console.error("Failed to enhance idea");
      }
    } catch (error) {
      console.error("Error enhancing idea:", error);
    } finally {
      setEnhancingId(null);
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
        // Reload ideas to show updated data
        await loadIdeas();
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

  const toggleExpand = (id: number) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      // If idea doesn't have AI data yet, enhance it
      const idea = ideas.find((i) => i.id === id);
      if (idea && (!idea.aiTitle || !idea.aiSummary || !idea.aiHashtags)) {
        enhanceIdea(id);
      }
    }
  };

  const parseHashtags = (hashtagsJson: string | undefined): string[] => {
    if (!hashtagsJson) return [];
    try {
      return JSON.parse(hashtagsJson);
    } catch {
      return [];
    }
  };

  const getIdeaStats = () => {
    const total = ideas.length;
    const withAI = ideas.filter((i) => i.aiTitle && i.aiSummary && i.aiHashtags).length;
    const withoutAI = total - withAI;
    return { total, withAI, withoutAI };
  };

  const stats = getIdeaStats();

  return (
    <div className="min-h-screen p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2 mb-2">
          <Sparkles size={24} className="text-blue-400" />
          AI-Enhanced Ideen Verwaltung
        </h1>
        <p className="text-sm text-white/60">
          Verwalte und generiere KI-Zusammenfassungen und Titel für alle Ideen
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <div className="glass-card border border-white/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-white/60">Gesamt</span>
            <Sparkles size={14} className="text-white/30" />
          </div>
          <p className="text-2xl font-bold text-white">{stats.total}</p>
          <p className="text-xs text-white/40 mt-1">Alle Ideen</p>
        </div>

        <div className="glass-card border border-white/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-white/60">Mit AI</span>
            <CheckCircle2 size={14} className="text-green-400/50" />
          </div>
          <p className="text-2xl font-bold text-green-400">{stats.withAI}</p>
          <p className="text-xs text-white/40 mt-1">AI-Enhanced</p>
        </div>

        <div className="glass-card border border-white/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-white/60">Ohne AI</span>
            <XCircle size={14} className="text-red-400/50" />
          </div>
          <p className="text-2xl font-bold text-red-400">{stats.withoutAI}</p>
          <p className="text-xs text-white/40 mt-1">Benötigen AI</p>
        </div>
      </div>

      {/* Reset and Scrape Control */}
      <div className="glass-card border border-red-500/20 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
              <RefreshCw size={16} className="text-red-400" />
              Alles neu scrapen
            </h2>
            <p className="text-xs text-white/60">
              Löscht alle bestehenden Ideen und scraped alles komplett neu.
              <br />
              Alle Ideen werden automatisch mit AI-Titeln, Zusammenfassungen und Hashtags versehen.
            </p>
          </div>
          <button
            onClick={resetAndScrape}
            disabled={rescraping}
            className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded text-sm text-red-300 font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 flex-shrink-0"
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

      {/* Ideas List */}
      <div className="space-y-2">
        {loading ? (
          <div className="glass-card border border-white/10 text-center py-10">
            <Loader2 size={24} className="animate-spin mx-auto mb-2 text-white/50" />
            <p className="text-sm text-white/50">Lade Ideen...</p>
          </div>
        ) : ideas.length === 0 ? (
          <div className="glass-card border border-white/10 text-center py-10">
            <p className="text-sm text-white/50">Keine Ideen gefunden</p>
          </div>
        ) : (
          ideas.map((idea) => {
            const isExpanded = expandedId === idea.id;
            const isEnhancing = enhancingId === idea.id;
            const hasAI = idea.aiTitle || idea.aiSummary || idea.aiHashtags;
            const hashtags = parseHashtags(idea.aiHashtags);

            return (
              <div
                key={idea.id}
                className="glass-card border border-white/10 hover:bg-white/5 transition-all"
              >
                {/* Accordion Header */}
                <button
                  onClick={() => toggleExpand(idea.id)}
                  className="w-full flex items-center justify-between gap-3 text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {isExpanded ? (
                        <ChevronDown size={16} className="text-white/60 flex-shrink-0" />
                      ) : (
                        <ChevronRight size={16} className="text-white/60 flex-shrink-0" />
                      )}
                      <h3 className="text-sm font-medium text-white truncate">
                        {idea.aiTitle || idea.title}
                      </h3>
                      {isEnhancing && (
                        <Loader2 size={14} className="animate-spin text-blue-400 flex-shrink-0" />
                      )}
                      {!hasAI && !isEnhancing && (
                        <span className="px-1.5 py-0.5 bg-yellow-500/20 border border-yellow-500/30 rounded text-[9px] text-yellow-300 flex-shrink-0">
                          Benötigt AI
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-white/40 ml-6">
                      <span>{idea.category}</span>
                      <span>·</span>
                      <span>{idea.supporters}/{idea.maxSupporters} Unterstützer</span>
                      <span>·</span>
                      <span>ID: {idea.id}</span>
                    </div>
                  </div>

                  {hasAI && (
                    <CheckCircle2 size={16} className="text-green-400 flex-shrink-0" />
                  )}
                </button>

                {/* Accordion Content */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-white/10 space-y-4">
                    {/* AI vs Original Title */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-white/60 mb-1.5 block">
                          AI-Titel
                          {isEnhancing && (
                            <Loader2 size={12} className="inline-block ml-2 animate-spin" />
                          )}
                        </label>
                        <div className="px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded">
                          <p className="text-sm text-blue-300">
                            {isEnhancing ? "Generiere..." : idea.aiTitle || "Noch nicht generiert"}
                          </p>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-white/60 mb-1.5 block">Original-Titel</label>
                        <div className="px-3 py-2 bg-white/5 border border-white/10 rounded">
                          <p className="text-sm text-white/70">{idea.title}</p>
                        </div>
                      </div>
                    </div>

                    {/* AI Summary */}
                    {(idea.aiSummary || isEnhancing) && (
                      <div>
                        <label className="text-xs text-white/60 mb-1.5 block">
                          AI-Zusammenfassung
                        </label>
                        <div className="px-3 py-2 bg-white/5 border border-white/10 rounded">
                          <p className="text-sm text-white/80 leading-relaxed">
                            {isEnhancing ? "Generiere Zusammenfassung..." : idea.aiSummary}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Hashtags */}
                    {(hashtags.length > 0 || isEnhancing) && (
                      <div>
                        <label className="text-xs text-white/60 mb-1.5 block">
                          AI-Hashtags
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                          {isEnhancing ? (
                            <span className="px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white/60">
                              Generiere Hashtags...
                            </span>
                          ) : (
                            hashtags.map((tag) => (
                              <span
                                key={tag}
                                className="px-2 py-1 bg-blue-500/20 border border-blue-500/30 rounded text-xs text-blue-300"
                              >
                                {tag}
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                    )}

                    {/* Original Description */}
                    <div>
                      <label className="text-xs text-white/60 mb-1.5 block">
                        Original-Beschreibung
                      </label>
                      <div className="px-3 py-2 bg-white/5 border border-white/10 rounded max-h-40 overflow-y-auto">
                        <p className="text-sm text-white/60 leading-relaxed whitespace-pre-wrap">
                          {idea.description}
                        </p>
                      </div>
                    </div>

                    {/* Metadata */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                      <div>
                        <span className="text-white/40">Autor:</span>
                        <p className="text-white/70">{idea.author}</p>
                      </div>
                      <div>
                        <span className="text-white/40">Status:</span>
                        <p className="text-white/70">{idea.status}</p>
                      </div>
                      <div>
                        <span className="text-white/40">Kommentare:</span>
                        <p className="text-white/70">{idea.comments}</p>
                      </div>
                      <div>
                        <span className="text-white/40">Erstellt:</span>
                        <p className="text-white/70">
                          {new Date(idea.createdAt).toLocaleDateString("de-DE")}
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          enhanceIdea(idea.id);
                        }}
                        disabled={isEnhancing}
                        className="px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 rounded text-xs text-blue-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                      >
                        <Sparkles size={12} />
                        {hasAI ? "Neu generieren" : "AI generieren"}
                      </button>
                      <a
                        href={idea.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 bg-white/10 hover:bg-white/15 border border-white/10 rounded text-xs text-white/80 transition-all"
                      >
                        Original ansehen
                      </a>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
