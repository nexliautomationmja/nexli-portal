"use client";

import { useRef, useState } from "react";
import type { ProjectDetail } from "@/lib/creative-studio/service";
import { SOURCE_MAX_SECONDS } from "@/lib/creative-studio/reaction-shared";
import { CTA_CLASSES } from "@/components/launch-pad";
import { addClipVideo } from "@/components/creative-studio/upload";
import { SP, SvgIcon } from "@/components/creative-studio/canvas";

/** The clips card's "Add your own video" button (the panel opens below the card's header). */
export function AddClipButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3.5 text-xs font-semibold text-neutral-300 hover:bg-white/10 hover:text-white"
    >
      <SvgIcon d={SP.upload} size={13} /> Add your own video
    </button>
  );
}

/**
 * "Add your own video" on the clips card (Nov 22 2026): pick where it goes
 * and the file. It's uploaded and added as a clip; the clips card then has
 * the server get it ready, and the cut card auto-cuts the whole video again.
 */
export function AddClipVideo({
  detail,
  onClose,
  onChange,
  onError,
}: {
  detail: ProjectDetail;
  onClose: () => void;
  onChange: (d: ProjectDetail) => void;
  onError: (msg: string) => void;
}) {
  const p = detail.project;
  const clips = detail.clips;
  const [after, setAfter] = useState<number>(clips.length - 1);
  const [uploading, setUploading] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const latestCut = detail.cuts[detail.cuts.length - 1];
  const speed = latestCut?.settings.speed;
  const shape = p.format === "vsl_16x9" ? "16:9 (landscape)" : "9:16 (vertical)";
  const place = Math.max(-1, Math.min(after, clips.length - 1));
  const label = (c: ProjectDetail["clips"][number]) => {
    const text = c.upload ? `your video · ${c.upload.filename}` : c.kind === "silent" ? c.action : c.line;
    return text.length > 48 ? `${text.slice(0, 47)}…` : text;
  };

  async function pick(file: File | undefined) {
    if (!file) return;
    setUploading(`Uploading ${file.name} (${Math.max(1, Math.round(file.size / 1024 / 1024))} MB)…`);
    try {
      const d = await addClipVideo(p.id, file, place);
      onChange(d);
      onClose();
      const id = d.clipId;
      if (id) setTimeout(() => document.getElementById(`clip-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 300);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Couldn't add the video");
    } finally {
      setUploading(null);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="mt-4 rounded-2xl border border-cyan-400/25 bg-cyan-500/[0.06] p-3.5 text-left">
      <p className="text-sm font-bold text-white">Add your own video</p>
      <p className="mt-0.5 text-xs leading-relaxed text-neutral-300">
        It goes in as a clip and the whole video is auto-cut again with it: its pauses are tightened like the other clips and it plays at the cut&apos;s speed
        {speed ? ` (${speed}×)` : ""}. A video with no talking is kept whole. If it isn&apos;t {shape}, it gets black bars to fit. MP4 or MOV, up to{" "}
        {Math.round(SOURCE_MAX_SECONDS / 60)} minutes.
      </p>
      <label className="mt-3 block text-[11px] font-bold uppercase tracking-[0.15em] text-neutral-400" htmlFor="add-clip-where">
        Where it goes
      </label>
      <select
        id="add-clip-where"
        value={place}
        onChange={(e) => setAfter(Number(e.target.value))}
        disabled={Boolean(uploading)}
        className="lp-input mt-1 w-full min-w-0 max-w-full truncate text-sm"
      >
        <option value={-1}>At the start, before clip 1</option>
        {clips.map((c, i) => (
          <option key={c.id} value={i}>
            {i === clips.length - 1 ? `At the end, after clip ${i + 1}` : `After clip ${i + 1}`} · {label(c)}
          </option>
        ))}
      </select>
      <input
        ref={input}
        type="file"
        accept="video/mp4,video/quicktime,.mp4,.mov"
        className="hidden"
        onChange={(e) => void pick(e.target.files?.[0])}
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {uploading ? (
          <span className="flex items-center gap-2 text-xs text-neutral-200">
            <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-cyan-300/30 border-t-cyan-300" aria-hidden="true" />
            {uploading}
          </span>
        ) : (
          <>
            <button type="button" onClick={() => input.current?.click()} className={`${CTA_CLASSES} !inline-flex`}>
              Choose the video
            </button>
            <button type="button" onClick={onClose} className="min-h-9 px-2 text-xs font-semibold text-neutral-500 hover:text-white">
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}
