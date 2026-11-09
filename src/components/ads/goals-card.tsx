"use client";

import { useState } from "react";
import { CTA_CLASSES, labelCls } from "@/components/launch-pad";
import { money } from "@/lib/ads/format";
import type { AdSettingsView } from "@/lib/ads/settings";
import { Glass } from "@/components/ads/parts";

const toUsd = (cents: number | null) => (cents ? String(Math.round(cents) / 100) : "");

function MoneyField({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      <span className="flex items-center rounded-xl border border-white/10 bg-black/30 focus-within:border-cyan-400/50">
        <span className="pl-3 text-sm text-neutral-500">$</span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))}
          inputMode="decimal"
          placeholder="—"
          className="w-full bg-transparent px-2 py-2.5 text-[16px] text-white placeholder:text-neutral-600 focus:outline-none sm:text-sm"
        />
      </span>
      {hint && <span className="mt-1 block text-[11px] text-neutral-500">{hint}</span>}
    </label>
  );
}

function Toggle({ on, onChange, label, sub }: { on: boolean; onChange: (v: boolean) => void; label: string; sub: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className="flex w-full items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left">
      <span className={`mt-0.5 flex h-6 w-10 shrink-0 items-center rounded-full p-0.5 transition-colors ${on ? "bg-cyan-500" : "bg-white/15"}`}>
        <span className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${on ? "translate-x-4" : ""}`} />
      </span>
      <span>
        <span className="block text-sm font-semibold text-white">{label}</span>
        <span className="block text-xs text-neutral-400">{sub}</span>
      </span>
    </button>
  );
}

export function GoalsCard({
  settings,
  assumedTargetCents,
  assumedSource,
  onSaved,
}: {
  settings: AdSettingsView;
  assumedTargetCents: number | null;
  assumedSource: "settings" | "history" | "default" | null;
  onSaved: (s: AdSettingsView) => void;
}) {
  const [cpb, setCpb] = useState(toUsd(settings.targetCpbCents));
  const [cpl, setCpl] = useState(toUsd(settings.targetCplCents));
  const [budget, setBudget] = useState(toUsd(settings.monthlyBudgetCents));
  const [cac, setCac] = useState(toUsd(settings.maxCacCents));
  const [context, setContext] = useState(settings.context);
  const [weekly, setWeekly] = useState(settings.weeklyAuto);
  const [email, setEmail] = useState(settings.notifyEmail);
  const [profile, setProfile] = useState(settings.agentProfile);
  const [competitors, setCompetitors] = useState(settings.competitors);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const r = await fetch("/api/dashboard/ads/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetCostPerBookedUsd: cpb || null,
          targetCplUsd: cpl || null,
          monthlyBudgetUsd: budget || null,
          maxCacUsd: cac || null,
          context,
          weeklyAuto: weekly,
          notifyEmail: email,
          agentProfile: profile,
          competitors,
        }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) throw new Error(d?.error || "Saving failed");
      onSaved(d.settings);
      setCompetitors(d.settings.competitors);
      setMsg("Saved — Manus uses these from the next analysis.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Saving failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Glass className="p-4 sm:p-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MoneyField
          label="Target cost per booked call"
          value={cpb}
          onChange={setCpb}
          hint={!cpb && assumedTargetCents ? `Empty: Manus judges from ${assumedSource === "history" ? "your recent average" : "a starting assumption"} (${money(assumedTargetCents)})` : undefined}
        />
        <MoneyField label="Target cost per lead" value={cpl} onChange={setCpl} />
        <MoneyField label="Monthly ad budget" value={budget} onChange={setBudget} hint="For pacing" />
        <MoneyField label="Max cost per client" value={cac} onChange={setCac} />
      </div>
      <label className="mt-4 block">
        <span className={labelCls}>Notes for Manus</span>
        <textarea
          value={context}
          onChange={(e) => setContext(e.target.value.slice(0, 2000))}
          rows={3}
          placeholder="Anything it should know: a new landing page went live Nov 5, we're testing a webinar offer, don't touch the retargeting campaign…"
          className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-[16px] text-white placeholder:text-neutral-600 focus:border-cyan-400/50 focus:outline-none sm:text-sm"
        />
      </label>
      <label className="mt-4 block">
        <span className={labelCls}>Competitors to always check</span>
        <textarea
          value={competitors}
          onChange={(e) => setCompetitors(e.target.value.slice(0, 6000))}
          rows={3}
          placeholder={"One per line: a name, a Facebook page link or an Ad Library link\nAcme CPA Marketing\nhttps://www.facebook.com/ads/library/?view_all_page_id=…"}
          className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-[16px] text-white placeholder:text-neutral-600 focus:border-cyan-400/50 focus:outline-none sm:text-sm"
        />
        <span className="mt-1 block text-[11px] text-neutral-500">Ad Library research checks these first, every time. Up to 25.</span>
      </label>
      <div className="mt-4 grid gap-2 md:grid-cols-2">
        <Toggle on={weekly} onChange={setWeekly} label="Weekly analysis" sub="Every Monday, 7:00 AM in the ad account's timezone" />
        <Toggle on={email} onChange={setEmail} label="Email me" sub="When an analysis is ready, Manus needs you, or a check-back is due" />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className={`${labelCls} mb-0`}>Manus depth</span>
        <div className="inline-flex rounded-xl border border-white/10 bg-white/[0.04] p-1">
          {(["standard", "max"] as const).map((p) => (
            <button key={p} type="button" onClick={() => setProfile(p)} className={`min-h-9 rounded-lg px-3 text-xs font-bold ${profile === p ? "bg-gradient-to-r from-blue-600 to-cyan-500 text-white" : "text-neutral-400 hover:text-white"}`}>
              {p === "standard" ? "Standard" : "Max"}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-neutral-500">Max digs deeper and uses more Manus credits.</span>
      </div>
      <p className="mt-3 text-[11px] text-neutral-500">
        Meta Ads Manager connector in Manus:{" "}
        {settings.connector?.id ? <b className="text-emerald-300">connected{settings.connector.name ? ` (${settings.connector.name})` : ""}</b> : <span>not connected — connect it in Manus → Connectors and the next analysis uses it.</span>}
        <br />
        Ad Library connector in Manus:{" "}
        {settings.libraryConnector?.id ? (
          <b className="text-emerald-300">connected{settings.libraryConnector.name ? ` (${settings.libraryConnector.name})` : ""}</b>
        ) : (
          <span>optional — without one, Manus browses the public Ad Library site itself.</span>
        )}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => void save()} disabled={saving} className={CTA_CLASSES}>
          {saving ? "Saving…" : "Save goals"}
        </button>
        {msg && <span className="text-xs text-neutral-300">{msg}</span>}
      </div>
    </Glass>
  );
}
