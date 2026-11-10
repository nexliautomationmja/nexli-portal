"use client";

import { useState } from "react";
import type { AdCopyVersion } from "@/lib/creative-studio/ad-copy";
import { FacebookLogo } from "@/components/launch-pad";
import { NUM_FONT } from "@/components/engagement-launch-pad/styles";
import { Chip, SP, SvgIcon } from "@/components/creative-studio/canvas";

const EMOJI = /\p{Extended_Pictographic}/gu;
const wordCount = (s: string) => s.split(/\s+/).filter((w) => /[\p{L}\p{N}$]/u.test(w)).length;
/** Meta cuts the primary text at about 125 characters behind "See more". */
const FOLD = 125;

/**
 * Ad copy variations: a feed preview of the chosen primary text + headline,
 * the 4 primary texts and 4 headlines (each with Copy), the description and
 * button, and changes / fresh variations / undo. Shared by the Ad copy tool
 * and the Ad copy card inside a studio video.
 */
export function AdCopyResults({
  copy,
  versions,
  media,
  busy,
  onRevise,
  onFresh,
  onUndo,
  onError,
}: {
  copy: AdCopyVersion;
  versions: number;
  media: { url: string | null; kind: "video" | "image" } | null;
  busy: boolean;
  onRevise: (note: string) => void;
  onFresh: () => void;
  onUndo: () => void;
  onError: (msg: string) => void;
}) {
  const [pick, setPick] = useState({ text: 0, headline: 0, version: copy.version });
  const [expanded, setExpanded] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [note, setNote] = useState("");

  // A new version starts back on the first variation.
  const sel = pick.version === copy.version ? pick : { text: 0, headline: 0, version: copy.version };
  const text = copy.primaryTexts[Math.min(sel.text, copy.primaryTexts.length - 1)] ?? "";
  const headline = copy.headlines[Math.min(sel.headline, copy.headlines.length - 1)] ?? "";
  const folded = !expanded && text.length > FOLD;
  const shown = folded ? `${text.slice(0, FOLD).replace(/\s+\S*$/, "")}…` : text;

  async function copyText(key: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1800);
    } catch {
      onError("Couldn't copy. Select the text and copy it by hand.");
    }
  }
  const copyBtn = (k: string, value: string) => (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        void copyText(k, value);
      }}
      className={`inline-flex min-h-8 shrink-0 items-center gap-1 rounded-full px-3 py-1 text-[11px] font-bold ${copied === k ? "bg-emerald-500/20 text-emerald-200" : "bg-white/10 text-white hover:bg-lime-400 hover:text-[#0a0f1c]"}`}
    >
      {copied === k ? "✓ Copied" : (
        <>
          <SvgIcon d={SP.copy} size={12} /> Copy
        </>
      )}
    </button>
  );

  return (
    <div className="grid gap-4 sm:grid-cols-[minmax(0,330px)_1fr]">
      {/* The post as it shows in the feed */}
      <div className="space-y-2">
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
            {media?.url && media.kind === "video" ? (
              <video key={media.url} src={media.url} controls playsInline muted preload="metadata" className="mx-auto max-h-[420px] w-full object-contain" />
            ) : media?.url ? (
              // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
              <img src={media.url} alt="" className="mx-auto max-h-[420px] w-full object-contain" />
            ) : (
              <div className="flex aspect-[9/16] max-h-[420px] items-center justify-center text-xs text-neutral-500">Your video</div>
            )}
          </div>
          <div className="flex items-center gap-2 bg-white/[0.04] px-3 py-2.5">
            <span className="min-w-0 flex-1">
              <span className="block text-[9px] uppercase tracking-[0.1em] text-neutral-500">nexli.net</span>
              <span className="block truncate text-xs font-bold leading-tight text-white" title={headline}>
                {headline}
              </span>
              <span className="block truncate text-[11px] leading-tight text-neutral-400">{copy.description}</span>
            </span>
            <span className="shrink-0 rounded-md bg-white/10 px-3 py-1.5 text-[11px] font-bold text-white">{copy.cta}</span>
          </div>
        </article>
        <p className="text-center text-[10px] text-neutral-400">
          Showing primary text {sel.text + 1} with headline {sel.headline + 1}. Click any version to preview it.
        </p>
      </div>

      <div className="min-w-0 space-y-4">
        {/* Primary texts */}
        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-400">Primary text · {copy.primaryTexts.length} versions</p>
          {copy.primaryTexts.map((t, i) => {
            const active = i === sel.text;
            const lines = t.split("\n").filter((l) => l.trim());
            return (
              <div
                key={i}
                role="button"
                tabIndex={0}
                onClick={() => {
                  setPick({ ...sel, text: i });
                  setExpanded(false);
                }}
                onKeyDown={(e) => e.key === "Enter" && setPick({ ...sel, text: i })}
                className={`cursor-pointer rounded-xl border p-3 transition ${active ? "border-lime-300/60 bg-lime-400/10 shadow-lg shadow-lime-500/10" : "border-white/10 bg-white/[0.03] hover:border-lime-300/30"}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-white">Version {i + 1}</span>
                  <span className="text-[10px] text-neutral-500" style={NUM_FONT}>
                    {wordCount(t)} words · {(t.match(EMOJI) ?? []).length} emojis
                  </span>
                  <span className="ml-auto" />
                  {copyBtn(`p${i}`, t)}
                </div>
                <p className="mt-1.5 text-[13px] font-semibold leading-snug text-neutral-100">{lines[0]}</p>
                {open === i ? (
                  <p className="mt-1 whitespace-pre-line text-[12px] leading-relaxed text-neutral-300">{lines.slice(1).join("\n\n")}</p>
                ) : null}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpen(open === i ? null : i);
                  }}
                  className="mt-1 text-[11px] font-semibold text-neutral-500 hover:text-white"
                >
                  {open === i ? "Show less" : "Read it all"}
                </button>
              </div>
            );
          })}
        </div>

        {/* Headlines */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-400">Headline · {copy.headlines.length} versions</p>
          {copy.headlines.map((h, i) => (
            <div
              key={i}
              role="button"
              tabIndex={0}
              onClick={() => setPick({ ...sel, headline: i })}
              onKeyDown={(e) => e.key === "Enter" && setPick({ ...sel, headline: i })}
              className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 ${i === sel.headline ? "border-lime-300/60 bg-lime-400/10 shadow-lg shadow-lime-500/10" : "border-white/10 bg-white/[0.03] hover:border-lime-300/30"}`}
            >
              <span className="min-w-0 flex-1 text-[13px] font-semibold text-white">{h}</span>
              <span className="text-[10px] text-neutral-500" style={NUM_FONT}>
                {h.length} chars
              </span>
              {copyBtn(`h${i}`, h)}
            </div>
          ))}
        </div>

        {/* Description + button */}
        <div className="grid gap-1.5 sm:grid-cols-2">
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
            <span className="min-w-0 flex-1">
              <span className="block text-[9px] font-black uppercase tracking-[0.14em] text-neutral-500">Description</span>
              <span className="block truncate text-[13px] text-white">{copy.description}</span>
            </span>
            {copyBtn("d", copy.description)}
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
            <span className="min-w-0 flex-1">
              <span className="block text-[9px] font-black uppercase tracking-[0.14em] text-neutral-500">Button</span>
              <span className="block text-[13px] text-white">{copy.cta}</span>
            </span>
            <Chip>CTA</Chip>
          </div>
        </div>

        {copy.notes && <p className="rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-xs leading-relaxed text-neutral-300">{copy.notes}</p>}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (note.trim()) {
              onRevise(note.trim());
              setNote("");
            }
          }}
          className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 p-1.5 pl-3 focus-within:border-lime-300/50"
        >
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What should change? e.g. punchier hooks, fewer emojis, mention the free audit"
            className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-neutral-500 focus:outline-none"
            disabled={busy}
          />
          <button
            type="submit"
            disabled={!note.trim() || busy}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-lime-400 text-[#0a0f1c] hover:bg-lime-300 disabled:opacity-40"
            aria-label="Change the copy"
          >
            <SvgIcon d={SP.arrowUp} size={15} />
          </button>
        </form>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={onFresh} disabled={busy} className="text-xs font-semibold text-neutral-400 hover:text-white disabled:opacity-40">
            ↻ New variations
          </button>
          {versions > 1 && (
            <button type="button" onClick={onUndo} disabled={busy} className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-500 hover:text-white disabled:opacity-40">
              <SvgIcon d={SP.undo} size={14} /> Undo last change
            </button>
          )}
          <span className="text-[10px] text-neutral-600">v{copy.version}</span>
        </div>
      </div>
    </div>
  );
}
