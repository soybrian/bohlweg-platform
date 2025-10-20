"use client";

import { useState, useEffect, useRef } from "react";
import { Search, Menu, X, Filter, MessageCircle, Sparkles } from "lucide-react";
import { cn, formatRelativeTime } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ideenQuickActions } from "@/lib/quick-actions";

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
  commentsData?: string;
  createdAt: string;
  url: string;
  aiSummary?: string;
  aiHashtags?: string;
  aiTitle?: string;
}

interface Comment {
  author: string;
  text: string;
  date: string;
  isModerator?: boolean;
}

export default function IdeenPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [buffer, setBuffer] = useState<Idea[]>([]);
  const [displayedIdeas, setDisplayedIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const ITEMS_TO_DISPLAY = 10;
  const ITEMS_TO_FETCH = 20;
  const MAX_BUFFER_SIZE = 100;

  // Hashtag Filter
  const [selectedHashtags, setSelectedHashtags] = useState<string[]>([]);
  const [availableHashtags, setAvailableHashtags] = useState<{ tag: string; count: number }[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  // Sort and Filter Options
  const [sortBy, setSortBy] = useState<"newest" | "supporters" | "comments">("newest");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  // Details Modal
  const [selectedIdea, setSelectedIdea] = useState<Idea | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Expanded Comments (accordion style)
  const [expandedComments, setExpandedComments] = useState<number | null>(null);

  // AI Summary
  const [showSummary, setShowSummary] = useState(false);
  const [customQuestion, setCustomQuestion] = useState("");
  const [customAnswer, setCustomAnswer] = useState<string>("");
  const [customAnswerLoading, setCustomAnswerLoading] = useState(false);
  const [customAnswerItemCount, setCustomAnswerItemCount] = useState<number>(0);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const answerContainerRef = useRef<HTMLDivElement | null>(null);
  const customInputRef = useRef<HTMLInputElement | null>(null);

  // Search Input
  const [showSearchInput, setShowSearchInput] = useState(false);

  // Debounced Search Effect
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Search Effect
  useEffect(() => {
    if (debouncedSearch) {
      handleSearch(debouncedSearch);
    } else if (!searchQuery) {
      // Reset to buffer when search is cleared
      setDisplayedIdeas(buffer.slice(0, ITEMS_TO_DISPLAY));
    }
  }, [debouncedSearch]);

  useEffect(() => {
    loadData();
    loadHashtags();
  }, []);

  // Reload data when filters change
  useEffect(() => {
    loadData();
  }, [selectedHashtags, sortBy, statusFilter]);

  // Auto-scroll when streaming answer
  useEffect(() => {
    if (customAnswerLoading && answerContainerRef.current) {
      answerContainerRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [customAnswer, customAnswerLoading]);

  const loadHashtags = async () => {
    try {
      const res = await fetch("/api/ideas/hashtags");
      if (res.ok) {
        const data = await res.json();
        setAvailableHashtags(data.hashtags || []);
      }
    } catch (error) {
      console.error("Error loading hashtags:", error);
    }
  };

  const buildApiUrl = (limit: number, offset: number) => {
    const params = new URLSearchParams();
    params.append("limit", limit.toString());
    params.append("offset", offset.toString());
    params.append("sortBy", sortBy);

    if (selectedHashtags.length > 0) {
      params.append("hashtags", selectedHashtags.join(","));
    }

    if (statusFilter) {
      params.append("status", statusFilter);
    }

    return `/api/ideas?${params.toString()}`;
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch(buildApiUrl(ITEMS_TO_FETCH, 0));

      if (res.ok) {
        const ideas = await res.json();
        const total = res.headers.get("X-Total-Count");

        setBuffer(ideas);
        setDisplayedIdeas(ideas.slice(0, ITEMS_TO_DISPLAY));
        setOffset(ITEMS_TO_FETCH);
        setTotalCount(total ? parseInt(total) : ideas.length);
      }
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setDisplayedIdeas(buffer.slice(0, ITEMS_TO_DISPLAY));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/ideas?search=${encodeURIComponent(query)}&limit=100`);
      if (res.ok) {
        const results = await res.json();
        setDisplayedIdeas(results);
      }
    } catch (error) {
      console.error("Error searching:", error);
    } finally {
      setLoading(false);
    }
  };

  // Debounced Scroll Handler
  useEffect(() => {
    if (searchQuery) return;

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
  }, [loadingMore, displayedIdeas.length, buffer.length, searchQuery, offset]);

  const loadMore = async () => {
    if (displayedIdeas.length >= totalCount) return;

    setLoadingMore(true);

    const currentDisplayed = displayedIdeas.length;
    const availableInBuffer = buffer.length;

    if (currentDisplayed < availableInBuffer) {
      setTimeout(() => {
        const nextItems = buffer.slice(0, currentDisplayed + ITEMS_TO_DISPLAY);
        setDisplayedIdeas(nextItems);
        setLoadingMore(false);
      }, 150);
    } else {
      try {
        const res = await fetch(buildApiUrl(ITEMS_TO_FETCH, offset));
        if (res.ok) {
          const newIdeas = await res.json();
          let updatedBuffer = [...buffer, ...newIdeas];

          if (updatedBuffer.length > MAX_BUFFER_SIZE) {
            const itemsToRemove = updatedBuffer.length - MAX_BUFFER_SIZE;
            updatedBuffer = updatedBuffer.slice(itemsToRemove);

            const newDisplayed = updatedBuffer.slice(0, Math.min(currentDisplayed + ITEMS_TO_DISPLAY - itemsToRemove, updatedBuffer.length));
            setDisplayedIdeas(newDisplayed);
          } else {
            setDisplayedIdeas(updatedBuffer.slice(0, currentDisplayed + ITEMS_TO_DISPLAY));
          }

          setBuffer(updatedBuffer);
          setOffset(offset + ITEMS_TO_FETCH);
        }
      } catch (error) {
        console.error("Error loading more ideas:", error);
      } finally {
        setLoadingMore(false);
      }
    }
  };

  const toggleHashtag = (hashtag: string) => {
    setSelectedHashtags((prev) =>
      prev.includes(hashtag) ? prev.filter((h) => h !== hashtag) : [...prev, hashtag]
    );
  };

  const clearFilters = () => {
    setSelectedHashtags([]);
  };

  const parseHashtags = (hashtagsJson: string | undefined): string[] => {
    if (!hashtagsJson) return [];
    try {
      return JSON.parse(hashtagsJson);
    } catch {
      return [];
    }
  };

  const parseComments = (commentsJson: string | undefined): Comment[] => {
    if (!commentsJson) return [];
    try {
      const comments = JSON.parse(commentsJson);
      // Sort comments by date (newest first)
      return comments.sort((a: Comment, b: Comment) => {
        if (!a.date || !b.date) return 0;
        // Parse German date format: "Fr., 30.06.2023 - 19:32"
        const parseGermanDate = (dateStr: string) => {
          const match = dateStr.match(/(\d{2})\.(\d{2})\.(\d{4})\s+-\s+(\d{2}):(\d{2})/);
          if (!match) return new Date(0);
          const [, day, month, year, hour, minute] = match;
          return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute));
        };
        return parseGermanDate(b.date).getTime() - parseGermanDate(a.date).getTime();
      });
    } catch {
      return [];
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
        body: JSON.stringify({ question, itemType: "ideas" }),
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

  // Function to convert URLs in text to clickable links with shortened display
  const linkifyText = (text: string) => {
    if (!text) return text;

    // Regular expression to match URLs
    const urlRegex = /(https?:\/\/[^\s]+)/g;

    const parts = text.split(urlRegex);

    return parts.map((part, index) => {
      if (part.match(urlRegex)) {
        // Shorten URL for display
        let displayUrl = part;
        try {
          const url = new URL(part);
          displayUrl = url.hostname + (url.pathname !== '/' ? '/...' : '');
          // Limit to 30 characters
          if (displayUrl.length > 30) {
            displayUrl = displayUrl.substring(0, 27) + '...';
          }
        } catch {
          // If URL parsing fails, just truncate
          if (part.length > 30) {
            displayUrl = part.substring(0, 27) + '...';
          }
        }

        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-300 hover:text-blue-200 underline transition-colors"
          >
            {displayUrl}
          </a>
        );
      }
      return part;
    });
  };

  // Generate consistent color for repeat commenters
  const getAuthorColor = (author: string, comments: Comment[]) => {
    // Skip moderators (both "Moderator" and "Moderation")
    if (author === 'Moderator' || author === 'Moderation') return null;

    // Count how many times this author has commented
    const authorCount = comments.filter(c => c.author === author).length;
    if (authorCount < 2) return null;

    // Generate consistent hue based on author name
    let hash = 0;
    for (let i = 0; i < author.length; i++) {
      hash = author.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);

    return {
      border: `hsl(${hue}, 60%, 50%)`,
      bg: `hsl(${hue}, 60%, 50%, 0.08)`,
      text: `hsl(${hue}, 70%, 75%)`
    };
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
                  placeholder="Ideen durchsuchen..."
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
                              Basierend auf {customAnswerItemCount} Ideen
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
                        {ideenQuickActions.map((action) => (
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

        {/* Filter & Sort Options */}
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
                  <h3 className="text-xs font-medium text-white/80">Filter & Sortierung</h3>
                </div>
                {(selectedHashtags.length > 0 || statusFilter) && (
                  <button
                    onClick={() => {
                      setSelectedHashtags([]);
                      setStatusFilter(null);
                    }}
                    className="text-[10px] text-white/50 hover:text-white/80 transition-colors"
                  >
                    Zurücksetzen
                  </button>
                )}
              </div>
              <div className="space-y-3">
              {/* Sort Options */}
              <div>
                <label className="text-[10px] text-white/50 mb-1.5 block">Sortieren nach</label>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setSortBy("newest")}
                    className={cn(
                      "px-2 py-1 rounded text-[10px] transition-all",
                      sortBy === "newest"
                        ? "bg-blue-500/30 text-blue-200"
                        : "bg-white/5 text-white/60 hover:bg-white/10"
                    )}
                  >
                    Neueste
                  </button>
                  <button
                    onClick={() => setSortBy("supporters")}
                    className={cn(
                      "px-2 py-1 rounded text-[10px] transition-all",
                      sortBy === "supporters"
                        ? "bg-blue-500/30 text-blue-200"
                        : "bg-white/5 text-white/60 hover:bg-white/10"
                    )}
                  >
                    Meiste Unterstützer
                  </button>
                  <button
                    onClick={() => setSortBy("comments")}
                    className={cn(
                      "px-2 py-1 rounded text-[10px] transition-all",
                      sortBy === "comments"
                        ? "bg-blue-500/30 text-blue-200"
                        : "bg-white/5 text-white/60 hover:bg-white/10"
                    )}
                  >
                    Meiste Kommentare
                  </button>
                </div>
              </div>

              {/* Status Filter */}
              <div>
                <label className="text-[10px] text-white/50 mb-1.5 block">Status Filter</label>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setStatusFilter(null)}
                    className={cn(
                      "px-2 py-1 rounded text-[10px] transition-all",
                      !statusFilter
                        ? "bg-blue-500/30 text-blue-200"
                        : "bg-white/5 text-white/60 hover:bg-white/10"
                    )}
                  >
                    Alle
                  </button>
                  <button
                    onClick={() => setStatusFilter("Zeitraum für Stimmabgabe überschritten")}
                    className={cn(
                      "px-2 py-1 rounded text-[10px] transition-all",
                      statusFilter === "Zeitraum für Stimmabgabe überschritten"
                        ? "bg-blue-500/30 text-blue-200"
                        : "bg-white/5 text-white/60 hover:bg-white/10"
                    )}
                  >
                    Abgelaufen
                  </button>
                  <button
                    onClick={() => setStatusFilter("Die Idee wird den politischen Gremien zur Entscheidung vorgelegt")}
                    className={cn(
                      "px-2 py-1 rounded text-[10px] transition-all",
                      statusFilter === "Die Idee wird den politischen Gremien zur Entscheidung vorgelegt"
                        ? "bg-blue-500/30 text-blue-200"
                        : "bg-white/5 text-white/60 hover:bg-white/10"
                    )}
                  >
                    In Prüfung
                  </button>
                  <button
                    onClick={() => setStatusFilter("Umgesetzt")}
                    className={cn(
                      "px-2 py-1 rounded text-[10px] transition-all",
                      statusFilter === "Umgesetzt"
                        ? "bg-blue-500/30 text-blue-200"
                        : "bg-white/5 text-white/60 hover:bg-white/10"
                    )}
                  >
                    Umgesetzt
                  </button>
                  <button
                    onClick={() => setStatusFilter("Abgelehnt")}
                    className={cn(
                      "px-2 py-1 rounded text-[10px] transition-all",
                      statusFilter === "Abgelehnt"
                        ? "bg-blue-500/30 text-blue-200"
                        : "bg-white/5 text-white/60 hover:bg-white/10"
                    )}
                  >
                    Abgelehnt
                  </button>
                  <button
                    onClick={() => setStatusFilter("Wird bei zukünftigen Planungen berücksichtigt")}
                    className={cn(
                      "px-2 py-1 rounded text-[10px] transition-all",
                      statusFilter === "Wird bei zukünftigen Planungen berücksichtigt"
                        ? "bg-blue-500/30 text-blue-200"
                        : "bg-white/5 text-white/60 hover:bg-white/10"
                    )}
                  >
                    Geplant
                  </button>
                </div>
              </div>

              {/* Hashtag Filter */}
              {availableHashtags.length > 0 && (
                <div>
                  <label className="text-[10px] text-white/50 mb-1.5 block">Hashtags</label>
                  <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                    {availableHashtags.slice(0, 30).map(({ tag, count }) => (
                      <button
                        key={tag}
                        onClick={() => toggleHashtag(tag)}
                        className={cn(
                          "px-2 py-1 rounded text-[10px] transition-all flex items-center gap-1",
                          selectedHashtags.includes(tag)
                            ? "bg-blue-500/30 text-blue-200"
                            : "bg-white/5 text-white/60 hover:bg-white/10"
                        )}
                      >
                        {tag}
                        <span className="text-[9px] text-white/40">({count})</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              </div>
            </div>
          </div>
        </div>

        {/* Ideas List */}
        <div className="space-y-3 mb-8">
          {loading ? (
            <>
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="glass-card border border-white/10 animate-in fade-in slide-in-from-bottom-2 duration-500"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  {/* Header: Date and Gauge */}
                  <div className="flex items-start justify-between mb-3">
                    {/* Left: Date and Title */}
                    <div className="flex-1 min-w-0">
                      <div className="h-3 w-32 bg-white/5 rounded animate-pulse mb-1"></div>
                      <div className="h-4 w-4/5 bg-white/10 rounded animate-pulse"></div>
                    </div>

                    {/* Right: Supporters Gauge Skeleton */}
                    <div className="flex-shrink-0 ml-3">
                      <div className="relative w-16 flex flex-col items-center">
                        {/* SVG Semi-circle skeleton */}
                        <div className="w-16 h-10 bg-white/5 rounded-t-full animate-pulse"></div>
                        {/* Numbers skeleton */}
                        <div className="mt-0.5 text-center space-y-1">
                          <div className="h-4 w-6 bg-white/10 rounded animate-pulse mx-auto"></div>
                          <div className="h-2 w-12 bg-white/5 rounded animate-pulse"></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="mb-3">
                    <div className="h-2.5 w-28 bg-white/5 rounded animate-pulse mb-1.5"></div>
                    <div className="space-y-1.5">
                      <div className="h-3 w-full bg-white/5 rounded animate-pulse"></div>
                      <div className="h-3 w-full bg-white/5 rounded animate-pulse"></div>
                      <div className="h-3 w-3/4 bg-white/5 rounded animate-pulse"></div>
                    </div>
                  </div>

                  {/* Footer: Comments, Status and Details */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-12 bg-white/5 rounded animate-pulse"></div>
                      <div className="h-3 w-16 bg-white/5 rounded animate-pulse"></div>
                    </div>
                    <div className="h-3 w-12 bg-white/5 rounded animate-pulse"></div>
                  </div>
                </div>
              ))}
            </>
          ) : displayedIdeas.length === 0 ? (
            <div className="glass-card text-center py-10 border border-white/10">
              <p className="text-white/30 text-xs">Keine Ideen gefunden</p>
            </div>
          ) : (
            displayedIdeas.map((idea) => {
              const hashtags = parseHashtags(idea.aiHashtags);

              // Show AI summary if it's >= 150 characters, otherwise show original description
              const summaryText = idea.aiSummary && idea.aiSummary.length >= 150
                ? idea.aiSummary
                : idea.description;

              const percentage = Math.min((idea.supporters / idea.maxSupporters) * 100, 100);
              const radius = 32;
              const circumference = Math.PI * radius; // Half circle
              const dashOffset = circumference - (percentage / 100) * circumference;

              return (
                <div key={idea.id} className="glass-card hover:bg-white/5 transition-all border border-white/10 animate-in fade-in slide-in-from-bottom-2 duration-300" style={{ animationDelay: `${Math.min(displayedIdeas.indexOf(idea) * 30, 300)}ms` }}>
                  {/* Header: Date and Gauge */}
                  <div className="flex items-start justify-between mb-3">
                    {/* Left: Date and Title */}
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] text-white/40 mb-1">
                        {formatRelativeTime(idea.createdAt)}
                      </div>
                      <h3 className="text-sm font-medium text-white leading-snug">
                        {idea.aiTitle || idea.title}
                      </h3>
                    </div>

                    {/* Right: Supporters Gauge */}
                    <div className="flex-shrink-0 ml-3">
                      <div className="relative w-16 flex flex-col items-center">
                        {/* SVG Semi-circle gauge */}
                        <svg width="64" height="40" viewBox="0 0 64 40" className="overflow-visible">
                          {/* Background arc */}
                          <path
                            d="M 6 34 A 26 26 0 0 1 58 34"
                            fill="none"
                            stroke="rgba(255, 255, 255, 0.1)"
                            strokeWidth="5"
                            strokeLinecap="round"
                          />
                          {/* Filled arc */}
                          <path
                            d="M 6 34 A 26 26 0 0 1 58 34"
                            fill="none"
                            stroke="#60a5fa"
                            strokeWidth="5"
                            strokeLinecap="round"
                            strokeDasharray={circumference}
                            strokeDashoffset={dashOffset}
                            className="transition-all duration-500"
                          />
                        </svg>
                        {/* Numbers */}
                        <div className="mt-0.5 text-center">
                          <div className="text-base font-bold text-blue-300">
                            {idea.supporters}
                          </div>
                          <div className="text-[7px] text-white/40">
                            von {idea.maxSupporters}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Summary */}
                  {summaryText && (
                    <div className="mb-3">
                      <div className="text-[9px] text-white/40 uppercase tracking-wide font-medium mb-1.5">
                        Zusammenfassung
                      </div>
                      <p className="text-xs text-white/70 leading-relaxed italic">
                        {summaryText}
                      </p>
                    </div>
                  )}

                  {/* Footer: Comments, Status and Details */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Comments Link */}
                      {idea.comments > 0 && (
                        <button
                          onClick={() => setExpandedComments(expandedComments === idea.id ? null : idea.id)}
                          className="text-[10px] text-white/50 hover:text-white/80 transition-colors flex items-center gap-1"
                        >
                          <MessageCircle size={10} />
                          <span>{idea.comments}</span>
                        </button>
                      )}

                      {/* Status Text with Icons */}
                    {idea.status === "Die Idee wird den politischen Gremien zur Entscheidung vorgelegt" && (
                      <span className="text-[10px] text-white/50 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-yellow-500"></span>
                        In Prüfung
                      </span>
                    )}
                    {idea.status === "Abgelehnt" && (
                      <span className="text-[10px] text-white/50 flex items-center gap-1">
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-red-500">
                          <circle cx="12" cy="12" r="10"/>
                          <line x1="15" y1="9" x2="9" y2="15"/>
                          <line x1="9" y1="9" x2="15" y2="15"/>
                        </svg>
                        Abgelehnt
                      </span>
                    )}
                    {idea.status === "Umgesetzt" && (
                      <span className="text-[10px] text-white/50 flex items-center gap-1">
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-green-500">
                          <circle cx="12" cy="12" r="10"/>
                          <polyline points="9 12 11 14 15 10"/>
                        </svg>
                        Umgesetzt
                      </span>
                    )}
                    {idea.status === "Zeitraum für Stimmabgabe überschritten" && (
                      <span className="text-[10px] text-white/50 flex items-center gap-1">
                        <svg width="6" height="6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-white/50">
                          <circle cx="12" cy="12" r="10"/>
                          <polyline points="12 6 12 12 16 14"/>
                        </svg>
                        Abgelaufen
                      </span>
                    )}
                    {idea.status === "Wird bei zukünftigen Planungen berücksichtigt" && (
                      <span className="text-[10px] text-white/50 flex items-center gap-1">
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-blue-400">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                          <line x1="16" y1="2" x2="16" y2="6"/>
                          <line x1="8" y1="2" x2="8" y2="6"/>
                          <line x1="3" y1="10" x2="21" y2="10"/>
                        </svg>
                        Geplant
                      </span>
                    )}
                    </div>

                    {/* Details Text Link - Far Right */}
                    <button
                      onClick={() => {
                        setSelectedIdea(idea);
                        setShowDetailsModal(true);
                      }}
                      className="text-[10px] text-white/40 hover:text-white/70 transition-colors"
                    >
                      Details
                    </button>
                  </div>

                  {/* Expanded Comments Section (Accordion) */}
                  <div
                    className={cn(
                      "grid transition-all duration-500 ease-out",
                      expandedComments === idea.id ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                    )}
                  >
                    <div className="overflow-hidden">
                      <div className="mt-3">
                        {/* Comments Header */}
                        <div className="flex items-center gap-1.5 mb-2">
                          <MessageCircle size={11} className="text-white/40" />
                          <span className="text-[10px] text-white/40 uppercase tracking-wide font-medium">
                            Kommentare
                          </span>
                        </div>

                        {/* Comments List */}
                        <div className="space-y-2">
                          {parseComments(idea.commentsData).length > 0 ? (
                            (() => {
                              const comments = parseComments(idea.commentsData);
                              return comments.map((comment, index) => {
                                const authorColor = getAuthorColor(comment.author, comments);
                                // Check if this is a moderator (either by flag or by author name)
                                const isModerator = comment.isModerator || comment.author === 'Moderation';

                                return (
                                  <div
                                    key={index}
                                    className={cn(
                                      "pl-3 pr-2 py-2 border-l-2 transition-all duration-300 ease-out",
                                      expandedComments === idea.id ? "translate-x-0 opacity-100" : "-translate-x-4 opacity-0"
                                    )}
                                    style={{
                                      borderLeftColor: isModerator
                                        ? 'hsl(217, 60%, 50%)'
                                        : (authorColor?.border || 'rgba(255, 255, 255, 0.1)'),
                                      backgroundColor: isModerator
                                        ? 'hsl(217, 60%, 50%, 0.05)'
                                        : (authorColor?.bg || 'transparent'),
                                      transitionDelay: expandedComments === idea.id ? `${100 + index * 80}ms` : '0ms'
                                    }}
                                  >
                                    <div className="flex items-baseline justify-between gap-2 mb-1">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span
                                          className="text-[10px] font-medium"
                                          style={{
                                            color: isModerator
                                              ? 'hsl(217, 70%, 75%)'
                                              : (authorColor?.text || 'rgba(255, 255, 255, 0.7)')
                                          }}
                                        >
                                          {comment.author}
                                        </span>
                                        {isModerator && (
                                          <span className="px-1 py-0.5 bg-blue-500/20 border border-blue-500/30 rounded text-[8px] text-blue-200">
                                            Stadt BS
                                          </span>
                                        )}
                                      </div>
                                      {comment.date && (
                                        <span className="text-[9px] text-white/30 whitespace-nowrap">
                                          {comment.date}
                                        </span>
                                      )}
                                    </div>
                                    <p className={cn(
                                      "text-[10px] leading-relaxed whitespace-pre-wrap",
                                      isModerator ? "text-white/75" : "text-white/60"
                                    )}>
                                      {linkifyText(comment.text)}
                                    </p>
                                  </div>
                                );
                              });
                            })()
                          ) : (
                            <div className="text-center py-3">
                              <p className="text-[10px] text-white/30">
                                Keine Kommentare vorhanden
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {/* Loading More Indicator - Skeleton */}
          {!searchQuery && loadingMore && (
            <>
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="glass-card border border-white/10 animate-in fade-in slide-in-from-bottom-2 duration-500"
                  style={{ animationDelay: `${i * 100}ms` }}
                >
                  {/* Header: Date and Gauge */}
                  <div className="flex items-start justify-between mb-3">
                    {/* Left: Date and Title */}
                    <div className="flex-1 min-w-0">
                      <div className="h-3 w-32 bg-white/5 rounded animate-pulse mb-1"></div>
                      <div className="h-4 w-4/5 bg-white/10 rounded animate-pulse"></div>
                    </div>

                    {/* Right: Supporters Gauge Skeleton */}
                    <div className="flex-shrink-0 ml-3">
                      <div className="relative w-16 flex flex-col items-center">
                        {/* SVG Semi-circle skeleton */}
                        <div className="w-16 h-10 bg-white/5 rounded-t-full animate-pulse"></div>
                        {/* Numbers skeleton */}
                        <div className="mt-0.5 text-center space-y-1">
                          <div className="h-4 w-6 bg-white/10 rounded animate-pulse mx-auto"></div>
                          <div className="h-2 w-12 bg-white/5 rounded animate-pulse"></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="mb-3">
                    <div className="h-2.5 w-28 bg-white/5 rounded animate-pulse mb-1.5"></div>
                    <div className="space-y-1.5">
                      <div className="h-3 w-full bg-white/5 rounded animate-pulse"></div>
                      <div className="h-3 w-full bg-white/5 rounded animate-pulse"></div>
                      <div className="h-3 w-3/4 bg-white/5 rounded animate-pulse"></div>
                    </div>
                  </div>

                  {/* Footer: Comments, Status and Details */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-12 bg-white/5 rounded animate-pulse"></div>
                      <div className="h-3 w-16 bg-white/5 rounded animate-pulse"></div>
                    </div>
                    <div className="h-3 w-12 bg-white/5 rounded animate-pulse"></div>
                  </div>
                </div>
              ))}
            </>
          )}

          {/* End of List Indicator */}
          {!searchQuery && !loadingMore && displayedIdeas.length >= totalCount && totalCount > ITEMS_TO_DISPLAY && (
            <div className="text-center py-4">
              <p className="text-white/30 text-xs">Alle Ideen geladen</p>
            </div>
          )}
        </div>
      </div>

      {/* Details Modal - Fullscreen */}
      {showDetailsModal && selectedIdea && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-lg z-50 animate-in fade-in duration-300"
          onClick={() => {
            setShowDetailsModal(false);
            setSelectedIdea(null);
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
                      setShowDetailsModal(false);
                      setSelectedIdea(null);
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
                    {selectedIdea.title}
                  </h3>
                </div>

                {/* Description */}
                <div className="glass-card border border-white/10">
                  <div className="text-[9px] text-white/40 uppercase tracking-wide font-medium mb-1.5">
                    Beschreibung
                  </div>
                  <p className="text-xs text-white/70 leading-relaxed whitespace-pre-wrap">
                    {linkifyText(selectedIdea.description)}
                  </p>
                </div>

                {/* Comments Accordion */}
                {selectedIdea.comments > 0 && (
                  <div className="glass-card border border-white/10">
                    <button
                      onClick={() => setExpandedComments(expandedComments === selectedIdea.id ? null : selectedIdea.id)}
                      className="w-full flex items-center justify-between text-left"
                    >
                      <div className="flex items-center gap-2">
                        <div className="text-[9px] text-white/40 uppercase tracking-wide font-medium">
                          Kommentare
                        </div>
                        <span className="text-[10px] text-white/40">({selectedIdea.comments})</span>
                      </div>
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className={cn(
                          "text-white/40 transition-transform duration-300",
                          expandedComments === selectedIdea.id ? "rotate-180" : ""
                        )}
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>

                    {/* Comments List */}
                    <div
                      className={cn(
                        "grid transition-all duration-500 ease-out",
                        expandedComments === selectedIdea.id ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                      )}
                    >
                      <div className="overflow-hidden">
                        <div className="mt-3 space-y-2">
                          {parseComments(selectedIdea.commentsData).length > 0 ? (
                            (() => {
                              const comments = parseComments(selectedIdea.commentsData);
                              return comments.map((comment, index) => {
                                const authorColor = getAuthorColor(comment.author, comments);
                                const isModerator = comment.isModerator || comment.author === 'Moderation';

                                return (
                                  <div
                                    key={index}
                                    className={cn(
                                      "pl-3 pr-2 py-2 border-l-2 transition-all duration-300 ease-out",
                                      expandedComments === selectedIdea.id ? "translate-x-0 opacity-100" : "-translate-x-4 opacity-0"
                                    )}
                                    style={{
                                      borderLeftColor: isModerator
                                        ? 'hsl(217, 60%, 50%)'
                                        : (authorColor?.border || 'rgba(255, 255, 255, 0.1)'),
                                      backgroundColor: isModerator
                                        ? 'hsl(217, 60%, 50%, 0.05)'
                                        : (authorColor?.bg || 'transparent'),
                                      transitionDelay: expandedComments === selectedIdea.id ? `${100 + index * 80}ms` : '0ms'
                                    }}
                                  >
                                    <div className="flex items-baseline justify-between gap-2 mb-1">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span
                                          className="text-[10px] font-medium"
                                          style={{
                                            color: isModerator
                                              ? 'hsl(217, 70%, 75%)'
                                              : (authorColor?.text || 'rgba(255, 255, 255, 0.7)')
                                          }}
                                        >
                                          {comment.author}
                                        </span>
                                        {isModerator && (
                                          <span className="px-1 py-0.5 bg-blue-500/20 border border-blue-500/30 rounded text-[8px] text-blue-200">
                                            Stadt BS
                                          </span>
                                        )}
                                      </div>
                                      {comment.date && (
                                        <span className="text-[9px] text-white/30 whitespace-nowrap">
                                          {comment.date}
                                        </span>
                                      )}
                                    </div>
                                    <p className={cn(
                                      "text-[10px] leading-relaxed whitespace-pre-wrap",
                                      isModerator ? "text-white/75" : "text-white/60"
                                    )}>
                                      {linkifyText(comment.text)}
                                    </p>
                                  </div>
                                );
                              });
                            })()
                          ) : (
                            <div className="text-center py-3">
                              <p className="text-[10px] text-white/30">
                                Keine Kommentare vorhanden
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Metadata Grid */}
                <div className="glass-card border border-white/10">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <div className="text-[9px] text-white/40 uppercase tracking-wide">Unterstützer</div>
                      <p className="text-sm text-white">
                        {selectedIdea.supporters} <span className="text-white/50">/ {selectedIdea.maxSupporters}</span>
                      </p>
                    </div>
                    <div className="space-y-1">
                      <div className="text-[9px] text-white/40 uppercase tracking-wide">Kategorie</div>
                      <p className="text-sm text-white/80">{selectedIdea.category}</p>
                    </div>
                    <div className="space-y-1">
                      <div className="text-[9px] text-white/40 uppercase tracking-wide">Kommentare</div>
                      <p className="text-sm text-white/80">{selectedIdea.comments}</p>
                    </div>
                    <div className="space-y-1">
                      <div className="text-[9px] text-white/40 uppercase tracking-wide">Erstellt</div>
                      <p className="text-sm text-white/80">{formatRelativeTime(selectedIdea.createdAt)}</p>
                    </div>
                  </div>
                </div>

                {/* Status */}
                <div className="glass-card border border-white/10">
                  <div className="text-[9px] text-white/40 uppercase tracking-wide font-medium mb-2">Status</div>
                  {selectedIdea.status === "Die Idee wird den politischen Gremien zur Entscheidung vorgelegt" && (
                    <span className="text-[10px] text-white/50 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-yellow-500"></span>
                      In Prüfung
                    </span>
                  )}
                  {selectedIdea.status === "Abgelehnt" && (
                    <span className="text-[10px] text-white/50 flex items-center gap-1">
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-red-500">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="15" y1="9" x2="9" y2="15"/>
                        <line x1="9" y1="9" x2="15" y2="15"/>
                      </svg>
                      Abgelehnt
                    </span>
                  )}
                  {selectedIdea.status === "Umgesetzt" && (
                    <span className="text-[10px] text-white/50 flex items-center gap-1">
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-green-500">
                        <circle cx="12" cy="12" r="10"/>
                        <polyline points="9 12 11 14 15 10"/>
                      </svg>
                      Umgesetzt
                    </span>
                  )}
                  {selectedIdea.status === "Zeitraum für Stimmabgabe überschritten" && (
                    <span className="text-[10px] text-white/50 flex items-center gap-1">
                      <svg width="6" height="6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-white/50">
                        <circle cx="12" cy="12" r="10"/>
                        <polyline points="12 6 12 12 16 14"/>
                      </svg>
                      Abgelaufen
                    </span>
                  )}
                  {selectedIdea.status === "Wird bei zukünftigen Planungen berücksichtigt" && (
                    <span className="text-[10px] text-white/50 flex items-center gap-1">
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-blue-400">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                        <line x1="16" y1="2" x2="16" y2="6"/>
                        <line x1="8" y1="2" x2="8" y2="6"/>
                        <line x1="3" y1="10" x2="21" y2="10"/>
                      </svg>
                      Geplant
                    </span>
                  )}
                  {!["Die Idee wird den politischen Gremien zur Entscheidung vorgelegt", "Abgelehnt", "Umgesetzt", "Zeitraum für Stimmabgabe überschritten", "Wird bei zukünftigen Planungen berücksichtigt"].includes(selectedIdea.status) && (
                    <span className="text-[10px] text-white/50">{selectedIdea.status}</span>
                  )}
                </div>

                {/* Hashtags if available */}
                {selectedIdea.aiHashtags && parseHashtags(selectedIdea.aiHashtags).length > 0 && (
                  <div className="glass-card border border-white/10">
                    <div className="text-[9px] text-white/40 uppercase tracking-wide font-medium mb-2">Hashtags</div>
                    <div className="flex flex-wrap gap-1.5">
                      {parseHashtags(selectedIdea.aiHashtags).map((tag) => (
                        <span key={tag} className="px-2 py-1 bg-white/5 rounded text-[10px] text-white/60 hover:bg-white/10 transition-all">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Link to Original */}
                <div className="glass-card border border-white/10">
                  <a
                    href={selectedIdea.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between group"
                  >
                    <div>
                      <div className="text-[9px] text-white/40 uppercase tracking-wide font-medium mb-1">Mehr erfahren</div>
                      <div className="text-xs text-blue-300 group-hover:text-blue-200 transition-colors">
                        Zur Original-Idee
                      </div>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-400 group-hover:translate-x-1 transition-transform">
                      <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                  </a>
                </div>
              </div>

              {/* Bottom spacing */}
              <div className="h-8"></div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
