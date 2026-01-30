"use client";

import { useState } from "react";
import { Sidebar } from "./sidebar";
import { NexliLogo } from "@/components/ui/nexli-logo";

interface HeaderProps {
  isAdmin: boolean;
  userName?: string | null;
}

export function MobileHeader({ isAdmin, userName }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      {/* Mobile top bar */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-50 glass-nav px-4 py-3 flex items-center justify-between">
        <NexliLogo iconSize="w-6 h-6" textSize="text-sm" gradientId="logo-grad-mobile" />

        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="w-9 h-9 rounded-lg flex items-center justify-center bg-[var(--glass-bg)] border border-[var(--glass-border)]"
          aria-label="Toggle menu"
        >
          {menuOpen ? (
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" /><path d="m6 6 12 12" />
            </svg>
          ) : (
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" x2="20" y1="12" y2="12" />
              <line x1="4" x2="20" y1="6" y2="6" />
              <line x1="4" x2="20" y1="18" y2="18" />
            </svg>
          )}
        </button>
      </header>

      {/* Mobile menu overlay */}
      {menuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-[var(--bg-main)]/80 backdrop-blur-sm">
          <div className="absolute top-14 left-4 right-4 bottom-4">
            <Sidebar
              isAdmin={isAdmin}
              userName={userName}
              onClose={() => setMenuOpen(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}
