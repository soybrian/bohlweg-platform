"use client";

import { useState, useEffect } from "react";
import { ChevronDown, Lightbulb, AlertTriangle, X, Calendar, FileText, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      setIsScrolled(scrollPosition > 10);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  return (
    <>
      {/* Navbar */}
      <nav className="sticky top-0 z-50 w-full mb-4 will-change-transform">
        <div className="mx-4 md:mx-6 pt-4">
          <div
            className={cn(
              "flex items-center justify-between h-12 rounded-xl px-5 transition-all duration-500 ease-out",
              isScrolled || isOpen
                ? "glass-card border-none"
                : "bg-transparent"
            )}
          >
            {/* Logo */}
            <a
              href="/"
              className="text-sm font-bold text-white tracking-tight hover:text-white/80 transition-colors"
            >
              BOHLWEG
            </a>

            {/* Menu Toggle */}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className={cn(
                "inline-flex items-center gap-1 text-xs font-medium transition-all duration-200",
                isOpen ? "text-white" : "text-white/60 hover:text-white/80"
              )}
            >
              {isOpen ? (
                <>
                  <span>SCHLIESSEN</span>
                  <X className="h-3.5 w-3.5" />
                </>
              ) : (
                <>
                  <span>MENÜ</span>
                  <ChevronDown className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* Fullscreen Mobile Menu */}
      <div
        className={cn(
          "fixed inset-0 z-40 transition-all duration-500 ease-out",
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
      >
        {/* Backdrop */}
        <div
          className={cn(
            "absolute inset-0 bg-black/80 backdrop-blur-xl transition-opacity duration-75",
            isOpen ? "opacity-100" : "opacity-0"
          )}
          onClick={() => setIsOpen(false)}
        />

        {/* Menu Content */}
        <div className="relative h-full flex items-center justify-center">
          <div
            className={cn(
              "transform transition-all duration-500 ease-out space-y-6 px-8 w-full max-w-sm",
              isOpen ? "translate-y-0 opacity-100 scale-100" : "translate-y-8 opacity-0 scale-95"
            )}
          >
            {/* Kategorie: Recherche */}
            <div>
              <div
                className={cn(
                  "text-xs font-bold text-white/40 uppercase tracking-wider mb-3 px-2 transition-all duration-500 ease-out",
                  isOpen ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4"
                )}
                style={{ transitionDelay: isOpen ? "150ms" : "0ms" }}
              >
                Recherche
              </div>
              <div className="space-y-2">
                <a
                  href="/research/ideas"
                  className={cn(
                    "flex items-center gap-3 px-6 py-4 rounded-xl text-white/80 hover:text-white bg-white/5 hover:bg-white/10 transition-all duration-300 backdrop-blur-sm border border-white/10",
                    "transform transition-all duration-500 ease-out",
                    isOpen ? "translate-x-0 opacity-100" : "-translate-x-8 opacity-0"
                  )}
                  style={{ transitionDelay: isOpen ? "200ms" : "0ms" }}
                  onClick={() => setIsOpen(false)}
                >
                  <Lightbulb className="h-5 w-5" />
                  <span className="text-base font-medium">Ideenplattform</span>
                </a>
                <a
                  href="/research/issues"
                  className={cn(
                    "flex items-center gap-3 px-6 py-4 rounded-xl text-white/80 hover:text-white bg-white/5 hover:bg-white/10 transition-all duration-300 backdrop-blur-sm border border-white/10",
                    "transform transition-all duration-500 ease-out",
                    isOpen ? "translate-x-0 opacity-100" : "-translate-x-8 opacity-0"
                  )}
                  style={{ transitionDelay: isOpen ? "250ms" : "0ms" }}
                  onClick={() => setIsOpen(false)}
                >
                  <AlertTriangle className="h-5 w-5" />
                  <span className="text-base font-medium">Mängelmelder</span>
                </a>
                <div
                  className={cn(
                    "flex items-center gap-3 px-6 py-4 rounded-xl text-white/30 bg-white/5 transition-all duration-300 backdrop-blur-sm border border-white/10 cursor-not-allowed",
                    "transform transition-all duration-500 ease-out",
                    isOpen ? "translate-x-0 opacity-100" : "-translate-x-8 opacity-0"
                  )}
                  style={{ transitionDelay: isOpen ? "300ms" : "0ms" }}
                >
                  <FileText className="h-5 w-5" />
                  <span className="text-base font-medium">Insolvenzen</span>
                  <span className="ml-auto text-[10px] px-2 py-0.5 bg-white/10 rounded">Bald</span>
                </div>
              </div>
            </div>

            {/* Kategorie: Events */}
            <div>
              <div
                className={cn(
                  "text-xs font-bold text-white/40 uppercase tracking-wider mb-3 px-2 transition-all duration-500 ease-out",
                  isOpen ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4"
                )}
                style={{ transitionDelay: isOpen ? "350ms" : "0ms" }}
              >
                Events
              </div>
              <div className="space-y-2">
                <a
                  href="/events"
                  className={cn(
                    "flex items-center gap-3 px-6 py-4 rounded-xl text-white/80 hover:text-white bg-white/5 hover:bg-white/10 transition-all duration-300 backdrop-blur-sm border border-white/10",
                    "transform transition-all duration-500 ease-out",
                    isOpen ? "translate-x-0 opacity-100" : "-translate-x-8 opacity-0"
                  )}
                  style={{ transitionDelay: isOpen ? "400ms" : "0ms" }}
                  onClick={() => setIsOpen(false)}
                >
                  <Calendar className="h-5 w-5" />
                  <span className="text-base font-medium">Veranstaltungen</span>
                </a>
              </div>
            </div>

            {/* Kategorie: Politik */}
            <div>
              <div
                className={cn(
                  "text-xs font-bold text-white/40 uppercase tracking-wider mb-3 px-2 transition-all duration-500 ease-out",
                  isOpen ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4"
                )}
                style={{ transitionDelay: isOpen ? "450ms" : "0ms" }}
              >
                Politik
              </div>
              <div className="space-y-2">
                <div
                  className={cn(
                    "flex items-center gap-3 px-6 py-4 rounded-xl text-white/30 bg-white/5 transition-all duration-300 backdrop-blur-sm border border-white/10 cursor-not-allowed",
                    "transform transition-all duration-500 ease-out",
                    isOpen ? "translate-x-0 opacity-100" : "-translate-x-8 opacity-0"
                  )}
                  style={{ transitionDelay: isOpen ? "500ms" : "0ms" }}
                >
                  <Building2 className="h-5 w-5" />
                  <span className="text-base font-medium">Ratsinformationssystem</span>
                  <span className="ml-auto text-[10px] px-2 py-0.5 bg-white/10 rounded">Bald</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
