/**
 * Utility Functions
 */

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Kombiniere Tailwind CSS Klassen
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formatiere Datum
 */
export function formatDate(dateString: string): string {
  if (!dateString) return "";

  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return dateString;
  }
}

/**
 * Parse German date format to Date object
 * Format: "Fr., 10.10.2025 - 22:13"
 */
function parseGermanDate(dateString: string): Date | null {
  try {
    // Match pattern: "Di., 04.07.2023 - 17:39"
    const match = dateString.match(/(\d{2})\.(\d{2})\.(\d{4})\s+-\s+(\d{2}):(\d{2})/);
    if (!match) return null;

    const [, day, month, year, hour, minute] = match;
    return new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hour),
      parseInt(minute)
    );
  } catch {
    return null;
  }
}

/**
 * Formatiere relative Zeit mit Uhrzeit
 * - Für Ideen max. 1 Woche alt: "Heute um 14:30", "Gestern um 09:15", "Vor X Tagen um 18:45"
 * - Für ältere Ideen: Original-Datumsformat
 */
export function formatRelativeTime(dateString: string): string {
  if (!dateString) return "";

  try {
    // Try to parse German date format first
    let date = parseGermanDate(dateString);

    // If that fails, try ISO format
    if (!date) {
      date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return dateString;
      }
    }

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / 86400000);

    // Format time as HH:MM
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const timeString = `${hours}:${minutes}`;

    // Für Ideen maximal 1 Woche alt (7 Tage)
    if (diffDays >= 0 && diffDays <= 7) {
      if (diffDays === 0) return `Heute um ${timeString}`;
      if (diffDays === 1) return `Gestern um ${timeString}`;
      if (diffDays === 2) return `Vorgestern um ${timeString}`;
      return `Vor ${diffDays} Tagen um ${timeString}`;
    }

    // Für ältere Ideen: Original-Format zurückgeben
    return dateString;
  } catch {
    return dateString;
  }
}

/**
 * Truncate Text
 */
export function truncate(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
}
