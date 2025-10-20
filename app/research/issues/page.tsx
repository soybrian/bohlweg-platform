"use client";

import { useState, useEffect, useRef } from "react";
import { Search, Filter, AlertTriangle, Activity, MapPin, ExternalLink, X, Sparkles } from "lucide-react";
import { cn, formatRelativeTime } from "@/lib/utils";
import { PlatformSummary } from "@/app/components/PlatformSummary";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { maengelQuickActions } from "@/lib/quick-actions";

interface Maengel {
  id: number;
  title: string;
  description: string;
  author: string;
  category: string;
  status: string;
  location: string;
  photoUrl?: string;
  createdAt: string;
  url: string;
  modified_at?: string;
  statusHistory?: string; // JSON array of { timestamp, status }
}

interface StatusHistoryEntry {
  timestamp: string;
  status: string;
}

interface MaengelHistory {
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

interface Stats {
  maengel: {
    total: number;
    byCategory: { category: string; count: number }[];
    byStatus: { status: string; count: number }[];
  };
}

export default function MaengelPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [buffer, setBuffer] = useState<Maengel[]>([]);
  const [displayedMaengel, setDisplayedMaengel] = useState<Maengel[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyData, setHistoryData] = useState<MaengelHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedMangel, setSelectedMangel] = useState<Maengel | null>(null);
  const [offset, setOffset] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [filteredStats, setFilteredStats] = useState<Stats | null>(null);
  const [showSearchInput, setShowSearchInput] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [customQuestion, setCustomQuestion] = useState("");
  const [customAnswer, setCustomAnswer] = useState<string>("");
  const [customAnswerLoading, setCustomAnswerLoading] = useState(false);
  const [customAnswerItemCount, setCustomAnswerItemCount] = useState<number>(0);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const answerContainerRef = useRef<HTMLDivElement | null>(null);
  const customInputRef = useRef<HTMLInputElement | null>(null);

  const ITEMS_TO_DISPLAY = 10;
  const ITEMS_TO_FETCH = 20;
  const MAX_BUFFER_SIZE = 100;

  // Debounced Search Effect
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Search/Filter Effect
  useEffect(() => {
    if (debouncedSearch || selectedCategory || selectedStatus) {
      handleSearch();
    } else if (!searchQuery && !selectedCategory && !selectedStatus) {
      setDisplayedMaengel(buffer.slice(0, ITEMS_TO_DISPLAY));
    }
  }, [debouncedSearch, selectedCategory, selectedStatus]);

  useEffect(() => {
    loadData();
  }, []);

  // Auto-scroll when streaming answer
  useEffect(() => {
    if (customAnswerLoading && answerContainerRef.current) {
      answerContainerRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [customAnswer, customAnswerLoading]);

  const loadData = async () => {
    try {
      const [maengelRes, statsRes] = await Promise.all([
        fetch(`/api/maengel?limit=${ITEMS_TO_FETCH}&offset=0`),
        fetch("/api/stats"),
      ]);

      if (maengelRes.ok) {
        const maengel = await maengelRes.json();
        const total = maengelRes.headers.get("X-Total-Count");

        setBuffer(maengel);
        setDisplayedMaengel(maengel.slice(0, ITEMS_TO_DISPLAY));
        setOffset(ITEMS_TO_FETCH);
        setTotalCount(total ? parseInt(total) : maengel.length);
      }
      if (statsRes.ok) setStats(await statsRes.json());
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.append("search", debouncedSearch);
      if (selectedCategory) params.append("category", selectedCategory);
      if (selectedStatus) params.append("status", selectedStatus);
      params.append("limit", "100");

      const res = await fetch(`/api/maengel?${params.toString()}`);
      if (res.ok) {
        const results = await res.json();
        setDisplayedMaengel(results);

        // Update filtered stats based on current results
        updateFilteredStats(results);
      }
    } catch (error) {
      console.error("Error searching:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateFilteredStats = (maengel: Maengel[]) => {
    // Count by category
    const categoryMap = new Map<string, number>();
    const statusMap = new Map<string, number>();

    maengel.forEach(m => {
      categoryMap.set(m.category, (categoryMap.get(m.category) || 0) + 1);
      statusMap.set(m.status, (statusMap.get(m.status) || 0) + 1);
    });

    setFilteredStats({
      maengel: {
        total: maengel.length,
        byCategory: Array.from(categoryMap.entries()).map(([category, count]) => ({ category, count })),
        byStatus: Array.from(statusMap.entries()).map(([status, count]) => ({ status, count }))
      }
    });
  };

  // Infinite Scroll
  useEffect(() => {
    if (searchQuery || selectedCategory || selectedStatus) return;

    let scrollTimeout: NodeJS.Timeout;
    const handleScroll = () => {
      if (loadingMore) return;

      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollHeight = document.documentElement.scrollHeight;
        const clientHeight = document.documentElement.clientHeight;

        if (scrollTop + clientHeight >= scrollHeight * 0.8) {
          loadMore();
        }
      }, 100);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      clearTimeout(scrollTimeout);
      window.removeEventListener("scroll", handleScroll);
    };
  }, [loadingMore, displayedMaengel.length, buffer.length, searchQuery, selectedCategory, selectedStatus, offset]);

  const loadMore = async () => {
    if (displayedMaengel.length >= totalCount) return;

    setLoadingMore(true);

    const currentDisplayed = displayedMaengel.length;
    const availableInBuffer = buffer.length;

    if (currentDisplayed < availableInBuffer) {
      setTimeout(() => {
        const nextItems = buffer.slice(0, currentDisplayed + ITEMS_TO_DISPLAY);
        setDisplayedMaengel(nextItems);
        setLoadingMore(false);
      }, 150);
    } else {
      try {
        const res = await fetch(`/api/maengel?limit=${ITEMS_TO_FETCH}&offset=${offset}`);
        if (res.ok) {
          const newMaengel = await res.json();
          let updatedBuffer = [...buffer, ...newMaengel];

          if (updatedBuffer.length > MAX_BUFFER_SIZE) {
            const itemsToRemove = updatedBuffer.length - MAX_BUFFER_SIZE;
            updatedBuffer = updatedBuffer.slice(itemsToRemove);

            const newDisplayed = updatedBuffer.slice(0, Math.min(currentDisplayed + ITEMS_TO_DISPLAY - itemsToRemove, updatedBuffer.length));
            setDisplayedMaengel(newDisplayed);
          } else {
            setDisplayedMaengel(updatedBuffer.slice(0, currentDisplayed + ITEMS_TO_DISPLAY));
          }

          setBuffer(updatedBuffer);
          setOffset(offset + ITEMS_TO_FETCH);
        }
      } catch (error) {
        console.error("Error loading more maengel:", error);
      } finally {
        setLoadingMore(false);
      }
    }
  };

  const loadHistory = async (id: number) => {
    setHistoryLoading(true);
    setShowHistoryModal(true);
    try {
      const res = await fetch(`/api/maengel/${id}/history`);
      if (res.ok) {
        const data = await res.json();
        setHistoryData(data);
      }
    } catch (error) {
      console.error("Error loading history:", error);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Stream AI answer
  const streamAnswer = async (question: string) => {
    if (!question.trim()) return;

    setCustomAnswerLoading(true);
    setCustomAnswer("");
    setCustomAnswerItemCount(0);

    try {
      const res = await fetch("/api/ask-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, itemType: "maengel" }),
      });

      if (!res.ok || !res.body) {
        console.error("Failed to fetch streaming response");
        return;
      }

      // Get item count from headers
      const itemCount = parseInt(res.headers.get("X-Item-Count") || "0");
      setCustomAnswerItemCount(itemCount);

      // Read the stream
      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        setCustomAnswer((prev) => prev + chunk);
      }
    } catch (error) {
      console.error("Error streaming answer:", error);
    } finally {
      setCustomAnswerLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      <div className="px-4 md:px-6">
        {/* Action Buttons - Minimal Icons */}
        <div className="flex gap-2 mb-3 justify-center">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "glass-card border-none w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 hover:bg-white/8",
              showFilters ? "text-white bg-white/8" : "text-white/60"
            )}
          >
            <Filter size={16} className="flex-shrink-0" />
          </button>
          <button
            onClick={() => {
              setShowSearchInput(!showSearchInput);
              if (!showSearchInput) {
                setSearchQuery("");
              }
            }}
            className={cn(
              "glass-card border-none w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 hover:bg-white/8",
              showSearchInput ? "text-white bg-white/8" : "text-white/60"
            )}
          >
            <Search size={16} className="flex-shrink-0" />
          </button>
          <button
            onClick={() => setShowSummary(!showSummary)}
            className={cn(
              "glass-card border-none w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 hover:bg-white/8",
              showSummary ? "text-white bg-white/8" : "text-white/60"
            )}
          >
            <Sparkles size={16} className="flex-shrink-0" />
          </button>
        </div>

        {/* Search Input Field */}
        <div
          className={cn(
            "grid transition-all duration-300 ease-out overflow-hidden",
            showSearchInput ? "grid-rows-[1fr] opacity-100 mb-3" : "grid-rows-[0fr] opacity-0 mb-0"
          )}
        >
          <div className="overflow-hidden">
            <div className="glass-card border border-white/10">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/30" size={14} />
                <input
                  type="text"
                  placeholder="Mängel durchsuchen..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent border-none pl-10 pr-3 py-2 text-white text-xs placeholder-white/30 focus:outline-none"
                  autoFocus={showSearchInput}
                />
              </div>
            </div>
          </div>
        </div>

        {/* AI Assistant Field */}
        <div
          className={cn(
            "grid transition-all duration-300 ease-out overflow-hidden",
            showSummary ? "grid-rows-[1fr] opacity-100 mb-3" : "grid-rows-[0fr] opacity-0 mb-0"
          )}
        >
          <div className="overflow-hidden">
            <div className="glass-card border border-blue-500/20 bg-blue-500/5">
              <div className="flex items-start gap-3">
                <Sparkles className="text-blue-400 flex-shrink-0 mt-0.5" size={16} />
                <div className="flex-1">
                  {/* Greeting or Answer */}
                  {!customAnswer && !customAnswerLoading ? (
                    <p className="text-sm text-white/70 mb-3">
                      Hi OG, wie kann ich helfen?
                    </p>
                  ) : (
                    <div className="mb-3" ref={answerContainerRef}>
                      {customAnswerLoading && !customAnswer ? (
                        <div className="space-y-1.5">
                          <div className="h-2.5 w-full bg-white/5 rounded animate-pulse"></div>
                          <div className="h-2.5 w-full bg-white/5 rounded animate-pulse"></div>
                          <div className="h-2.5 w-3/4 bg-white/5 rounded animate-pulse"></div>
                        </div>
                      ) : (
                        <>
                          <div className="prose prose-invert prose-sm max-w-none text-xs text-white/70 leading-relaxed">
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={{
                                p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                                ul: ({ children }) => <ul className="list-disc mb-2 space-y-1 pl-4">{children}</ul>,
                                ol: ({ children }) => <ol className="list-decimal mb-2 space-y-1 pl-4">{children}</ol>,
                                li: ({ children }) => <li className="text-white/70 pl-1">{children}</li>,
                                strong: ({ children }) => <strong className="text-white/90 font-semibold">{children}</strong>,
                                em: ({ children }) => <em className="text-white/80">{children}</em>,
                                code: ({ children }) => <code className="bg-white/10 px-1 py-0.5 rounded text-[11px] text-blue-300">{children}</code>,
                                pre: ({ children }) => <pre className="bg-white/5 p-2 rounded text-[11px] overflow-x-auto mb-2">{children}</pre>,
                              }}
                            >
                              {customAnswer}
                            </ReactMarkdown>
                            {customAnswerLoading && (
                              <span className="inline-block w-1 h-3 bg-blue-400 ml-0.5 animate-pulse"></span>
                            )}
                          </div>
                          {customAnswerItemCount > 0 && !customAnswerLoading && (
                            <p className="text-[10px] text-white/40 mt-2">
                              Basierend auf {customAnswerItemCount} Mängeln
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {/* Quick Action Buttons */}
                  <div
                    className={cn(
                      "grid transition-all duration-500 ease-out overflow-hidden",
                      !customAnswerLoading ? "grid-rows-[1fr] opacity-100 mb-3" : "grid-rows-[0fr] opacity-0 mb-0"
                    )}
                  >
                    <div className="overflow-hidden">
                      <div className="flex flex-wrap gap-1.5">
                        {maengelQuickActions.map((action) => (
                          <button
                            key={action.label}
                            onClick={() => streamAnswer(action.question)}
                            className="px-2 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded text-[10px] text-white/60 hover:text-white/80 transition-all"
                          >
                            {action.label}
                          </button>
                        ))}
                        <button
                          onClick={() => {
                            setShowCustomInput(!showCustomInput);
                            if (!showCustomInput) {
                              setTimeout(() => {
                                if (customInputRef.current) {
                                  customInputRef.current.focus();
                                }
                              }, 100);
                            }
                          }}
                          className={cn(
                            "px-2 py-1.5 border rounded text-[10px] transition-all",
                            showCustomInput
                              ? "bg-blue-500/30 border-blue-500/40 text-blue-200"
                              : "bg-blue-500/20 hover:bg-blue-500/30 border-blue-500/30 hover:border-blue-500/40 text-blue-300 hover:text-blue-200"
                          )}
                        >
                          {showCustomInput ? "− Schließen" : "+ Eigene Frage"}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Custom Question Input */}
                  <div
                    className={cn(
                      "grid transition-all duration-300 ease-out overflow-hidden",
                      showCustomInput ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                    )}
                  >
                    <div className="overflow-hidden">
                      <div className={cn(!customAnswer && !customAnswerLoading ? "" : "pt-3 border-t border-white/10")}>
                        <div className="flex gap-2">
                          <input
                            ref={customInputRef}
                            type="text"
                            placeholder="Stelle eine eigene Frage..."
                            value={customQuestion}
                            onChange={(e) => setCustomQuestion(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && customQuestion.trim()) {
                                streamAnswer(customQuestion);
                              }
                            }}
                            className="flex-1 bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-xs placeholder-white/30 focus:outline-none focus:border-blue-400/50 transition-colors"
                          />
                          <button
                            onClick={() => streamAnswer(customQuestion)}
                            disabled={!customQuestion.trim() || customAnswerLoading}
                            className="px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 disabled:bg-white/5 disabled:text-white/30 text-blue-300 rounded text-xs font-medium transition-colors disabled:cursor-not-allowed"
                          >
                            Fragen
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Options */}
        <div
          className={cn(
            "grid transition-all duration-300 ease-in-out mb-3",
            showFilters ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
          )}
        >
          <div className="overflow-hidden">
            <div className="glass-card border border-white/10">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-medium text-white/80">Filter</h3>
                </div>
                {(selectedCategory || selectedStatus) && (
                  <button
                    onClick={() => {
                      setSelectedCategory("");
                      setSelectedStatus("");
                    }}
                    className="text-[10px] text-white/50 hover:text-white/80 transition-colors"
                  >
                    Zurücksetzen
                  </button>
                )}
              </div>
              <div className="space-y-3">
                {/* Status Filter */}
                <div>
                  <label className="text-[10px] text-white/50 mb-1.5 block">Status</label>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => setSelectedStatus("")}
                      className={cn(
                        "px-2 py-1 rounded text-[10px] transition-all",
                        !selectedStatus
                          ? "bg-blue-500/30 text-blue-200"
                          : "bg-white/5 text-white/60 hover:bg-white/10"
                      )}
                    >
                      Alle
                    </button>
                    {(filteredStats || stats)?.maengel.byStatus.map((status) => (
                      <button
                        key={status.status}
                        onClick={() => setSelectedStatus(status.status)}
                        className={cn(
                          "px-2 py-1 rounded text-[10px] transition-all flex items-center gap-1",
                          selectedStatus === status.status
                            ? "bg-blue-500/30 text-blue-200"
                            : "bg-white/5 text-white/60 hover:bg-white/10"
                        )}
                      >
                        {status.status === "Erledigt / beauftragt" ? "Erledigt" :
                         status.status === "in Bearbeitung" ? "In Bearbeitung" :
                         status.status === "Das Anliegen ist derzeit nicht Bestandteil des Mängelmelders" ? "Abgelehnt" :
                         status.status}
                        <span className="text-[9px] text-white/40">({status.count})</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Category Filter */}
                <div>
                  <label className="text-[10px] text-white/50 mb-1.5 block">Kategorie</label>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => setSelectedCategory("")}
                      className={cn(
                        "px-2 py-1 rounded text-[10px] transition-all",
                        !selectedCategory
                          ? "bg-blue-500/30 text-blue-200"
                          : "bg-white/5 text-white/60 hover:bg-white/10"
                      )}
                    >
                      Alle
                    </button>
                    {(filteredStats || stats)?.maengel.byCategory.map((cat) => (
                      <button
                        key={cat.category}
                        onClick={() => setSelectedCategory(cat.category)}
                        className={cn(
                          "px-2 py-1 rounded text-[10px] transition-all flex items-center gap-1",
                          selectedCategory === cat.category
                            ? "bg-blue-500/30 text-blue-200"
                            : "bg-white/5 text-white/60 hover:bg-white/10"
                        )}
                      >
                        {cat.category}
                        <span className="text-[9px] text-white/40">({cat.count})</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-3 mb-8">
          {loading ? (
            <>
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="glass-card border border-white/10 animate-in fade-in slide-in-from-bottom-2 duration-500"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="h-3 w-24 bg-white/5 rounded animate-pulse mb-1"></div>
                      <div className="h-4 w-3/4 bg-white/10 rounded animate-pulse"></div>
                    </div>
                    <div className="h-5 w-16 bg-white/5 rounded animate-pulse flex-shrink-0"></div>
                  </div>

                  <div className="flex gap-3 mb-3">
                    <div className="flex-1">
                      <div className="h-3 w-32 bg-white/5 rounded animate-pulse mb-1.5"></div>
                      <div className="space-y-1.5">
                        <div className="h-3 w-full bg-white/5 rounded animate-pulse"></div>
                        <div className="h-3 w-4/5 bg-white/5 rounded animate-pulse"></div>
                      </div>
                    </div>
                    <div className="w-16 h-16 bg-white/5 rounded animate-pulse flex-shrink-0"></div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="h-3 w-24 bg-white/5 rounded animate-pulse"></div>
                    <div className="h-3 w-12 bg-white/5 rounded animate-pulse"></div>
                  </div>
                </div>
              ))}
            </>
          ) : displayedMaengel.length === 0 ? (
            <div className="glass-card text-center py-10 border border-white/10">
              <AlertTriangle className="mx-auto mb-2 text-white/20" size={32} />
              <p className="text-white/30 text-xs">Keine Mängel gefunden</p>
            </div>
          ) : (
            displayedMaengel.map((m, index) => (
              <div
                key={m.id}
                className="glass-card hover:bg-white/5 transition-all border border-white/10 animate-in fade-in slide-in-from-bottom-2 duration-300"
                style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}
              >
                {/* Header: Date and Title */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] text-white/40 mb-1">
                      {formatRelativeTime(m.createdAt)}
                    </div>
                    <h3 className="text-sm font-medium text-white leading-snug">
                      {m.title}
                    </h3>
                  </div>

                  {/* Status Badge */}
                  <div className="flex-shrink-0">
                    {m.status === "Erledigt / beauftragt" ? (
                      <span className="flex items-center gap-1 px-2 py-1 bg-white/5 rounded text-[10px] text-white/50">
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-green-500">
                          <circle cx="12" cy="12" r="10"/>
                          <polyline points="9 12 11 14 15 10"/>
                        </svg>
                        Erledigt
                      </span>
                    ) : m.status === "in Bearbeitung" ? (
                      <span className="flex items-center gap-1 px-2 py-1 bg-white/5 rounded text-[10px] text-white/50">
                        <svg width="6" height="6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-yellow-500">
                          <circle cx="12" cy="12" r="10"/>
                          <polyline points="12 6 12 12 16 14"/>
                        </svg>
                        In Bearbeitung
                      </span>
                    ) : m.status === "Das Anliegen ist derzeit nicht Bestandteil des Mängelmelders" ? (
                      <span className="flex items-center gap-1 px-2 py-1 bg-white/5 rounded text-[10px] text-white/50">
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-red-500">
                          <circle cx="12" cy="12" r="10"/>
                          <line x1="15" y1="9" x2="9" y2="15"/>
                          <line x1="9" y1="9" x2="15" y2="15"/>
                        </svg>
                        Abgelehnt
                      </span>
                    ) : (
                      <div className="px-2 py-1 bg-white/5 rounded text-[10px] text-white/50 whitespace-nowrap">
                        {m.status}
                      </div>
                    )}
                  </div>
                </div>

                {/* Location and Description */}
                <div className="flex gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    {m.location && (
                      <div className="flex items-center gap-1 mb-1.5">
                        <MapPin className="text-white/40 flex-shrink-0" size={11} />
                        <span className="text-[11px] text-white/50 truncate">{m.location}</span>
                      </div>
                    )}
                    <p className="text-xs text-white/70 leading-relaxed line-clamp-3">
                      {m.description}
                    </p>
                  </div>

                  {m.photoUrl && (
                    <div className="flex-shrink-0">
                      <img
                        src={m.photoUrl}
                        alt={m.title}
                        className="w-20 h-20 object-cover rounded border border-white/10"
                      />
                    </div>
                  )}
                </div>

                {/* Footer: Category, Author and Details */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-wrap text-[10px] text-white/50">
                    <span>{m.author}</span>
                    {m.category && (
                      <>
                        <span className="text-white/30">·</span>
                        <span>{m.category}</span>
                      </>
                    )}
                  </div>

                  {/* Details Text Link - Far Right */}
                  <button
                    onClick={() => {
                      setSelectedMangel(m);
                      setShowDetailModal(true);
                    }}
                    className="text-[10px] text-white/40 hover:text-white/70 transition-colors"
                  >
                    Details
                  </button>
                </div>
              </div>
            ))
          )}

          {/* Loading More Indicator */}
          {!searchQuery && !selectedCategory && !selectedStatus && loadingMore && (
            <>
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="glass-card border border-white/10 animate-in fade-in slide-in-from-bottom-2 duration-500"
                  style={{ animationDelay: `${i * 100}ms` }}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="h-3 w-24 bg-white/5 rounded animate-pulse mb-1"></div>
                      <div className="h-4 w-3/4 bg-white/10 rounded animate-pulse"></div>
                    </div>
                    <div className="h-5 w-16 bg-white/5 rounded animate-pulse flex-shrink-0"></div>
                  </div>

                  <div className="flex gap-3 mb-3">
                    <div className="flex-1">
                      <div className="h-3 w-32 bg-white/5 rounded animate-pulse mb-1.5"></div>
                      <div className="space-y-1.5">
                        <div className="h-3 w-full bg-white/5 rounded animate-pulse"></div>
                        <div className="h-3 w-4/5 bg-white/5 rounded animate-pulse"></div>
                      </div>
                    </div>
                    <div className="w-16 h-16 bg-white/5 rounded animate-pulse flex-shrink-0"></div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="h-3 w-24 bg-white/5 rounded animate-pulse"></div>
                    <div className="h-3 w-12 bg-white/5 rounded animate-pulse"></div>
                  </div>
                </div>
              ))}
            </>
          )}

          {/* End of List Indicator */}
          {!searchQuery && !selectedCategory && !selectedStatus && !loadingMore && displayedMaengel.length >= totalCount && totalCount > ITEMS_TO_DISPLAY && (
            <div className="text-center py-4">
              <p className="text-white/30 text-xs">Alle Mängel geladen</p>
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal - Fullscreen */}
      {showDetailModal && selectedMangel && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-lg z-50 animate-in fade-in duration-300"
          onClick={() => {
            setShowDetailModal(false);
            setSelectedMangel(null);
          }}
        >
          <div
            className="h-full w-full overflow-y-auto animate-in slide-in-from-bottom-10 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="min-h-full px-4 md:px-6 py-4">
              {/* Header with close button - sticky */}
              <div className="glass-card sticky top-4 z-10 mb-4 border border-white/10 animate-in fade-in duration-200" style={{ animationDelay: '50ms' }}>
                <div className="flex items-center justify-between">
                  <div className="text-[10px] text-white/40 uppercase tracking-wide font-medium">
                    Details
                  </div>
                  <button
                    onClick={() => {
                      setShowDetailModal(false);
                      setSelectedMangel(null);
                    }}
                    className="p-1.5 hover:bg-white/10 rounded transition-all"
                  >
                    <X size={16} className="text-white/40 hover:text-white/70" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="space-y-3 animate-in fade-in duration-200" style={{ animationDelay: '100ms' }}>
                {/* Title */}
                <div className="glass-card border border-white/10">
                  <div className="text-[9px] text-white/40 uppercase tracking-wide font-medium mb-1.5">
                    Titel
                  </div>
                  <h3 className="text-sm font-medium text-white/90 leading-snug">
                    {selectedMangel.title}
                  </h3>
                </div>

                {/* Photo */}
                {selectedMangel.photoUrl && (
                  <div className="glass-card border border-white/10">
                    <div className="text-[9px] text-white/40 uppercase tracking-wide font-medium mb-1.5">
                      Foto
                    </div>
                    <img
                      src={selectedMangel.photoUrl}
                      alt={selectedMangel.title}
                      className="w-full rounded border border-white/10"
                    />
                  </div>
                )}

                {/* Description */}
                <div className="glass-card border border-white/10">
                  <div className="text-[9px] text-white/40 uppercase tracking-wide font-medium mb-1.5">
                    Beschreibung
                  </div>
                  <p className="text-xs text-white/70 leading-relaxed whitespace-pre-wrap">
                    {selectedMangel.description}
                  </p>
                </div>

                {/* Status History Timeline */}
                {selectedMangel.statusHistory && (() => {
                  try {
                    const history = JSON.parse(selectedMangel.statusHistory) as StatusHistoryEntry[];
                    if (history.length > 0) {
                      return (
                        <div className="glass-card border border-white/10">
                          <div className="text-[9px] text-white/40 uppercase tracking-wide font-medium mb-2">
                            Bearbeitungshistorie
                          </div>
                          <div className="relative">
                            {history.map((entry, index) => (
                              <div key={index} className="flex gap-3 pb-3">
                                {/* Timeline Line */}
                                <div className="flex flex-col items-center">
                                  <div className="w-2 h-2 rounded-full bg-white/30 border-2 border-white/50 flex-shrink-0 mt-1"></div>
                                  {index < history.length - 1 && (
                                    <div className="w-px h-full bg-white/10 flex-grow"></div>
                                  )}
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0 pb-2">
                                  <div className="flex items-center justify-between gap-2 mb-1">
                                    <span className="text-xs text-white/70 font-medium">{entry.status}</span>
                                    <span className="text-[10px] text-white/40">{entry.timestamp}</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }
                  } catch (e) {
                    console.error("Failed to parse statusHistory:", e);
                  }
                  return null;
                })()}

                {/* Metadata Grid */}
                <div className="glass-card border border-white/10">
                  <div className="grid grid-cols-2 gap-3">
                    {selectedMangel.location && (
                      <div className="space-y-1">
                        <div className="text-[9px] text-white/40 uppercase tracking-wide">Standort</div>
                        <div className="flex items-center gap-1.5">
                          <MapPin size={12} className="text-white/50" />
                          <p className="text-sm text-white/80">{selectedMangel.location}</p>
                        </div>
                      </div>
                    )}
                    {selectedMangel.category && (
                      <div className="space-y-1">
                        <div className="text-[9px] text-white/40 uppercase tracking-wide">Kategorie</div>
                        <p className="text-sm text-white/80">{selectedMangel.category}</p>
                      </div>
                    )}
                    <div className="space-y-1">
                      <div className="text-[9px] text-white/40 uppercase tracking-wide">Autor</div>
                      <p className="text-sm text-white/80">{selectedMangel.author}</p>
                    </div>
                    <div className="space-y-1">
                      <div className="text-[9px] text-white/40 uppercase tracking-wide">Gemeldet am</div>
                      <p className="text-sm text-white/80">{formatRelativeTime(selectedMangel.createdAt)}</p>
                    </div>
                  </div>
                </div>

                {/* Status */}
                <div className="glass-card border border-white/10">
                  <div className="text-[9px] text-white/40 uppercase tracking-wide font-medium mb-2">Status</div>
                  {selectedMangel.status === "Erledigt / beauftragt" ? (
                    <span className="text-[10px] text-white/50 flex items-center gap-1">
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-green-500">
                        <circle cx="12" cy="12" r="10"/>
                        <polyline points="9 12 11 14 15 10"/>
                      </svg>
                      Erledigt
                    </span>
                  ) : selectedMangel.status === "in Bearbeitung" ? (
                    <span className="text-[10px] text-white/50 flex items-center gap-1">
                      <svg width="6" height="6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-yellow-500">
                        <circle cx="12" cy="12" r="10"/>
                        <polyline points="12 6 12 12 16 14"/>
                      </svg>
                      In Bearbeitung
                    </span>
                  ) : selectedMangel.status === "Das Anliegen ist derzeit nicht Bestandteil des Mängelmelders" ? (
                    <span className="text-[10px] text-white/50 flex items-center gap-1">
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-red-500">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="15" y1="9" x2="9" y2="15"/>
                        <line x1="9" y1="9" x2="15" y2="15"/>
                      </svg>
                      Abgelehnt
                    </span>
                  ) : (
                    <span className="text-[10px] text-white/50">{selectedMangel.status}</span>
                  )}
                </div>

                {/* Link to Original */}
                <div className="glass-card border border-white/10">
                  <a
                    href={selectedMangel.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between group"
                  >
                    <div>
                      <div className="text-[9px] text-white/40 uppercase tracking-wide font-medium mb-1">Mehr erfahren</div>
                      <div className="text-xs text-blue-300 group-hover:text-blue-200 transition-colors">
                        Zum Original-Mangel
                      </div>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-400 group-hover:translate-x-1 transition-transform">
                      <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                  </a>
                </div>

                {/* History Link */}
                {selectedMangel.modified_at && (
                  <div className="glass-card border border-white/10">
                    <button
                      onClick={() => {
                        setShowDetailModal(false);
                        loadHistory(selectedMangel.id);
                      }}
                      className="w-full text-left flex items-center justify-between group"
                    >
                      <div>
                        <div className="text-[9px] text-white/40 uppercase tracking-wide font-medium mb-1">Änderungsverlauf</div>
                        <div className="text-xs text-blue-300 group-hover:text-blue-200 transition-colors">
                          Verlauf anzeigen
                        </div>
                      </div>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-400 group-hover:translate-x-1 transition-transform">
                        <path d="M5 12h14M12 5l7 7-7 7"/>
                      </svg>
                    </button>
                  </div>
                )}
              </div>

              {/* Bottom spacing */}
              <div className="h-8"></div>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-white/10">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-medium text-white">Änderungsverlauf</h2>
              <button
                onClick={() => {
                  setShowHistoryModal(false);
                  setHistoryData([]);
                }}
                className="px-2.5 py-1 bg-white/10 hover:bg-white/15 rounded-lg text-white text-xs transition-colors border border-white/10"
              >
                Schließen
              </button>
            </div>

            {historyLoading ? (
              <div className="text-center py-6">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-white/10 border-t-white/50 mx-auto mb-2"></div>
                <p className="text-white/40 text-xs">Lade Verlauf...</p>
              </div>
            ) : historyData.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-white/40 text-xs">Keine Änderungen gefunden</p>
              </div>
            ) : (
              <div className="space-y-2">
                {historyData.map((history, index) => (
                  <div key={history.id} className="bg-white/5 rounded-lg p-2.5 border border-white/10">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 bg-white/10 rounded text-[10px] text-white/80 border border-white/10">
                          Version {historyData.length - index}
                        </span>
                        <span className="text-[10px] text-white/50">
                          {formatRelativeTime(history.changed_at)}
                        </span>
                      </div>
                      <span className="px-1.5 py-0.5 bg-white/10 rounded text-[10px] text-white/80 border border-white/10">
                        {history.status}
                      </span>
                    </div>
                    <h3 className="text-sm font-medium text-white mb-1.5">{history.title}</h3>
                    <p className="text-xs text-white/60 mb-1.5">{history.description}</p>
                    <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-white/50">
                      <span>{history.author}</span>
                      <span>·</span>
                      <span>{history.category}</span>
                      <span>·</span>
                      <span>{history.location}</span>
                    </div>
                    {history.photoUrl && (
                      <div className="mt-2">
                        <img
                          src={history.photoUrl}
                          alt={history.title}
                          className="w-32 h-32 object-cover rounded border border-white/10"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
