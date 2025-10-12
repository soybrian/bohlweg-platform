"use client";

import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex justify-center px-4 pt-32">
      <div className="text-center space-y-6">
        {/* Text */}
        <p className="text-xs text-white/30">
          hier passiert etwas wunderbares ✨
        </p>

        {/* Navigation Links */}
        <div className="flex gap-3">
          <Link
            href="/research/ideas"
            className="glass-card border border-white/10 hover:border-white/20 px-5 py-3 text-xs text-white/60 hover:text-white transition-all"
          >
            Ideenplattform
          </Link>

          <Link
            href="/research/issues"
            className="glass-card border border-white/10 hover:border-white/20 px-5 py-3 text-xs text-white/60 hover:text-white transition-all"
          >
            Mängelmelder
          </Link>
        </div>
      </div>
    </div>
  );
}
