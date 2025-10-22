"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Search, Filter, Calendar, MapPin, Clock, User, ExternalLink, X, Sparkles, Tag, CalendarPlus, ArrowUpRight, ChevronDown, CheckCircle2, SlidersHorizontal, Coffee } from "lucide-react";
import { cn, formatRelativeTime } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { eventsQuickActions } from "@/lib/quick-actions";
import { Event } from "./types";
import { groupEventsByDate, getEndOfWeek, formatDateHeader, cleanVenueName, getEventStatus } from "./helpers";
import EventCard from "@/app/components/EventCard";

export default function EventsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedVenue, setSelectedVenue] = useState("");
  const [venues, setVenues] = useState<string[]>([]);
  const [buffer, setBuffer] = useState<Event[]>([]);
  const [displayedEvents, setDisplayedEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [showSearchInput, setShowSearchInput] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [isClosingModal, setIsClosingModal] = useState(false);
  const [customQuestion, setCustomQuestion] = useState("");
  const [customAnswer, setCustomAnswer] = useState<string>("");
  const [customAnswerLoading, setCustomAnswerLoading] = useState(false);
  const [customAnswerItemCount, setCustomAnswerItemCount] = useState<number>(0);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [stickyDate, setStickyDate] = useState<string>("");
  const [currentWeekEnd, setCurrentWeekEnd] = useState<string>("");
  const [collapsedDates, setCollapsedDates] = useState<Set<string>>(new Set());
  const [activeFilters, setActiveFilters] = useState<Set<'afterWork' | 'weekend' | 'free'>>(new Set());
  const [showFilterPills, setShowFilterPills] = useState(false);
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

  // Search Effect
  useEffect(() => {
    if (debouncedSearch) {
      handleSearch(debouncedSearch);
    } else if (!searchQuery) {
      setDisplayedEvents(buffer.slice(0, ITEMS_TO_DISPLAY));
    }
  }, [debouncedSearch]);

  useEffect(() => {
    loadData();
    loadVenues();
  }, []);

  // Reload data when filters change
  useEffect(() => {
    if (!loading) {
      loadData();
    }
  }, [activeFilters]);

  // Sticky Date Header - Intersection Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
            const date = entry.target.getAttribute('data-date');
            if (date) {
              setStickyDate(formatDateHeader(date));
            }
          }
        });
      },
      {
        threshold: [0, 0.5, 1],
        rootMargin: '-100px 0px -80% 0px'
      }
    );

    // Observe all date group containers
    const dateGroups = document.querySelectorAll('[data-date]');
    dateGroups.forEach((group) => observer.observe(group));

    return () => observer.disconnect();
  }, [displayedEvents]);

  // Auto-refresh for live event status updates
  useEffect(() => {
    const hasTodayEvents = displayedEvents.some(e => {
      const eventDate = new Date(e.startDate || '');
      const today = new Date();
      eventDate.setHours(0, 0, 0, 0);
      today.setHours(0, 0, 0, 0);
      return eventDate.getTime() === today.getTime();
    });

    if (hasTodayEvents) {
      const interval = setInterval(() => {
        setDisplayedEvents([...displayedEvents]); // Force re-render for live status
      }, 60000); // 1 minute

      return () => clearInterval(interval);
    }
  }, [displayedEvents]);

  // Auto-collapse only 'Heute' (today) if all events have ended
  useEffect(() => {
    const collapsed = new Set<string>();
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

    groupEventsByDate(displayedEvents).forEach((events, date) => {
      const allEnded = events.every(event => getEventStatus(event) === 'ended');
      // Only collapse if it's today AND all events have ended
      if (date === today && allEnded) {
        collapsed.add(date);
      }
    });

    setCollapsedDates(collapsed);
  }, [displayedEvents]);

  const toggleDate = (date: string) => {
    setCollapsedDates(prev => {
      const newSet = new Set(prev);
      if (newSet.has(date)) {
        newSet.delete(date);
      } else {
        newSet.add(date);
      }
      return newSet;
    });
  };

  const toggleFilter = (filter: 'afterWork' | 'weekend' | 'free') => {
    setActiveFilters(prev => {
      const newSet = new Set(prev);
      if (newSet.has(filter)) {
        newSet.delete(filter);
      } else {
        newSet.add(filter);
      }
      return newSet;
    });
  };

  const buildFilterQuery = () => {
    const params = new URLSearchParams();
    if (activeFilters.has('afterWork')) params.set('afterWork', 'true');
    if (activeFilters.has('weekend')) params.set('weekend', 'true');
    if (activeFilters.has('free')) params.set('free', 'true');
    return params.toString();
  };

  const loadVenues = async () => {
    try {
      const res = await fetch('/api/events/venues');
      if (res.ok) {
        const data = await res.json();
        setVenues(data.venues || []);
      }
    } catch (error) {
      console.error("Error loading venues:", error);
    }
  };

  // Auto-scroll when streaming answer
  useEffect(() => {
    if (customAnswerLoading && answerContainerRef.current) {
      answerContainerRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [customAnswer, customAnswerLoading]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Initial load: only current week
      const endOfWeek = getEndOfWeek();
      setCurrentWeekEnd(endOfWeek);

      const filterQuery = buildFilterQuery();
      const url = `/api/events?limit=100&offset=0&endDate=${endOfWeek}${filterQuery ? '&' + filterQuery : ''}`;
      const res = await fetch(url);

      if (res.ok) {
        const data = await res.json();
        const events = data.events || [];
        const total = data.total || events.length;

        setBuffer(events);
        setDisplayedEvents(events);
        setOffset(0);
        setTotalCount(total);
      }
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleVenueChange = async (venue: string) => {
    setSelectedVenue(venue);
    setLoading(true);
    try {
      const venueParam = venue ? `&venue=${encodeURIComponent(venue)}` : '';
      const searchParam = debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}` : '';
      const filterQuery = buildFilterQuery();
      const url = `/api/events?limit=${ITEMS_TO_FETCH}&offset=0${venueParam}${searchParam}${filterQuery ? '&' + filterQuery : ''}`;
      const res = await fetch(url);

      if (res.ok) {
        const data = await res.json();
        const events = data.events || [];
        setBuffer(events);
        setDisplayedEvents(events.slice(0, ITEMS_TO_DISPLAY));
        setOffset(ITEMS_TO_FETCH);
        setTotalCount(data.total || events.length);
      }
    } catch (error) {
      console.error("Error filtering by venue:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (query: string) => {
    if (!query.trim() && !selectedVenue) {
      setDisplayedEvents(buffer.slice(0, ITEMS_TO_DISPLAY));
      return;
    }

    setLoading(true);
    try {
      const filterQuery = buildFilterQuery();
      const url = `/api/events?search=${encodeURIComponent(query)}&limit=100${filterQuery ? '&' + filterQuery : ''}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const results = data.events || [];
        setDisplayedEvents(results);
      }
    } catch (error) {
      console.error("Error searching:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = useCallback(async () => {
    setLoadingMore(true);

    try {
      // Calculate next week's date range
      const nextWeekStart = new Date(currentWeekEnd);
      nextWeekStart.setDate(nextWeekStart.getDate() + 1); // Day after current week end

      const nextWeekEnd = new Date(nextWeekStart);
      nextWeekEnd.setDate(nextWeekEnd.getDate() + 6); // 7 days = 1 week

      const startDateStr = nextWeekStart.toISOString().split('T')[0];
      const endDateStr = nextWeekEnd.toISOString().split('T')[0];

      const filterQuery = buildFilterQuery();
      const url = `/api/events?limit=100&offset=0&startDate=${startDateStr}&endDate=${endDateStr}${filterQuery ? '&' + filterQuery : ''}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const newEvents = data.events || [];

        if (newEvents.length > 0) {
          // Append new week's events to displayed events
          setDisplayedEvents(prev => [...prev, ...newEvents]);
          setBuffer(prev => [...prev, ...newEvents]);

          // Update current week end to the new week
          setCurrentWeekEnd(endDateStr);
        }
      }
    } catch (error) {
      console.error("Error loading more events:", error);
    } finally {
      setLoadingMore(false);
    }
  }, [currentWeekEnd, buildFilterQuery]);

  // Infinite Scroll
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

        // Trigger at 70% to load earlier (better UX)
        if (scrollTop + clientHeight >= scrollHeight * 0.7) {
          loadMore();
        }
      }, 100);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      clearTimeout(scrollTimeout);
      window.removeEventListener("scroll", handleScroll);
    };
  }, [loadingMore, displayedEvents.length, buffer.length, searchQuery, offset, loadMore]);

  // Format date
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString("de-DE", {
      weekday: "short",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  // Format time
  const formatTime = (startTime?: string, endTime?: string) => {
    if (!startTime) return "";
    if (endTime) return `${startTime} - ${endTime} Uhr`;
    return `${startTime} Uhr`;
  };


  // Close modal with animation
  const closeModal = () => {
    setIsClosingModal(true);
    setTimeout(() => {
      setShowDetailModal(false);
      setSelectedEvent(null);
      setIsClosingModal(false);
    }, 400); // Match animation duration
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
        body: JSON.stringify({ question, itemType: "events" }),
      });

      if (!res.ok || !res.body) {
        console.error("Failed to fetch streaming response");
        return;
      }

      const itemCount = parseInt(res.headers.get("X-Item-Count") || "0");
      setCustomAnswerItemCount(itemCount);

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
        <div className="flex gap-2 mb-3 pb-[10px] justify-center">
            {/* Filter Button Group - Links */}
            <div className="flex">
              <button
                onClick={() => setShowFilterPills(!showFilterPills)}
                className={cn(
                  "glass-card border-none w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 hover:bg-white/8 relative overflow-visible",
                  showFilterPills ? "text-white bg-white/8" : "text-white/60"
                )}
              >
                <SlidersHorizontal size={16} className="flex-shrink-0" />
                <span className={cn(
                  "absolute -top-1 -right-1 bg-white text-black text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center transition-all duration-300 ease-out",
                  activeFilters.size > 0
                    ? "px-1 opacity-100 scale-100"
                    : "px-0 opacity-0 scale-0"
                )}>
                  {activeFilters.size > 0 ? activeFilters.size : ''}
                </span>
              </button>
              {/* Filtered Calendar Button - Only shows when filters are active */}
              <div className={cn(
                "transition-all duration-300 ease-out",
                activeFilters.size > 0 ? "w-[44px] ml-2 opacity-100" : "w-0 ml-0 opacity-0"
              )}>
                <a
                  href={activeFilters.size > 0 ? `/api/events/ical?${buildFilterQuery()}` : "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Gefilterte Events in Kalender-App abonnieren"
                  className={cn(
                    "glass-card border-none w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/8 text-white/60 hover:text-green-400",
                    "transition-all duration-300 ease-out",
                    activeFilters.size > 0
                      ? "pointer-events-auto"
                      : "pointer-events-none"
                  )}
                >
                  <CalendarPlus size={16} className="flex-shrink-0" />
                </a>
              </div>
            </div>

            {/* Search Button - Mitte */}
            <button
              onClick={() => setShowSearchInput(!showSearchInput)}
              className={cn(
                "glass-card border-none w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 hover:bg-white/8",
                showSearchInput ? "text-white bg-white/8" : "text-white/60"
              )}
            >
              <Search size={16} className="flex-shrink-0" />
            </button>

            {/* AI Button - Rechts */}
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
              <div className="flex items-center">
                {/* Search Input - 8/12 */}
                <div className="w-8/12 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/30" size={14} />
                  <input
                    type="text"
                    placeholder="Events durchsuchen..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-transparent border-none pl-10 pr-3 py-2 text-white text-xs placeholder-white/30 focus:outline-none"
                    autoFocus={showSearchInput}
                  />
                </div>

                {/* Separator */}
                <div className="h-6 w-px bg-white/10"></div>

                {/* Venue Filter - 4/12 */}
                {venues.length > 0 && (
                  <div className="w-4/12 relative">
                    <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/30" size={14} />
                    <select
                      value={selectedVenue}
                      onChange={(e) => handleVenueChange(e.target.value)}
                      className="w-full bg-transparent border-none pl-10 pr-8 py-2 text-white text-xs focus:outline-none appearance-none cursor-pointer"
                    >
                      <option value="" className="bg-black/95 text-white">Alle Orte</option>
                      {venues.map((venue) => (
                        <option key={venue} value={venue} className="bg-black/95 text-white">
                          {venue}
                        </option>
                      ))}
                    </select>
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                      <svg className="w-3 h-3 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Filter Pills */}
        <div className={cn(
          "grid transition-all duration-300 ease-out overflow-hidden",
          showFilterPills ? "grid-rows-[1fr] opacity-100 mb-4" : "grid-rows-[0fr] opacity-0 mb-0"
        )}>
          <div className="overflow-hidden">
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 justify-center">
              {/* After Work Filter */}
              <button
                onClick={() => toggleFilter('afterWork')}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 whitespace-nowrap",
                  activeFilters.has('afterWork')
                    ? "bg-white/20 border border-white/40 text-white"
                    : "bg-white/5 border border-white/20 text-white/70 hover:bg-white/10"
                )}
              >
                <Coffee size={12} />
                <span>After Work</span>
              </button>

              {/* Weekend Filter */}
              <button
                onClick={() => toggleFilter('weekend')}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 whitespace-nowrap",
                  activeFilters.has('weekend')
                    ? "bg-white/20 border border-white/40 text-white"
                    : "bg-white/5 border border-white/20 text-white/70 hover:bg-white/10"
                )}
              >
                <Calendar size={12} />
                <span>Weekend</span>
              </button>

              {/* Free Filter */}
              <button
                onClick={() => toggleFilter('free')}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 whitespace-nowrap",
                  activeFilters.has('free')
                    ? "bg-white/20 border border-white/40 text-white"
                    : "bg-white/5 border border-white/20 text-white/70 hover:bg-white/10"
                )}
              >
                <CheckCircle2 size={12} />
                <span>Kostenlos</span>
              </button>
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
                              Basierend auf {customAnswerItemCount} Events
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
                        {eventsQuickActions.map((action) => (
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


        {/* Events List - Grouped by Date */}
        <div className="space-y-6 mb-8 pl-6 md:pl-8">

          {loading ? (
            <>
              {/* Desktop Loading */}
              <div className="hidden md:block space-y-0 min-h-[400px]">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="animate-pulse px-2 py-2.5">
                    <div className="flex gap-3 flex-row-reverse">
                      <div className="w-[72px] h-[72px] bg-white/5 rounded-md flex-shrink-0"></div>
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="h-4 w-3/4 bg-white/10 rounded"></div>
                        <div className="h-3 w-24 bg-white/5 rounded"></div>
                        <div className="h-3 w-40 bg-white/5 rounded"></div>
                        <div className="h-7 w-28 bg-white/5 rounded-md mt-2"></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Mobile Loading */}
              <div className="md:hidden space-y-2 min-h-[400px]">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="animate-pulse bg-white/5 border border-white/20 rounded-xl px-4 py-3">
                    <div className="flex gap-3 flex-row-reverse">
                      <div className="w-10 h-10 bg-white/10 rounded-lg flex-shrink-0"></div>
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="h-3.5 w-3/4 bg-white/10 rounded"></div>
                        <div className="h-2.5 w-20 bg-white/5 rounded"></div>
                        <div className="h-2.5 w-32 bg-white/5 rounded"></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : displayedEvents.length === 0 ? (
            <div className="glass-card text-center py-10 border border-white/10">
              <Calendar className="mx-auto mb-2 text-white/20" size={32} />
              <p className="text-white/30 text-xs">Keine Events gefunden</p>
            </div>
          ) : (
            <>
              {/* Desktop: Flat Luma-Style */}
              <div className="hidden md:block relative pl-8">
                {/* Vertical timeline line */}
                <div className="absolute left-0 top-0 bottom-0 w-[2px] border-l-[3px] border-dotted border-white/40" style={{ borderSpacing: '8px' }}></div>

                {Array.from(groupEventsByDate(displayedEvents)).map(([date, events], groupIndex) => {
                  const allEnded = events.every(event => getEventStatus(event) === 'ended');
                  const isCollapsed = collapsedDates.has(date);
                  const today = new Date().toISOString().split('T')[0];
                  const isToday = date === today;
                  const showCollapse = isToday && allEnded;

                  return (
                    <div key={date} className="mb-6 relative" data-date={date} id={`date-${date}`}>
                      {/* Date Header with Timeline Dot */}
                      <div
                        className={`text-sm font-medium mb-3 relative flex items-center transition-colors ${
                          showCollapse ? 'cursor-pointer group' : ''
                        } ${
                          allEnded ? 'text-white/30 hover:text-white/40' : 'text-white/50 hover:text-white/70'
                        }`}
                        onClick={showCollapse ? () => toggleDate(date) : undefined}
                      >
                        <div className={`absolute -left-[41px] w-5 h-5 rounded-full z-10 ${
                          allEnded ? 'bg-white/50' : 'bg-white/90'
                        }`}></div>
                        {showCollapse && (
                          <ChevronDown
                            size={16}
                            className={`mr-2 transition-transform duration-300 ${isCollapsed ? '-rotate-90' : ''}`}
                          />
                        )}
                        <span className="whitespace-nowrap">{formatDateHeader(date)}</span>
                      </div>

                      {/* Events */}
                      <div
                        className={`${showCollapse ? 'transition-all duration-500 ease-in-out overflow-hidden' : ''} ${
                          showCollapse && isCollapsed
                            ? 'max-h-0 opacity-0'
                            : showCollapse
                            ? 'max-h-[10000px] opacity-100'
                            : ''
                        }`}
                      >
                        <div className="space-y-0">
                          {events.map((event, idx) => (
                            <EventCard
                              key={event.id}
                              event={event}
                              variant="desktop"
                              animationDelay={isCollapsed ? 0 : idx * 30}
                              onClick={() => {
                                setSelectedEvent(event);
                                setShowDetailModal(true);
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Mobile: Bordered Cards */}
              <div className="md:hidden space-y-3 relative pl-8">
                {/* Vertical timeline line */}
                <div className="absolute left-0 top-0 bottom-0 w-[2px] border-l-[3px] border-dotted border-white/40" style={{ borderSpacing: '8px' }}></div>

                {Array.from(groupEventsByDate(displayedEvents)).map(([date, events], groupIndex) => {
                  const allEnded = events.every(event => getEventStatus(event) === 'ended');
                  const isCollapsed = collapsedDates.has(date);
                  const today = new Date().toISOString().split('T')[0];
                  const isToday = date === today;
                  const showCollapse = isToday && allEnded;

                  return (
                    <div key={date} className="relative mb-4" data-date={date} id={`date-${date}`}>
                      {/* Date Header with Timeline Dot */}
                      <div
                        className={`text-sm font-medium mb-2 relative flex items-center transition-colors ${
                          showCollapse ? 'cursor-pointer group' : ''
                        } ${
                          allEnded ? 'text-white/30 hover:text-white/40' : 'text-white/50 hover:text-white/70'
                        }`}
                        onClick={showCollapse ? () => toggleDate(date) : undefined}
                      >
                        <div className={`absolute -left-[41px] w-5 h-5 rounded-full z-10 ${
                          allEnded ? 'bg-white/50' : 'bg-white/90'
                        }`}></div>
                        {showCollapse && (
                          <ChevronDown
                            size={14}
                            className={`mr-2 transition-transform duration-300 ${isCollapsed ? '-rotate-90' : ''}`}
                          />
                        )}
                        <span className="whitespace-nowrap">{formatDateHeader(date)}</span>
                      </div>

                      {/* Events with Smooth Collapse */}
                      <div
                        className={`${showCollapse ? 'transition-all duration-500 ease-in-out overflow-hidden' : ''} ${
                          showCollapse && isCollapsed
                            ? 'max-h-0 opacity-0'
                            : showCollapse
                            ? 'max-h-[10000px] opacity-100'
                            : ''
                        }`}
                      >
                        <div className="space-y-2">
                          {events.map((event, idx) => (
                            <EventCard
                              key={event.id}
                              event={event}
                              variant="mobile"
                              animationDelay={isCollapsed ? 0 : idx * 30}
                              onClick={() => {
                                setSelectedEvent(event);
                                setShowDetailModal(true);
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Loading More Indicator - Fixed Height to Prevent Layout Shift */}
          {!searchQuery && loadingMore && (
            <div className="mb-6">
              {/* Desktop Loading More */}
              <div className="hidden md:block space-y-0">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="opacity-0 animate-[fadeIn_0.3s_ease-in_forwards] px-2 py-2.5" style={{ animationDelay: `${i * 50}ms` }}>
                    <div className="flex gap-3 flex-row-reverse">
                      <div className="w-[72px] h-[72px] bg-white/5 rounded-md animate-pulse flex-shrink-0"></div>
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="h-4 w-3/4 bg-white/10 rounded animate-pulse"></div>
                        <div className="h-3 w-24 bg-white/5 rounded animate-pulse"></div>
                        <div className="h-3 w-40 bg-white/5 rounded animate-pulse"></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Mobile Loading More */}
              <div className="md:hidden space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="opacity-0 animate-[fadeIn_0.3s_ease-in_forwards] bg-white/5 border border-white/20 rounded-xl px-4 py-3" style={{ animationDelay: `${i * 50}ms` }}>
                    <div className="flex gap-3 flex-row-reverse">
                      <div className="w-10 h-10 bg-white/10 rounded-lg animate-pulse flex-shrink-0"></div>
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="h-3.5 w-3/4 bg-white/10 rounded animate-pulse"></div>
                        <div className="h-2.5 w-20 bg-white/5 rounded animate-pulse"></div>
                        <div className="h-2.5 w-32 bg-white/5 rounded animate-pulse"></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* End of List Indicator */}
          {!searchQuery && !loadingMore && displayedEvents.length >= totalCount && totalCount > ITEMS_TO_DISPLAY && (
            <div className="text-center py-4">
              <p className="text-white/30 text-xs">Alle Events geladen</p>
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal - Fullscreen */}
      {showDetailModal && selectedEvent && (
        <div
          className={`fixed inset-0 bg-black/95 z-50 transition-opacity duration-400 ${
            isClosingModal ? 'opacity-0' : 'opacity-100'
          }`}
          onClick={closeModal}
        >
          <div
            className={`h-full w-full overflow-y-auto transition-all duration-400 ease-out ${
              isClosingModal ? 'translate-y-full' : 'translate-y-0'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="min-h-full px-4 md:px-6 py-6">
              {/* Close button - minimal circled X */}
              <div className="flex justify-end mb-6">
                <button
                  onClick={closeModal}
                  className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center text-white/50 hover:text-white/90 hover:border-white/40 hover:bg-white/5 transition-all duration-300 hover:scale-110"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Content */}
              <div className="space-y-3">
                {/* Title */}
                <div>
                  <h3 className="text-[17px] font-semibold text-white leading-snug">
                    {selectedEvent.title}
                  </h3>
                </div>

                {/* Event Details */}
                <div className="space-y-1.5">
                  {selectedEvent.startDate && (
                    <div className="flex items-center gap-1.5 text-[13px] text-white/50">
                      <Clock size={12} className="flex-shrink-0" />
                      <span>
                        {formatDate(selectedEvent.startDate)}
                        {selectedEvent.startTime && ` • ${formatTime(selectedEvent.startTime, selectedEvent.endTime)}`}
                      </span>
                    </div>
                  )}
                  {selectedEvent.venueName && cleanVenueName(selectedEvent.venueName) && (
                    <div className="flex items-start gap-1.5 text-[13px] text-white/50">
                      <MapPin size={12} className="mt-0.5 flex-shrink-0" />
                      <span>
                        {cleanVenueName(selectedEvent.venueName)}
                        {selectedEvent.venueAddress && ` • ${selectedEvent.venueAddress}`}
                      </span>
                    </div>
                  )}
                  {selectedEvent.organizer && (
                    <div className="flex items-center gap-1.5 text-[13px] text-white/50">
                      <User size={12} className="flex-shrink-0" />
                      <span>{selectedEvent.organizer}</span>
                    </div>
                  )}
                </div>

                {/* Description */}
                {selectedEvent.description && (
                  <div>
                    <p className="text-[13px] text-white/50 leading-relaxed whitespace-pre-wrap">
                      {selectedEvent.description}
                    </p>
                  </div>
                )}

                {/* Price */}
                {(selectedEvent.isFree || selectedEvent.price) && (
                  <div>
                    {selectedEvent.isFree ? (
                      <span className="text-[13px] text-green-400">
                        Kostenlos
                      </span>
                    ) : selectedEvent.price ? (
                      <span className="text-[13px] text-white/50">
                        {selectedEvent.price}
                      </span>
                    ) : null}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="pt-3 flex gap-2">
                  {(selectedEvent.organizerWebsite || selectedEvent.url) && (
                    <a
                      href={selectedEvent.organizerWebsite || selectedEvent.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[13px] text-white/70 hover:text-white transition-all hover:bg-white/5"
                    >
                      <span>{selectedEvent.organizerWebsite ? 'Zur Veranstalter-Website' : 'Zur Event-Seite'}</span>
                      <ArrowUpRight size={12} />
                    </a>
                  )}
                  <button
                    onClick={() => {
                      // Create calendar event
                      const event = selectedEvent;
                      const startDate = event.startDate ? new Date(event.startDate) : new Date();
                      const startTime = event.startTime || '00:00';
                      const endTime = event.endTime || '23:59';

                      const [startHour, startMin] = startTime.split(':');
                      startDate.setHours(parseInt(startHour), parseInt(startMin));

                      const endDate = new Date(startDate);
                      const [endHour, endMin] = endTime.split(':');
                      endDate.setHours(parseInt(endHour), parseInt(endMin));

                      const formatICS = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

                      const icsContent = [
                        'BEGIN:VCALENDAR',
                        'VERSION:2.0',
                        'BEGIN:VEVENT',
                        `DTSTART:${formatICS(startDate)}`,
                        `DTEND:${formatICS(endDate)}`,
                        `SUMMARY:${event.title}`,
                        `DESCRIPTION:${event.description || ''}`,
                        `LOCATION:${event.venueName || ''} ${event.venueAddress || ''}`,
                        'END:VEVENT',
                        'END:VCALENDAR'
                      ].join('\n');

                      const blob = new Blob([icsContent], { type: 'text/calendar' });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = `${event.title}.ics`;
                      link.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[13px] text-white/70 hover:text-white transition-all hover:bg-white/5"
                  >
                    <CalendarPlus size={12} />
                    <span>Im Kalender speichern</span>
                  </button>
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
