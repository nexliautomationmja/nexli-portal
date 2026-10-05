"use client";

import { useEffect } from "react";

export interface WeeklyUpdateCardData {
  id: string;
  weekStart: string;
  headline: string | null;
  body: string;
  adSpendCents: number | null;
  sentAt: string;
  viewedAt: string | null;
}

function money(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString("en-US")}`;
}

function weekLabel(weekStart: string): string {
  return new Date(`${weekStart}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * "This week from your Nexli team" — the latest update Marcel sent this
 * client, on their dashboard Overview. Stamps viewedAt once on mount so the
 * Client Tracker shows whether it was opened.
 */
export function WeeklyUpdateCard({ update }: { update: WeeklyUpdateCardData }) {
  useEffect(() => {
    if (update.viewedAt) return;
    fetch("/api/dashboard/client-success/mine", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updateId: update.id }),
    }).catch(() => {});
  }, [update.id, update.viewedAt]);

  const paragraphs = update.body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const sentLabel = new Date(update.sentAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return (
    <div className="glass-card p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-1" style={{ color: "var(--text-muted)" }}>
            This week from your Nexli team
          </p>
          <h2 className="text-lg font-bold" style={{ color: "var(--text-main)" }}>
            {update.headline || `Week of ${weekLabel(update.weekStart)}`}
          </h2>
        </div>
        <span className="text-xs shrink-0" style={{ color: "var(--text-muted)" }}>
          Sent {sentLabel}
        </span>
      </div>

      <div className="space-y-3">
        {paragraphs.map((p, i) => (
          <p key={i} className="text-sm leading-relaxed whitespace-pre-line" style={{ color: "var(--text-main)" }}>
            {p}
          </p>
        ))}
      </div>

      {update.adSpendCents != null && update.adSpendCents > 0 && (
        <div
          className="mt-4 inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm"
          style={{ borderColor: "var(--card-border)", background: "var(--input-bg)", color: "var(--text-main)" }}
        >
          <span className="text-base">📣</span>
          <span>
            <span className="font-bold">{money(update.adSpendCents)}</span>{" "}
            <span style={{ color: "var(--text-muted)" }}>ad budget deployed this week</span>
          </span>
        </div>
      )}
    </div>
  );
}
