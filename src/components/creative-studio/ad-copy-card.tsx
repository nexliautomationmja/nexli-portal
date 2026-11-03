"use client";

import { useState } from "react";
import type { ProjectDetail } from "@/lib/creative-studio/service";
import { CTA_CLASSES, FacebookLogo } from "@/components/launch-pad";
import { NUM_FONT } from "@/components/engagement-launch-pad/styles";
import { api, send } from "@/components/creative-studio/client";
import { AssistantCard, Chip, SP, SvgIcon, ThinkingCard, UserBubble } from "@/components/creative-studio/canvas";

const EMOJI = /\p{Extended_Pictographic}/gu;
const wordCount = (s: string) => s.split(/\s+/).filter((w) => /[\p{L}\p{N}$]/u.test(w)).length;
/** Meta cuts the primary text at about 125 characters behind "See more". */
const FOLD = 125;

/**
 * Meta ad copy written from the finished video: mid-length primary text,
 * spaced out with emojis, plus headline, description and button. Shown as
 * the post will look in the feed, with one-click copy for each field.
 */
export function AdCopyCard({
  detail,
  onChange,
  onError,
}: {
  detail: ProjectDetail;
  onChange: (d: ProjectDetail) => void;
  onError: (msg: string) => void;
}) {
  const p = detail.project;
  const copies = detail.adCopies;
  const copy = copies[copies.length - 1];
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  // The video under the copy: the newest rendered edit, else the final cut.
  const rendered = [...detail.edits].reverse().find((e) => e.status === "done" && e.outputUrl);
  const media = rendered?.outputUrl ?? detail.finalCuts[detail.finalCuts.length - 1]?.url ?? null;

  async function write(body: { note?: string }) {
    setBusy(body.note ? "Claude is changing the copy…" : "Claude is writing the ad copy…");
    const r = await send(api(`${p.id}/copy`), "POST", body);
    setBusy(null);
    if (r.ok) {
      setNote("");
      setExpanded(false);
      onChange(r.data);
    } else onError(r.error);
  }
  async function undo() {
    const r = await send(api(`${p.id}/copy/undo`), "POST");
    if (r.ok) onChange(r.data);
    else onError(r.error);
  }
  async function copyText(label: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied((c) => (c === label ? null : c)), 1800);
    } catch {
      onError("Couldn't copy. Select the text and copy it by hand.");
    }
  }

  const text = copy?.primaryText ?? "";
  const folded = !expanded && text.length > FOLD;
  const shown = folded ? `${text.slice(0, FOLD).replace(/\s+\S*$/, "")}…` : text;

  return (
    <div className="space-y-4">
      {copies.filter((c) => c.note).slice(-2).map((c) => (
        <UserBubble key={c.id}>{c.note}</UserBubble>
      ))}

      <AssistantCard
        id="stage-copy"
        accent="violet"
        icon={SP.script}
        title="Meta ad copy"
        right={copy ? <Chip>v{copy.version}</Chip> : null}
      >
        {!copy && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-md text-sm text-neutral-300">
              Ad copy written from this video: a mid-length primary text, spaced out with emojis, plus the headline, description and button.
            </p>
            <button type="button" onClick={() => void write({})} disabled={Boolean(busy)} className={`${CTA_CLASSES} disabled:opacity-50`}>
              Write the ad copy
            </button>
          </div>
        )}

        {copy && (
          <div className="grid gap-4 sm:grid-cols-[minmax(0,330px)_1fr]">
            {/* The post as it shows in the feed */}
            <article className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b1220]">
              <div className="flex items-center gap-2 px-3 pt-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- small static logo */}
                <img src="/logos/nexli-avatar.png" alt="" className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-white/10" />
                <span className="min-w-0">
                  <span className="block text-xs font-bold leading-tight text-white">Nexli</span>
                  <span className="block text-[10px] leading-tight text-neutral-500">Sponsored</span>
                </span>
                <span className="ml-auto opacity-70">
                  <FacebookLogo size={13} />
                </span>
              </div>
              <p className="whitespace-pre-line px-3 pt-2.5 text-[13px] leading-relaxed text-neutral-100">
                {shown}
                {text.length > FOLD && (
                  <button type="button" onClick={() => setExpanded((v) => !v)} className="ml-1 font-semibold text-neutral-400 hover:text-white">
                    {expanded ? "See less" : "See more"}
                  </button>
                )}
              </p>
              <div className="mt-2.5 bg-black">
                {media ? (
                  <video key={media} src={media} controls playsInline muted preload="metadata" className="mx-auto max-h-[420px] w-full object-contain" />
                ) : (
                  <div className="flex aspect-[9/16] max-h-[420px] items-center justify-center text-xs text-neutral-500">Your video</div>
                )}
              </div>
              <div className="flex items-center gap-2 bg-white/[0.04] px-3 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block text-[9px] uppercase tracking-[0.1em] text-neutral-500">nexli.net</span>
                  <span className="block truncate text-xs font-bold leading-tight text-white" title={copy.headline}>
                    {copy.headline}
                  </span>
                  <span className="block truncate text-[11px] leading-tight text-neutral-400">{copy.description}</span>
                </span>
                <span className="shrink-0 rounded-md bg-white/10 px-3 py-1.5 text-[11px] font-bold text-white">{copy.cta}</span>
              </div>
            </article>

            {/* Fields + changes */}
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1.5" style={NUM_FONT}>
                <Chip>{wordCount(text)} words</Chip>
                <Chip>{(text.match(EMOJI) ?? []).length} emojis</Chip>
                <Chip>{copy.headline.length}-char headline</Chip>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Primary text", value: text },
                  { label: "Headline", value: copy.headline },
                  { label: "Description", value: copy.description },
                  { label: "Everything", value: `${text}\n\nHeadline: ${copy.headline}\nDescription: ${copy.description}\nButton: ${copy.cta}` },
                ].map((f) => (
                  <button
                    key={f.label}
                    type="button"
                    onClick={() => void copyText(f.label, f.value)}
                    className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-left text-xs font-semibold text-neutral-200 hover:border-violet-400/40 hover:bg-white/[0.06]"
                  >
                    <span>{copied === f.label ? "✓ Copied" : f.label}</span>
                    <SvgIcon d={SP.copy} size={14} />
                  </button>
                ))}
              </div>

              {copy.notes && <p className="rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-xs leading-relaxed text-neutral-300">{copy.notes}</p>}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (note.trim()) void write({ note: note.trim() });
                }}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 p-1.5 pl-3 focus-within:border-violet-400/50"
              >
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="What should change? e.g. punchier hook, fewer emojis"
                  className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-neutral-500 focus:outline-none"
                  disabled={Boolean(busy)}
                />
                <button
                  type="submit"
                  disabled={!note.trim() || Boolean(busy)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-40"
                  aria-label="Change the copy"
                >
                  <SvgIcon d={SP.arrowUp} size={15} />
                </button>
              </form>

              <div className="flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => void write({})} disabled={Boolean(busy)} className="text-xs font-semibold text-neutral-400 hover:text-white disabled:opacity-40">
                  ↻ Write a fresh one
                </button>
                {copies.length > 1 && (
                  <button type="button" onClick={undo} disabled={Boolean(busy)} className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-500 hover:text-white">
                    <SvgIcon d={SP.undo} size={14} /> Undo last change
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </AssistantCard>

      {busy && <ThinkingCard accent="violet" label={busy} detail="Following your copy rules: no guarantees, “investment” never “price”, and only the numbers the video uses." />}
    </div>
  );
}
