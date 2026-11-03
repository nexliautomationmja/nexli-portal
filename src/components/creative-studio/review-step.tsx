"use client";

import { useEffect, useMemo, useState } from "react";
import type { ProjectDetail } from "@/lib/creative-studio/service";
import { RIG_LABEL, lintClip, scriptTotals } from "@/lib/creative-studio/prompts";
import { api, send } from "@/components/creative-studio/client";
import { INPUT } from "@/components/creative-studio/ui";

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/**
 * Step 3 — the script as a timeline (line, timing, register, action, edit,
 * Kling prompt). Ask for changes in plain words; approve to render on Kling.
 */
export function ReviewStep({
  detail,
  locked,
  onChange,
  onError,
}: {
  detail: ProjectDetail;
  locked: boolean;
  onChange: (d: ProjectDetail) => void;
  onError: (msg: string) => void;
}) {
  const p = detail.project;
  const [note, setNote] = useState("");
  const [revising, setRevising] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [approving, setApproving] = useState(false);
  const [kling, setKling] = useState<{ connected: boolean } | null>(null);
  const [openPrompt, setOpenPrompt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard/creative-studio/kling/status")
      .then((r) => r.json())
      .then((s) => !cancelled && setKling({ connected: Boolean(s?.connected) }))
      .catch(() => !cancelled && setKling({ connected: false }));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!revising) return;
    const started = Date.now();
    const t = setInterval(() => setSeconds(Math.round((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(t);
  }, [revising]);

  const totals = useMemo(() => scriptTotals(detail.clips.map((c) => c.line)), [detail.clips]);
  const timeline = useMemo(
    () =>
      detail.clips.map((c, i) => {
        const start = detail.clips.slice(0, i).reduce((s, x) => s + x.durationS, 0);
        return { clip: c, start, end: start + c.durationS, flags: lintClip(c) };
      }),
    [detail.clips]
  );
  const risks = timeline.reduce((n, r) => n + r.flags.filter((f) => f.level === "risk").length, 0);

  async function revise() {
    setRevising(true);
    setSeconds(0);
    const r = await send(api(`${p.id}/script/revise`), "POST", { note });
    setRevising(false);
    if (r.ok) {
      onChange(r.data);
      setNote("");
    } else onError(r.error);
  }

  async function undo() {
    const r = await send(api(`${p.id}/script/undo`), "POST");
    if (r.ok) onChange(r.data);
    else onError(r.error);
  }

  async function approveAndRender() {
    if (!confirm(`Approve the script and send ${detail.clips.length} clips to Kling? About ${totals.credits.toLocaleString("en-US")} credits from your kling.ai plan.`)) return;
    setApproving(true);
    const a = await send(api(`${p.id}/approve`), "POST");
    if (!a.ok) {
      setApproving(false);
      onError(a.error);
      return;
    }
    onChange(a.data);
    const r = await send(api(`${p.id}/render`), "POST", {});
    setApproving(false);
    if (r.ok) onChange(r.data);
    else onError(r.error);
  }

  async function unlock() {
    const rendered = detail.clips.some((c) => c.status !== "draft");
    if (rendered && !confirm("Changing the script after rendering replaces these clips when you write or revise it. Unlock anyway?")) return;
    const r = await send(api(`${p.id}/approve`), "DELETE");
    if (r.ok) onChange(r.data);
    else onError(r.error);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-2 text-sm" style={{ color: "var(--text-main)" }}>
        <span><b>{totals.clips}</b> clips</span>
        <span><b>{totals.seconds}s</b> total (≈ {totals.minutesAfterTrims} min after trims)</span>
        <span>≈ <b>{totals.credits.toLocaleString("en-US")}</b> Kling credits</span>
        <span style={{ color: "var(--text-muted)" }}>{RIG_LABEL[p.rig]}</span>
        {risks > 0 && <span className="font-semibold text-rose-500">{risks} line{risks === 1 ? "" : "s"} flagged</span>}
      </div>

      {p.scriptNotes && (
        <p className="rounded-xl border px-4 py-3 text-xs leading-relaxed whitespace-pre-line" style={{ borderColor: "var(--card-border)", color: "var(--text-main)" }}>
          <b>Claude&apos;s notes: </b>
          {p.scriptNotes}
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--card-border)" }}>
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="text-left text-[10px] font-black uppercase tracking-[0.12em]" style={{ color: "var(--text-muted)" }}>
              <th className="px-3 py-2.5 w-24">Time</th>
              <th className="px-3 py-2.5">Line</th>
              <th className="px-3 py-2.5 w-44">Register</th>
              <th className="px-3 py-2.5 w-44">Action</th>
              <th className="px-3 py-2.5 w-44">Edit</th>
            </tr>
          </thead>
          <tbody>
            {timeline.map(({ clip, start, end, flags }, i) => {
              const newSection = i === 0 || timeline[i - 1].clip.section !== clip.section;
              return (
                <FragmentRows key={clip.id}>
                  {newSection && (
                    <tr style={{ borderTop: "1px solid var(--card-border)", background: "var(--input-bg)" }}>
                      <td colSpan={5} className="px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: "var(--text-muted)" }}>
                        {clip.section}
                      </td>
                    </tr>
                  )}
                  <tr className="align-top" style={{ borderTop: "1px solid var(--card-border)" }}>
                    <td className="px-3 py-3 tabular-nums text-xs" style={{ color: "var(--text-muted)" }}>
                      <span className="font-bold" style={{ color: "var(--text-main)" }}>#{clip.idx + 1}</span>
                      <br />
                      {fmt(start)}–{fmt(end)}
                      <br />
                      <span className={clip.durationS >= 12 ? "font-bold text-rose-500" : ""}>{clip.durationS}s</span>
                    </td>
                    <td className="px-3 py-3">
                      {clip.speaker && <span className="mr-1.5 rounded bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-bold text-blue-400">{clip.speaker}</span>}
                      <span className="font-semibold" style={{ color: "var(--text-main)" }}>{clip.line}</span>
                      {flags.map((f) => (
                        <p key={f.message} className={`mt-1 text-[11px] font-semibold ${f.level === "risk" ? "text-rose-500" : "text-amber-600 dark:text-amber-400"}`}>
                          {f.level === "risk" ? "⚠ " : "• "}
                          {f.message}
                        </p>
                      ))}
                      {clip.cues && <p className="mt-1 text-[11px]" style={{ color: "var(--text-muted)" }}>Cue: {clip.cues}</p>}
                      <button type="button" onClick={() => setOpenPrompt(openPrompt === clip.id ? null : clip.id)} className="mt-1.5 text-[11px] font-semibold text-blue-400 hover:underline">
                        {openPrompt === clip.id ? "Hide Kling prompt" : "Kling prompt"}
                      </button>
                      {openPrompt === clip.id && (
                        <div className="mt-1.5 rounded-lg border p-2.5" style={{ borderColor: "var(--card-border)" }}>
                          <p className="text-[11px] leading-relaxed font-mono whitespace-pre-wrap" style={{ color: "var(--text-muted)" }}>{clip.prompt}</p>
                          <button type="button" onClick={() => navigator.clipboard.writeText(clip.prompt).catch(() => {})} className="mt-1.5 text-[11px] font-semibold text-blue-400 hover:underline">
                            Copy
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-xs" style={{ color: "var(--text-main)" }}>{clip.register}</td>
                    <td className="px-3 py-3 text-xs" style={{ color: "var(--text-main)" }}>{clip.action}</td>
                    <td className="px-3 py-3 text-xs" style={{ color: "var(--text-muted)" }}>{clip.editNote}</td>
                  </tr>
                </FragmentRows>
              );
            })}
          </tbody>
        </table>
      </div>

      {locked ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
          <span className="text-sm font-semibold text-emerald-500">Approved and sent to Kling.</span>
          <button type="button" onClick={unlock} className="text-xs font-semibold hover:underline" style={{ color: "var(--text-muted)" }}>
            Unlock to change the script
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={revising}
              placeholder="What should change? e.g. make the hook punchier, drop clip 4, mention the $9,997 investment"
              className={INPUT}
              style={{ color: "var(--text-main)" }}
              onKeyDown={(e) => e.key === "Enter" && note.trim() && !revising && revise()}
            />
            <button
              type="button"
              onClick={revise}
              disabled={!note.trim() || revising}
              className="rounded-xl border px-4 py-2 text-sm font-semibold shrink-0 hover:bg-[var(--input-bg)]"
              style={{ borderColor: "var(--card-border)", color: "var(--text-main)" }}
            >
              {revising ? `Revising… ${seconds}s` : "Revise"}
            </button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            {p.history.length > 0 ? (
              <button type="button" onClick={undo} disabled={revising} className="text-xs font-semibold hover:underline" style={{ color: "var(--text-muted)" }}>
                ↶ Undo last change
              </button>
            ) : (
              <span />
            )}
            {kling && !kling.connected ? (
              <a
                href={`/api/dashboard/creative-studio/kling/connect?returnTo=${encodeURIComponent(`/dashboard/creative-studio/${p.id}`)}`}
                className="btn-primary px-6 py-2.5 text-sm"
              >
                Connect Kling to render
              </a>
            ) : (
              <button type="button" onClick={approveAndRender} disabled={approving || revising || !kling} className="btn-primary px-6 py-2.5 text-sm">
                {approving ? "Sending to Kling…" : "Approve and render"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FragmentRows({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
