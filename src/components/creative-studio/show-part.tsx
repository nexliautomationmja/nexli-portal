"use client";

import { useState } from "react";
import type { ProjectDetail } from "@/lib/creative-studio/service";
import type { ShowCue, ShowLayout } from "@/lib/creative-studio/tables";
import { NUM_FONT } from "@/components/engagement-launch-pad/styles";
import { api, send } from "@/components/creative-studio/client";

type Media = NonNullable<ProjectDetail["media"]>;

export const LAYOUT_LABEL: Record<ShowLayout, string> = { window: "9:16 window", full: "Full screen", split: "Split screen", corner: "You in the corner" };

/**
 * A line's clip on screen, on the script: which clip, how it shows and the
 * part shown, all changeable (and addable on a line without one) until the
 * edit is made.
 */
export function ShowPart({
  projectId,
  clipId,
  show,
  media,
  locked,
  onChange,
  onError,
}: {
  projectId: string;
  clipId: string;
  show: ShowCue | null;
  media: Media;
  locked: boolean;
  onChange: (d: ProjectDetail) => void;
  onError: (msg: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ShowCue | null>(show);
  const [saving, setSaving] = useState(false);
  const number = show ? media.items.findIndex((it) => it.id === show.mediaId) + 1 : 0;

  async function save(next: ShowCue | null) {
    setSaving(true);
    const r = await send(api(`${projectId}/clips/${clipId}`), "PATCH", { show: next });
    setSaving(false);
    if (r.ok) {
      onChange(r.data);
      setOpen(false);
    } else onError(r.error);
  }

  if (!show && locked) return null;
  if (!open) {
    return show ? (
      <button
        type="button"
        onClick={() => {
          if (locked) return;
          setDraft(show);
          setOpen(true);
        }}
        disabled={locked}
        className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2 py-0.5 text-[11px] font-semibold text-cyan-100 enabled:hover:border-cyan-300/60"
        title={locked ? undefined : "Change the clip on screen"}
      >
        <span className="rounded bg-cyan-500/30 px-1 text-[9px] font-black tracking-wider">ON SCREEN</span>
        Clip {number || "?"} · {LAYOUT_LABEL[show.layout]} ·{" "}
        <span style={NUM_FONT}>
          {show.from.toFixed(1)}–{show.to.toFixed(1)} s
        </span>
        {!locked && <span aria-hidden="true">✎</span>}
      </button>
    ) : (
      <button
        type="button"
        onClick={() => {
          const first = media.items[0];
          if (!first) return;
          setDraft({ mediaId: first.id, from: 0, to: Math.min(5, first.durationS ?? 5), layout: "window" });
          setOpen(true);
        }}
        className="mt-1.5 text-[11px] font-semibold text-neutral-500 hover:text-cyan-300"
      >
        + Show a clip on this line
      </button>
    );
  }

  const clip = media.items.find((it) => it.id === draft?.mediaId);
  const field = "rounded-lg border border-white/10 bg-[#0b1220] px-2 py-1 text-[12px] text-white outline-none focus:border-cyan-400/60";
  return (
    <div className="mt-2 space-y-2 rounded-xl border border-cyan-400/25 bg-cyan-500/[0.06] p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={draft?.mediaId ?? ""}
          onChange={(e) => {
            const it = media.items.find((x) => x.id === e.target.value);
            if (it && draft) setDraft({ ...draft, mediaId: it.id, from: 0, to: Math.min(Math.max(1.5, draft.to - draft.from), it.durationS ?? 5) });
          }}
          className={field}
          aria-label="Which clip"
        >
          {media.items.map((it, i) => (
            <option key={it.id} value={it.id}>
              Clip {i + 1} · {it.filename}
            </option>
          ))}
        </select>
        <select value={draft?.layout ?? "window"} onChange={(e) => draft && setDraft({ ...draft, layout: e.target.value as ShowLayout })} className={field} aria-label="How it shows">
          {(Object.keys(LAYOUT_LABEL) as ShowLayout[]).map((l) => (
            <option key={l} value={l}>
              {LAYOUT_LABEL[l]}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-[11px] text-neutral-400">
          from
          <input
            type="number"
            step={0.1}
            min={0}
            value={draft?.from ?? 0}
            onChange={(e) => draft && setDraft({ ...draft, from: Number(e.target.value) })}
            className={`${field} w-16`}
            style={NUM_FONT}
          />
          to
          <input
            type="number"
            step={0.1}
            min={0}
            value={draft?.to ?? 0}
            onChange={(e) => draft && setDraft({ ...draft, to: Number(e.target.value) })}
            className={`${field} w-16`}
            style={NUM_FONT}
          />
          s{clip?.durationS ? ` of ${clip.durationS.toFixed(1)}` : ""}
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => void save(draft)} disabled={saving || !draft} className="min-h-8 rounded-full bg-cyan-600 px-3 text-xs font-bold text-white hover:bg-cyan-500 disabled:opacity-50">
          {saving ? "Saving…" : "Save"}
        </button>
        {show && (
          <button type="button" onClick={() => void save(null)} disabled={saving} className="min-h-8 px-2 text-xs font-semibold text-neutral-400 hover:text-white disabled:opacity-50">
            No clip on this line
          </button>
        )}
        <button type="button" onClick={() => setOpen(false)} disabled={saving} className="min-h-8 px-2 text-xs font-semibold text-neutral-500 hover:text-white">
          Cancel
        </button>
      </div>
    </div>
  );
}
