"use client";

import { SYNE } from "@/components/launch-pad";
import { NUM_FONT } from "@/components/engagement-launch-pad/styles";
import { money, pct } from "@/lib/ads/format";
import { shortDay } from "@/lib/ads/time";
import { vslHeadline, type VslBoard, type VslRow } from "@/lib/ads/vsl-shared";
import { Glass, Ico, Skeleton } from "@/components/ads/parts";
import { VIZ } from "@/components/ads/viz";

/**
 * The VSL scoreboard: which of the four VSL funnels turns CRM leads into
 * booked calls best — booking rate per VSL with its likely range, and the
 * chance each one truly books best (the counts are small, so the page says
 * how sure it is instead of crowning a winner on luck).
 */

const TROPHY = <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4ZM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" />;
const REFRESH = <path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5" />;

const VERDICT_TONE: Record<VslBoard["verdict"]["kind"], { box: string; dot: string; label: string }> = {
  clear: { box: "border-emerald-400/30 bg-emerald-500/[0.08] text-emerald-50", dot: VIZ.status.good, label: "Clear winner" },
  leading: { box: "border-cyan-400/30 bg-cyan-500/[0.07] text-cyan-50", dot: "#67e8f9", label: "Leading" },
  close: { box: "border-white/10 bg-white/[0.04] text-neutral-100", dot: VIZ.inkMuted, label: "Too close to call" },
  no_bookings: { box: "border-white/10 bg-white/[0.04] text-neutral-100", dot: VIZ.inkMuted, label: "No bookings yet" },
  no_data: { box: "border-white/10 bg-white/[0.04] text-neutral-100", dot: VIZ.inkMuted, label: "Not enough data" },
};

export function VslScoreboard({ board, loading, error, onRefresh }: { board: VslBoard | null; loading: boolean; error: string | null; onRefresh: () => void }) {
  if (!board) {
    if (loading) return <Skeleton className="h-64" />;
    return (
      <Glass className="p-4 text-sm text-neutral-300">
        {error ?? "The VSL scoreboard needs GoHighLevel connected — that's where each lead's VSL tag lives."}
      </Glass>
    );
  }
  const tone = VERDICT_TONE[board.verdict.kind];
  const maxHi = Math.max(0.25, ...board.rows.map((r) => r.range?.[1] ?? 0));
  const sorted = [...board.rows].sort((a, b) => (b.pBest ?? -1) - (a.pBest ?? -1) || b.leads - a.leads);
  return (
    <div className="space-y-3">
      <div className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-2xl border px-4 py-3 ${tone.box}`}>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full" style={{ background: `${tone.dot}26`, color: tone.dot }}>
          <Ico d={TROPHY} size={14} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-black uppercase tracking-[0.15em] opacity-80">{tone.label}</p>
          <p className="text-sm font-bold">{board.verdict.text}</p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-white/10 px-3 text-xs font-semibold text-white hover:bg-white/15 disabled:opacity-50"
        >
          <Ico d={REFRESH} size={12} className={loading ? "animate-spin" : ""} />
          {loading ? "Reading…" : "Refresh"}
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {sorted.map((r) => (
          <VslCard key={r.key} r={r} best={board.verdict.best === r.key && (board.verdict.kind === "clear" || board.verdict.kind === "leading")} scaleMax={maxHi} />
        ))}
      </div>

      <div className="space-y-1 px-1 text-[11px] leading-relaxed text-neutral-500">
        <p>
          Contacts created {shortDay(board.since)} – {shortDay(board.until)} (the four VSLs went live Nov 2), sorted by the VSL tag your site puts on each lead. Booking rate counts leads at least {board.matureDays} days old, so new
          ones have had time to book. &ldquo;Best chance&rdquo; is how likely each VSL is to truly book best given the counts so far — it firms up as leads come in.
        </p>
        {(board.unclear > 0 || board.unassignedSpendCents > 0 || board.correctionsApplied > 0 || board.truncated) && (
          <p>
            {[
              board.unclear ? `${board.unclear} contact${board.unclear === 1 ? "" : "s"} went through two VSLs and can't be told apart (left out).` : null,
              board.unassignedSpendCents ? `${money(board.unassignedSpendCents)} of ad spend went to ads whose VSL couldn't be told (left out of cost per lead).` : null,
              board.correctionsApplied ? `${board.correctionsApplied} of your lead corrections applied.` : null,
              board.truncated ? `Only the first ${board.scanned.toLocaleString("en-US")} contacts were read.` : null,
            ]
              .filter(Boolean)
              .join(" ")}
          </p>
        )}
        {board.error && <p className="text-amber-200/80">{board.error}</p>}
      </div>
    </div>
  );
}

function VslCard({ r, best, scaleMax }: { r: VslRow; best: boolean; scaleMax: number }) {
  const x = (v: number) => `${Math.max(0, Math.min(100, (v / scaleMax) * 100))}%`;
  return (
    <Glass className={`p-4 ${best ? "ring-1 ring-cyan-300/40" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-base font-bold text-white" style={SYNE}>
            {r.label}
            {best && <span className="rounded-full bg-cyan-400/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-cyan-100">Best so far</span>}
          </p>
          <p className="text-[11px] text-neutral-500">
            nexli.net{r.path}
            {r.note ? ` · ${r.note}` : ""}
          </p>
        </div>
        {r.pBest !== null && (
          <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] font-bold text-neutral-200" style={NUM_FONT} title="The chance this VSL truly books best, given the counts so far">
            {Math.round(r.pBest * 100)}% best chance
          </span>
        )}
      </div>

      <div className="mt-3 flex items-end gap-3">
        <p className="text-4xl font-bold text-white" style={NUM_FONT}>
          {r.bookingRate === null ? "—" : pct(r.bookingRate, 0)}
        </p>
        <p className="pb-1.5 text-xs text-neutral-400">
          {r.matureLeads ? (
            <>
              <span className="font-bold text-neutral-200" style={NUM_FONT}>
                {r.matureBooked} of {r.matureLeads}
              </span>{" "}
              booked a call
            </>
          ) : r.leads ? (
            `${r.leads} lead${r.leads === 1 ? "" : "s"}, all too new to judge`
          ) : (
            "no leads yet"
          )}
        </p>
      </div>

      {r.range && r.bookingRate !== null && (
        <div className="mt-2">
          <div className="relative h-2.5 rounded-full bg-white/[0.07]" role="img" aria-label={`Likely booking rate ${pct(r.range[0], 0)} to ${pct(r.range[1], 0)}`}>
            <div className="absolute top-0 h-full rounded-full" style={{ left: x(r.range[0]), width: `calc(${x(r.range[1])} - ${x(r.range[0])})`, background: `${VIZ.current}66` }} />
            <div className="absolute top-1/2 h-3.5 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" style={{ left: x(r.bookingRate) }} />
          </div>
          <p className="mt-1 text-[10px] text-neutral-500" style={NUM_FONT}>
            Likely between {pct(r.range[0], 0)} and {pct(r.range[1], 0)}
          </p>
        </div>
      )}

      <dl className="mt-3 grid grid-cols-3 gap-x-3 gap-y-2 text-[11px]" style={NUM_FONT}>
        <Stat k="Leads" v={String(r.leads)} />
        <Stat k="Qualified" v={String(r.qualified)} />
        <Stat k="Booked" v={String(r.booked)} />
        <Stat k="Won" v={String(r.won)} />
        <Stat k="Per lead" v={r.cplCents === null ? "—" : money(r.cplCents)} />
        <Stat k="Per booked call" v={r.cpbCents === null ? "—" : money(r.cpbCents)} />
      </dl>
      <p className="mt-2 text-[10px] text-neutral-500">
        {r.spendCents !== null ? `${money(r.spendCents)} spent on ${r.ads} ad${r.ads === 1 ? "" : "s"} sending people here` : "No ad spend matched to this VSL"}
        {r.flags.length ? ` · ${r.flags.join(" · ")}` : ""}
      </p>
    </Glass>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-[10px] uppercase tracking-wider text-neutral-500">{k}</dt>
      <dd className="truncate text-sm font-bold text-white">{v}</dd>
    </div>
  );
}

/** One line on Today's plan. */
export function VslStrip({ board }: { board: VslBoard | null }) {
  const h = vslHeadline(board);
  if (!h) return null;
  return (
    <a href="#vsls" className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 transition-opacity hover:opacity-90">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-400/15 text-cyan-200">
        <Ico d={TROPHY} size={12} />
      </span>
      <span className="text-sm font-bold text-white">Best VSL right now:</span>
      <span className="min-w-0 basis-full text-xs text-neutral-300 sm:flex-1 sm:basis-auto">{h.text}</span>
      <span className="text-xs font-semibold text-cyan-300">See VSLs →</span>
    </a>
  );
}
