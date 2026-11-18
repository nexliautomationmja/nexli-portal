"use client";

import { useState } from "react";
import { SYNE } from "@/components/launch-pad";
import { NUM_FONT } from "@/components/engagement-launch-pad/styles";
import { money } from "@/lib/ads/format";
import { shortDay } from "@/lib/ads/time";
import type { AdPlan, CreativeCall } from "@/lib/ads/decide";
import type { AdRow, AdsSnapshot } from "@/lib/ads/types";
import type { DailyPlanView } from "@/lib/ads/daily-plan";
import { fallbackMake, typeLabel, typeStats, stopCards, type CreativeTags, type MakeCard, type StopCard, type TypeStat } from "@/lib/ads/creative-types";
import type { TrackingVerdict } from "@/lib/ads/tracking-check";
import { Glass, Ico } from "@/components/ads/parts";
import { CallBadge } from "@/components/ads/call-badge";
import { photosHref, videosHref } from "@/components/ads/handoff";
import { VIZ } from "@/components/ads/viz";
import { CreateCreativesButton, OnDeck, type DeckState } from "@/components/ads/new-creatives";
import type { DeckItem } from "@/lib/ads/ideas-shared";
import type { VslBoard } from "@/lib/ads/vsl-shared";
import { VslStrip } from "@/components/ads/vsl-scoreboard";
import { TurnOffButton } from "@/components/ads/meta-change";

/**
 * Today's plan — the top of the Ads page: which creatives to cut (by name,
 * with a button straight to the ad), which to keep and why, how many new
 * creatives to add and what kind, and whether the tracking can be trusted.
 * The calls are live (same rules as the morning email, current numbers);
 * "what to make" is this morning's (Claude reads which creative types win).
 */

const EXT = <path d="M15 3h6v6M10 14 21 3M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />;
const weekday = (ymd: string) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" });

export function TodayPlan({
  s,
  plan,
  stored,
  today,
  tags,
  making,
  makeError,
  tracking,
  vsl,
  studioKey,
  deck,
  onMake,
  onJumpAd,
  onCreate,
  onLive,
  canTurnOff = false,
  onTurnedOff,
}: {
  s: AdsSnapshot;
  plan: AdPlan;
  stored: DailyPlanView | null;
  today: string | null;
  tags: Record<string, CreativeTags>;
  making: boolean;
  makeError: string | null;
  tracking: TrackingVerdict | null;
  vsl?: VslBoard | null;
  studioKey: string;
  deck: DeckState | null;
  onMake: () => void;
  onJumpAd: (id: string) => void;
  onCreate: () => void;
  onLive: (item: DeckItem, live: boolean) => void;
  /** Changes in Meta are on: cuts get a Turn off button. */
  canTurnOff?: boolean;
  onTurnedOff?: () => void;
}) {
  const ready = (deck?.deck ?? []).filter((d) => d.stage === "ready");
  const openCuts = plan.counts.cut;
  const adById = new Map(s.ads.map((a) => [a.id, a]));
  const cuts = plan.calls.filter((c) => c.call === "cut");
  const keeps = plan.calls.filter((c) => c.call === "keep");
  const fresh = stored && stored.status === "done" && stored.planDate === today ? stored : null;
  const types = typeStats(s.ads, tags, { cpbCents: plan.targets.cpbCents, cplCents: plan.targets.cplCents });
  const cards: MakeCard[] = fresh?.make?.cards?.length ? fresh.make.cards : fallbackMake({ add: plan.need.add, ads: s.ads, tags, plan });
  const stop: StopCard[] = stopCards(types);
  const cardsFromClaude = Boolean(fresh?.make?.cards?.length && fresh.make.source === "claude");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-neutral-400" style={NUM_FONT}>
        <span>
          {weekday(plan.date)} · results through {shortDay(plan.throughDate)} · judged against {money(plan.targets.cpbCents)} per booked call and {money(plan.targets.cplCents)} per lead
          {plan.targets.cplSource !== "settings" ? ` (${plan.targets.cplSource === "history" ? "your 60-day average" : "a third of the call target"})` : ""}
        </span>
        <span>{fresh ? `Made ${new Date(fresh.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} · updates every morning at 7:00` : "Updates every morning at 7:00"}</span>
      </div>

      {!fresh && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-cyan-400/25 bg-cyan-500/[0.06] px-4 py-3">
          <p className="min-w-0 flex-1 text-xs text-cyan-50">
            {making
              ? "Making today's plan — reading your creatives and working out what to make next (about a minute)…"
              : makeError
                ? `This morning's plan didn't finish: ${makeError}`
                : "This morning's plan isn't made yet. The calls below are already live."}
          </p>
          {!making && (
            <button type="button" onClick={onMake} className="min-h-10 rounded-full bg-white/10 px-4 text-xs font-bold text-white hover:bg-white/15">
              {makeError ? "Try again" : "Make today's plan now"}
            </button>
          )}
          {making && <span className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent" aria-hidden="true" />}
        </div>
      )}

      {/* The three numbers */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Counter
          n={plan.counts.cut}
          label="Cut"
          sub={
            plan.counts.cut
              ? `${plan.counts.early ? `${plan.counts.early} early read${plan.counts.early === 1 ? "" : "s"} · ` : ""}${canTurnOff ? "turn off below" : "turn off in Ads Manager"}`
              : plan.counts.cutDone
                ? `${plan.counts.cutDone} done today`
                : "nothing to cut"
          }
          color={VIZ.status.critical}
          href="#plan-cut"
        />
        <Counter n={plan.counts.keep} label="Keep" sub={[plan.counts.winners ? `${plan.counts.winners} winner${plan.counts.winners === 1 ? "" : "s"}` : null, plan.counts.testing ? `${plan.counts.testing} testing` : null].filter(Boolean).join(" · ") || "running"} color={VIZ.status.good} href="#plan-keep" />
        <Counter n={plan.need.add} label="Add" sub={plan.need.when === "today" ? "new creatives today" : plan.need.when === "this_week" ? "new creatives this week" : "none needed"} color={VIZ.current} href="#plan-add" />
      </div>

      {tracking && <TrackingStrip v={tracking} />}
      {vsl && <VslStrip board={vsl} />}

      <div className="grid gap-3 lg:grid-cols-2">
        <Glass id="plan-cut" className="scroll-mt-28 p-4 md:scroll-mt-20">
          <ListHead title="Cut these" count={cuts.length} color={VIZ.status.critical} />
          {canTurnOff && cuts.filter((c) => !c.done).length >= 2 && (
            <div className="mt-2">
              <TurnOffButton
                adIds={cuts.filter((c) => !c.done).map((c) => c.adId)}
                label={`Turn off all ${cuts.filter((c) => !c.done).length} in Meta`}
                confirmText={`Turn off all ${cuts.filter((c) => !c.done).length} cuts now?`}
                onDone={() => onTurnedOff?.()}
              />
            </div>
          )}
          {cuts.length === 0 ? (
            <p className="mt-3 text-sm text-neutral-300">Nothing to cut today — every live creative is earning its keep or still being tested.</p>
          ) : (
            <ul className="mt-3 space-y-2.5">
              {cuts.map((c) => (
                <CallRow key={c.adId} c={c} ad={adById.get(c.adId)} tags={tags} fixes={s.corrections?.leadFixes} onJump={onJumpAd} canTurnOff={canTurnOff} onTurnedOff={onTurnedOff} />
              ))}
            </ul>
          )}
          {cuts.some((c) => !c.done) && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-violet-400/20 bg-violet-500/[0.06] px-3 py-2.5 text-xs text-violet-50">
              {ready.length ? (
                <>
                  <span className="min-w-0 flex-1">
                    <span className="font-bold">{ready.length} ready on deck</span>
                    {ready.length >= openCuts
                      ? ` — upload one in place of each cut: ${ready.slice(0, 3).map((r) => `“${r.title}”`).join(", ")}.`
                      : ` for ${openCuts} cuts — upload ${ready.length === 1 ? "it" : "them"} (${ready.map((r) => `“${r.title}”`).join(", ")}) and make ${openCuts - ready.length} more.`}
                  </span>
                  {ready.length < openCuts && <CreateCreativesButton onClick={onCreate} tone="quiet" />}
                  <a href="#plan-deck" className="font-semibold text-cyan-300 hover:underline">
                    On deck ↓
                  </a>
                </>
              ) : (
                <>
                  <span className="min-w-0 flex-1">Nothing on deck to replace {cuts.filter((c) => !c.done).length === 1 ? "it" : "them"} yet.</span>
                  <CreateCreativesButton onClick={onCreate} tone="quiet" />
                </>
              )}
            </div>
          )}
        </Glass>
        <Glass id="plan-keep" className="scroll-mt-28 p-4 md:scroll-mt-20">
          <ListHead title="Keep these running" count={keeps.length} color={VIZ.status.good} />
          {keeps.length === 0 ? (
            <p className="mt-3 text-sm text-neutral-300">No live creatives to keep — the account needs new ones.</p>
          ) : (
            <KeepList keeps={keeps} adById={adById} tags={tags} fixes={s.corrections?.leadFixes} onJump={onJumpAd} />
          )}
        </Glass>
      </div>

      <Glass id="plan-add" className="scroll-mt-28 p-4 md:scroll-mt-20">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-white" style={SYNE}>
              {plan.need.add > 0 ? `Add ${plan.need.add} new creative${plan.need.add === 1 ? "" : "s"} ${plan.need.when === "today" ? "today" : "this week"}` : "No new creatives needed today"}
            </h3>
            <p className="mt-0.5 text-xs leading-relaxed text-neutral-300">{plan.need.why}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {plan.need.when !== "none" && (
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-wide ${plan.need.when === "today" ? "bg-blue-500/20 text-blue-100" : "bg-white/10 text-neutral-200"}`}>{plan.need.when === "today" ? "Today" : "This week"}</span>
            )}
            <CreateCreativesButton onClick={onCreate} />
          </div>
        </div>
        {plan.need.adsets.length > 1 && plan.need.add > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {plan.need.adsets
              .filter((a) => a.add > 0)
              .map((a) => (
                <li key={a.adsetId} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-neutral-300" style={NUM_FONT}>
                  {a.name}: {a.keepers} worth keeping → <span className="font-bold text-white">add {a.add}</span>
                </li>
              ))}
          </ul>
        )}
        {plan.need.add > 0 && cards.length > 0 && (
          <>
            <p className="mb-2 mt-4 text-[11px] font-black uppercase tracking-[0.15em] text-neutral-400">What to make{cardsFromClaude ? "" : " (from your best performer)"}</p>
            <div className="grid gap-3 md:grid-cols-2">
              {cards.map((m, i) => (
                <MakeCardView key={`${m.label}-${i}`} m={m} studioKey={studioKey} onJump={onJumpAd} />
              ))}
            </div>
          </>
        )}
        {stop.length > 0 && (
          <div className="mt-4 rounded-xl border border-rose-400/20 bg-rose-500/[0.06] px-3.5 py-3">
            <p className="text-[11px] font-black uppercase tracking-[0.15em] text-rose-300">Stop making</p>
            <ul className="mt-1.5 space-y-1">
              {stop.map((x) => (
                <li key={x.label} className="text-xs text-rose-50/90">
                  <span className="font-bold">{x.label}</span> — {x.why}
                </li>
              ))}
            </ul>
          </div>
        )}
        {types.length > 0 && <TypesTable types={types} target={plan.targets.cpbCents} />}
      </Glass>

      <div id="plan-deck" className="scroll-mt-28 md:scroll-mt-20">
        <OnDeck deck={deck} onCreate={onCreate} onLive={onLive} />
      </div>
    </div>
  );
}

function Counter({ n, label, sub, color, href }: { n: number; label: string; sub: string; color: string; href: string }) {
  return (
    <a href={href} className="block rounded-2xl border border-white/10 bg-white/[0.04] p-3 transition-colors hover:bg-white/[0.07] sm:p-4">
      <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.15em]" style={{ color }}>
        <span className="h-2 w-2 rounded-full" style={{ background: color }} />
        {label}
      </p>
      <p className="mt-1 text-3xl font-bold text-white sm:text-4xl" style={NUM_FONT}>
        {n}
      </p>
      <p className="mt-0.5 truncate text-[11px] text-neutral-400">{sub}</p>
    </a>
  );
}

function ListHead({ title, count, color }: { title: string; count: number; color: string }) {
  return (
    <h3 className="flex items-center gap-2 text-base font-bold text-white" style={SYNE}>
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      {title}
      <span className="text-sm font-semibold text-neutral-400" style={NUM_FONT}>
        {count}
      </span>
    </h3>
  );
}

const TRACK_TONE: Record<string, { box: string; dot: string }> = {
  ok: { box: "border-emerald-400/25 bg-emerald-500/[0.07] text-emerald-50", dot: VIZ.status.good },
  info: { box: "border-white/10 bg-white/[0.04] text-neutral-100", dot: VIZ.inkMuted },
  warning: { box: "border-amber-400/30 bg-amber-500/[0.08] text-amber-50", dot: VIZ.status.warning },
  critical: { box: "border-rose-500/40 bg-rose-500/[0.1] text-rose-50", dot: VIZ.status.critical },
};

function TrackingStrip({ v }: { v: TrackingVerdict }) {
  const t = TRACK_TONE[v.severity] ?? TRACK_TONE.info;
  return (
    <a href="#tracking" className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border px-4 py-3 transition-opacity hover:opacity-90 ${t.box}`}>
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: t.dot }} />
      <span className="text-sm font-bold">Tracking: {v.title}</span>
      <span className="min-w-0 basis-full text-xs opacity-80 sm:flex-1 sm:basis-auto">{v.week.meta + v.week.crm > 0 ? `Meta ${v.week.meta} · CRM ${v.week.crm} leads, last 7 days` : v.detail}</span>
      <span className="text-xs font-semibold">See tracking →</span>
    </a>
  );
}

function Thumb({ ad }: { ad?: AdRow }) {
  const src = ad?.creative.thumbnailUrl ?? null;
  return (
    <span className="relative flex h-14 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-black/40">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src ? <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" referrerPolicy="no-referrer" /> : <Ico d={<path d="M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5" />} size={14} className="text-neutral-500" />}
    </span>
  );
}

function CallRow({
  c,
  ad,
  tags,
  fixes,
  onJump,
  canTurnOff = false,
  onTurnedOff,
}: {
  c: CreativeCall;
  ad?: AdRow;
  tags: Record<string, CreativeTags>;
  fixes?: Record<string, { leads: number; bookings: number }>;
  onJump: (id: string) => void;
  canTurnOff?: boolean;
  onTurnedOff?: () => void;
}) {
  const t = tags[c.adId];
  const fix = fixes?.[c.adId];
  return (
    <li className="flex gap-3 rounded-xl border border-white/5 bg-black/20 p-2.5">
      <Thumb ad={ad} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" onClick={() => onJump(c.adId)} className="min-w-0 text-left text-sm font-bold text-white hover:underline">
            {c.name}
          </button>
          <CallBadge call={c} size="sm" />
        </div>
        {t && <p className="text-[10px] text-neutral-500">{typeLabel(t)}</p>}
        <p className="mt-0.5 text-xs leading-snug text-neutral-300">{c.reason}</p>
        {c.cutKind === "early_read" && c.early && !c.done && (
          <p className="mt-1 inline-flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 font-bold text-amber-100">Suggestion</span>
            <span className="text-neutral-400" style={NUM_FONT}>
              from its first {c.early.impressions.toLocaleString("en-US")} views{c.early.saveCents > 0 ? ` — the full test would wait until ${money(c.numbers.spendCents + c.early.saveCents)} spent` : ""}
            </span>
          </p>
        )}
        {c.override && c.override.ruleCall !== c.override.call && (
          <p className="mt-0.5 text-[11px] leading-snug text-neutral-500">
            The rules say {c.override.ruleCall}: {c.override.ruleReason}
          </p>
        )}
        {fix && (fix.leads > 0 || fix.bookings > 0) && (
          <p className="mt-0.5 text-[11px] font-semibold text-cyan-300/90">
            {[fix.leads ? `${fix.leads} lead${fix.leads === 1 ? "" : "s"}` : null, fix.bookings ? `${fix.bookings} booked call${fix.bookings === 1 ? "" : "s"}` : null].filter(Boolean).join(" and ")} you marked not real {fix.leads + fix.bookings === 1 ? "isn't" : "aren't"} counted
          </p>
        )}
        {c.decideAt && (
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(c.decideAt.progress * 100)} aria-label="Spent toward the decision">
              <div className="h-full rounded-full" style={{ width: `${Math.max(4, c.decideAt.progress * 100)}%`, background: VIZ.current }} />
            </div>
            <span className="shrink-0 text-[10px] text-neutral-400" style={NUM_FONT}>
              decide at {money(c.decideAt.spendCents)}
              {c.decideAt.days !== null ? ` · ~${c.decideAt.days}d` : ""}
            </span>
          </div>
        )}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          {!(c.call === "cut" && !c.done && ad?.adsManagerUrl) && <span className="text-[11px] font-semibold text-neutral-400">{c.action}</span>}
          {c.call === "cut" && !c.done && canTurnOff && <TurnOffButton adIds={[c.adId]} label="Turn off in Meta" confirmText="Turn it off now?" onDone={() => onTurnedOff?.()} />}
          {c.call === "cut" && !c.done && ad?.adsManagerUrl && (
            <a
              href={ad.adsManagerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={
                canTurnOff
                  ? "inline-flex min-h-9 items-center gap-1 text-[11px] font-semibold text-neutral-400 hover:text-white"
                  : "inline-flex min-h-9 items-center gap-1 rounded-full bg-rose-500/20 px-3 text-[11px] font-bold text-rose-50 hover:bg-rose-500/30"
              }
            >
              {canTurnOff ? "Ads Manager" : "Turn it off in Ads Manager"} <Ico d={EXT} size={11} />
            </a>
          )}
        </div>
      </div>
    </li>
  );
}

function KeepList({ keeps, adById, tags, fixes, onJump }: { keeps: CreativeCall[]; adById: Map<string, AdRow>; tags: Record<string, CreativeTags>; fixes?: Record<string, { leads: number; bookings: number }>; onJump: (id: string) => void }) {
  const [all, setAll] = useState(false);
  const shown = all ? keeps : keeps.slice(0, 6);
  return (
    <>
      <ul className="mt-3 space-y-2.5">
        {shown.map((c) => (
          <CallRow key={c.adId} c={c} ad={adById.get(c.adId)} tags={tags} fixes={fixes} onJump={onJump} />
        ))}
      </ul>
      {keeps.length > 6 && (
        <button type="button" onClick={() => setAll((v) => !v)} className="mt-2 min-h-9 text-xs font-semibold text-cyan-300 hover:underline">
          {all ? "Show fewer" : `Show all ${keeps.length}`}
        </button>
      )}
    </>
  );
}

function MakeCardView({ m, studioKey, onJump }: { m: MakeCard; studioKey: string; onJump: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const href = m.format === "video" ? videosHref(studioKey, m.brief, m.count) : photosHref(studioKey, m.brief, m.count);
  return (
    <div className="flex flex-col rounded-xl border border-blue-400/20 bg-blue-500/[0.06] p-3.5">
      <p className="text-sm font-bold text-white">
        <span style={NUM_FONT}>{m.count} ×</span> {m.label} <span className="font-semibold text-neutral-400">· {m.format === "video" ? "videos" : "photo ads"}</span>
      </p>
      <p className="mt-1 text-xs leading-snug text-neutral-300">{m.why}</p>
      {m.basedOn.length > 0 && (
        <p className="mt-1 text-[11px] text-neutral-400">
          Based on{" "}
          {m.basedOn.map((b, i) => (
            <span key={b.adId}>
              {i > 0 && ", "}
              <button type="button" onClick={() => onJump(b.adId)} className="font-semibold text-cyan-300 hover:underline">
                {b.name}
              </button>
            </span>
          ))}
        </p>
      )}
      {open && <p className="mt-2 whitespace-pre-wrap rounded-lg bg-black/30 p-2.5 text-xs leading-relaxed text-neutral-200">{m.brief}</p>}
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
        <a href={href} className="inline-flex min-h-10 items-center rounded-full bg-blue-600 px-4 text-xs font-bold text-white hover:bg-blue-500">
          Make {m.count === 1 ? "it" : "them"} in Creative Studio
        </a>
        <button type="button" onClick={() => setOpen((v) => !v)} className="min-h-10 px-2 text-xs font-semibold text-neutral-300 hover:text-white">
          {open ? "Hide the brief" : "Read the brief"}
        </button>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(m.brief).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
          className="min-h-10 px-2 text-xs font-semibold text-neutral-300 hover:text-white"
        >
          {copied ? "Copied" : "Copy brief"}
        </button>
      </div>
    </div>
  );
}

const VERDICT_TONE: Record<TypeStat["verdict"], { label: string; cls: string }> = {
  best: { label: "Best", cls: "bg-emerald-500/15 text-emerald-200" },
  good: { label: "OK", cls: "bg-white/10 text-neutral-200" },
  weak: { label: "Stop", cls: "bg-rose-500/15 text-rose-200" },
  unproven: { label: "Unproven", cls: "bg-white/5 text-neutral-400" },
};

function TypesTable({ types, target }: { types: TypeStat[]; target: number }) {
  return (
    <div className="mt-4">
      <p className="mb-2 text-[11px] font-black uppercase tracking-[0.15em] text-neutral-400">Your creative types · last 30 days</p>
      <div className="cs-scroll -mx-1 overflow-x-auto px-1">
        <table className="w-full min-w-[480px] text-left text-xs" style={NUM_FONT}>
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-neutral-500">
              <th className="py-1.5 pr-2 font-bold">Type</th>
              <th className="py-1.5 pr-2 text-right font-bold">Ads</th>
              <th className="py-1.5 pr-2 text-right font-bold">Spent</th>
              <th className="py-1.5 pr-2 text-right font-bold">Booked</th>
              <th className="py-1.5 pr-2 text-right font-bold">Per booked call</th>
              <th className="py-1.5 font-bold" />
            </tr>
          </thead>
          <tbody>
            {types.map((t) => (
              <tr key={t.key} className="border-t border-white/5">
                <td className="py-1.5 pr-2 font-semibold text-neutral-100">{t.label}</td>
                <td className="py-1.5 pr-2 text-right text-neutral-300">{t.ads}</td>
                <td className="py-1.5 pr-2 text-right text-neutral-300">{money(t.spendCents)}</td>
                <td className="py-1.5 pr-2 text-right text-neutral-300">{t.booked}</td>
                <td className={`py-1.5 pr-2 text-right font-bold ${t.cpbCents !== null && t.cpbCents <= target ? "text-emerald-300" : "text-neutral-200"}`}>{money(t.cpbCents)}</td>
                <td className="py-1.5">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${VERDICT_TONE[t.verdict].cls}`}>{VERDICT_TONE[t.verdict].label}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
