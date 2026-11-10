"use client";

import { useMemo, useState } from "react";
import { Area, Bar, BarChart, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { SYNE } from "@/components/launch-pad";
import { NUM_FONT } from "@/components/engagement-launch-pad/styles";
import { change, count, decimal, money, moneyShort, pct } from "@/lib/ads/format";
import { div, rel } from "@/lib/ads/math";
import { shortDay } from "@/lib/ads/time";
import type { AdsSnapshot } from "@/lib/ads/types";
import { Glass } from "@/components/ads/parts";
import { rollingCpb } from "@/components/ads/kpi-row";
import { VIZ } from "@/components/ads/viz";

interface Row {
  i: number;
  date: string;
  prevDate: string;
  label: string;
  spend: number | null;
  prevSpend: number | null;
  leads: number | null;
  booked: number | null;
  cpb: number | null;
  prevCpb: number | null;
  ctr: number | null;
  prevCtr: number | null;
  cpm: number | null;
  prevCpm: number | null;
}

type Fmt = (v: number | null) => string;

function LineKey({ color }: { color: string }) {
  return <span className="inline-block h-0.5 w-3.5 shrink-0 rounded-full" style={{ background: color }} />;
}

function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5 text-[11px] text-neutral-400">
          <LineKey color={it.color} />
          {it.label}
        </span>
      ))}
    </div>
  );
}

/** Values lead, labels follow; one readout for every series at the hovered day. */
function Tip({
  active,
  payload,
  series,
}: {
  active?: boolean;
  payload?: { payload: Row }[];
  series: { key: keyof Row; label: string; color: string; fmt: Fmt; dateKey?: "date" | "prevDate" }[];
}) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return (
    <div className="min-w-[150px] rounded-xl border border-white/10 bg-[#0b1220]/95 px-3 py-2 shadow-xl backdrop-blur" style={NUM_FONT}>
      {series.map((s) => (
        <div key={String(s.key)} className="flex items-center gap-2 py-0.5">
          <LineKey color={s.color} />
          <span className="text-sm font-bold text-white">{s.fmt(row[s.key] as number | null)}</span>
          <span className="text-[11px] text-neutral-400">
            {s.label} · {shortDay(row[s.dateKey ?? "date"] as string)}
          </span>
        </div>
      ))}
    </div>
  );
}

const axisProps = {
  tick: { fill: VIZ.tick, fontSize: 10 },
  tickLine: false,
  axisLine: false,
} as const;

function ChartCard({ title, sub, legend, children }: { title: string; sub?: React.ReactNode; legend?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Glass className="p-4">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-white" style={SYNE}>
            {title}
          </h3>
          {sub && <p className="mt-0.5 text-[11px] text-neutral-400" style={NUM_FONT}>{sub}</p>}
        </div>
        {legend}
      </div>
      <div className="h-[170px] w-full">{children}</div>
    </Glass>
  );
}

const sumOf = (rows: ({ spendCents: number } | null)[]) => rows.reduce((t, r) => t + (r?.spendCents ?? 0), 0);

export function TrendCharts({ s }: { s: AdsSnapshot }) {
  const [table, setTable] = useState(false);
  const rows: Row[] = useMemo(() => {
    const cur = s.daily.map((d) => d.cur);
    const prev = s.daily.map((d) => d.prev);
    const cpb = rollingCpb(cur);
    const prevCpb = rollingCpb(prev);
    return s.daily.map((d, i) => ({
      i,
      date: d.date,
      prevDate: d.prevDate,
      label: shortDay(d.date),
      spend: d.cur ? d.cur.spendCents / 100 : null,
      prevSpend: d.prev ? d.prev.spendCents / 100 : null,
      leads: d.cur ? d.cur.ghlLeads : null,
      booked: d.cur ? d.cur.booked : null,
      cpb: cpb[i] === null ? null : (cpb[i] as number) / 100,
      prevCpb: prevCpb[i] === null ? null : (prevCpb[i] as number) / 100,
      ctr: d.cur ? div(d.cur.linkClicks, d.cur.impressions) : null,
      prevCtr: d.prev ? div(d.prev.linkClicks, d.prev.impressions) : null,
      cpm: d.cur && d.cur.impressions ? (d.cur.spendCents * 10) / d.cur.impressions : null,
      prevCpm: d.prev && d.prev.impressions ? (d.prev.spendCents * 10) / d.prev.impressions : null,
    }));
  }, [s.daily]);

  const curSpend = sumOf(s.daily.map((d) => d.cur));
  const prevSpend = sumOf(s.daily.map((d) => d.prev));
  const cur = s.totals.cur;
  const prev = s.totals.prev;
  const vsLegend = <Legend items={[{ label: "This period", color: VIZ.current }, { label: "Previous", color: VIZ.previous }]} />;
  const dollars: Fmt = (v) => (v === null ? "—" : money(Math.round(v * 100)));
  const rate: Fmt = (v) => pct(v);
  const tickEvery = Math.max(0, Math.ceil(rows.length / 6) - 1);
  const xAxis = <XAxis dataKey="label" {...axisProps} interval={tickEvery} minTickGap={8} />;
  const grid = <CartesianGrid stroke={VIZ.grid} vertical={false} />;
  const cursor = { stroke: "rgba(255,255,255,0.25)", strokeWidth: 1 };
  const activeDot = { r: 4, stroke: VIZ.surface, strokeWidth: 2 };

  if (table) {
    return (
      <div>
        <div className="mb-2 flex justify-end">
          <button type="button" onClick={() => setTable(false)} className="min-h-9 rounded-full border border-white/10 bg-white/5 px-3 text-xs font-semibold text-neutral-300 hover:text-white">
            Show charts
          </button>
        </div>
        <Glass className="cs-scroll overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-xs" style={NUM_FONT}>
            <thead>
              <tr className="border-b border-white/10 text-[10px] uppercase tracking-widest text-neutral-500">
                {["Day", "Spend", "Leads", "Booked", "Cost / booked (7d)", "Link CTR", "CPM"].map((h) => (
                  <th key={h} className="px-3 py-2 font-bold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.date} className="border-b border-white/5 text-neutral-300">
                  <td className="px-3 py-1.5 text-white">{r.label}</td>
                  <td className="px-3 py-1.5">{dollars(r.spend)}</td>
                  <td className="px-3 py-1.5">{count(r.leads)}</td>
                  <td className="px-3 py-1.5">{count(r.booked)}</td>
                  <td className="px-3 py-1.5">{dollars(r.cpb)}</td>
                  <td className="px-3 py-1.5">{pct(r.ctr)}</td>
                  <td className="px-3 py-1.5">{dollars(r.cpm)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Glass>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-2 flex justify-end">
        <button type="button" onClick={() => setTable(true)} className="min-h-9 rounded-full border border-white/10 bg-white/5 px-3 text-xs font-semibold text-neutral-300 hover:text-white">
          Show as table
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <ChartCard title="Spend per day" sub={`${money(curSpend)} this period · ${money(prevSpend)} before (${change(rel(curSpend, prevSpend))})`} legend={vsLegend}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rows} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
              {grid}
              {xAxis}
              <YAxis {...axisProps} width={44} tickFormatter={(v: number) => moneyShort(v * 100)} />
              <Tooltip cursor={cursor} content={<Tip series={[{ key: "spend", label: "This period", color: VIZ.current, fmt: dollars }, { key: "prevSpend", label: "Previous", color: VIZ.previous, fmt: dollars, dateKey: "prevDate" }]} />} />
              <Line dataKey="prevSpend" stroke={VIZ.previous} strokeWidth={2} dot={false} activeDot={activeDot} isAnimationActive={false} />
              <Area dataKey="spend" stroke={VIZ.current} fill={VIZ.current} fillOpacity={0.1} strokeWidth={2} dot={false} activeDot={activeDot} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Leads & booked calls per day"
          sub={`${count(cur.ghlLeads)} leads · ${count(cur.booked)} booked (GoHighLevel)`}
          legend={<Legend items={[{ label: "Leads", color: VIZ.series[0] }, { label: "Booked calls", color: VIZ.series[1] }]} />}
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rows} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
              {grid}
              {xAxis}
              <YAxis {...axisProps} width={28} allowDecimals={false} />
              <Tooltip cursor={cursor} content={<Tip series={[{ key: "leads", label: "Leads", color: VIZ.series[0], fmt: count }, { key: "booked", label: "Booked", color: VIZ.series[1], fmt: count }]} />} />
              <Line dataKey="leads" stroke={VIZ.series[0]} strokeWidth={2} dot={false} activeDot={activeDot} isAnimationActive={false} />
              <Line dataKey="booked" stroke={VIZ.series[1]} strokeWidth={2} dot={false} activeDot={activeDot} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Cost per booked call (rolling 7 days)" sub={`${money(cur.costPerBookedCents)} this period · ${money(prev?.costPerBookedCents ?? null)} before · target ${money(s.targetCpb.cents)}`} legend={vsLegend}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rows} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
              {grid}
              {xAxis}
              <YAxis {...axisProps} width={44} tickFormatter={(v: number) => moneyShort(v * 100)} />
              <Tooltip cursor={cursor} content={<Tip series={[{ key: "cpb", label: "This period", color: VIZ.current, fmt: dollars }, { key: "prevCpb", label: "Previous", color: VIZ.previous, fmt: dollars, dateKey: "prevDate" }]} />} />
              <ReferenceLine
                y={s.targetCpb.cents / 100}
                stroke={VIZ.status.good}
                strokeDasharray="4 4"
                ifOverflow="extendDomain"
                label={{ value: `target ${moneyShort(s.targetCpb.cents)}`, position: "insideTopRight", fill: VIZ.tick, fontSize: 10 }}
              />
              <Line dataKey="prevCpb" stroke={VIZ.previous} strokeWidth={2} dot={false} activeDot={activeDot} connectNulls={false} isAnimationActive={false} />
              <Line dataKey="cpb" stroke={VIZ.current} strokeWidth={2} dot={false} activeDot={activeDot} connectNulls={false} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Link CTR" sub={`${pct(cur.ctr)} this period · ${pct(prev?.ctr ?? null)} before`} legend={vsLegend}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rows} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
              {grid}
              {xAxis}
              <YAxis {...axisProps} width={40} tickFormatter={(v: number) => pct(v, 1)} />
              <Tooltip cursor={cursor} content={<Tip series={[{ key: "ctr", label: "This period", color: VIZ.current, fmt: rate }, { key: "prevCtr", label: "Previous", color: VIZ.previous, fmt: rate, dateKey: "prevDate" }]} />} />
              <Line dataKey="prevCtr" stroke={VIZ.previous} strokeWidth={2} dot={false} activeDot={activeDot} isAnimationActive={false} />
              <Line dataKey="ctr" stroke={VIZ.current} strokeWidth={2} dot={false} activeDot={activeDot} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="CPM" sub={`${money(cur.cpmCents)} this period · ${money(prev?.cpmCents ?? null)} before`} legend={vsLegend}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rows} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
              {grid}
              {xAxis}
              <YAxis {...axisProps} width={40} tickFormatter={(v: number) => moneyShort(v * 100)} />
              <Tooltip cursor={cursor} content={<Tip series={[{ key: "cpm", label: "This period", color: VIZ.current, fmt: dollars }, { key: "prevCpm", label: "Previous", color: VIZ.previous, fmt: dollars, dateKey: "prevDate" }]} />} />
              <Line dataKey="prevCpm" stroke={VIZ.previous} strokeWidth={2} dot={false} activeDot={activeDot} isAnimationActive={false} />
              <Line dataKey="cpm" stroke={VIZ.current} strokeWidth={2} dot={false} activeDot={activeDot} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <WeeklyFrequency s={s} />
      </div>
    </div>
  );
}

function WeeklyFrequency({ s }: { s: AdsSnapshot }) {
  const data = s.weekly.map((w) => ({ label: shortDay(w.since), until: shortDay(w.until), frequency: w.frequency, reach: w.reach }));
  const last = s.weekly[s.weekly.length - 1];
  const T = s.thresholds;
  return (
    <ChartCard
      title="Frequency by week"
      sub={last ? `${decimal(last.frequency, 2)} last week · fatigue usually shows past ${T.freqFatigued.cold} on cold audiences` : "Weekly frequency"}
      legend={<Legend items={[{ label: `Watch ${T.freqWatch.cold}`, color: VIZ.status.warning }, { label: `Fatigue ${T.freqFatigued.cold}`, color: VIZ.status.serious }]} />}
    >
      {data.length ? (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={VIZ.grid} vertical={false} />
            <XAxis dataKey="label" {...axisProps} interval={Math.max(0, Math.ceil(data.length / 6) - 1)} />
            <YAxis {...axisProps} width={28} domain={[0, (max: number) => Math.max(4, Math.ceil(max + 0.5))]} />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.04)" }}
              content={({ active, payload }) => {
                const p = payload?.[0]?.payload as { label: string; until: string; frequency: number | null; reach: number | null } | undefined;
                if (!active || !p) return null;
                return (
                  <div className="rounded-xl border border-white/10 bg-[#0b1220]/95 px-3 py-2 shadow-xl" style={NUM_FONT}>
                    <p className="text-sm font-bold text-white">{decimal(p.frequency, 2)}</p>
                    <p className="text-[11px] text-neutral-400">
                      {p.label} – {p.until} · reach {count(p.reach)}
                    </p>
                  </div>
                );
              }}
            />
            <ReferenceLine y={T.freqWatch.cold} stroke={VIZ.status.warning} strokeDasharray="4 4" />
            <ReferenceLine y={T.freqFatigued.cold} stroke={VIZ.status.serious} strokeDasharray="4 4" />
            <Bar dataKey="frequency" fill={VIZ.current} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <p className="flex h-full items-center justify-center text-xs text-neutral-400">No weekly data yet</p>
      )}
    </ChartCard>
  );
}
