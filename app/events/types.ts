export interface Event {
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
  price?: string;
  priceFormatted?: string;
  isFree?: boolean;
  ticketUrl?: string;
  organizerWebsite?: string;
  url: string;
  status?: string;
  scraped_at: string;
  dates_count?: number; // Number of additional dates
}

export type EventStatus = 'upcoming' | 'live' | 'ended';
