"use client";

import Link from "next/link";
import { SYNE } from "@/components/launch-pad";
import { NUM_FONT } from "@/components/engagement-launch-pad/styles";
import { change, count, money, pct } from "@/lib/ads/format";
import { rel } from "@/lib/ads/math";
import type { AdsSnapshot, Signal } from "@/lib/ads/types";
import { ExternalIcon, Glass, Meter, SeverityIcon } from "@/components/ads/parts";
import { VIZ } from "@/components/ads/viz";

export function Funnel({ s }: { s: AdsSnapshot }) {
  return (
    <Glass className="p-4">
      <h3 className="text-sm font-bold text-white" style={SYNE}>
        From impression to client
      </h3>
      <p className="mt-0.5 text-[11px] text-neutral-400">Each step&apos;s rate from the one before, vs the previous {s.range.days} days</p>
      <ol className="mt-3 space-y-3">
        {s.funnel.map((f, i) => {
          const r = rel(f.rate, f.prevRate);
          const lowVol = (f.prev ?? 0) < 20 || (f.cur ?? 0) < 5;
          return (
            <li key={f.key} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1">
              <div className="min-w-0">
                <p className="flex items-baseline gap-2 text-xs">
                  <span className="text-[10px] font-bold text-neutral-500" style={NUM_FONT}>
                    {i + 1}
                  </span>
                  <span className="font-semibold text-neutral-200">{f.label}</span>
                  <span className="font-bold text-white" style={NUM_FONT}>
                    {count(f.cur)}
                  </span>
                  {f.prev !== null && (
                    <span className="text-[11px] text-neutral-500" style={NUM_FONT}>
                      was {count(f.prev)}
                    </span>
                  )}
                </p>
              </div>
              <span className="text-right text-[11px] text-neutral-400" style={NUM_FONT}>
                {f.costPerCents !== null ? (f.key === "impressions" ? `${money(f.costPerCents)} CPM` : `${money(f.costPerCents)} each`) : ""}
              </span>
              {i > 0 && (
                <div className="col-span-2 flex items-center gap-2">
                  <div className="flex-1">
                    <Meter value={f.rate} label={`${f.label} rate`} color={VIZ.current} />
                  </div>
                  <span className="w-12 text-right text-[11px] font-bold text-white" style={NUM_FONT}>
                    {pct(f.rate)}
                  </span>
                  <span
                    className={`w-14 text-right text-[10px] font-bold ${lowVol || r === null ? "text-neutral-500" : r >= 0 ? "text-emerald-300" : "text-rose-300"}`}
                    style={NUM_FONT}
                    title={lowVol ? "Low volume" : `was ${pct(f.prevRate)}`}
                  >
                    {r === null ? "" : change(r)}
                  </span>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </Glass>
  );
}

export function TrackingHealth({ s }: { s: AdsSnapshot }) {
  const items = s.tracking;
  const issues = items.filter((t) => t.severity !== "ok").length;
  return (
    <Glass className="p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-white" style={SYNE}>
          Tracking health
        </h3>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${issues ? "bg-amber-500/15 text-amber-200" : "bg-emerald-500/15 text-emerald-200"}`}>
          {issues ? `${issues} to check` : "All good"}
        </span>
      </div>
      <p className="mt-0.5 text-[11px] text-neutral-400">If tracking is off, every number above is off — so this comes first.</p>
      {items.length === 0 ? (
        <p className="py-4 text-xs text-neutral-500">Nothing to check yet.</p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {items.map((t) => (
            <li key={t.key} className="flex gap-2.5">
              <SeverityIcon severity={t.severity} size={13} />
              <div className="min-w-0 text-xs">
                <p className="font-semibold text-neutral-100">{t.label}</p>
                <p className="text-neutral-400">{t.value}</p>
                {t.fix && <p className="mt-0.5 text-neutral-300">{t.fix}</p>}
                {t.link &&
                  (t.link.href.startsWith("/") ? (
                    <Link href={t.link.href} className="mt-0.5 inline-flex min-h-8 items-center text-[11px] font-semibold text-cyan-300 hover:underline">
                      {t.link.label} →
                    </Link>
                  ) : (
                    <a href={t.link.href} target="_blank" rel="noopener noreferrer" className="mt-0.5 inline-flex min-h-8 items-center gap-1 text-[11px] font-semibold text-cyan-300 hover:underline">
                      {t.link.label} <ExternalIcon />
                    </a>
                  ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Glass>
  );
}

/** The deterministic read: what the numbers flag right now (before or between Manus runs). */
export function SignalsCard({ s, onJump }: { s: AdsSnapshot; onJump: (sig: Signal) => void }) {
  const list = s.signals.filter((x) => !x.kind.startsWith("tracking_")).slice(0, 8);
  if (!list.length) {
    return (
      <Glass className="p-4">
        <p className="text-sm text-neutral-300">Nothing stands out in the numbers for this period.</p>
      </Glass>
    );
  }
  return (
    <Glass className="p-4">
      <ul className="space-y-3">
        {list.map((sig, i) => (
          <li key={`${sig.kind}-${i}`} className="flex gap-3">
            <SeverityIcon severity={sig.severity} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white">{sig.title}</p>
              <p className="text-xs leading-relaxed text-neutral-400">{sig.detail}</p>
              {sig.ref?.id && (
                <button type="button" onClick={() => onJump(sig)} className="mt-0.5 min-h-8 text-[11px] font-semibold text-cyan-300 hover:underline">
                  {sig.ref.level === "ad" ? "Show the creative" : "Open in Ads Manager ↗"}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Glass>
  );
}
