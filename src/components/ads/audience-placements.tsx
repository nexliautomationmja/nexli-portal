"use client";

import { SYNE } from "@/components/launch-pad";
import { NUM_FONT } from "@/components/engagement-launch-pad/styles";
import { FacebookLogo } from "@/components/launch-pad";
import { InstagramLogo } from "@/components/launch-pad/icons";
import { count, money, pct } from "@/lib/ads/format";
import { div } from "@/lib/ads/math";
import type { AdsSnapshot, BreakdownRow } from "@/lib/ads/types";
import { DeltaChip, Glass } from "@/components/ads/parts";
import { inkOn, PLATFORM_COLOR, VIZ } from "@/components/ads/viz";

function PlatformMark({ k }: { k: string }) {
  if (k === "facebook") return <FacebookLogo size={16} />;
  if (k === "instagram") return <InstagramLogo size={16} />;
  return <span className="inline-block h-3 w-3 rounded-sm" style={{ background: PLATFORM_COLOR[k] ?? VIZ.previous }} />;
}

export function AudiencePlacements({ s }: { s: AdsSnapshot }) {
  const spendTotal = s.platforms.reduce((t, p) => t + p.m.cur.spendCents, 0);
  const withSpend = s.platforms.filter((p) => p.m.cur.spendCents > 0);
  const top = s.placements.slice(0, 9);
  const restSpend = s.placements.slice(9).reduce((t, p) => t + p.spendCents, 0);
  const max = Math.max(1, ...top.map((p) => p.spendCents), restSpend);
  return (
    <div className="space-y-3">
      <Glass className="p-4">
        <h3 className="text-sm font-bold text-white" style={SYNE}>
          Facebook vs Instagram
        </h3>
        {/* Thin segmented bar: share of spend. */}
        {spendTotal > 0 && (
          <div className="mt-3">
            <div className="flex h-2 w-full gap-[2px] overflow-hidden rounded-full" role="img" aria-label={withSpend.map((p) => `${p.label} ${pct(p.m.cur.spendCents / spendTotal, 0)}`).join(", ")}>
              {withSpend.map((p) => (
                <span key={p.key} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${(p.m.cur.spendCents / spendTotal) * 100}%`, background: PLATFORM_COLOR[p.key] }} title={`${p.label}: ${money(p.m.cur.spendCents)}`} />
              ))}
            </div>
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
              {withSpend.map((p) => (
                <span key={p.key} className="inline-flex items-center gap-1.5 text-[11px] text-neutral-400">
                  <span className="h-2 w-2 rounded-sm" style={{ background: PLATFORM_COLOR[p.key] }} />
                  {p.label}
                </span>
              ))}
            </div>
          </div>
        )}
        <div className="cs-scroll mt-3 overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-xs" style={NUM_FONT}>
            <thead>
              <tr className="border-b border-white/10 text-[10px] uppercase tracking-widest text-neutral-500">
                {["Platform", "Spend", "Leads", "Booked", "Cost / booked", "CPL", "CTR", "CPM"].map((h) => (
                  <th key={h} className="px-2.5 py-2 font-bold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {s.platforms.map((p) => (
                <tr key={p.key} className="border-b border-white/5 text-neutral-300">
                  <td className="px-2.5 py-2">
                    <span className="inline-flex items-center gap-2 font-semibold text-white">
                      <PlatformMark k={p.key} />
                      {p.label}
                    </span>
                  </td>
                  <td className="px-2.5 py-2">
                    {money(p.m.cur.spendCents)} <span className="text-neutral-500">{spendTotal ? pct(p.m.cur.spendCents / spendTotal, 0) : ""}</span>
                  </td>
                  <td className="px-2.5 py-2">{count(p.m.cur.ghlLeads)}</td>
                  <td className="px-2.5 py-2">{count(p.m.cur.booked)}</td>
                  <td className="px-2.5 py-2">
                    <span className="text-white">{money(p.m.cur.costPerBookedCents)}</span> <DeltaChip delta={p.m.delta.costPerBookedCents} size="xs" />
                  </td>
                  <td className="px-2.5 py-2">{money(p.m.cur.cplCents)}</td>
                  <td className="px-2.5 py-2">{pct(p.m.cur.ctr)}</td>
                  <td className="px-2.5 py-2">{money(p.m.cur.cpmCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {s.ghl.platformUnknown > 0 && <p className="mt-2 text-[11px] text-neutral-500">Leads with no platform count in the totals but can&apos;t be split.</p>}
      </Glass>

      <div className="grid gap-3 lg:grid-cols-2">
        <Glass className="p-4">
          <h3 className="text-sm font-bold text-white" style={SYNE}>
            Where the money goes
          </h3>
          <p className="mt-0.5 text-[11px] text-neutral-400">Placements by spend this period</p>
          {top.length === 0 ? (
            <p className="py-6 text-center text-xs text-neutral-500">No placement data</p>
          ) : (
            <ul className="mt-3 space-y-2.5">
              {[...top, ...(restSpend > 0 ? [{ key: "rest", label: "Other placements", spendCents: restSpend, share: div(restSpend, spendTotal), ctr: null, cpmCents: null, lpvRate: null } as Partial<BreakdownRow> & { key: string; label: string; spendCents: number }] : [])].map((p) => (
                <li key={p.key} className="text-xs" tabIndex={0} title={`${p.label}: ${money(p.spendCents)}${p.ctr !== null && p.ctr !== undefined ? ` · CTR ${pct(p.ctr)}` : ""}${p.cpmCents ? ` · CPM ${money(p.cpmCents)}` : ""}`}>
                  <div className="mb-1 flex items-baseline justify-between gap-2">
                    <span className="truncate text-neutral-200">{p.label}</span>
                    <span className="shrink-0 text-neutral-400" style={NUM_FONT}>
                      <b className="text-white">{money(p.spendCents)}</b>
                      {p.share !== null && p.share !== undefined ? ` · ${pct(p.share, 0)}` : ""}
                      {p.ctr !== null && p.ctr !== undefined ? ` · CTR ${pct(p.ctr)}` : ""}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-white/[0.04]">
                    <div className="h-full rounded-r-[4px]" style={{ width: `${Math.max(1, (p.spendCents / max) * 100)}%`, background: VIZ.current }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Glass>

        <Demographics rows={s.demographics} />
      </div>
      <p className="text-[11px] text-neutral-500">Meta shares delivery by placement, age and gender, but not who booked — booked calls can only be split by platform and creative.</p>
    </div>
  );
}

function Demographics({ rows }: { rows: BreakdownRow[] }) {
  const ages = [...new Set(rows.map((r) => r.group))].filter((a) => a !== "unknown").sort();
  const genders = ["female", "male"] as const;
  const cell = (age: string, g: string) => rows.find((r) => r.key === `${age}:${g}`);
  const shares = rows.map((r) => r.share ?? 0).filter((v) => v > 0).sort((a, b) => a - b);
  const step = (v: number) => {
    if (!shares.length || v <= 0) return null;
    const rank = shares.findIndex((x) => x >= v);
    const q = (rank < 0 ? shares.length - 1 : rank) / Math.max(1, shares.length - 1);
    return VIZ.ramp[Math.min(VIZ.ramp.length - 1, Math.floor(q * VIZ.ramp.length))];
  };
  return (
    <Glass className="p-4">
      <h3 className="text-sm font-bold text-white" style={SYNE}>
        Who sees the ads
      </h3>
      <p className="mt-0.5 text-[11px] text-neutral-400">Share of spend by age and gender (darker = less)</p>
      {ages.length === 0 ? (
        <p className="py-6 text-center text-xs text-neutral-500">No age & gender data</p>
      ) : (
        <table className="mt-3 w-full border-separate text-xs" style={{ ...NUM_FONT, borderSpacing: 2 }}>
          <thead>
            <tr className="text-[10px] uppercase tracking-widest text-neutral-500">
              <th className="py-1 text-left font-bold">Age</th>
              <th className="py-1 font-bold">Women</th>
              <th className="py-1 font-bold">Men</th>
            </tr>
          </thead>
          <tbody>
            {ages.map((age) => (
              <tr key={age}>
                <td className="pr-2 text-neutral-300">{age}</td>
                {genders.map((g) => {
                  const r = cell(age, g);
                  const bg = r ? step(r.share ?? 0) : null;
                  return (
                    <td
                      key={g}
                      tabIndex={0}
                      className="h-9 rounded-[4px] text-center font-bold"
                      style={{ background: bg ?? "rgba(255,255,255,0.03)", color: bg ? inkOn(bg) : "#64748b" }}
                      title={r ? `${age} ${g === "male" ? "men" : "women"}: ${money(r.spendCents)} · CTR ${pct(r.ctr)} · ${count(r.metaLeads)} Meta leads` : "No delivery"}
                    >
                      {r ? pct(r.share, 0) : "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Glass>
  );
}
