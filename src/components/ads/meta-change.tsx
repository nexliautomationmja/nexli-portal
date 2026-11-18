"use client";

import { useState } from "react";
import { NUM_FONT } from "@/components/engagement-launch-pad/styles";
import { Ico } from "@/components/ads/parts";
import type { ChangeView } from "@/lib/ads/corrections-shared";
import {
  LEVEL_LABEL,
  isMetaKind,
  money0,
  resultLine,
  type MetaAccessView,
  type MetaBudgetPayload,
  type MetaCopyPayload,
  type MetaKind,
  type MetaPayload,
  type MetaStatusPayload,
} from "@/lib/ads/meta-changes-shared";

/**
 * Changes in Meta on the Ads page: what a card will do (before → after, the
 * copy's tree, the warnings), what happened when Marcel applied it (with
 * links into Ads Manager), the setup steps when the manage token isn't there
 * yet, and the Turn off button on Today's plan.
 */

const EXT = <path d="M15 3h6v6M10 14 21 3M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />;

export const isMeta = (c: ChangeView) => isMetaKind(c.kind);

export function metaApplyLabel(c: ChangeView): string {
  if (c.kind === "meta_copy") return (c.payload as MetaCopyPayload).turnOn ? "Launch in Meta" : "Make it in Meta";
  if (c.kind === "meta_status") return (c.payload as MetaStatusPayload).to === "ACTIVE" ? "Turn on in Meta" : "Turn off in Meta";
  return "Change in Meta";
}

export function metaBusyLabel(c: ChangeView): string {
  return c.kind === "meta_copy" ? "Building it in Meta…" : "Changing Meta…";
}

export function metaUndoLabel(c: ChangeView): string {
  if (c.kind === "meta_copy") return "Remove the copy";
  if (c.kind === "meta_status") return (c.payload as MetaStatusPayload).to === "ACTIVE" ? "Turn back off" : "Turn back on";
  return `Put back ${money0((c.payload as MetaBudgetPayload).beforeCents)}`;
}

const pctChange = (a: number, b: number) => (a > 0 ? `${b >= a ? "+" : "−"}${Math.round((Math.abs(b - a) / a) * 100)}%` : "");

function OnOff({ on }: { on: boolean }) {
  return <span className={`rounded-full px-1.5 py-px text-[10px] font-black uppercase tracking-wide ${on ? "bg-emerald-500/20 text-emerald-100" : "bg-white/10 text-neutral-300"}`}>{on ? "On" : "Off"}</span>;
}

/** The body of a Meta card. */
export function MetaDetails({ c, compact = false }: { c: ChangeView; compact?: boolean }) {
  const kind = c.kind as MetaKind;
  const p = c.payload as MetaPayload;
  const r = p.result;
  const line = resultLine(kind, p);
  const madeLinks = (r?.done ?? []).filter((d) => d.url && (d.what === "made" || d.what === "on" || d.what === "off" || d.what === "budget"));
  const firstLinks = kind === "meta_copy" ? madeLinks.filter((d) => d.what === "made").slice(0, 1) : madeLinks.slice(0, 3);

  return (
    <div className="mt-2 space-y-2">
      {!compact && c.status === "proposed" && (
        <p className="text-[11px] font-semibold text-rose-200/90">Changes your live Meta ad account when you tap — nothing happens before that.</p>
      )}

      {!compact && kind === "meta_status" && (
        <ul className="space-y-1">
          {(p as MetaStatusPayload).targets.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-1.5 text-xs text-neutral-200">
              <span className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">{LEVEL_LABEL[t.level]}</span>
              <span className="min-w-0 font-semibold text-white">{t.name}</span>
              <OnOff on={t.before === "ACTIVE"} />
              <span className="text-neutral-500">→</span>
              <OnOff on={(p as MetaStatusPayload).to === "ACTIVE"} />
            </li>
          ))}
        </ul>
      )}

      {!compact && kind === "meta_budget" && (
        <p className="text-xs text-neutral-200" style={NUM_FONT}>
          <span className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">{LEVEL_LABEL[(p as MetaBudgetPayload).level]} </span>
          <span className="font-semibold text-white">{(p as MetaBudgetPayload).name}</span>: {money0((p as MetaBudgetPayload).beforeCents)} → <span className="font-bold text-white">{money0((p as MetaBudgetPayload).afterCents)}</span> a day{" "}
          <span className="text-neutral-400">({pctChange((p as MetaBudgetPayload).beforeCents, (p as MetaBudgetPayload).afterCents)})</span>
        </p>
      )}

      {!compact && kind === "meta_copy" && <CopyTree p={p as MetaCopyPayload} waiting={c.status === "proposed"} />}

      {!compact && c.status === "proposed" && p.warnings.length > 0 && (
        <ul className="space-y-0.5">
          {p.warnings.map((w) => (
            <li key={w} className="text-[11px] leading-snug text-amber-100/90">
              · {w}
            </li>
          ))}
        </ul>
      )}

      {r && (
        <div className="space-y-1">
          {line && (
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold text-emerald-200">
              <span>{line}</span>
              {firstLinks.map((d) => (
                <a key={d.key} href={d.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-cyan-300 hover:underline">
                  {firstLinks.length > 1 ? d.name : "See it in Ads Manager"} <Ico d={EXT} size={10} />
                </a>
              ))}
            </p>
          )}
          {r.failed && (
            <p className="text-[11px] leading-snug text-rose-200">
              Stopped while {r.failed.step.startsWith("“") ? `changing ${r.failed.step}` : r.failed.step}: {r.failed.error}
            </p>
          )}
          {r.undo && (
            <div className="text-[11px] leading-snug text-neutral-400">
              {r.undo.done.map((d) => (
                <p key={d}>↺ {d}</p>
              ))}
              {r.undo.failed && <p className="text-rose-200">Undo stopped: {r.undo.failed}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CopyTree({ p, waiting }: { p: MetaCopyPayload; waiting: boolean }) {
  const c = p.campaign;
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-2.5 text-xs text-neutral-200">
      <p>
        <span className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">Campaign </span>
        {c.mode === "new" ? (
          <>
            <span className="font-semibold text-white">{c.name}</span> <span className="text-neutral-400">· new, settings from “{c.fromName}”</span>
            {c.isCbo && c.dailyBudgetCents ? <span style={NUM_FONT}> · {money0(c.dailyBudgetCents)}/day</span> : null}
          </>
        ) : (
          <>
            into <span className="font-semibold text-white">{c.name}</span>
          </>
        )}
      </p>
      <ul className="mt-1 space-y-1.5 border-l border-white/10 pl-2.5">
        {p.adsets.map((s, i) => (
          <li key={i}>
            <p>
              <span className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">Ad set </span>
              {s.mode === "new" ? (
                <>
                  <span className="font-semibold text-white">{s.name}</span> <span className="text-neutral-400">· copy of “{s.fromName}”</span>
                  {s.dailyBudgetCents ? <span style={NUM_FONT}> · {money0(s.dailyBudgetCents)}/day</span> : null}
                </>
              ) : (
                <>
                  into <span className="font-semibold text-white">{s.name}</span>
                </>
              )}
            </p>
            <ul className="mt-0.5 space-y-0.5 pl-2.5">
              {s.ads.slice(0, 8).map((a) => (
                <li key={a.fromId} className="text-[11px] text-neutral-300">
                  Ad <span className="font-semibold text-white">{a.name}</span>
                </li>
              ))}
              {s.ads.length > 8 && <li className="text-[11px] text-neutral-500">+{s.ads.length - 8} more ads</li>}
            </ul>
          </li>
        ))}
      </ul>
      {waiting && (
        <p className={`mt-2 text-[11px] font-semibold ${p.turnOn ? "text-rose-200" : "text-neutral-400"}`} style={NUM_FONT}>
          {p.turnOn ? `Goes live when you tap${p.dailyCents ? ` — about ${money0(p.dailyCents)} a day` : ""}.` : "Made paused — turn it on when you're ready."}
        </p>
      )}
    </div>
  );
}

/** Under the Ask box: whether it can change Meta, and the three setup steps when it can't. */
export function MetaSetup({ meta, onRecheck }: { meta: MetaAccessView | null; onRecheck: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  if (!meta) return null;
  const ready = meta.configured && meta.canWrite;
  return (
    <div className={`rounded-2xl border ${ready ? "border-emerald-400/20 bg-emerald-500/[0.05]" : "border-white/10 bg-white/[0.03]"}`}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex min-h-11 w-full flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2 text-left">
        <span className={`h-2 w-2 shrink-0 rounded-full ${ready ? "bg-emerald-400" : meta.configured ? "bg-amber-400" : "bg-neutral-500"}`} aria-hidden="true" />
        <span className="text-sm font-bold text-white">{ready ? "Can make changes in Meta" : meta.configured ? "Changes in Meta: needs a fix" : "Let it make changes in Meta"}</span>
        <span className="text-xs text-neutral-400">
          {ready ? "off / on, budgets, copies, new campaigns — only when you tap" : meta.configured ? meta.problems[0] ?? "" : "read-only now · 3 steps"}
        </span>
        <span className="ml-auto text-xs font-semibold text-cyan-300">{open ? "Hide" : ready ? "Details" : "Show steps"}</span>
      </button>
      {open && (
        <div className="space-y-2 px-4 pb-4 text-xs leading-relaxed text-neutral-300">
          {ready ? (
            <p>
              The portal has its own Meta token for changes. Every change is a card: before → after, then your tap. Undo puts it back. To switch changes off, delete <code className="rounded bg-white/10 px-1">META_ADS_MANAGE_TOKEN</code> in Vercel.
            </p>
          ) : (
            <ol className="list-decimal space-y-1.5 pl-4">
              {meta.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          )}
          {meta.problems.length > 0 && (
            <ul className="space-y-0.5 text-rose-200">
              {meta.problems.map((p) => (
                <li key={p}>· {p}</li>
              ))}
            </ul>
          )}
          {meta.notes.length > 0 && <p className="text-neutral-500">{meta.notes.join(" ")}</p>}
          {meta.configured && (
            <button
              type="button"
              disabled={checking}
              onClick={async () => {
                setChecking(true);
                await onRecheck();
                setChecking(false);
              }}
              className="min-h-9 rounded-full bg-white/10 px-3.5 font-bold text-white hover:bg-white/15 disabled:opacity-50"
            >
              {checking ? "Checking…" : "Check the token again"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Today's plan: turn a cut off in Meta (tap, then confirm). */
export function TurnOffButton({ adIds, label, confirmText, onDone }: { adIds: string[]; label: string; confirmText: string; onDone: () => void }) {
  const [stage, setStage] = useState<"idle" | "confirm" | "busy" | "done">("idle");
  const [err, setErr] = useState<string | null>(null);
  const go = async () => {
    setStage("busy");
    setErr(null);
    try {
      const r = await fetch("/api/dashboard/ads/meta", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "off", adIds }) });
      const d = await r.json().catch(() => null);
      if (!r.ok) {
        setErr(d?.error || "Meta didn't take it — try again, or use Ads Manager.");
        setStage("idle");
        return;
      }
      if (d?.warning) setErr(d.warning);
      setStage("done");
      onDone();
    } catch {
      setErr("Couldn't reach the server — check your connection.");
      setStage("idle");
    }
  };
  if (stage === "done") return <span className="text-[11px] font-bold text-emerald-300">Off in Meta ✓ {err ? <span className="font-normal text-amber-200">{err}</span> : <span className="font-normal text-neutral-400">· undo under the Ask box</span>}</span>;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {stage === "confirm" ? (
        <>
          <span className="text-[11px] text-rose-100">{confirmText}</span>
          <button type="button" onClick={() => void go()} className="min-h-9 rounded-full bg-rose-500 px-3 text-[11px] font-bold text-white hover:bg-rose-400">
            Yes, turn off
          </button>
          <button type="button" onClick={() => setStage("idle")} className="min-h-9 rounded-full px-2 text-[11px] font-semibold text-neutral-300 hover:text-white">
            Cancel
          </button>
        </>
      ) : (
        <button
          type="button"
          disabled={stage === "busy"}
          onClick={() => setStage("confirm")}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-rose-500/20 px-3 text-[11px] font-bold text-rose-50 hover:bg-rose-500/30 disabled:opacity-60"
        >
          {stage === "busy" && <span className="h-3 w-3 animate-spin rounded-full border-2 border-rose-100 border-t-transparent" aria-hidden="true" />}
          {stage === "busy" ? "Turning off…" : label}
        </button>
      )}
      {err && stage !== "busy" && <span className="basis-full text-[11px] text-rose-200">{err}</span>}
    </span>
  );
}
