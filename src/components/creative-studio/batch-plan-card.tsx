"use client";

import type { CreativeFormat } from "@/lib/creative-studio/tables";
import { assignFrames } from "@/lib/creative-studio/batch-shared";
import { CTA_CLASSES } from "@/components/launch-pad";
import { AssistantCard, Chip, SP } from "@/components/creative-studio/canvas";

export interface PlanItem {
  title: string;
  direction: string;
  shot: string;
  /** Index into the pasted frames, or null = Manus makes this video's frame. */
  frame: number | null;
}

export interface BatchPlan {
  format: CreativeFormat;
  brief: string;
  notes: string;
  items: PlanItem[];
  /** The frames pasted in the chat box (object URLs for the thumbnails). */
  frames: { file: File; url: string }[];
  /** How the pasted frames were handed out. */
  cover: "rest" | "all";
  random: boolean;
}

/**
 * The batch plan before anything is made: Claude's videos (all editable),
 * which frame goes with which video, and — when fewer frames were pasted
 * than videos — the question "use it for every video, or Manus for the rest?".
 */
export function BatchPlanCard({
  plan,
  busy,
  onChange,
  onReplan,
  onCancel,
  onCreate,
}: {
  plan: BatchPlan;
  busy: string | null;
  onChange: (p: BatchPlan) => void;
  onReplan: () => void;
  onCancel: () => void;
  onCreate: () => void;
}) {
  const n = plan.items.length;
  const k = plan.frames.length;
  const noun = plan.format === "vsl_16x9" ? (n === 1 ? "VSL" : "VSLs") : n === 1 ? "ad" : "ads";
  const manusCount = plan.items.filter((i) => i.frame === null).length;

  function setItem(i: number, patch: Partial<PlanItem>) {
    onChange({ ...plan, items: plan.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) });
  }
  function reassign(cover: "rest" | "all", random: boolean) {
    const frames = assignFrames(n, k, cover, random);
    onChange({ ...plan, cover, random, items: plan.items.map((it, i) => ({ ...it, frame: frames[i] })) });
  }
  function remove(i: number) {
    if (n <= 2) return;
    onChange({ ...plan, items: plan.items.filter((_, j) => j !== i) });
  }

  const pill = (on: boolean) =>
    `rounded-full border px-3 py-1.5 text-xs font-bold transition ${on ? "border-cyan-400 bg-cyan-500/20 text-white" : "border-white/10 bg-white/5 text-neutral-300 hover:text-white"}`;

  return (
    <AssistantCard
      accent="violet"
      icon={SP.sparkles}
      title={`${n} ${noun} planned`}
      right={<Chip tone="blue">Batch · review before anything is made</Chip>}
    >
      {plan.notes && <p className="mb-3 text-sm text-neutral-300">{plan.notes}</p>}

      {/* Frames */}
      <div className="mb-4 rounded-xl border border-white/10 bg-white/[0.03] p-3">
        {k === 0 ? (
          <p className="text-xs text-neutral-300">
            No frames pasted, so <b className="text-white">Manus makes one frame per video</b> from its shot line, using your Daniela reference images. Paste frames in the chat box next time to use your own.
          </p>
        ) : k < n ? (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-white">
              You pasted {k} frame{k > 1 ? "s" : ""} for {n} videos. What should the rest use?
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => reassign("all", plan.random)} className={pill(plan.cover === "all")}>
                Use {k > 1 ? "my frames" : "it"} for every video
              </button>
              <button type="button" onClick={() => reassign("rest", plan.random)} className={pill(plan.cover === "rest")}>
                ✨ Manus makes the other {n - k}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm font-semibold text-white">
            {k} frames for {n} videos{k > n ? ` (the extra ${k - n} won't be used)` : ""}.
          </p>
        )}
        {k > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-neutral-400">
            <span>Don&apos;t mind which frame goes where?</span>
            <button type="button" onClick={() => reassign(plan.cover, true)} className={pill(false)}>
              🎲 Assign randomly
            </button>
            {plan.random && (
              <button type="button" onClick={() => reassign(plan.cover, false)} className="font-semibold text-neutral-500 hover:text-white">
                Back to in order
              </button>
            )}
            <span className="text-neutral-500">Or pick a frame on each video below.</span>
          </div>
        )}
      </div>

      {/* Videos */}
      <div className="space-y-3">
        {plan.items.map((it, i) => (
          <div key={i} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-[11px] font-black text-violet-200">{i + 1}</span>
              <input
                value={it.title}
                onChange={(e) => setItem(i, { title: e.target.value })}
                className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1.5 py-1 text-sm font-bold text-white hover:border-white/10 focus:border-cyan-400/50 focus:outline-none"
                aria-label={`Video ${i + 1} title`}
              />
              {n > 2 && (
                <button type="button" onClick={() => remove(i)} className="min-h-8 shrink-0 rounded-full px-2.5 text-[11px] font-semibold text-neutral-500 hover:bg-white/5 hover:text-rose-300" title="Drop this video">
                  Remove
                </button>
              )}
            </div>
            <textarea
              value={it.direction}
              onChange={(e) => setItem(i, { direction: e.target.value })}
              rows={3}
              className="mt-2 w-full resize-y rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[13px] leading-relaxed text-neutral-100 focus:border-cyan-400/50 focus:outline-none"
              aria-label={`Video ${i + 1} description`}
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.14em] text-neutral-500">Frame</span>
              {plan.frames.map((f, fi) => (
                <button
                  key={fi}
                  type="button"
                  onClick={() => setItem(i, { frame: fi })}
                  className={`relative h-16 w-12 overflow-hidden rounded-md border-2 sm:h-14 sm:w-10 ${it.frame === fi ? "border-cyan-400" : "border-transparent opacity-60 hover:opacity-100"}`}
                  title={`Your frame ${fi + 1}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- local preview */}
                  <img src={f.url} alt="" className="h-full w-full object-cover" />
                  <span className="absolute bottom-0 right-0 rounded-tl bg-black/70 px-1 text-[9px] font-bold text-white">{fi + 1}</span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => setItem(i, { frame: null })}
                className={`flex h-16 items-center rounded-md border-2 px-2.5 text-[11px] font-bold sm:h-14 ${it.frame === null ? "border-cyan-400 bg-cyan-500/10 text-white" : "border-white/10 text-neutral-400 hover:text-white"}`}
              >
                ✨ Manus
              </button>
            </div>
            {it.frame === null && (
              <input
                value={it.shot}
                onChange={(e) => setItem(i, { shot: e.target.value })}
                placeholder="Describe the shot for Manus, e.g. Daniela in a lounge chair by the window"
                className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-neutral-200 sm:py-1.5 placeholder:text-neutral-600 focus:border-cyan-400/50 focus:outline-none"
                aria-label={`Video ${i + 1} Manus shot`}
              />
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onCreate}
          disabled={Boolean(busy) || plan.items.some((it) => !it.direction.trim() || (it.frame === null && !it.shot.trim()))}
          className={`${CTA_CLASSES} w-full disabled:opacity-50 sm:w-auto`}
        >
          {busy ?? `Create ${n} ${noun}`}
        </button>
        <button
          type="button"
          onClick={onReplan}
          disabled={Boolean(busy)}
          className="rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-neutral-300 hover:bg-white/10 hover:text-white disabled:opacity-50"
        >
          ↻ Re-plan
        </button>
        <button type="button" onClick={onCancel} disabled={Boolean(busy)} className="min-h-10 px-3 text-xs font-semibold text-neutral-500 hover:text-white">
          Cancel
        </button>
        <span className="text-[11px] text-neutral-500">
          {manusCount > 0 ? `Manus makes ${manusCount} frame${manusCount > 1 ? "s" : ""}. ` : ""}Scripts are written automatically; nothing goes to Kling until you approve.
        </span>
      </div>
    </AssistantCard>
  );
}
