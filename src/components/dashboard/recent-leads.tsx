"use client";

import { useGHL } from "@/lib/hooks/use-ghl";
import { formatDateFull } from "@/lib/format";

export function RecentLeads() {
  const { data, loading } = useGHL();

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-14 rounded-xl animate-pulse"
            style={{ background: "var(--glass-border)" }}
          />
        ))}
      </div>
    );
  }

  if (!data || data.recentLeads.length === 0) {
    return (
      <div className="text-sm py-8 text-center" style={{ color: "var(--text-muted)" }}>
        No leads yet. Connect GoHighLevel in Settings to see lead data.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {data.recentLeads.map((lead) => (
        <div
          key={lead.id}
          className="flex items-center justify-between p-3 rounded-xl border border-[var(--glass-border)] hover:bg-[var(--glass-bg)] transition-colors"
        >
          <div>
            <p className="text-sm font-medium" style={{ color: "var(--text-main)" }}>
              {[lead.firstName, lead.lastName].filter(Boolean).join(" ") || "Unknown"}
            </p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {lead.email || lead.phone || "No contact info"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {formatDateFull(lead.dateAdded)}
            </p>
            {lead.source && (
              <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20">
                {lead.source}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
