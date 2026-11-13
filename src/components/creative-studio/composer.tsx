"use client";

import { useEffect, useRef, useState } from "react";
import type { CreativeFormat } from "@/lib/creative-studio/tables";
import { SP, SvgIcon } from "@/components/creative-studio/canvas";

export interface ComposerSubmit {
  text: string;
  /** Pasted / dropped / picked images — in the studio a pasted image is the frame. */
  images: File[];
  /** A video file (the final cut, or before a script is approved the video a reaction reacts to). */
  video: File | null;
  format: CreativeFormat;
  /** Batch size (1 = a single video). */
  count: number;
  /** The one attached image is a photo for Manus to recreate (text = what to change), not the frame. */
  recreate: boolean;
}

interface Attachment {
  id: string;
  file: File;
  preview: string | null;
}

/**
 * The chat box (ChatGPT / Claude style): auto-growing textarea, Enter sends
 * (Shift+Enter = new line; on phones Return adds a line and ↑ sends), paste / drop / 📎 for images (and a video for the
 * final cut), optional Ad · VSL pill and batch size. Modeled on the composer in
 * src/components/messages/message-thread.tsx.
 *
 * With `allowRecreate`, one attached photo can be either the frame as is or a
 * photo for Manus to recreate: then the text is what to change about it.
 *
 * Image pastes anywhere on the page land here too — unless the pointer or
 * focus is inside an element marked data-paste-zone (the Daniela references
 * strip), which handles its own pastes.
 */
export function Composer({
  placeholder,
  hint,
  busy = false,
  disabled = false,
  allowFormat = false,
  allowVideo = false,
  videoLabel = "Final cut",
  format,
  onFormat,
  large = false,
  autoFocus = false,
  defaultText,
  count = 1,
  onCount,
  maxCount = 1,
  maxImages,
  allowRecreate = false,
  onSubmit,
}: {
  placeholder: string;
  hint?: string;
  busy?: boolean;
  disabled?: boolean;
  allowFormat?: boolean;
  allowVideo?: boolean;
  /** What an attached video is for, on its chip ("Final cut", or "React to" before a script is approved). */
  videoLabel?: string;
  format: CreativeFormat;
  onFormat?: (f: CreativeFormat) => void;
  large?: boolean;
  autoFocus?: boolean;
  /** Initial text (e.g. a suggestion chip). Remount with a new key to change it. */
  defaultText?: string;
  /** Batch create: how many videos (with onCount, shows the − n + stepper). */
  count?: number;
  onCount?: (n: number) => void;
  maxCount?: number;
  /** How many images one message can carry (a story's scenes); defaults to one per video in the batch. */
  maxImages?: number;
  /** Offer "Recreate with Manus" when one photo is attached (single video, before the script is locked). */
  allowRecreate?: boolean;
  onSubmit: (s: ComposerSubmit) => Promise<boolean | void> | boolean | void;
}) {
  const [text, setText] = useState(defaultText ?? "");
  const [files, setFiles] = useState<Attachment[]>([]);
  const [dragging, setDragging] = useState(false);
  // One attached photo: use it as the frame, or have Manus recreate it with a change.
  const [recreateOn, setRecreateOn] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const filesRef = useRef(files);

  const grow = () => {
    const el = area.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, large ? 260 : 180)}px`;
  };

  const add = (list: File[]) => {
    const accepted = list.filter((f) => f.type.startsWith("image/") || (allowVideo && f.type.startsWith("video/")));
    if (accepted.length === 0) return;
    setFiles((prev) => {
      // A batch keeps up to one frame per video; a single video up to `maxImages` (its scenes, in order). One video max.
      const limit = count > 1 ? count : Math.max(1, maxImages ?? 1);
      const newImages = accepted.filter((f) => f.type.startsWith("image/"));
      const prevImages = prev.filter((a) => a.file.type.startsWith("image/"));
      const keepImages = newImages.length ? prevImages.slice(Math.max(0, prevImages.length + newImages.length - limit)) : prevImages;
      const keep = prev.filter((a) =>
        a.file.type.startsWith("image/") ? keepImages.includes(a) : !accepted.some((f) => f.type.startsWith("video/"))
      );
      prev.filter((a) => !keep.includes(a)).forEach((a) => a.preview && URL.revokeObjectURL(a.preview));
      const image = newImages.slice(-limit);
      const video = accepted.filter((f) => f.type.startsWith("video/")).slice(-1);
      return [
        ...keep,
        ...[...image, ...video].map((file) => ({
          id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 7)}`,
          file,
          preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
        })),
      ];
    });
    area.current?.focus();
  };
  const addRef = useRef(add);
  // Keep the latest handlers for the page-level paste listener.
  useEffect(() => {
    addRef.current = add;
    filesRef.current = files;
  });

  // Page-level image paste → the composer (except inside a paste zone).
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (document.querySelector('[data-paste-zone][data-active="true"]')) return;
      const pasted = Array.from(e.clipboardData?.files ?? []);
      if (!pasted.some((f) => f.type.startsWith("image/") || f.type.startsWith("video/"))) return;
      e.preventDefault();
      addRef.current(pasted);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, []);

  useEffect(() => () => filesRef.current.forEach((a) => a.preview && URL.revokeObjectURL(a.preview)), []);

  async function submit() {
    if (busy || disabled) return;
    const t = text.trim();
    if (!t && files.length === 0) return;
    const images = files.filter((a) => a.file.type.startsWith("image/")).map((a) => a.file);
    const video = files.find((a) => a.file.type.startsWith("video/"))?.file ?? null;
    const ok = await onSubmit({ text: t, images, video, format, count, recreate: recreatable && recreateOn });
    if (ok !== false) {
      setText("");
      files.forEach((a) => a.preview && URL.revokeObjectURL(a.preview));
      setFiles([]);
      setRecreateOn(false);
      requestAnimationFrame(grow);
    }
  }

  const canSend = !busy && !disabled && (text.trim().length > 0 || files.length > 0);
  // Several images on one video are its scenes, in the order attached.
  const imageIds = files.filter((a) => a.preview).map((a) => a.id);
  const imageCount = imageIds.length;
  const imageIndex = new Map(imageIds.map((id, i) => [id, i]));
  const recreatable = allowRecreate && count === 1 && imageCount === 1 && files.length === 1;
  const recreating = recreatable && recreateOn;

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        add(Array.from(e.dataTransfer.files));
      }}
      className={`relative rounded-3xl border bg-[#0b1224]/90 shadow-2xl shadow-black/40 backdrop-blur-xl transition-colors ${
        dragging ? "border-blue-400 ring-4 ring-blue-500/20" : "border-white/12 focus-within:border-blue-500/60"
      }`}
      style={{ borderColor: dragging ? undefined : "rgba(255,255,255,0.12)" }}
    >
      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-3xl bg-blue-500/10 text-sm font-semibold text-blue-200">
          Drop to attach
        </div>
      )}

      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 px-4 pt-4">
          {files.map((a) => (
            <div key={a.id} className="group relative">
              {a.preview ? (
                // eslint-disable-next-line @next/next/no-img-element -- local preview
                <img src={a.preview} alt="" className="h-20 w-auto max-w-[140px] rounded-xl border border-white/15 object-cover" />
              ) : (
                <div className="flex h-20 w-44 items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3">
                  <SvgIcon d={SP.film} className="text-cyan-300" />
                  <span className="truncate text-xs text-white">{a.file.name}</span>
                </div>
              )}
              <span className="absolute bottom-1 left-1 rounded-md bg-black/70 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                {!a.preview ? videoLabel : recreating ? "To recreate" : imageCount > 1 && count === 1 ? `Scene ${imageIndex.get(a.id)! + 1}` : "Frame"}
              </span>
              <button
                type="button"
                onClick={() => setFiles((prev) => prev.filter((x) => x.id !== a.id))}
                className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-[#020617] text-white/80 hover:text-white"
                aria-label="Remove attachment"
              >
                <SvgIcon d={SP.x} size={12} />
              </button>
            </div>
          ))}
          {recreatable && (
            <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
              <div className="flex w-fit rounded-full border border-white/10 bg-white/5 p-0.5" role="group" aria-label="What to do with this photo">
                {(
                  [
                    [false, "Use as the frame"],
                    [true, "Recreate with Manus"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => {
                      setRecreateOn(value);
                      area.current?.focus();
                    }}
                    aria-pressed={recreateOn === value}
                    className={`min-h-8 rounded-full px-3 py-1 text-xs font-bold transition-colors ${
                      recreateOn === value
                        ? value
                          ? "bg-violet-600 text-white shadow shadow-violet-600/30"
                          : "bg-blue-600 text-white shadow shadow-blue-600/30"
                        : "text-neutral-400 hover:text-white"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <span className="text-[11px] leading-snug text-neutral-500">
                {recreateOn
                  ? "Type what to change below: a new suit colour, outfit, background, anything. Manus makes 2 options to pick from."
                  : "This photo becomes the video's frame as is."}
              </span>
            </div>
          )}
        </div>
      )}

      <textarea
        ref={area}
        rows={large ? 3 : 1}
        value={text}
        autoFocus={autoFocus}
        disabled={disabled}
        placeholder={
          recreating
            ? "What should Manus change? e.g. “same shot, navy suit instead of grey” or “put her in a modern office”. Leave empty to copy it as is."
            : placeholder
        }
        onChange={(e) => {
          setText(e.target.value);
          grow();
        }}
        onPaste={(e) => {
          const pasted = Array.from(e.clipboardData.files);
          if (pasted.some((f) => f.type.startsWith("image/") || f.type.startsWith("video/"))) {
            e.preventDefault();
            e.stopPropagation();
            add(pasted);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            // Touch keyboards have no Shift+Enter: Return adds a new line there, the send button sends.
            if (window.matchMedia("(hover: none), (pointer: coarse)").matches) return;
            e.preventDefault();
            void submit();
          }
        }}
        className={`block w-full resize-none bg-transparent px-5 text-white outline-none placeholder:text-neutral-500 ${
          large ? "pt-5 pb-2 text-[16px] leading-relaxed" : "pt-4 pb-1 text-[15px]"
        }`}
        style={{ fontSize: undefined }}
      />

      <div className="flex flex-wrap items-center gap-2 px-3 pb-3 pt-1">
        <button
          type="button"
          onClick={() => picker.current?.click()}
          disabled={disabled}
          className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Attach an image"
          title={
            allowVideo
              ? videoLabel === "Final cut"
                ? "Attach a frame image or your final cut video"
                : "Attach a frame image, or a video to react to"
              : (maxImages ?? 1) > 1
                ? "Attach frames (several = scenes of a story)"
                : "Attach the frame image"
          }
        >
          <SvgIcon d={SP.paperclip} />
        </button>
        <input
          ref={picker}
          type="file"
          hidden
          multiple={count > 1 || (maxImages ?? 1) > 1}
          accept={allowVideo ? "image/png,image/jpeg,image/webp,video/mp4,video/quicktime" : "image/png,image/jpeg,image/webp"}
          onChange={(e) => {
            add(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />

        {allowFormat && onFormat && (
          <div className="flex rounded-full border border-white/10 bg-white/5 p-0.5" role="group" aria-label="Ad or VSL">
            {(
              [
                ["ad_9x16", "Ad · 9:16"],
                ["vsl_16x9", "VSL · 16:9"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => onFormat(value)}
                aria-pressed={format === value}
                className={`min-h-8 rounded-full px-3 py-1 text-xs font-bold transition-colors ${
                  format === value ? "bg-blue-600 text-white shadow shadow-blue-600/30" : "text-neutral-400 hover:text-white"
                }`}
              >
                <span className="sm:hidden">{value === "ad_9x16" ? "Ad" : "VSL"}</span>
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
        )}

        {onCount && maxCount > 1 && (
          <div
            className={`flex items-center rounded-full border p-0.5 text-xs font-bold ${count > 1 ? "border-cyan-400/50 bg-cyan-500/10" : "border-white/10 bg-white/5"}`}
            role="group"
            aria-label="Batch size"
            title={`Batch create: up to ${maxCount} ${format === "vsl_16x9" ? "VSLs" : "ads"} at once`}
          >
            <button
              type="button"
              onClick={() => onCount(Math.max(1, count - 1))}
              disabled={count <= 1}
              className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-300 hover:bg-white/10 hover:text-white disabled:opacity-30"
              aria-label="Fewer videos"
            >
              −
            </button>
            <span className={`min-w-[64px] px-1 text-center ${count > 1 ? "text-cyan-100" : "text-neutral-400"}`}>
              {count === 1 ? "1 video" : `${count} ${format === "vsl_16x9" ? "VSLs" : "ads"}`}
            </span>
            <button
              type="button"
              onClick={() => onCount(Math.min(maxCount, count + 1))}
              disabled={count >= maxCount}
              className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-300 hover:bg-white/10 hover:text-white disabled:opacity-30"
              aria-label="More videos"
            >
              +
            </button>
          </div>
        )}

        {(recreating || hint) && (
          <span className="hidden min-w-0 flex-1 truncate text-[11px] text-neutral-500 sm:block">{recreating ? "Enter → Manus recreates your photo" : hint}</span>
        )}

        <button
          type="button"
          onClick={() => void submit()}
          disabled={!canSend}
          className="ml-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 text-white shadow-lg shadow-blue-500/30 transition-all hover:scale-105 disabled:cursor-not-allowed disabled:from-white/10 disabled:to-white/10 disabled:text-neutral-500 disabled:shadow-none disabled:hover:scale-100"
          aria-label="Send"
        >
          {busy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <SvgIcon d={SP.arrowUp} />}
        </button>
      </div>
    </div>
  );
}
