"use client";

import { useEffect } from "react";
import { ArrowRight, Megaphone } from "lucide-react";
import { ButtonLink, Chip, Surface } from "@/components/rainmaker";
import { moneyWhole } from "@/lib/format";

export interface WeeklyUpdateCardData {
  id: string;
  weekStart: string;
  headline: string | null;
  body: string;
  adSpendCents: number | null;
  sentAt: string;
  viewedAt: string | null;
}

function weekLabel(weekStart: string): string {
  return new Date(`${weekStart}T00:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" });
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
  const sentLabel = new Date(update.sentAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <Surface className="p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300/80">This week from your Nexli team</div>
          <h3 className="text-lg font-bold text-white">{update.headline || `Week of ${weekLabel(update.weekStart)}`}</h3>
        </div>
        <Chip size="xs">Sent {sentLabel}</Chip>
      </div>
      <div className="space-y-3">
        {paragraphs.map((p, i) => (
          <p key={i} className="whitespace-pre-line text-sm leading-relaxed text-neutral-200">
            {p}
          </p>
        ))}
      </div>
      {update.adSpendCents != null && update.adSpendCents > 0 && (
        <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm">
          <Megaphone className="h-4 w-4 text-amber-300" aria-hidden="true" />
          <span className="font-bold text-white">{moneyWhole(update.adSpendCents)}</span>
          <span className="text-neutral-400">ad budget deployed this week</span>
        </div>
      )}
      <div className="mt-4 border-t border-white/10 pt-3">
        <ButtonLink href="/dashboard/nexli-messages" variant="ghost">
          Reply in messages <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </ButtonLink>
      </div>
    </Surface>
  );
}
