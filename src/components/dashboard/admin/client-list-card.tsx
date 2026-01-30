"use client";

import { cn } from "@/lib/utils";
import { compactNumber } from "@/lib/format";

interface ClientListCardProps {
  client: {
    id: string;
    name: string | null;
    email: string;
    companyName: string | null;
    websiteUrl: string | null;
    active: boolean;
    pageViews30d: number;
    uniqueVisitors30d: number;
  };
  isSelected: boolean;
  onClick: () => void;
}

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function UsersSmallIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 21a8 8 0 0 0-16 0" />
      <circle cx="10" cy="8" r="5" />
      <path d="M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3" />
    </svg>
  );
}

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </svg>
  );
}

export function ClientListCard({ client, isSelected, onClick }: ClientListCardProps) {
  const displayName = client.companyName || client.name || "Unnamed Client";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left p-4 rounded-2xl border transition-all duration-200",
        isSelected
          ? "border-blue-500/30 bg-blue-500/5"
          : "border-[var(--glass-border)] hover:border-blue-500/20 hover:bg-[var(--glass-bg)]"
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold text-sm"
          style={{ background: "linear-gradient(135deg, #2563EB, #06B6D4)" }}
        >
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-bold truncate" style={{ color: "var(--text-main)" }}>
              {displayName}
            </h4>
            <span
              className={cn(
                "shrink-0 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border",
                client.active
                  ? "bg-green-500/10 border-green-500/20 text-green-400"
                  : "bg-yellow-500/10 border-yellow-500/20 text-yellow-400"
              )}
            >
              {client.active ? "Active" : "Inactive"}
            </span>
          </div>
          <p className="text-xs truncate mt-0.5" style={{ color: "var(--text-muted)" }}>
            {client.email}
          </p>
          <div className="flex items-center gap-4 mt-2">
            <span className="flex items-center gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
              <EyeIcon className="w-3 h-3" />
              {compactNumber(client.pageViews30d)}
            </span>
            <span className="flex items-center gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
              <UsersSmallIcon className="w-3 h-3" />
              {compactNumber(client.uniqueVisitors30d)}
            </span>
            {client.websiteUrl && (
              <span className="flex items-center gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
                <GlobeIcon className="w-3 h-3" />
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
