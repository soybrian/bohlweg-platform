import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
import type { EventItem } from "@/lib/db/schema";

/**
 * iCal/ICS Feed für Event-Synchronisation mit Kalender-Apps
 * Kompatibel mit iPhone, Android, Google Calendar, Outlook etc.
 */
export async function GET() {
  try {
    const db = getDatabase();

    // Hole alle aktiven Events mit vollständigen Daten
    const events = db.prepare(`
      SELECT * FROM events
      WHERE status = 'active'
      AND startDate IS NOT NULL
      ORDER BY startDate ASC, startTime ASC
    `).all() as EventItem[];

    // Generiere iCal-Format
    const icalContent = generateICalFeed(events);

    return new NextResponse(icalContent, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'inline; filename="bohlweg-events.ics"',
        'Cache-Control': 'public, max-age=3600', // 1 Stunde Cache
      },
    });
  } catch (error) {
    console.error("[iCal] Error generating feed:", error);
    return NextResponse.json(
      { error: "Failed to generate iCal feed" },
      { status: 500 }
    );
  }
}

/**
 * Generiere iCal-Feed im ICS-Format
 */
function generateICalFeed(events: EventItem[]): string {
  const lines: string[] = [];

  // iCal Header
  lines.push('BEGIN:VCALENDAR');
  lines.push('VERSION:2.0');
  lines.push('PRODID:-//Bohlweg Platform//Events Calendar//DE');
  lines.push('CALSCALE:GREGORIAN');
  lines.push('METHOD:PUBLISH');
  lines.push('X-WR-CALNAME:Bohlweg Events - Braunschweig');
  lines.push('X-WR-CALDESC:Veranstaltungen aus Braunschweig');
  lines.push('X-WR-TIMEZONE:Europe/Berlin');

  // Timezone Definition für Europe/Berlin
  lines.push('BEGIN:VTIMEZONE');
  lines.push('TZID:Europe/Berlin');
  lines.push('BEGIN:DAYLIGHT');
  lines.push('TZOFFSETFROM:+0100');
  lines.push('TZOFFSETTO:+0200');
  lines.push('DTSTART:19700329T020000');
  lines.push('RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU');
  lines.push('END:DAYLIGHT');
  lines.push('BEGIN:STANDARD');
  lines.push('TZOFFSETFROM:+0200');
  lines.push('TZOFFSETTO:+0100');
  lines.push('DTSTART:19701025T030000');
  lines.push('RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU');
  lines.push('END:STANDARD');
  lines.push('END:VTIMEZONE');

  // Events
  for (const event of events) {
    const icalEvent = generateICalEvent(event);
    if (icalEvent) {
      lines.push(...icalEvent);
    }
  }

  // iCal Footer
  lines.push('END:VCALENDAR');

  return lines.join('\r\n');
}

/**
 * Generiere einzelnes iCal-Event (VEVENT)
 */
function generateICalEvent(event: EventItem): string[] | null {
  if (!event.startDate) return null;

  const lines: string[] = [];

  lines.push('BEGIN:VEVENT');

  // UID: Eindeutige ID für das Event
  lines.push(`UID:event-${event.externalId}@bohlweg.de`);

  // DTSTAMP: Wann wurde der Eintrag erstellt/aktualisiert
  const now = formatICalDateTime(new Date());
  lines.push(`DTSTAMP:${now}`);

  // DTSTART: Start-Datum und Zeit
  const dtstart = formatEventDateTime(event.startDate, event.startTime);
  if (event.startTime) {
    lines.push(`DTSTART;TZID=Europe/Berlin:${dtstart}`);
  } else {
    // Ganztägiges Event
    lines.push(`DTSTART;VALUE=DATE:${event.startDate.replace(/-/g, '')}`);
  }

  // DTEND: End-Datum und Zeit
  if (event.endDate && event.endTime) {
    const dtend = formatEventDateTime(event.endDate, event.endTime);
    lines.push(`DTEND;TZID=Europe/Berlin:${dtend}`);
  } else if (event.startTime && event.endTime) {
    // Gleicher Tag, nur End-Zeit
    const dtend = formatEventDateTime(event.startDate, event.endTime);
    lines.push(`DTEND;TZID=Europe/Berlin:${dtend}`);
  } else if (!event.startTime) {
    // Ganztägiges Event - DTEND ist der Tag NACH dem Event
    const endDate = new Date(event.startDate);
    endDate.setDate(endDate.getDate() + 1);
    const dtend = endDate.toISOString().split('T')[0].replace(/-/g, '');
    lines.push(`DTEND;VALUE=DATE:${dtend}`);
  }

  // SUMMARY: Event-Titel
  lines.push(`SUMMARY:${escapeICalText(event.title)}`);

  // DESCRIPTION: Beschreibung
  if (event.description) {
    const desc = escapeICalText(event.description.substring(0, 500));
    lines.push(`DESCRIPTION:${desc}`);
  }

  // LOCATION: Veranstaltungsort
  if (event.venueName) {
    let location = event.venueName;
    if (event.venueAddress) {
      location += `, ${event.venueAddress}`;
    }
    if (event.venuePostcode && event.venueCity) {
      location += `, ${event.venuePostcode} ${event.venueCity}`;
    }
    lines.push(`LOCATION:${escapeICalText(location)}`);
  }

  // ORGANIZER: Veranstalter (immer "Einladung von: bohlweg" anzeigen)
  const organizerName = event.organizer ? `${event.organizer} (Einladung von: bohlweg)` : 'Einladung von: bohlweg';
  lines.push(`ORGANIZER;CN=${escapeICalText(organizerName)}:noreply@bohlweg.de`);

  // URL: Link zur Detail-Seite
  if (event.url) {
    lines.push(`URL:${event.url}`);
  }

  // CATEGORIES: Kategorie
  if (event.category) {
    lines.push(`CATEGORIES:${escapeICalText(event.category)}`);
  }

  // STATUS
  lines.push('STATUS:CONFIRMED');

  // TRANSP: Zeitblockierung (OPAQUE = blockiert Zeit im Kalender)
  lines.push('TRANSP:OPAQUE');

  lines.push('END:VEVENT');

  return lines;
}

/**
 * Formatiere Datum+Zeit für iCal (Format: 20251018T190000)
 */
function formatEventDateTime(date: string, time?: string): string {
  const datePart = date.replace(/-/g, ''); // 2025-10-18 → 20251018

  if (time) {
    const timePart = time.replace(/:/g, '') + '00'; // 19:00 → 190000
    return `${datePart}T${timePart}`;
  }

  return `${datePart}T000000`;
}

/**
 * Formatiere DateTime für DTSTAMP
 */
function formatICalDateTime(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/**
 * Escape Sonderzeichen für iCal-Text
 * Wichtig: Kommas, Semikolons, Backslashes und Newlines müssen escaped werden
 */
function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')  // Backslash
    .replace(/;/g, '\\;')    // Semikolon
    .replace(/,/g, '\\,')    // Komma
    .replace(/\n/g, '\\n')   // Newline
    .replace(/\r/g, '');     // Carriage Return entfernen
}
