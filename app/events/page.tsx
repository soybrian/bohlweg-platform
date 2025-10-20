"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Search, Filter, Calendar, MapPin, Clock, User, ExternalLink, X, Sparkles, Tag, CalendarPlus, ArrowUpRight } from "lucide-react";
import { cn, formatRelativeTime } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { eventsQuickActions } from "@/lib/quick-actions";

interface Event {
  id: number;
  externalId: string;
  title: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  venueName?: string;
  venueAddress?: string;
  venueCity?: string;
  organizer?: string;
  imageUrl?: string;
  category?: string;
  moodCategory?: string;
  price?: string;
  isFree?: boolean;
  ticketUrl?: string;
  url: string;
  status?: string;
  scraped_at: string;
  dates_count?: number; // Number of additional dates
}

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

      const res = await fetch(`/api/events?limit=100&offset=0&endDate=${endOfWeek}`);

      if (res.ok) {
        const data = await res.json();
        const events = data.events || [];
        const total = data.total || events.length;

        setBuffer(events);
        setDisplayedEvents(events);
        setOffset(0); // Reset offset for week-based loading
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
      const res = await fetch(`/api/events?limit=${ITEMS_TO_FETCH}&offset=0${venueParam}${searchParam}`);

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
      const res = await fetch(`/api/events?search=${encodeURIComponent(query)}&limit=100`);
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
  }, [loadingMore, displayedEvents.length, buffer.length, searchQuery, offset]);

  const loadMore = async () => {
    setLoadingMore(true);

    try {
      // Calculate next week's date range
      const nextWeekStart = new Date(currentWeekEnd);
      nextWeekStart.setDate(nextWeekStart.getDate() + 1); // Day after current week end

      const nextWeekEnd = new Date(nextWeekStart);
      nextWeekEnd.setDate(nextWeekEnd.getDate() + 6); // 7 days = 1 week

      const startDateStr = nextWeekStart.toISOString().split('T')[0];
      const endDateStr = nextWeekEnd.toISOString().split('T')[0];

      const res = await fetch(`/api/events?limit=100&offset=0&startDate=${startDateStr}&endDate=${endDateStr}`);
      if (res.ok) {
        const data = await res.json();
        const newEvents = data.events || [];

        if (newEvents.length > 0) {
          // Append new week's events to displayed events
          setDisplayedEvents([...displayedEvents, ...newEvents]);
          setBuffer([...buffer, ...newEvents]);

          // Update current week end to the new week
          setCurrentWeekEnd(endDateStr);
        }
      }
    } catch (error) {
      console.error("Error loading more events:", error);
    } finally {
      setLoadingMore(false);
    }
  };

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

  // Clean venue name (remove HTML artifacts)
  const cleanVenueName = (venueName?: string) => {
    if (!venueName) return "";
    // Extract just the venue name if it contains HTML-like content
    const lines = venueName.split('\n').filter(line => line.trim());
    if (lines.length > 0 && lines[0].includes('Veranstaltungsort')) {
      return lines[1]?.trim() || "";
    }
    return lines[0]?.trim() || "";
  };

  // Group events by date
  const groupEventsByDate = (events: Event[]): Map<string, Event[]> => {
    const grouped = new Map<string, Event[]>();

    events.forEach(event => {
      if (!event.startDate) return;

      const existing = grouped.get(event.startDate);
      if (existing) {
        existing.push(event);
      } else {
        grouped.set(event.startDate, [event]);
      }
    });

    return grouped;
  };


  // Get end of current week (Sunday)
  const getEndOfWeek = () => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday
    const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
    const endOfWeek = new Date(today);
    endOfWeek.setDate(today.getDate() + daysUntilSunday);
    return endOfWeek.toISOString().split('T')[0]; // YYYY-MM-DD
  };

  // Get event status (upcoming, live, ended)
  const getEventStatus = (event: Event): 'upcoming' | 'live' | 'ended' => {
    // Nur für heutige Events relevant
    const eventDate = new Date(event.startDate || '');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    eventDate.setHours(0, 0, 0, 0);

    if (eventDate.getTime() !== today.getTime()) {
      return 'upcoming'; // Nicht heute
    }

    // Heutiges Event - Zeit prüfen
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    // Parse startTime (z.B. "19:30")
    const startParts = event.startTime?.split(':');
    const startMinutes = startParts ? parseInt(startParts[0]) * 60 + parseInt(startParts[1]) : 0;

    // Parse endTime (z.B. "21:30")
    const endParts = event.endTime?.split(':');
    const endMinutes = endParts ? parseInt(endParts[0]) * 60 + parseInt(endParts[1]) : 0;

    if (!event.endTime) {
      // Kein endTime: Event ist "upcoming" wenn startTime in Zukunft
      return currentTime >= startMinutes ? 'live' : 'upcoming';
    }

    // Event vorbei
    if (currentTime > endMinutes) return 'ended';

    // Event läuft gerade
    if (currentTime >= startMinutes && currentTime <= endMinutes) return 'live';

    // Event kommt noch
    return 'upcoming';
  };

  // Format date header with relative days (e.g. "Morgen, 20. Okt" or "Donnerstag, 14. Okt")
  const formatDateHeader = (dateStr: string) => {
    const eventDate = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    eventDate.setHours(0, 0, 0, 0);

    const diffTime = eventDate.getTime() - today.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    const day = eventDate.toLocaleDateString("de-DE", { day: "numeric" });
    const month = eventDate.toLocaleDateString("de-DE", { month: "short" });
    const weekday = eventDate.toLocaleDateString("de-DE", { weekday: "long" });

    // Events der aktuellen Woche: nur Wochentag
    if (diffDays >= 0 && diffDays <= 6) {
      if (diffDays === 0) return `Heute, ${weekday}`;
      if (diffDays === 1) return `Morgen, ${weekday}`;
      if (diffDays === 2) return `Übermorgen, ${weekday}`;
      return weekday; // Tag 3-6 der Woche
    }

    // Ab nächster Woche: Wochentag + Datum
    return `${weekday}, ${day}. ${month}`;
  };

  // Get initials from event title (first letter)
  const getEventInitial = (title: string) => {
    return title.charAt(0).toUpperCase();
  };

  // Generate gradient color based on title
  const getGradientForTitle = (title: string) => {
    const gradients = [
      "from-blue-500 to-purple-500",
      "from-purple-500 to-pink-500",
      "from-pink-500 to-rose-500",
      "from-rose-500 to-orange-500",
      "from-orange-500 to-yellow-500",
      "from-yellow-500 to-green-500",
      "from-green-500 to-teal-500",
      "from-teal-500 to-cyan-500",
      "from-cyan-500 to-blue-500",
    ];

    // Use character code sum for consistent color per title
    const sum = title.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return gradients[sum % gradients.length];
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
          <button
            onClick={() => setShowSearchInput(!showSearchInput)}
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
          <a
            href="/api/events/ical"
            target="_blank"
            rel="noopener noreferrer"
            title="Events in Kalender-App abonnieren (iPhone, Android, Google Calendar, Outlook)"
            className="glass-card border-none w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 hover:bg-white/8 text-white/60 hover:text-green-400"
          >
            <CalendarPlus size={16} className="flex-shrink-0" />
          </a>
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

                {Array.from(groupEventsByDate(displayedEvents)).map(([date, events], groupIndex) => (
                  <div key={date} className="mb-6 relative" data-date={date} id={`date-${date}`}>
                    {/* Date Header with Timeline Dot */}
                    <div className="text-sm font-medium text-white/50 mb-3 relative flex items-center">
                      <div className="absolute -left-[41px] w-5 h-5 rounded-full bg-white/90 z-10"></div>
                      <span className="whitespace-nowrap">{formatDateHeader(date)}</span>
                    </div>

                    {/* Events */}
                    <div className="space-y-0">
                      {events.map((event, idx) => (
                        <div
                          key={event.id}
                          onClick={() => {
                            setSelectedEvent(event);
                            setShowDetailModal(true);
                          }}
                          className="group relative rounded-lg hover:bg-white/[0.03] transition-all duration-150 cursor-pointer px-2 py-2.5 -mx-2 opacity-0 animate-[fadeIn_0.3s_ease-out_forwards]"
                          style={{ animationDelay: `${idx * 30}ms` }}
                        >
                          <div className="flex gap-3 flex-row-reverse">
                            <div className={`w-[72px] h-[72px] flex-shrink-0 relative transition-all duration-300 ${getEventStatus(event) === 'ended' ? 'opacity-30 grayscale' : ''}`}>
                              <div className={`w-full h-full rounded-md bg-gradient-to-br ${getGradientForTitle(event.title)} flex items-center justify-center`}>
                                <span className="text-white text-2xl font-bold">{getEventInitial(event.title)}</span>
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="text-[15px] font-semibold text-white leading-snug mb-1">{event.title}</h3>
                              <div className="space-y-0.5">
                                {event.startTime && (
                                  <div className="flex items-center gap-2 text-[13px]">
                                    {getEventStatus(event) === 'ended' ? (
                                      <span className="text-white/40">Zu Ende</span>
                                    ) : (
                                      <>
                                        <span className="text-white/50">{event.startTime}</span>
                                        {getEventStatus(event) === 'live' && (
                                          <>
                                            <span className="text-white/20">•</span>
                                            <span className="flex items-center gap-1.5 text-green-400 text-[11px]">
                                              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
                                              Findet gerade statt
                                            </span>
                                          </>
                                        )}
                                      </>
                                    )}
                                  </div>
                                )}
                                {event.venueName && cleanVenueName(event.venueName) && (
                                  <div className="flex items-center gap-1.5 text-[13px] text-white/50">
                                    <MapPin size={12} className="flex-shrink-0" />
                                    <span className="truncate">{cleanVenueName(event.venueName)}</span>
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-2">
                                {event.ticketUrl && (
                                  <a href={event.ticketUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex items-center px-3 py-1.5 bg-white/10 hover:bg-white/15 rounded-md text-xs text-white font-medium transition-all">Get Tickets</a>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Mobile: Bordered Cards */}
              <div className="md:hidden space-y-3 relative pl-8">
                {/* Vertical timeline line */}
                <div className="absolute left-0 top-0 bottom-0 w-[2px] border-l-[3px] border-dotted border-white/40" style={{ borderSpacing: '8px' }}></div>

                {Array.from(groupEventsByDate(displayedEvents)).map(([date, events], groupIndex) => (
                  <div key={date} className="relative mb-4" data-date={date} id={`date-${date}`}>
                    {/* Date Header with Timeline Dot */}
                    <div className="text-sm font-medium text-white/50 mb-2 relative flex items-center">
                      <div className="absolute -left-[41px] w-5 h-5 rounded-full bg-white/90 z-10"></div>
                      <span className="whitespace-nowrap">{formatDateHeader(date)}</span>
                    </div>

                    {/* Events */}
                    <div className="space-y-2">
                      {events.map((event, idx) => (
                        <div
                          key={event.id}
                          onClick={() => {
                            setSelectedEvent(event);
                            setShowDetailModal(true);
                          }}
                          className="bg-white/5 border border-white/20 rounded-xl px-4 py-3 cursor-pointer active:scale-[0.98] transition-all duration-150 opacity-0 animate-[fadeIn_0.3s_ease-out_forwards]"
                          style={{ animationDelay: `${idx * 30}ms` }}
                        >
                          <div className="flex gap-3 flex-row-reverse">
                            <div className={`w-10 h-10 flex-shrink-0 transition-all duration-300 ${getEventStatus(event) === 'ended' ? 'opacity-30 grayscale' : ''}`}>
                              <div className={`w-full h-full rounded-lg bg-gradient-to-br ${getGradientForTitle(event.title)} flex items-center justify-center`}>
                                <span className="text-white text-lg font-bold">{getEventInitial(event.title)}</span>
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="text-sm font-semibold text-white leading-tight mb-1">{event.title}</h3>
                              <div className="space-y-0.5">
                                {event.startTime && (
                                  <div className="flex items-center gap-2 text-xs">
                                    {getEventStatus(event) === 'ended' ? (
                                      <span className="text-white/40">Zu Ende</span>
                                    ) : (
                                      <>
                                        <span className="text-white/50">{event.startTime}</span>
                                        {getEventStatus(event) === 'live' && (
                                          <>
                                            <span className="text-white/20">•</span>
                                            <span className="flex items-center gap-1 text-green-400 text-[10px]">
                                              <span className="w-1 h-1 rounded-full bg-green-400 animate-pulse"></span>
                                              Live
                                            </span>
                                          </>
                                        )}
                                      </>
                                    )}
                                  </div>
                                )}
                                {event.venueName && cleanVenueName(event.venueName) && (
                                  <div className="flex items-center gap-1 text-xs text-white/50">
                                    <MapPin size={10} className="flex-shrink-0" />
                                    <span className="truncate">{cleanVenueName(event.venueName)}</span>
                                  </div>
                                )}
                              </div>
                              {event.ticketUrl && (
                                <a href={event.ticketUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="inline-block mt-2 px-2.5 py-1 bg-white/10 rounded text-[11px] text-white font-medium">Tickets</a>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
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
                  <a
                    href={selectedEvent.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[13px] text-white/70 hover:text-white transition-all hover:bg-white/5"
                  >
                    <span>Zum Veranstalter</span>
                    <ArrowUpRight size={12} />
                  </a>
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
