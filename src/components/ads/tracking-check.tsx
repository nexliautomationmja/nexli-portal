"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { SYNE } from "@/components/launch-pad";
import { NUM_FONT } from "@/components/engagement-launch-pad/styles";
import { count, money } from "@/lib/ads/format";
import { shortDay } from "@/lib/ads/time";
import type { AdsSnapshot } from "@/lib/ads/types";
import type { TrackingData, TrackingVerdict } from "@/lib/ads/tracking-check";
import { Glass, Ico } from "@/components/ads/parts";
import { TrackingHealth } from "@/components/ads/funnel-tracking";
import { VIZ } from "@/components/ads/viz";

/**
 * Tracking check — the live tracker: is Meta counting the leads your CRM
 * actually got? Status first (with the fix), today so far (refreshes every
 * minute), the last 14 days side by side, the ads Meta and the CRM disagree
 * on, then the setup checks.
 */

const CRM_COLOR = VIZ.series[0];
const META_COLOR = VIZ.series[1];

const TONE = {
  ok: { box: "border-emerald-400/25 bg-emerald-500/[0.07]", title: "text-emerald-100", dot: VIZ.status.good, word: "Trustworthy" },
  info: { box: "border-white/10 bg-white/[0.04]", title: "text-white", dot: VIZ.inkMuted, word: "Note" },
  warning: { box: "border-amber-400/30 bg-amber-500/[0.08]", title: "text-amber-100", dot: VIZ.status.warning, word: "Check" },
  critical: { box: "border-rose-500/40 bg-rose-500/[0.1]", title: "text-rose-100", dot: VIZ.status.critical, word: "Fix now" },
} as const;

function minutesAgo(iso: string | null, now: number): string {
  if (!iso) return "—";
  const m = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h} h ago` : `${Math.round(h / 24)} days ago`;
}

export function TrackingCheck({ v, data, s, loading, error, onRefresh }: { v: TrackingVerdict; data: TrackingData | null; s: AdsSnapshot; loading: boolean; error: string | null; onRefresh: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  const tone = TONE[v.severity] ?? TONE.info;
  const live = data?.live ?? null;

  return (
    <div className="space-y-3">
      {/* The verdict */}
      <div className={`rounded-3xl border p-4 sm:p-5 ${tone.box}`}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="h-3 w-3 rounded-full" style={{ background: tone.dot, boxShadow: `0 0 0 4px ${tone.dot}33` }} />
          <span className="text-[11px] font-black uppercase tracking-[0.2em] text-neutral-300">{tone.word}</span>
        </div>
        <h3 className={`mt-2 text-xl font-bold tracking-tight sm:text-2xl ${tone.title}`} style={SYNE}>
          {v.title}
        </h3>
        <p className="mt-1 text-sm leading-relaxed text-neutral-200">{v.detail}</p>
        {v.fixes.length > 0 && (
          <div className="mt-3">
            <p className="text-[11px] font-black uppercase tracking-[0.15em] text-neutral-300">How to fix it</p>
            <ol className="mt-1.5 space-y-1.5">
              {v.fixes.map((f, i) => (
                <li key={i} className="flex gap-2 text-xs leading-relaxed text-neutral-100">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] font-bold" style={NUM_FONT}>
                    {i + 1}
                  </span>
                  {f}
                </li>
              ))}
            </ol>
          </div>
        )}
        {error && <p className="mt-2 text-[11px] text-amber-200/80">{error}</p>}
      </div>

      {/* Today so far */}
      <Glass className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-bold text-white" style={SYNE}>
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: VIZ.status.good }} />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ background: VIZ.status.good }} />
            </span>
            Today so far
          </h3>
          <p className="text-[11px] text-neutral-400" style={NUM_FONT}>
            {live ? `Updated ${minutesAgo(live.at, now)} · refreshes every minute` : loading ? "Loading…" : "Not loaded"}
            <button type="button" onClick={onRefresh} disabled={loading} className="ml-2 min-h-8 font-semibold text-cyan-300 hover:underline disabled:opacity-50">
              Refresh
            </button>
          </p>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Tile label="Spent today" value={live ? money(live.spendCents) : "—"} sub={live ? `${count(live.linkClicks)} link clicks` : undefined} />
          <Tile label="Meta says" value={live ? count(live.metaLeads) : "—"} sub="leads today" color={META_COLOR} />
          <Tile label="Your CRM got" value={live ? count(live.crmLeads) : "—"} sub={live?.unmatched ? `${live.unmatched} not matched to an ad` : "leads today"} color={CRM_COLOR} />
          <Tile label="Booked today" value={live ? count(live.booked) : "—"} sub={`last lead ${minutesAgo(live?.lastCrmLeadAt ?? null, now)}`} />
        </div>
        {v.today && (
          <p className={`mt-3 rounded-xl px-3 py-2 text-xs ${v.today.severity === "warning" ? "bg-amber-500/10 text-amber-100" : "bg-white/5 text-neutral-300"}`}>{v.today.text}</p>
        )}
        {live && live.ads.length > 0 && (
          <div className="cs-scroll -mx-1 mt-3 overflow-x-auto px-1">
            <table className="w-full text-left text-xs" style={NUM_FONT}>
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-neutral-500">
                  <th className="py-1.5 pr-2 font-bold">Ad, today</th>
                  <th className="py-1.5 pr-2 text-right font-bold" style={{ color: META_COLOR }}>
                    Meta
                  </th>
                  <th className="py-1.5 pr-2 text-right font-bold" style={{ color: CRM_COLOR }}>
                    CRM
                  </th>
                  <th className="py-1.5 pr-2 text-right font-bold">Spent</th>
                  <th className="hidden py-1.5 text-right font-bold sm:table-cell">Clicks</th>
                </tr>
              </thead>
              <tbody>
                {live.ads.map((a) => {
                  const off = Math.abs(a.metaLeads - a.crmLeads) >= 2;
                  return (
                    <tr key={a.adId} className="border-t border-white/5">
                      <td className="max-w-[150px] truncate py-1.5 pr-2 font-semibold text-neutral-100 sm:max-w-[280px]">{a.name}</td>
                      <td className={`py-1.5 pr-2 text-right font-bold ${off ? "text-amber-200" : "text-neutral-100"}`}>{count(a.metaLeads)}</td>
                      <td className={`py-1.5 pr-2 text-right font-bold ${off ? "text-amber-200" : "text-neutral-100"}`}>{count(a.crmLeads)}</td>
                      <td className="py-1.5 pr-2 text-right text-neutral-300">{money(a.spendCents)}</td>
                      <td className="hidden py-1.5 text-right text-neutral-300 sm:table-cell">{count(a.linkClicks)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-[10px] text-neutral-500">Meta&apos;s live numbers run 15–30 minutes behind; leads are dated by when they came in, like your CRM.</p>
      </Glass>

      <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
        <DaysChart v={v} />
        <AdMismatches v={v} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <TrackingHealth s={s} />
        <Glass className="p-4">
          <h3 className="text-sm font-bold text-white" style={SYNE}>
            Why Meta and your CRM can differ
          </h3>
          <ul className="mt-2 space-y-2 text-xs leading-relaxed text-neutral-300">
            <li>
              <span className="font-semibold text-white">Meta counts people who only saw the ad.</span> With the default setting (7-day click, 1-day view) someone who scrolled past the ad and filled the form later from a Google search still counts as Meta&apos;s lead.
            </li>
            <li>
              <span className="font-semibold text-white">The Lead event can fire twice</span> — a form with two steps, or a thank-you page that reloads — and Meta counts both.
            </li>
            <li>
              <span className="font-semibold text-white">Browsers and iPhones block part of the pixel</span>, so Meta misses some real leads. Sending leads from the server (Conversions API) fills that gap.
            </li>
            <li>
              <span className="font-semibold text-white">Your CRM is the truth here.</span> Every Cut / Keep call on this page is made from CRM leads and booked calls, never from Meta&apos;s count — except for an ad with no utm_content, which the CRM can&apos;t credit.
            </li>
          </ul>
        </Glass>
      </div>
    </div>
  );
}

function Tile({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
        {color && <span className="h-2 w-2 rounded-sm" style={{ background: color }} />}
        {label}
      </p>
      <p className="mt-0.5 text-2xl font-bold text-white" style={NUM_FONT}>
        {value}
      </p>
      {sub && <p className="truncate text-[10px] text-neutral-400">{sub}</p>}
    </div>
  );
}

function DaysChart({ v }: { v: TrackingVerdict }) {
  const [table, setTable] = useState(false);
  const rows = v.days.map((d) => ({ ...d, label: shortDay(d.date) }));
  const flagged = rows.filter((r) => r.flag !== "match");
  return (
    <Glass className="p-4">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-white" style={SYNE}>
            Leads by day: Meta vs your CRM
          </h3>
          <p className="mt-0.5 text-[11px] text-neutral-400" style={NUM_FONT}>
            Last 14 days · {flagged.length ? `${flagged.length} day${flagged.length === 1 ? "" : "s"} don't line up (shaded)` : "every day lines up"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-[11px] text-neutral-400">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: CRM_COLOR }} />
            CRM
          </span>
          <span className="inline-flex items-center gap-1.5 text-[11px] text-neutral-400">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: META_COLOR }} />
            Meta
          </span>
          <button type="button" onClick={() => setTable((t) => !t)} className="min-h-8 text-[11px] font-semibold text-cyan-300 hover:underline">
            {table ? "Chart" : "Table"}
          </button>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="flex h-[190px] items-center justify-center text-xs text-neutral-400">Loading the last 14 days…</p>
      ) : table ? (
        <div className="cs-scroll max-h-[230px] overflow-y-auto">
          <table className="w-full text-left text-xs" style={NUM_FONT}>
            <thead className="sticky top-0 bg-[#0c1020]">
              <tr className="text-[10px] uppercase tracking-wider text-neutral-500">
                <th className="py-1.5 pr-2 font-bold">Day</th>
                <th className="py-1.5 pr-2 text-right font-bold">Spent</th>
                <th className="py-1.5 pr-2 text-right font-bold">Meta</th>
                <th className="py-1.5 pr-2 text-right font-bold">CRM</th>
                <th className="py-1.5 text-right font-bold">Booked</th>
              </tr>
            </thead>
            <tbody>
              {[...rows].reverse().map((r) => (
                <tr key={r.date} className={`border-t border-white/5 ${r.flag !== "match" ? "bg-amber-500/[0.06]" : ""}`}>
                  <td className="py-1.5 pr-2 text-neutral-200">{r.label}</td>
                  <td className="py-1.5 pr-2 text-right text-neutral-300">{money(r.spendCents)}</td>
                  <td className="py-1.5 pr-2 text-right font-bold text-neutral-100">{r.metaLeads}</td>
                  <td className="py-1.5 pr-2 text-right font-bold text-neutral-100">{r.crmLeads}</td>
                  <td className="py-1.5 text-right text-neutral-300">{r.booked}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="h-[190px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 6, right: 4, left: 0, bottom: 0 }} barGap={2} barCategoryGap="22%">
              <CartesianGrid stroke={VIZ.grid} vertical={false} />
              {flagged.map((r) => (
                <ReferenceArea key={r.date} x1={r.label} x2={r.label} fill={VIZ.status.warning} fillOpacity={0.09} ifOverflow="extendDomain" />
              ))}
              <XAxis dataKey="label" tick={{ fill: VIZ.tick, fontSize: 10 }} tickLine={false} axisLine={false} interval={Math.max(0, Math.ceil(rows.length / 7) - 1)} />
              <YAxis tick={{ fill: VIZ.tick, fontSize: 10 }} tickLine={false} axisLine={false} width={24} allowDecimals={false} domain={[0, (max: number) => Math.max(3, max)]} />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
                content={({ active, payload }) => {
                  const p = payload?.[0]?.payload as (typeof rows)[number] | undefined;
                  if (!active || !p) return null;
                  const diff = p.metaLeads - p.crmLeads;
                  return (
                    <div className="rounded-xl border border-white/10 bg-[#0b1220]/95 px-3 py-2 shadow-xl" style={NUM_FONT}>
                      <p className="text-[11px] text-neutral-400">{p.label}</p>
                      <p className="text-sm font-bold text-white">
                        {p.crmLeads} <span className="text-[11px] font-semibold text-neutral-400">in your CRM</span>
                      </p>
                      <p className="text-sm font-bold text-white">
                        {p.metaLeads} <span className="text-[11px] font-semibold text-neutral-400">Meta counted</span>
                      </p>
                      {p.flag !== "match" && <p className="mt-0.5 text-[11px] text-amber-200">{diff > 0 ? `Meta counted ${diff} more` : `Meta missed ${-diff}`}</p>}
                      <p className="text-[11px] text-neutral-400">{money(p.spendCents)} spent · {p.booked} booked</p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="crmLeads" name="CRM" fill={CRM_COLOR} radius={[4, 4, 0, 0]} maxBarSize={14} isAnimationActive={false} />
              <Bar dataKey="metaLeads" name="Meta" fill={META_COLOR} radius={[4, 4, 0, 0]} maxBarSize={14} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Glass>
  );
}

function AdMismatches({ v }: { v: TrackingVerdict }) {
  const list = v.ads.slice(0, 8);
  return (
    <Glass className="p-4">
      <h3 className="text-sm font-bold text-white" style={SYNE}>
        Ads Meta and your CRM disagree on
      </h3>
      <p className="mt-0.5 text-[11px] text-neutral-400">Last 30 days, per ad</p>
      {list.length === 0 ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-neutral-300">
          <Ico d={<path d="M20 6 9 17l-5-5" />} size={14} className="text-emerald-300" />
          Every ad lines up.
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {list.map((a) => (
            <li key={a.adId} className="text-xs">
              <p className="flex flex-wrap items-center gap-1.5">
                <span className="font-bold text-white">{a.name}</span>
                {!a.live && <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] text-neutral-400">off</span>}
                <span className="text-[10px] text-neutral-400" style={NUM_FONT}>
                  Meta {a.meta} · CRM {a.crm}
                </span>
              </p>
              <p className="mt-0.5 text-neutral-300">{a.text}</p>
              <p className="mt-0.5 text-neutral-400">
                {a.fix}{" "}
                <a href={a.adsManagerUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-cyan-300 hover:underline">
                  Open the ad ↗
                </a>
              </p>
            </li>
          ))}
        </ul>
      )}
    </Glass>
  );
}
