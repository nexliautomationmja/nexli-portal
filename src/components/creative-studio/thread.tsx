"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ProjectDetail } from "@/lib/creative-studio/service";
import type { CreativeFormat } from "@/lib/creative-studio/tables";
import { SYNE } from "@/components/launch-pad";
import { api, send } from "@/components/creative-studio/client";
import { uploadFrameFile } from "@/components/creative-studio/upload";
import {
  AssistantCard,
  Chip,
  ErrorStrip,
  SP,
  STATUS_PILL,
  StudioCanvas,
  SvgIcon,
  ThinkingCard,
  UserBubble,
} from "@/components/creative-studio/canvas";
import { Composer, type ComposerSubmit } from "@/components/creative-studio/composer";
import { FrameCard } from "@/components/creative-studio/frame-card";
import { ScriptCard } from "@/components/creative-studio/script-card";
import { ClipsCard } from "@/components/creative-studio/clips-card";
import { FinalCutCard, uploadFinalCut } from "@/components/creative-studio/final-cut-card";

type Stage = "direction" | "frame" | "write" | "review" | "locked";

function stageOf(d: ProjectDetail): Stage {
  const locked = ["approved", "rendering", "clips_ready"].includes(d.project.status);
  if (locked) return "locked";
  if (d.clips.length > 0) return "review";
  if (!d.project.direction.trim()) return "direction";
  if (d.frames.length === 0) return "frame";
  return "write";
}

const COMPOSER: Record<Stage, { placeholder: string; hint: string }> = {
  direction: {
    placeholder: "What's this video about? Explain it like you would to Claude…",
    hint: "Enter saves it · paste an image to use it as the frame",
  },
  frame: {
    placeholder: "Paste Daniela's frame, or describe the shot for Manus…",
    hint: "A pasted image becomes the frame · text goes to Manus",
  },
  write: {
    placeholder: "Change the direction before Claude writes it…",
    hint: "Enter rewrites with this direction",
  },
  review: {
    placeholder: "What should change? e.g. make the hook punchier, drop clip 4",
    hint: "Enter → Claude revises the script",
  },
  locked: {
    placeholder: "Fix a clip, e.g. “clip 3: she said the number twice” · or attach your final cut",
    hint: "Mention the clip number · attach a video to upload your cut",
  },
};

/**
 * One video as a conversation: your brief → Daniela's frame → the script →
 * Kling clips → your final cut, with a chat box pinned at the bottom whose
 * meaning follows the stage. A pasted image is always the frame.
 */
export function StudioThread({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState<{ label: string; detail?: string; accent?: "violet" | "blue" | "cyan" | "emerald" } | null>(null);
  const [format, setFormat] = useState<CreativeFormat>("ad_9x16");
  const [frameChanged, setFrameChanged] = useState(false);
  const [params] = useState(() => (typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search)));
  const [autoWrite, setAutoWrite] = useState(() => params.get("start") === "1");
  const klingNotice = params.get("kling");
  const lastStage = useRef<Stage | null>(null);
  const writing = useRef(false);

  const apply = useCallback((d: ProjectDetail) => {
    setDetail(d);
    setFormat(d.project.format);
  }, []);
  const fail = useCallback((msg: string) => setError(msg), []);

  useEffect(() => {
    let cancelled = false;
    send(api(projectId), "GET").then((r) => {
      if (cancelled) return;
      if (r.ok) apply(r.data);
      else setError(r.error);
    });
    return () => {
      cancelled = true;
    };
  }, [projectId, apply]);

  const stage = detail ? stageOf(detail) : null;

  const writeScript = useCallback(
    async (direction?: string, fmt?: CreativeFormat) => {
      if (!detail || writing.current) return;
      writing.current = true;
      setError(null);
      setWorking({
        label: "Claude is writing the script…",
        detail: "Following your Kling framework: structure, lines, delivery, actions and pronunciation cues. An ad takes about a minute; a VSL up to three.",
        accent: "violet",
      });
      const r = await send(api(`${detail.project.id}/script`), "POST", {
        direction: direction ?? detail.project.direction,
        format: fmt ?? format,
      });
      writing.current = false;
      setWorking(null);
      setAutoWrite(false);
      setFrameChanged(false);
      if (r.ok) apply(r.data);
      else setError(r.error);
    },
    [detail, format, apply]
  );

  // Write automatically once there's a direction and a frame (started from home, or set here).
  useEffect(() => {
    if (stage === "write" && autoWrite && !working && !error) void writeScript();
  }, [stage, autoWrite, working, error, writeScript]);

  // Bring the active step into view when the stage moves on.
  useEffect(() => {
    if (!stage) return;
    if (lastStage.current && lastStage.current !== stage) {
      const id = stage === "review" ? "stage-review" : stage === "locked" ? "stage-clips" : "stage-frame";
      setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
    }
    lastStage.current = stage;
  }, [stage]);

  if (!detail || !stage) {
    return (
      <StudioCanvas>
        <div className="mx-auto max-w-3xl px-4 py-10">
          {error ? <ErrorStrip>{error}</ErrorStrip> : <div className="h-40 animate-pulse rounded-2xl bg-white/5" />}
        </div>
      </StudioCanvas>
    );
  }

  const p = detail.project;
  const status = STATUS_PILL[p.status] ?? STATUS_PILL.draft;
  const locked = stage === "locked";

  async function changeFormat(f: CreativeFormat) {
    setFormat(f);
    const r = await send(api(p.id), "PATCH", { format: f });
    if (r.ok) apply(r.data);
  }

  async function onSubmit({ text, images, video, format: fmt }: ComposerSubmit): Promise<boolean> {
    if (!detail) return false;
    setError(null);
    let d = detail;
    try {
      // A video is the final cut (text = its note).
      if (video) {
        if (!locked) {
          setError("Upload your final cut after the clips are rendered.");
          return false;
        }
        setWorking({ label: "Uploading your final cut…", accent: "emerald" });
        d = await uploadFinalCut(p.id, video, text);
        apply(d);
        setWorking(null);
        return true;
      }

      // A pasted image is the frame.
      if (images[0]) {
        const hadScript = d.clips.length > 0;
        if (hadScript && !confirm("Use this image as the new frame? You can rewrite the script for it afterwards.")) return false;
        setWorking({ label: "Setting Daniela's frame…", accent: "blue" });
        const fresh = await uploadFrameFile(p.id, images[0], (hadScript ? d.project.format : fmt) === "ad_9x16");
        d = fresh as ProjectDetail;
        apply(d);
        setWorking(null);
        if (hadScript) setFrameChanged(true);
        else if (!text) setAutoWrite(true); // with text, the direction branch below writes it
      }

      if (!text) return true;
      const st = stageOf(d);

      if (st === "direction" || st === "write") {
        const r = await send(api(p.id), "PATCH", { brief: { ...d.project.brief, direction: text }, format: fmt });
        if (!r.ok) throw new Error(r.error);
        apply(r.data);
        if (r.data.frames.length > 0) await writeScriptWith(r.data, text, fmt);
        return true;
      }
      if (st === "frame") {
        setWorking({ label: "Starting Manus…", accent: "blue" });
        const r = await send(api(`${p.id}/frame/generate`), "POST", { shot: text });
        setWorking(null);
        if (!r.ok) throw new Error(r.error);
        apply(r.data);
        return true;
      }
      if (st === "review") {
        setWorking({ label: "Claude is revising the script…", detail: `“${text}”`, accent: "violet" });
        const r = await send(api(`${p.id}/script/revise`), "POST", { note: text });
        setWorking(null);
        if (!r.ok) throw new Error(r.error);
        apply(r.data);
        return true;
      }
      // Locked: "clip 3: …" → redo that clip with the note.
      const m = text.match(/(?:clip|#)\s*(\d+)/i);
      const clip = m ? d.clips[Number(m[1]) - 1] : undefined;
      if (!clip) {
        setError("Say which clip to fix, e.g. “clip 3: she said the number twice”.");
        return false;
      }
      setWorking({ label: `Fixing clip ${clip.idx + 1} and sending it to Kling…`, accent: "cyan" });
      const r = await send(api(`${p.id}/render`), "POST", { redo: { clipId: clip.id, note: text } });
      setWorking(null);
      if (!r.ok) throw new Error(r.error);
      apply(r.data);
      return true;
    } catch (err) {
      setWorking(null);
      setError(err instanceof Error ? err.message : "Something went wrong");
      return false;
    }
  }

  async function writeScriptWith(d: ProjectDetail, direction: string, fmt: CreativeFormat) {
    if (writing.current) return;
    setWorking({
      label: "Claude is writing the script…",
      detail: "Following your Kling framework: structure, lines, delivery, actions and pronunciation cues.",
      accent: "violet",
    });
    writing.current = true;
    const r = await send(api(`${d.project.id}/script`), "POST", { direction, format: fmt });
    writing.current = false;
    setWorking(null);
    setAutoWrite(false);
    if (r.ok) apply(r.data);
    else setError(r.error);
  }

  async function remove() {
    if (!confirm(`Delete "${p.title}" and everything in it? This can't be undone.`)) return;
    const r = await send(api(p.id), "DELETE");
    if (r.ok) router.push("/dashboard/creative-studio");
    else setError(r.error);
  }

  const composer = COMPOSER[stage];
  const showFormat = stage === "direction" || stage === "frame" || stage === "write";

  return (
    <StudioCanvas>
      <div className="mx-auto flex min-h-[calc(100dvh-3rem)] max-w-3xl flex-col px-3 sm:px-6">
        {/* Header */}
        <header className="sticky top-0 z-20 -mx-3 flex items-center gap-3 border-b border-white/5 bg-[#020617]/80 px-3 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6">
          <Link href="/dashboard/creative-studio" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 text-neutral-400 hover:bg-white/5 hover:text-white" aria-label="Back to Creative Studio">
            <SvgIcon d={SP.chevronLeft} />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold text-white sm:text-lg" style={SYNE}>
              {p.title}
            </h1>
          </div>
          <Chip tone={status.tone}>{status.label}</Chip>
          <button type="button" onClick={remove} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-neutral-500 hover:bg-rose-500/10 hover:text-rose-300" aria-label="Delete video" title="Delete video">
            <SvgIcon d={SP.trash} size={16} />
          </button>
        </header>

        {/* Thread */}
        <div className="flex-1 space-y-5 py-6">
          {p.direction ? (
            <UserBubble meta={<Chip tone="blue">{p.format === "vsl_16x9" ? "VSL · 16:9" : "Ad · 9:16"}</Chip>}>{p.direction}</UserBubble>
          ) : null}

          <FrameCard key={detail.frames[0]?.id ?? "none"} detail={detail} onChange={apply} onError={fail} onFrameChosen={() => (detail.clips.length > 0 ? setFrameChanged(true) : setAutoWrite(true))} />

          {stage === "direction" && (
            <AssistantCard accent="violet" icon={SP.sparkles} title="What's the video?" delay={0.05}>
              <p className="text-sm text-neutral-300">
                Tell me in the box below what this video is about: the angle, who it&apos;s for, what she should get across, any lines she has to say. Then pick <b className="text-white">Ad</b> or <b className="text-white">VSL</b>. I&apos;ll write it clip by clip with your Kling framework.
              </p>
            </AssistantCard>
          )}

          {frameChanged && stage === "review" && (
            <AssistantCard accent="blue" icon={SP.image} title="New frame set">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-neutral-300">The script was written for the old frame. Rewrite it so the actions and descriptions match?</p>
                <button type="button" onClick={() => void writeScript()} className="rounded-full bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-500">
                  Rewrite for this frame
                </button>
              </div>
            </AssistantCard>
          )}

          {(stage === "review" || stage === "locked") && <ScriptCard detail={detail} locked={locked} onChange={apply} onError={fail} />}

          {locked && <ClipsCard detail={detail} klingNotice={klingNotice} onChange={apply} onError={fail} />}
          {locked && <FinalCutCard detail={detail} onChange={apply} onError={fail} />}

          {working && <ThinkingCard accent={working.accent} label={working.label} detail={working.detail} />}
          {error && <ErrorStrip onClose={() => setError(null)}>{error}</ErrorStrip>}
        </div>

        {/* Composer */}
        <div className="sticky bottom-0 z-20 -mx-3 bg-gradient-to-t from-[#020617] via-[#020617]/95 to-transparent px-3 pb-4 pt-6 sm:-mx-6 sm:px-6" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
          <Composer
            placeholder={composer.placeholder}
            hint={composer.hint}
            busy={Boolean(working)}
            allowFormat={showFormat}
            allowVideo={locked}
            format={format}
            onFormat={showFormat ? changeFormat : undefined}
            onSubmit={onSubmit}
          />
        </div>
      </div>
    </StudioCanvas>
  );
}
