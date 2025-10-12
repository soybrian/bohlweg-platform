"use client";

import { useState, useEffect } from "react";
import { Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface PlatformSummary {
  id: number;
  moduleKey: string;
  summary: string;
  itemCount: number;
  createdAt: string;
  validUntil?: string;
}

interface PlatformSummaryProps {
  moduleKey: "ideenplattform" | "maengelmelder";
}

export function PlatformSummary({ moduleKey }: PlatformSummaryProps) {
  const [summary, setSummary] = useState<PlatformSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    loadSummary();
  }, [moduleKey]);

  const loadSummary = async () => {
    try {
      const res = await fetch("/api/summaries");
      if (res.ok) {
        const summaries = await res.json();
        const moduleSummary = summaries.find(
          (s: PlatformSummary) => s.moduleKey === moduleKey
        );
        setSummary(moduleSummary || null);
      }
    } catch (error) {
      console.error("Error loading summary:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="glass-card mb-3 border border-white/10 animate-pulse">
        <div className="flex items-start gap-2">
          <div className="flex-shrink-0 mt-0.5">
            <div className="w-4 h-4 bg-white/10 rounded"></div>
          </div>
          <div className="flex-1 space-y-2">
            <div className="h-3 w-24 bg-white/10 rounded"></div>
            <div className="space-y-1.5">
              <div className="h-3 w-full bg-white/5 rounded"></div>
              <div className="h-3 w-full bg-white/5 rounded"></div>
              <div className="h-3 w-3/4 bg-white/5 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!summary) {
    return null;
  }

  return (
    <div className="glass-card mb-3 border border-blue-500/20 bg-blue-500/5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-start gap-2 text-left"
      >
        <div className="flex-shrink-0 mt-0.5">
          <Sparkles className="text-blue-400" size={14} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <h3 className="text-[10px] font-medium text-blue-300 uppercase tracking-wide">
                AI-Zusammenfassung
              </h3>
              <span className="text-[9px] text-white/40">
                ({summary.itemCount} {moduleKey === "ideenplattform" ? "Ideen" : "Mängel"})
              </span>
            </div>
            <div className="flex-shrink-0">
              {expanded ? (
                <ChevronUp className="text-white/40" size={12} />
              ) : (
                <ChevronDown className="text-white/40" size={12} />
              )}
            </div>
          </div>
          <div
            className={cn(
              "grid transition-all duration-300 ease-in-out",
              expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
            )}
          >
            <div className="overflow-hidden">
              <p className="text-xs text-white/70 leading-relaxed">
                {summary.summary}
              </p>
            </div>
          </div>
        </div>
      </button>
    </div>
  );
}
