import { Event, EventStatus } from './types';

/**
 * Clean venue name by extracting the actual name from potentially HTML-formatted content
 */
export const cleanVenueName = (venueName?: string): string => {
  if (!venueName) return "";
  // Extract just the venue name if it contains HTML-like content
  const lines = venueName.split('\n').filter(line => line.trim());
  if (lines.length > 0 && lines[0].includes('Veranstaltungsort')) {
    return lines[1]?.trim() || "";
  }
  return lines[0]?.trim() || "";
};

/**
 * Get event status based on current time
 * Returns 'upcoming', 'live', or 'ended'
 */
export const getEventStatus = (event: Event): EventStatus => {
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

/**
 * Get first letter of event title as initial
 */
export const getEventInitial = (title: string): string => {
  return title.charAt(0).toUpperCase();
};

/**
 * Generate consistent gradient color based on event title
 */
export const getGradientForTitle = (title: string): string => {
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

/**
 * Group events by their start date
 */
export const groupEventsByDate = (events: Event[]): Map<string, Event[]> => {
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

/**
 * Get end of current week (Sunday) in YYYY-MM-DD format
 */
export const getEndOfWeek = (): string => {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday
  const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
  const endOfWeek = new Date(today);
  endOfWeek.setDate(today.getDate() + daysUntilSunday);
  return endOfWeek.toISOString().split('T')[0]; // YYYY-MM-DD
};

/**
 * Format date header with relative days
 * Examples: "Heute, Mittwoch", "Morgen, Donnerstag", "Freitag", "Montag, 24. Okt"
 */
export const formatDateHeader = (dateStr: string): string => {
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
