"use client";

import { Fragment, useState } from "react";
import { NUM_FONT } from "@/components/engagement-launch-pad/styles";
import { count, decimal, money, pct, statusLabel } from "@/lib/ads/format";
import type { AdsetRow, AdsSnapshot, CampaignRow, LearningStatus } from "@/lib/ads/types";
import { AdsManagerLink, DeltaChip, Glass, Ico } from "@/components/ads/parts";
import { VIZ } from "@/components/ads/viz";

const LEARNING: Record<LearningStatus, { label: string; cls: string } | null> = {
  LEARNING: { label: "Learning", cls: "border-blue-400/30 bg-blue-500/15 text-blue-200" },
  SUCCESS: { label: "Out of learning", cls: "border-emerald-400/30 bg-emerald-500/15 text-emerald-200" },
  FAIL: { label: "Learning limited", cls: "border-amber-400/30 bg-amber-500/15 text-amber-200" },
  UNKNOWN: null,
};

function StatusDot({ status }: { status: string }) {
  const on = status === "ACTIVE";
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-neutral-400">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: on ? VIZ.status.good : VIZ.previous }} />
      {statusLabel(status)}
    </span>
  );
}

const budgetOf = (daily: number | null, lifetime: number | null) => (daily ? `${money(daily)}/day` : lifetime ? `${money(lifetime)} total` : null);

function Learning({ s }: { s: AdsetRow }) {
  const l = LEARNING[s.learning.status];
  if (!l) return null;
  return (
    <span className={`inline-flex rounded-full border px-1.5 py-px text-[10px] font-bold ${l.cls}`} title={s.eventsLast7 !== null ? `${s.eventsLast7} optimization events in the last 7 days` : undefined}>
      {l.label}
    </span>
  );
}

const COLS = ["Budget", "Spend", "Leads", "Booked", "Cost / booked", "CPL", "CTR", "CPM", "Freq."];

function Cells({ m, budget }: { m: CampaignRow["metrics"]; budget: string | null }) {
  const c = m.cur;
  return (
    <>
      <td className="px-3 py-2 text-neutral-300">{budget ?? "—"}</td>
      <td className="px-3 py-2 text-white">{money(c.spendCents)}</td>
      <td className="px-3 py-2">{count(c.ghlLeads)}</td>
      <td className="px-3 py-2">{count(c.booked)}</td>
      <td className="px-3 py-2">
        <span className="text-white">{money(c.costPerBookedCents)}</span> <DeltaChip delta={m.delta.costPerBookedCents} size="xs" />
      </td>
      <td className="px-3 py-2">{money(c.cplCents)}</td>
      <td className="px-3 py-2">{pct(c.ctr)}</td>
      <td className="px-3 py-2">{money(c.cpmCents)}</td>
      <td className="px-3 py-2">{decimal(c.frequency, 1)}</td>
    </>
  );
}

export function StructureTable({ s }: { s: AdsSnapshot }) {
  const [open, setOpen] = useState<Set<string>>(() => new Set(s.campaigns.filter((c) => c.effectiveStatus === "ACTIVE").slice(0, 3).map((c) => c.id)));
  const toggle = (id: string) =>
    setOpen((o) => {
      const n = new Set(o);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const setsOf = (id: string) => s.adsets.filter((a) => a.campaignId === id);

  if (!s.campaigns.length) return <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-6 text-center text-sm text-neutral-400">No campaigns ran in this period.</p>;

  return (
    <>
      {/* Desktop: one table, campaigns expanding into their ad sets. */}
      <Glass className="cs-scroll hidden overflow-x-auto md:block">
        <table className="w-full min-w-[900px] text-left text-xs" style={NUM_FONT}>
          <thead>
            <tr className="border-b border-white/10 text-[10px] uppercase tracking-widest text-neutral-500">
              <th className="px-3 py-2.5 font-bold">Campaign / ad set</th>
              {COLS.map((h) => (
                <th key={h} className="px-3 py-2.5 font-bold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {s.campaigns.map((c) => {
              const sets = setsOf(c.id);
              const isOpen = open.has(c.id);
              return (
                <Fragment key={c.id}>
                  <tr className="border-b border-white/5 text-neutral-300 hover:bg-white/[0.02]">
                    <td className="max-w-[280px] px-3 py-2">
                      <button type="button" onClick={() => toggle(c.id)} className="flex min-h-9 items-center gap-2 text-left" aria-expanded={isOpen}>
                        <Ico d={<path d={isOpen ? "m6 9 6 6 6-6" : "m9 18 6-6-6-6"} />} size={13} className="shrink-0 text-neutral-500" />
                        <span className="min-w-0">
                          <span className="block truncate font-bold text-white">{c.name}</span>
                          <span className="flex items-center gap-2">
                            <StatusDot status={c.effectiveStatus} />
                            {c.isCbo && <span className="text-[10px] text-neutral-500">campaign budget</span>}
                            <span className="text-[10px] text-neutral-500">{sets.length} ad set{sets.length === 1 ? "" : "s"}</span>
                          </span>
                        </span>
                      </button>
                    </td>
                    <Cells m={c.metrics} budget={budgetOf(c.dailyBudgetCents, c.lifetimeBudgetCents)} />
                  </tr>
                  {isOpen &&
                    sets.map((a) => (
                      <tr key={a.id} className="border-b border-white/5 bg-white/[0.015] text-neutral-400">
                        <td className="max-w-[280px] py-2 pl-10 pr-3">
                          <span className="block truncate font-semibold text-neutral-200">{a.name}</span>
                          <span className="flex flex-wrap items-center gap-2">
                            <StatusDot status={a.effectiveStatus} />
                            <Learning s={a} />
                            {a.temperature === "warm" && <span className="text-[10px] text-neutral-500">warm audience</span>}
                            <a href={a.adsManagerUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] font-semibold text-cyan-300 hover:underline">
                              Ads Manager ↗
                            </a>
                          </span>
                        </td>
                        <Cells m={a.metrics} budget={budgetOf(a.dailyBudgetCents, a.lifetimeBudgetCents) ?? (c.isCbo ? "campaign" : null)} />
                      </tr>
                    ))}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </Glass>

      {/* Phones: cards. */}
      <div className="space-y-2 md:hidden">
        {s.campaigns.map((c) => {
          const sets = setsOf(c.id);
          const isOpen = open.has(c.id);
          return (
            <Glass key={c.id} className="p-3">
              <button type="button" onClick={() => toggle(c.id)} className="flex w-full items-start gap-2 text-left" aria-expanded={isOpen}>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-white">{c.name}</span>
                  <StatusDot status={c.effectiveStatus} />
                </span>
                <span className="text-right" style={NUM_FONT}>
                  <span className="block text-sm font-bold text-white">{money(c.metrics.cur.spendCents)}</span>
                  <span className="text-[11px] text-neutral-400">{count(c.metrics.cur.booked)} booked</span>
                </span>
              </button>
              <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]" style={NUM_FONT}>
                <span className="text-neutral-400">
                  Cost/booked <b className="block text-white">{money(c.metrics.cur.costPerBookedCents)}</b>
                </span>
                <span className="text-neutral-400">
                  CPL <b className="block text-white">{money(c.metrics.cur.cplCents)}</b>
                </span>
                <span className="text-neutral-400">
                  CTR <b className="block text-white">{pct(c.metrics.cur.ctr)}</b>
                </span>
              </div>
              {isOpen && sets.length > 0 && (
                <div className="mt-3 space-y-2 border-t border-white/5 pt-2">
                  {sets.map((a) => (
                    <div key={a.id} className="rounded-xl bg-white/[0.03] p-2.5">
                      <p className="text-xs font-semibold text-neutral-200">{a.name}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <StatusDot status={a.effectiveStatus} />
                        <Learning s={a} />
                      </div>
                      <p className="mt-1 text-[11px] text-neutral-400" style={NUM_FONT}>
                        {money(a.metrics.cur.spendCents)} · {count(a.metrics.cur.booked)} booked · {money(a.metrics.cur.costPerBookedCents)} per booked · {budgetOf(a.dailyBudgetCents, a.lifetimeBudgetCents) ?? (c.isCbo ? "campaign budget" : "—")}
                      </p>
                      <AdsManagerLink href={a.adsManagerUrl} />
                    </div>
                  ))}
                </div>
              )}
              <button type="button" onClick={() => toggle(c.id)} className="mt-1 min-h-9 text-[11px] font-semibold text-cyan-300">
                {isOpen ? "Hide ad sets" : `Show ${sets.length} ad set${sets.length === 1 ? "" : "s"}`}
              </button>
            </Glass>
          );
        })}
      </div>
    </>
  );
}
