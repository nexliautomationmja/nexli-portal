"use client";

import { labelCls } from "@/components/launch-pad";
import { count, decimal, money, multiple, pct } from "@/lib/ads/format";
import { div, rel } from "@/lib/ads/math";
import type { AdsSnapshot, Delta } from "@/lib/ads/types";
import { BIG_NUM, DeltaChip, Glass, Sparkline } from "@/components/ads/parts";
import { VIZ } from "@/components/ads/viz";

/** Rolling 7-day cost per booked call, day by day (null until there's a booking in the window). */
export function rollingCpb(points: ({ spendCents: number; booked: number } | null)[]): (number | null)[] {
  return points.map((_, i) => {
    let spend = 0;
    let booked = 0;
    for (let k = Math.max(0, i - 6); k <= i; k++) {
      spend += points[k]?.spendCents ?? 0;
      booked += points[k]?.booked ?? 0;
    }
    return booked > 0 ? spend / booked : null;
  });
}

interface Tile {
  key: string;
  label: string;
  value: string;
  delta?: Delta;
  sub?: React.ReactNode;
  spark?: (number | null)[];
  hint: string;
}

function TileCard({ t, vs, size = "md" }: { t: Tile; vs: string; size?: "md" | "sm" }) {
  return (
    <Glass className={`flex min-w-0 flex-col ${size === "sm" ? "p-3" : "p-4"}`}>
      <p className={`${labelCls} truncate`} title={t.hint}>
        {t.label}
      </p>
      <p className={`font-extrabold leading-none text-white ${size === "sm" ? "text-lg" : "text-2xl"}`} style={BIG_NUM}>
        {t.value}
      </p>
      <div className="mt-2 flex min-h-5 flex-wrap items-center gap-1.5">
        <DeltaChip delta={t.delta} vs={vs} size={size === "sm" ? "xs" : "sm"} />
        {t.sub && <span className="text-[11px] text-neutral-500">{t.sub}</span>}
      </div>
      {t.spark && size === "md" && <Sparkline values={t.spark} className="mt-3" height={26} />}
    </Glass>
  );
}

export function KpiRow({ s }: { s: AdsSnapshot }) {
  const c = s.totals.cur;
  const d = s.totals.delta;
  const vs = `the previous ${s.range.days} days`;
  const days = s.daily.map((x) => x.cur);
  const cpbLine = rollingCpb(days);
  const target = s.targetCpb;
  const vsTarget = c.costPerBookedCents !== null ? rel(c.costPerBookedCents, target.cents) : null;
  const targetLabel = target.source === "settings" ? "your target" : target.source === "history" ? "your recent average" : "starting assumption";
  const b = s.business.cur;
  const bd = s.business.prev;
  const bizDelta = (cur: number | null, prev: number | null | undefined, better: 1 | -1): Delta | undefined => {
    const r = rel(cur, prev ?? null);
    return r === null ? undefined : { rel: r, better: r === 0 ? null : r * better > 0, lowVolume: (b.newClients ?? 0) < 2 && (bd?.newClients ?? 0) < 2, significant: null };
  };

  const primary: Tile[] = [
    { key: "booked", label: "Booked calls", value: count(c.booked), delta: d.booked, spark: days.map((x) => x?.booked ?? 0), hint: "GoHighLevel contacts from Meta in this period who booked a call", sub: c.bookedRate !== null ? `${pct(c.bookedRate, 0)} of leads` : undefined },
    { key: "spend", label: "Spend", value: money(c.spendCents), delta: d.spendCents, spark: days.map((x) => (x ? x.spendCents : null)), hint: "Meta ad spend in this period", sub: s.today ? `${money(s.today.spendCents)} today so far` : undefined },
  ];
  const secondary: Tile[] = [
    { key: "cpl", label: "Cost per lead", value: money(c.cplCents), delta: d.cplCents, hint: "Spend ÷ GoHighLevel leads from Meta" },
    { key: "leads", label: "Leads", value: count(c.ghlLeads), delta: d.ghlLeads, spark: days.map((x) => x?.ghlLeads ?? 0), hint: "GoHighLevel contacts from Meta", sub: `Meta counted ${count(c.metaLeads)}` },
    { key: "ctr", label: "Link CTR", value: pct(c.ctr), delta: d.ctr, spark: days.map((x) => (x ? div(x.linkClicks, x.impressions) : null)), hint: "Link clicks ÷ impressions" },
    { key: "cpm", label: "CPM", value: money(c.cpmCents), delta: d.cpmCents, spark: days.map((x) => (x && x.impressions ? (x.spendCents * 1000) / x.impressions : null)), hint: "Cost per 1,000 impressions" },
  ];
  const detail: Tile[] = [
    { key: "freq", label: "Frequency", value: decimal(c.frequency, 2), delta: d.frequency, hint: "Average times each person saw an ad in the period" },
    { key: "hook", label: "Hook rate", value: pct(c.hookRate), delta: d.hookRate, hint: "3-second video plays ÷ impressions (video ads)" },
    { key: "hold", label: "Hold rate", value: pct(c.holdRate), delta: d.holdRate, hint: "ThruPlays ÷ 3-second plays (video ads)" },
    { key: "lpv", label: "Page loads", value: pct(c.lpvRate, 0), delta: d.lpvRate, hint: "Landing page views ÷ link clicks" },
    { key: "close", label: "Close rate", value: pct(b.closeRate, 0), delta: bizDelta(b.closeRate, bd?.closeRate, 1), hint: "New clients ÷ booked calls (start date in the period)" },
    { key: "cac", label: "CAC", value: money(b.cacCents), delta: bizDelta(b.cacCents, bd?.cacCents, -1), hint: "Spend ÷ new clients", sub: b.setupCoverage ? `setup fee covers it ${multiple(b.setupCoverage)}` : undefined },
    { key: "roas", label: "Cash ROAS", value: multiple(b.cashRoas), delta: bizDelta(b.cashRoas, bd?.cashRoas, 1), hint: "Cash collected from new clients ÷ spend (ad budget pass-through excluded)" },
    { key: "clients", label: "New clients", value: count(b.newClients), delta: bizDelta(b.newClients, bd?.newClients, 1), hint: "Clients whose start date falls in the period" },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {/* The headline metric. */}
        <div className="col-span-2 flex flex-col overflow-hidden rounded-2xl border border-cyan-400/25 bg-gradient-to-br from-blue-600/[0.16] via-[#0b1220] to-cyan-500/[0.08] p-4 sm:p-5">
          <p className={labelCls}>Cost per booked call</p>
          <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
            <p className="text-4xl font-extrabold leading-none text-white sm:text-5xl" style={BIG_NUM}>
              {money(c.costPerBookedCents)}
            </p>
            <DeltaChip delta={d.costPerBookedCents} vs={vs} />
          </div>
          <p className="mt-2 text-xs text-neutral-400">
            {vsTarget !== null ? (
              <>
                <span className={vsTarget <= 0 ? "font-semibold text-emerald-300" : "font-semibold text-rose-300"}>
                  {vsTarget <= 0 ? `${Math.round(-vsTarget * 100)}% under` : `${Math.round(vsTarget * 100)}% over`}
                </span>{" "}
                {targetLabel} of {money(target.cents)}
              </>
            ) : (
              <>
                No booked calls yet this period · {targetLabel}: {money(target.cents)}
              </>
            )}
          </p>
          <div className="mt-auto pt-3">
            <Sparkline values={cpbLine} height={34} color={VIZ.current} />
            <p className="mt-1 text-[10px] text-neutral-400">Rolling 7-day cost per booked call</p>
          </div>
        </div>
        {primary.map((t) => (
          <TileCard key={t.key} t={t} vs={vs} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {secondary.map((t) => (
          <TileCard key={t.key} t={t} vs={vs} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        {detail.map((t) => (
          <TileCard key={t.key} t={t} vs={vs} size="sm" />
        ))}
      </div>
    </div>
  );
}
