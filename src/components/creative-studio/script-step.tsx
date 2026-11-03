"use client";

import { useEffect, useMemo, useState } from "react";
import type { ProjectDetail } from "@/lib/creative-studio/service";
import type { ClipFields } from "@/lib/creative-studio/tables";
import {
  buildKlingPrompt,
  clipDuration,
  isMultiPerson,
  lintClip,
  scriptTotals,
} from "@/lib/creative-studio/prompts";
import { INPUT, LABEL } from "@/components/creative-studio/brief-fields";
import { api, send } from "@/components/creative-studio/client";

type Clip = ProjectDetail["clips"][number];

/**
 * Step 2 — the framework's §10 review page inside the portal: Claude writes
 * the script, you edit any field (the Kling prompt is rebuilt live), rewrite
 * single clips, restore earlier versions, then approve. Nothing renders
 * before approval.
 */
export function ScriptStep({
  detail,
  onChange,
  onError,
}: {
  detail: ProjectDetail;
  onChange: (d: ProjectDetail) => void;
  onError: (msg: string) => void;
}) {
  const p = detail.project;
  // Approved, rendering or rendered: the script is locked.
  const approved = ["approved", "rendering", "clips_ready"].includes(p.status);
  const [generating, setGenerating] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!generating) return;
    const started = Date.now();
    const t = setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(t);
  }, [generating]);

  const totals = useMemo(() => scriptTotals(detail.clips.map((c) => c.line)), [detail.clips]);
  const riskCount = useMemo(
    () => detail.clips.reduce((n, c) => n + lintClip(c).filter((f) => f.level === "risk").length, 0),
    [detail.clips]
  );

  async function generate() {
    if (detail.clips.length > 0 && !confirm("Write a new script? The current one is kept in the version history.")) return;
    setGenerating(true);
    setElapsed(0);
    setNotice(null);
    const r = await send(api(`${p.id}/script`), "POST");
    setGenerating(false);
    if (r.ok) onChange(r.data);
    else onError(r.error);
  }

  async function approve(on: boolean) {
    const r = await send(api(`${p.id}/approve`), on ? "POST" : "DELETE");
    if (r.ok) onChange(r.data);
    else onError(r.error);
  }

  async function revert(version: number) {
    if (!confirm(`Restore script v${version}? The current script is kept in the history too.`)) return;
    const r = await send(api(`${p.id}/script/revert`), "POST", { version });
    if (r.ok) onChange(r.data);
    else onError(r.error);
  }

  if (detail.frames.length === 0) {
    return (
      <div className="glass-card p-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
        Add the opening frame in step 1 first. Claude writes the frame description and every action from it.
      </div>
    );
  }

  if (detail.clips.length === 0 || generating) {
    return (
      <div className="glass-card p-8 text-center space-y-3">
        <p className="text-sm font-bold" style={{ color: "var(--text-main)" }}>
          {generating ? "Claude is writing the script…" : "Write the script"}
        </p>
        <p className="text-sm max-w-xl mx-auto" style={{ color: "var(--text-muted)" }}>
          {generating
            ? `Following your framework: structure, lines, delivery, actions and pronunciation cues. A VSL can take up to three minutes. ${elapsed}s so far.`
            : "Claude reads your angle and the opening frame, follows your Kling framework, and writes it clip by clip. The portal builds every Kling prompt from your templates."}
        </p>
        {!generating && (
          <button type="button" onClick={generate} className="btn-primary px-6 py-2.5 text-sm">
            Write the script with Claude
          </button>
        )}
        {generating && (
          <div className="mx-auto h-1.5 w-64 overflow-hidden rounded-full" style={{ background: "var(--input-bg)" }}>
            <div className="h-full w-1/3 animate-pulse rounded-full bg-blue-500" />
          </div>
        )}
      </div>
    );
  }

  // Group consecutive clips by section, as the review page does.
  const groups: { section: string; clips: Clip[] }[] = [];
  for (const c of detail.clips) {
    const last = groups[groups.length - 1];
    if (last && last.section === c.section) last.clips.push(c);
    else groups.push({ section: c.section, clips: [c] });
  }

  return (
    <div className="space-y-4">
      <section className="glass-card p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-2">
            <Stat label="Clips" value={String(totals.clips)} />
            <Stat label="Total" value={`${totals.seconds}s`} />
            <Stat label="After trims" value={`≈ ${totals.minutesAfterTrims} min`} />
            <Stat label="Est. Kling credits" value={totals.credits.toLocaleString("en-US")} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {p.history.length > 0 && (
              <select
                className="rounded-xl border px-3 py-2 text-xs font-semibold bg-transparent"
                style={{ borderColor: "var(--card-border)", color: "var(--text-main)" }}
                value=""
                onChange={(e) => e.target.value && revert(Number(e.target.value))}
              >
                <option value="">Version v{p.scriptVersion} · history…</option>
                {[...p.history].reverse().map((h) => (
                  <option key={`${h.version}-${h.createdAt}`} value={h.version}>
                    Restore v{h.version} ({h.clips} clips, {new Date(h.createdAt).toLocaleString()})
                  </option>
                ))}
              </select>
            )}
            {!approved && (
              <button
                type="button"
                onClick={generate}
                className="rounded-xl border px-3 py-2 text-xs font-semibold transition-colors hover:bg-[var(--input-bg)]"
                style={{ borderColor: "var(--card-border)", color: "var(--text-main)" }}
              >
                Rewrite whole script
              </button>
            )}
            {approved ? (
              <button
                type="button"
                onClick={() => approve(false)}
                className="rounded-xl border px-3 py-2 text-xs font-semibold transition-colors hover:bg-[var(--input-bg)]"
                style={{ borderColor: "var(--card-border)", color: "var(--text-main)" }}
              >
                Unlock to edit
              </button>
            ) : (
              <button type="button" onClick={() => approve(true)} className="btn-primary px-4 py-2 text-xs">
                Approve script
              </button>
            )}
          </div>
        </div>

        {approved ? (
          <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-500">
            Approved {p.approvedAt ? new Date(p.approvedAt).toLocaleString() : ""}. The script is locked for Kling rendering.
          </p>
        ) : riskCount > 0 ? (
          <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-600 dark:text-amber-400">
            {riskCount} flag{riskCount === 1 ? "" : "s"} to look at before approving. They&apos;re marked on the clips below.
          </p>
        ) : null}

        {(p.scriptNotes || notice) && (
          <div className="rounded-xl border px-4 py-3 text-xs leading-relaxed whitespace-pre-line" style={{ borderColor: "var(--card-border)", color: "var(--text-main)" }}>
            <span className="font-bold">Claude&apos;s notes: </span>
            {notice ?? p.scriptNotes}
          </div>
        )}
      </section>

      {groups.map((g, gi) => (
        <section key={`${g.section}-${gi}`} className="space-y-3">
          <p className="section-header !mb-0">{g.section}</p>
          {g.clips.map((c) => (
            <ClipCard
              key={`${c.id}-${c.version}-${p.scriptVersion}`}
              clip={c}
              detail={detail}
              locked={approved}
              onChange={onChange}
              onError={onError}
              onNotes={setNotice}
            />
          ))}
        </section>
      ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: "var(--text-muted)" }}>{label}</p>
      <p className="text-lg font-bold tabular-nums" style={{ color: "var(--text-main)" }}>{value}</p>
    </div>
  );
}

function ClipCard({
  clip,
  detail,
  locked,
  onChange,
  onError,
  onNotes,
}: {
  clip: Clip;
  detail: ProjectDetail;
  locked: boolean;
  onChange: (d: ProjectDetail) => void;
  onError: (msg: string) => void;
  onNotes: (s: string | null) => void;
}) {
  const p = detail.project;
  const multi = isMultiPerson(p.rig);
  const initial: ClipFields = {
    section: clip.section,
    speaker: clip.speaker,
    line: clip.line,
    register: clip.register,
    action: clip.action,
    editNote: clip.editNote,
    cues: clip.cues,
    listenerReactions: clip.listenerReactions,
  };
  const [fields, setFields] = useState<ClipFields>(initial);
  const [saving, setSaving] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [rewriting, setRewriting] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [askRewrite, setAskRewrite] = useState(false);
  const [copied, setCopied] = useState(false);

  const dirty = JSON.stringify(fields) !== JSON.stringify(initial);
  const prompt = useMemo(
    () => buildKlingPrompt({ format: p.format, rig: p.rig, frame: p.frameSpec, clip: fields }),
    [p.format, p.rig, p.frameSpec, fields]
  );
  const flags = lintClip(fields);
  const duration = clipDuration(fields.line);

  async function save() {
    if (!dirty) return;
    setSaving(true);
    const r = await send(api(`${p.id}/clips/${clip.id}`), "PATCH", fields);
    setSaving(false);
    if (r.ok) onChange(r.data);
    else onError(r.error);
  }

  async function rewrite() {
    setRewriting(true);
    const r = await send(api(`${p.id}/clips/${clip.id}/rewrite`), "POST", { instruction });
    setRewriting(false);
    setAskRewrite(false);
    setInstruction("");
    if (r.ok) {
      onChange(r.data);
      if (r.data.rewriteNotes) onNotes(`Clip ${clip.idx + 1}: ${r.data.rewriteNotes}`);
    } else onError(r.error);
  }

  async function remove() {
    if (!confirm(`Delete clip ${clip.idx + 1}?`)) return;
    const r = await send(api(`${p.id}/clips/${clip.id}`), "DELETE");
    if (r.ok) onChange(r.data);
    else onError(r.error);
  }

  async function insertAfter() {
    const r = await send(api(`${p.id}/clips`), "POST", { afterIdx: clip.idx });
    if (r.ok) onChange(r.data);
    else onError(r.error);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      onError("Couldn't copy. Select the prompt text and copy it manually.");
    }
  }

  const field = (key: keyof Omit<ClipFields, "speaker" | "listenerReactions">, label: string, rows = 1) => (
    <label className="block">
      <span className={LABEL} style={{ color: "var(--text-muted)" }}>{label}</span>
      <textarea
        rows={rows}
        value={fields[key]}
        disabled={locked}
        onChange={(e) => setFields({ ...fields, [key]: e.target.value })}
        onBlur={save}
        className={`${INPUT} resize-y`}
        style={{ color: "var(--text-main)" }}
      />
    </label>
  );

  const speakers = (p.frameSpec?.positions ?? []).map((x) => x.position);
  const listeners = (p.frameSpec?.positions ?? []).filter((x) => x.position !== fields.speaker);

  return (
    <article className="glass-card p-4 sm:p-5 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-blue-500/15 px-2.5 py-0.5 text-xs font-bold text-blue-400 tabular-nums">#{clip.idx + 1}</span>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums ${duration >= 12 ? "bg-rose-500/15 text-rose-500" : "bg-[var(--input-bg)]"}`} style={duration >= 12 ? undefined : { color: "var(--text-main)" }}>
          {duration}s
        </span>
        {multi && (
          <select
            value={fields.speaker ?? ""}
            disabled={locked}
            onChange={(e) => {
              const next = { ...fields, speaker: (e.target.value || null) as ClipFields["speaker"] };
              setFields(next);
            }}
            onBlur={save}
            className="rounded-full border px-2 py-0.5 text-xs font-semibold bg-transparent"
            style={{ borderColor: "var(--card-border)", color: "var(--text-main)" }}
          >
            {speakers.map((s) => (
              <option key={s} value={s}>
                {s} speaks
              </option>
            ))}
          </select>
        )}
        {saving && <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>Saving…</span>}
        {!locked && (
          <span className="ml-auto flex flex-wrap gap-3 text-[11px] font-semibold">
            <button type="button" onClick={() => setAskRewrite((v) => !v)} className="text-blue-400 hover:underline">
              Rewrite with Claude
            </button>
            <button type="button" onClick={insertAfter} className="hover:underline" style={{ color: "var(--text-muted)" }}>
              Add clip after
            </button>
            <button type="button" onClick={remove} className="text-rose-500 hover:underline">
              Delete
            </button>
          </span>
        )}
      </div>

      {askRewrite && (
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="Optional: what to change (shorter, punchier, fix the number…)"
            className={INPUT}
            style={{ color: "var(--text-main)" }}
          />
          <button type="button" onClick={rewrite} disabled={rewriting} className="btn-primary px-4 py-2 text-xs shrink-0">
            {rewriting ? "Rewriting…" : "Rewrite this clip"}
          </button>
        </div>
      )}

      <label className="block">
        <span className={LABEL} style={{ color: "var(--text-muted)" }}>Line</span>
        <textarea
          rows={2}
          value={fields.line}
          disabled={locked}
          onChange={(e) => setFields({ ...fields, line: e.target.value })}
          onBlur={save}
          className={`${INPUT} resize-y text-base font-semibold`}
          style={{ color: "var(--text-main)" }}
        />
      </label>

      {flags.length > 0 && (
        <ul className="space-y-1">
          {flags.map((f) => (
            <li key={f.message} className={`text-[11px] font-semibold ${f.level === "risk" ? "text-rose-500" : "text-amber-600 dark:text-amber-400"}`}>
              {f.level === "risk" ? "⚠ " : "• "}
              {f.message}
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {field("register", "Register")}
        {field("action", "Action")}
        {field("editNote", "Edit (caption / graphic note)")}
        {field("cues", "Pronunciation cues")}
        {field("section", "Section")}
      </div>

      {multi && listeners.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          {listeners.map((l) => {
            const current = fields.listenerReactions.find((r) => r.shortName === l.shortName)?.reaction ?? "";
            return (
              <label key={l.position} className="block">
                <span className={LABEL} style={{ color: "var(--text-muted)" }}>{l.shortName || l.position} listens</span>
                <input
                  value={current}
                  disabled={locked}
                  placeholder="e.g. she gives a small agreeing nod"
                  onChange={(e) => {
                    const others = fields.listenerReactions.filter((r) => r.shortName !== l.shortName);
                    setFields({ ...fields, listenerReactions: [...others, { shortName: l.shortName, reaction: e.target.value }] });
                  }}
                  onBlur={save}
                  className={INPUT}
                  style={{ color: "var(--text-main)" }}
                />
              </label>
            );
          })}
        </div>
      )}

      <div className="rounded-xl border" style={{ borderColor: "var(--card-border)" }}>
        <div className="flex items-center justify-between px-3 py-2">
          <button type="button" onClick={() => setShowPrompt((v) => !v)} className="text-xs font-bold" style={{ color: "var(--text-main)" }}>
            {showPrompt ? "▾" : "▸"} Kling prompt
          </button>
          <button type="button" onClick={copy} className="text-[11px] font-semibold text-blue-400 hover:underline">
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        {showPrompt && (
          <p className="border-t px-3 py-2.5 text-xs leading-relaxed font-mono whitespace-pre-wrap" style={{ borderColor: "var(--card-border)", color: "var(--text-muted)" }}>
            {prompt}
          </p>
        )}
      </div>
    </article>
  );
}
