"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SHIMMER_CONIC, ShimmerPill, SYNE } from "@/components/launch-pad";
import { NUM_FONT } from "@/components/engagement-launch-pad/styles";
import { ErrorStrip, GradientText, LaunchPadCanvas } from "@/components/creative-studio/canvas";
import { MetaLogo } from "@/components/creative-studio/meta";
import { shortDay } from "@/lib/ads/time";
import { money } from "@/lib/ads/format";
import { ADS_RANGES, type AdsRange, type AdsSnapshot, type Signal } from "@/lib/ads/types";
import { Ico, SectionHead, Skeleton } from "@/components/ads/parts";
import { KpiRow } from "@/components/ads/kpi-row";
import { TrendCharts } from "@/components/ads/trend-charts";
import { FatigueBoard } from "@/components/ads/fatigue-board";
import { StructureTable } from "@/components/ads/structure-table";
import { AudiencePlacements } from "@/components/ads/audience-placements";
import { Funnel, SignalsCard, TrackingHealth } from "@/components/ads/funnel-tracking";

type SnapshotResponse = { configured: false } | { configured: true; snapshot: AdsSnapshot; cachedAt: string; stale: boolean } | { error: string };

const RANGE_KEY = "nexli.ads.range";

export const SECTIONS = [
  { id: "read", label: "The read" },
  { id: "kpis", label: "KPIs" },
  { id: "trends", label: "Trends" },
  { id: "creatives", label: "Creatives" },
  { id: "structure", label: "Campaigns" },
  { id: "audience", label: "Audience" },
  { id: "funnel", label: "Funnel" },
] as const;

function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

const ago = (iso: string, now: number) => {
  const m = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
};

function RangeControl({ value, onChange, busy }: { value: AdsRange; onChange: (r: AdsRange) => void; busy: boolean }) {
  return (
    <div className="inline-flex rounded-2xl border border-white/10 bg-white/[0.04] p-1" role="radiogroup" aria-label="Date range">
      {ADS_RANGES.map((r) => (
        <button
          key={r}
          type="button"
          role="radio"
          aria-checked={value === r}
          onClick={() => onChange(r)}
          className={`min-h-10 min-w-[3.25rem] rounded-xl px-3 text-xs font-bold transition-all ${
            value === r ? "bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-500/30" : "text-neutral-400 hover:bg-white/[0.06] hover:text-white"
          }`}
          style={NUM_FONT}
        >
          {busy && value === r ? <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white/80 border-t-transparent align-middle" /> : `${r}D`}
        </button>
      ))}
    </div>
  );
}

/** Scroll-spy chips: which section is on screen. */
function useActiveSection(ids: readonly string[]) {
  const [active, setActive] = useState<string>(ids[0]);
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      let cur = ids[0];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= window.innerHeight * 0.3) cur = id;
      }
      setActive(cur);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [ids]);
  return active;
}

export function SectionNav({ sections }: { sections: readonly { id: string; label: string }[] }) {
  const ids = useMemo(() => sections.map((s) => s.id), [sections]);
  const active = useActiveSection(ids);
  return (
    <nav aria-label="Sections" className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-30 -mx-4 mb-6 border-b border-white/5 bg-[#020617]/85 px-4 py-2 backdrop-blur-xl sm:-mx-6 sm:px-6 md:top-0">
      <div className="cs-scroll flex gap-1.5 overflow-x-auto">
        {sections.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            onClick={(e) => {
              e.preventDefault();
              document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className={`flex min-h-9 shrink-0 items-center whitespace-nowrap rounded-full border px-3 text-[11px] font-bold transition-colors ${
              active === s.id ? "border-blue-500 bg-blue-600 text-white" : "border-white/10 bg-white/5 text-neutral-400 hover:text-white"
            }`}
          >
            {s.label}
          </a>
        ))}
      </div>
    </nav>
  );
}

export function useSnapshot() {
  const [range, setRangeState] = useState<AdsRange>("30");
  const [res, setRes] = useState<SnapshotResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  const load = useCallback(async (r: AdsRange, refresh = false) => {
    const mine = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(`/api/dashboard/ads/snapshot?range=${r}${refresh ? "&refresh=1" : ""}`, { cache: "no-store" });
      const data = (await resp.json().catch(() => null)) as SnapshotResponse | null;
      if (mine !== seq.current) return;
      if (!resp.ok || !data || "error" in data) throw new Error((data && "error" in data && data.error) || `Couldn't load the numbers (${resp.status})`);
      setRes(data);
    } catch (err) {
      if (mine === seq.current) setError(err instanceof Error ? err.message : "Couldn't load the numbers");
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let saved: AdsRange = "30";
    try {
      const v = localStorage.getItem(RANGE_KEY);
      if (v === "7" || v === "14" || v === "30" || v === "90") saved = v;
    } catch {}
    setRangeState(saved);
    void load(saved);
  }, [load]);

  const setRange = useCallback(
    (r: AdsRange) => {
      setRangeState(r);
      try {
        localStorage.setItem(RANGE_KEY, r);
      } catch {}
      void load(r);
    },
    [load]
  );

  return { range, setRange, res, loading, error, setError, reload: (refresh = false) => load(range, refresh) };
}

function ConnectCard() {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-sm text-neutral-300">
      <p className="text-base font-bold text-white" style={SYNE}>
        Connect Meta ads first
      </p>
      <p className="mt-2">
        Add <code className="rounded bg-white/10 px-1">META_ADS_ACCESS_TOKEN</code> (a System User token with ads_read) and <code className="rounded bg-white/10 px-1">META_AD_ACCOUNT_ID</code> in Vercel, then
        redeploy. The Overview&apos;s Meta ads section uses the same two.
      </p>
    </div>
  );
}

export function Hero({
  s,
  range,
  onRange,
  loading,
  onRefresh,
}: {
  s: AdsSnapshot | null;
  range: AdsRange;
  onRange: (r: AdsRange) => void;
  loading: boolean;
  onRefresh: () => void;
}) {
  const now = useNow();
  return (
    <header className="lp-card pb-6 pt-8 text-center sm:pt-14">
      <ShimmerPill conic={SHIMMER_CONIC}>
        <MetaLogo className="h-auto w-[18px]" />
        <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white">Ads command center</span>
      </ShimmerPill>
      <h1 className="mt-5 text-4xl font-bold tracking-tighter text-white sm:text-6xl" style={SYNE}>
        Ads that <GradientText>book calls.</GradientText>
      </h1>
      <p className="mx-auto mt-3 max-w-2xl text-sm text-neutral-400 sm:text-base">
        Every number from Meta and GoHighLevel in one place, and Manus&apos;s read on what to do next. Read-only: Manus advises, you make the changes in Ads Manager.
      </p>
      {s && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-neutral-500" style={NUM_FONT}>
          <span className="font-semibold text-neutral-300">{s.account.name ?? "Ad account"}</span>
          <span>act_{s.account.id}</span>
          <span>{s.account.timezone.replace(/_/g, " ")}</span>
          {s.account.status.tone !== "ok" && <span className="rounded-full bg-rose-500/15 px-2 py-0.5 font-bold text-rose-200">{s.account.status.label}</span>}
          {s.today && <span>{money(s.today.spendCents)} spent today so far</span>}
        </div>
      )}
      <div className="mt-5 flex flex-col items-center gap-2">
        <RangeControl value={range} onChange={onRange} busy={loading} />
        <p className="text-[11px] text-neutral-500" style={NUM_FONT}>
          {s ? (
            <>
              {shortDay(s.range.since)} – {shortDay(s.range.until)} vs {shortDay(s.range.prevSince)} – {shortDay(s.range.prevUntil)} · updated {ago(s.fetchedAt, now)} ·{" "}
            </>
          ) : null}
          <button type="button" onClick={onRefresh} disabled={loading} className="inline-flex min-h-8 items-center gap-1 font-semibold text-cyan-300 hover:underline disabled:opacity-50">
            <Ico d={<path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5" />} size={11} />
            Refresh
          </button>
        </p>
        {s && (
          <p className="text-[10px] text-neutral-600" title="Ads Manager's Last N days use the ad account's timezone and complete days; the Overview counts back from now, so the two can differ slightly.">
            Complete days in the ad account&apos;s timezone, like Ads Manager
          </p>
        )}
      </div>
    </header>
  );
}

export function jumpTo(sig: Signal, s: AdsSnapshot) {
  if (!sig.ref?.id) return;
  if (sig.ref.level === "ad") {
    const el = document.getElementById(`ad-${sig.ref.id}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
  }
  const url =
    sig.ref.level === "adset" ? s.adsets.find((a) => a.id === sig.ref?.id)?.adsManagerUrl : sig.ref.level === "campaign" ? s.campaigns.find((c) => c.id === sig.ref?.id)?.adsManagerUrl : s.ads.find((a) => a.id === sig.ref?.id)?.adsManagerUrl;
  if (url) window.open(url, "_blank", "noopener,noreferrer");
}

export function SnapshotSections({ s, extraRead }: { s: AdsSnapshot; extraRead?: React.ReactNode }) {
  return (
    <>
      <section className="lp-card mb-10">
        <SectionHead id="read" eyebrow="The read" title="What the numbers say" sub="Flags straight from the data, refreshed every time you load the page." />
        {extraRead}
        <SignalsCard s={s} onJump={(sig) => jumpTo(sig, s)} />
      </section>
      <section className="lp-card mb-10" style={{ animationDelay: "0.05s" }}>
        <SectionHead id="kpis" eyebrow="Scorecard" title={`The last ${s.range.days} days`} sub="Leads and booked calls come from GoHighLevel; spend and delivery from Meta." />
        <KpiRow s={s} />
      </section>
      <section className="lp-card mb-10" style={{ animationDelay: "0.1s" }}>
        <SectionHead id="trends" eyebrow="Trends" title="Day by day" sub="This period against the one before it, lined up day for day." />
        <TrendCharts s={s} />
      </section>
      <section className="lp-card mb-10">
        <SectionHead
          id="creatives"
          eyebrow="Creatives"
          title="Fatigue board"
          sub={`Every creative's last 7 days (${shortDay(s.fatigueWindow.l7[0])} – ${shortDay(s.fatigueWindow.l7[1])}) against the 14 before, plus 30-day results.`}
        />
        <FatigueBoard s={s} />
      </section>
      <section className="lp-card mb-10">
        <SectionHead id="structure" eyebrow="Structure" title="Campaigns & ad sets" sub="Budgets, learning phase and results, with links straight into Ads Manager." />
        <StructureTable s={s} />
      </section>
      <section className="lp-card mb-10">
        <SectionHead id="audience" eyebrow="Audience" title="Platforms, placements & people" />
        <AudiencePlacements s={s} />
      </section>
      <section className="lp-card mb-10">
        <SectionHead id="funnel" eyebrow="Funnel" title="Funnel & tracking" sub="Where people drop off, and whether the tracking can be trusted." />
        <div className="grid gap-3 lg:grid-cols-2">
          <Funnel s={s} />
          <TrackingHealth s={s} />
        </div>
      </section>
    </>
  );
}

export function AdsCommandCenter() {
  const { range, setRange, res, loading, error, setError, reload } = useSnapshot();
  const s = res && "configured" in res && res.configured ? res.snapshot : null;
  const notConfigured = res && "configured" in res && !res.configured;

  return (
    <LaunchPadCanvas>
      <div className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        <Hero s={s} range={range} onRange={setRange} loading={loading} onRefresh={() => void reload(true)} />
        {error && (
          <div className="mb-4">
            <ErrorStrip onClose={() => setError(null)}>{error}</ErrorStrip>
          </div>
        )}
        {notConfigured ? (
          <ConnectCard />
        ) : !s ? (
          <div className="space-y-4">
            <Skeleton className="h-40" />
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
            <Skeleton className="h-64" />
          </div>
        ) : (
          <div className={`transition-opacity duration-300 ${loading ? "opacity-60" : ""}`}>
            <SectionNav sections={SECTIONS} />
            {(s.errors.meta || s.partial.length > 0) && (
              <div className="mb-6 rounded-2xl border border-amber-400/25 bg-amber-500/[0.07] px-4 py-3 text-xs text-amber-100">
                {s.errors.meta ?? "Some numbers are incomplete:"}
                {s.partial.length > 0 && (
                  <ul className="mt-1 list-disc pl-4 text-amber-100/80">
                    {s.partial.slice(0, 5).map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <SnapshotSections s={s} />
          </div>
        )}
      </div>
    </LaunchPadCanvas>
  );
}
