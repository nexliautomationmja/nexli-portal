"use client";

import { useEffect, useState } from "react";
import type { ProjectDetail } from "@/lib/creative-studio/service";
import type { CreativeFormat } from "@/lib/creative-studio/tables";
import { api, send } from "@/components/creative-studio/client";
import { INPUT } from "@/components/creative-studio/ui";

/**
 * Step 2 — say what the video is in your own words. The only question is
 * ad or VSL; Claude infers the rest from your words, the frame and the
 * framework, then writes the script.
 */
export function DirectionStep({
  detail,
  onChange,
  onError,
}: {
  detail: ProjectDetail;
  onChange: (d: ProjectDetail) => void;
  onError: (msg: string) => void;
}) {
  const p = detail.project;
  const [direction, setDirection] = useState(p.direction);
  const [format, setFormat] = useState<CreativeFormat>(p.format);
  const [writing, setWriting] = useState(false);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!writing) return;
    const started = Date.now();
    const t = setInterval(() => setSeconds(Math.round((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(t);
  }, [writing]);

  const frame = detail.frames[0];
  const frameIsVertical = frame?.width && frame?.height ? frame.height > frame.width : true;
  const mismatch = format === "vsl_16x9" && frameIsVertical;

  async function write() {
    if (detail.clips.length > 0 && !confirm("Write a new script from scratch? The current one is kept, so you can undo.")) return;
    setWriting(true);
    setSeconds(0);
    const r = await send(api(`${p.id}/script`), "POST", { direction, format });
    setWriting(false);
    if (r.ok) onChange(r.data);
    else onError(r.error);
  }

  return (
    <div className="space-y-4">
      <textarea
        rows={6}
        value={direction}
        onChange={(e) => setDirection(e.target.value)}
        placeholder="Explain the video like you would to Claude: the angle, who it's for, what she should get across, any lines she has to say, where it sends people…"
        className={`${INPUT} resize-y text-base`}
        style={{ color: "var(--text-main)" }}
        disabled={writing}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold" style={{ color: "var(--text-main)" }}>Is this an ad or a VSL?</span>
          {(
            [
              ["ad_9x16", "Ad · 9:16"],
              ["vsl_16x9", "VSL · 16:9"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              disabled={writing}
              onClick={() => setFormat(value)}
              className={`rounded-xl border px-3 py-1.5 text-sm font-semibold transition-colors ${
                format === value ? "border-blue-500 bg-blue-500/15 text-blue-400" : "border-[var(--glass-border)] text-[var(--text-muted)] hover:bg-[var(--input-bg)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button type="button" onClick={write} disabled={writing || !direction.trim()} className="btn-primary px-6 py-2.5 text-sm">
          {writing ? `Writing… ${seconds}s` : detail.clips.length > 0 ? "Rewrite from scratch" : "Write the script"}
        </button>
      </div>
      {mismatch && (
        <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
          Your frame is vertical. A VSL is 16:9, so pick or create a horizontal frame in step 1 first.
        </p>
      )}
      {writing && (
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Claude is following your Kling framework: structure, lines, delivery, actions and pronunciation cues. An ad takes about a minute; a VSL can take up to three.
        </p>
      )}
    </div>
  );
}
