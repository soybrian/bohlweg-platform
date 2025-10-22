import { MapPin, Ticket, CheckCircle2 } from "lucide-react";
import { Event } from "@/app/events/types";
import { getEventStatus, getGradientForTitle, getEventInitial, cleanVenueName } from "@/app/events/helpers";

interface EventCardProps {
  event: Event;
  variant: 'desktop' | 'mobile';
  animationDelay: number;
  onClick: () => void;
}

export default function EventCard({ event, variant, animationDelay, onClick }: EventCardProps) {
  const status = getEventStatus(event);
  const isDesktop = variant === 'desktop';

  // Desktop variant: Flat Luma-Style with hover effects
  if (isDesktop) {
    return (
      <div
        onClick={onClick}
        className="group relative rounded-lg hover:bg-white/[0.03] transition-all duration-150 cursor-pointer px-2 py-2.5 -mx-2 opacity-0 animate-[fadeIn_0.3s_ease-out_forwards]"
        style={{ animationDelay: `${animationDelay}ms` }}
      >
        <div className="flex gap-3 flex-row-reverse">
          {/* Avatar */}
          <div className={`w-[72px] h-[72px] flex-shrink-0 relative transition-all duration-300 ${status === 'ended' ? 'opacity-30 grayscale' : ''}`}>
            <div className={`w-full h-full rounded-md bg-gradient-to-br ${getGradientForTitle(event.title)} flex items-center justify-center`}>
              <span className="text-white text-2xl font-bold">{getEventInitial(event.title)}</span>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className="text-[15px] font-semibold text-white leading-snug mb-1">{event.title}</h3>
            <div className="space-y-0.5">
              {/* Time & Status */}
              {event.startTime && (
                <div className="flex items-center gap-2 text-[13px]">
                  {status === 'ended' ? (
                    <span className="text-white/40">Zu Ende</span>
                  ) : (
                    <>
                      <span className="text-white/50">{event.startTime}</span>
                      {/* Ticket Icon */}
                      {event.isFree ? (
                        <span className="flex items-center gap-1">
                          <CheckCircle2 size={12} className="flex-shrink-0 text-green-400 [&>circle]:fill-green-400 [&>path]:stroke-[#0a0a0a]" />
                          <span className="text-[11px] text-white/50">Eintritt frei</span>
                        </span>
                      ) : event.priceFormatted ? (
                        <span className="flex items-center gap-1">
                          <Ticket size={12} className="flex-shrink-0 text-white/40" />
                          <span className="text-[11px] text-white/50">ab {event.priceFormatted}</span>
                        </span>
                      ) : null}
                      {status === 'live' && (
                        <span className="flex items-center gap-1.5 text-green-400 text-[11px]">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
                          Findet gerade statt
                        </span>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Venue */}
              {event.venueName && cleanVenueName(event.venueName) && (
                <div className="flex items-center gap-1.5 text-[13px] text-white/50">
                  <MapPin size={12} className="flex-shrink-0" />
                  <span className="truncate">{cleanVenueName(event.venueName)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Mobile variant: Bordered Cards with active scaling
  return (
    <div
      onClick={onClick}
      className="bg-white/5 border border-white/20 rounded-xl px-4 py-3 cursor-pointer active:scale-[0.98] transition-all duration-150 opacity-0 animate-[fadeIn_0.3s_ease-out_forwards]"
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      <div className="flex gap-3 flex-row-reverse">
        {/* Avatar */}
        <div className={`w-10 h-10 flex-shrink-0 transition-all duration-300 ${status === 'ended' ? 'opacity-30 grayscale' : ''}`}>
          <div className={`w-full h-full rounded-lg bg-gradient-to-br ${getGradientForTitle(event.title)} flex items-center justify-center`}>
            <span className="text-white text-lg font-bold">{getEventInitial(event.title)}</span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-white leading-tight mb-1">{event.title}</h3>
          <div className="space-y-0.5">
            {/* Time & Status */}
            {event.startTime && (
              <div className="flex items-center gap-2 text-xs">
                {status === 'ended' ? (
                  <span className="text-white/40">Zu Ende</span>
                ) : (
                  <>
                    <span className="text-white/50">{event.startTime}</span>
                    {/* Ticket Icon */}
                    {event.isFree ? (
                      <span className="flex items-center gap-1">
                        <CheckCircle2 size={10} className="flex-shrink-0 text-green-400 [&>circle]:fill-green-400 [&>path]:stroke-[#0a0a0a]" />
                        <span className="text-[10px] text-white/50">Eintritt frei</span>
                      </span>
                    ) : event.priceFormatted ? (
                      <span className="flex items-center gap-1">
                        <Ticket size={10} className="flex-shrink-0 text-white/40" />
                        <span className="text-[10px] text-white/50">ab {event.priceFormatted}</span>
                      </span>
                    ) : null}
                    {status === 'live' && (
                      <span className="flex items-center gap-1 text-green-400 text-[10px]">
                        <span className="w-1 h-1 rounded-full bg-green-400 animate-pulse"></span>
                        Findet gerade statt
                      </span>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Venue */}
            {event.venueName && cleanVenueName(event.venueName) && (
              <div className="flex items-center gap-1 text-xs text-white/50">
                <MapPin size={10} className="flex-shrink-0" />
                <span className="truncate">{cleanVenueName(event.venueName)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
