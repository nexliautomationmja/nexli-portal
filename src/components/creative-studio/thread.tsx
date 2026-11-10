"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ProjectDetail } from "@/lib/creative-studio/service";
import type { CreativeFormat } from "@/lib/creative-studio/tables";
import { MAX_SCENES, scriptPresenterMismatch } from "@/lib/creative-studio/prompts";
import { defaultPresenterName } from "@/components/creative-studio/presenter-picker";
import { SYNE } from "@/components/launch-pad";
import { studioHref, api, send } from "@/components/creative-studio/client";
import { uploadFrameFile } from "@/components/creative-studio/upload";
import {
  AssistantCard,
  Chip,
  ErrorStrip,
  SP,
  STATUS_PILL,
  ScrollJump,
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
import { CutCard } from "@/components/creative-studio/cut-card";
import { EditCard, measureDuration } from "@/components/creative-studio/edit-card";
import { AdCopyCard } from "@/components/creative-studio/ad-copy-card";

type Stage = "direction" | "frame" | "write" | "review" | "locked" | "cut" | "edit";

function stageOf(d: ProjectDetail): Stage {
  // With a final cut the chat box drives the edit — unless a newer auto-cut is
  // being worked on (a trim after approving), which keeps the cut notes going.
  const newestFinal = d.finalCuts[d.finalCuts.length - 1];
  const latestCut = d.cuts[d.cuts.length - 1];
  const recutting = Boolean(
    latestCut && newestFinal && !["approved", "failed"].includes(latestCut.status) && new Date(latestCut.createdAt) > new Date(newestFinal.uploadedAt)
  );
  if ((d.edits.length > 0 || newestFinal) && !recutting) return "edit";
  if (d.project.status === "clips_ready") return "cut";
  const locked = ["approved", "rendering"].includes(d.project.status);
  if (locked) return "locked";
  if (d.clips.length > 0) return "review";
  if (!d.project.direction.trim()) return "direction";
  if (d.frames.length === 0 || d.scenes.some((sc) => !sc.frameId)) return "frame";
  return "write";
}

/** Several scenes: the video is a story (the script is written across them). */
const isStoryDetail = (d: ProjectDetail) => d.scenes.filter((sc) => sc.frameId).length > 1;

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
  cut: {
    placeholder: "Tighter where she says “…” · looser after the hook · slow it to 1.1×",
    hint: "Enter → re-cut with your note · attach a video to upload your own cut",
  },
  edit: {
    placeholder: "Change the edit, e.g. “shorter title” · “zoom in on $15,000” · “caption should say CALENDAR”",
    hint: "Enter → Claude revises the edit · pick another style on the card · trim clips with ✂ on the auto-cut",
  },
};

const DESCRIBE_EDIT = {
  placeholder: "Tell me how to edit it, e.g. “captions, title ‘Stop doing returns’, zoom in when she says $15,000”",
  hint: "Enter → Remotion builds it your way · or pick one of the four styles above",
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
  const [cutSummary, setCutSummary] = useState<string | null>(null);
  // A suggestion dropped into the chat box (remounts the composer with that text).
  const [seed, setSeed] = useState<{ key: number; text: string } | null>(null);
  const [reading, setReading] = useState(false);
  const readFor = useRef<string | null>(null);
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
        detail: isStoryDetail(detail)
          ? `A story across your ${detail.scenes.length} scenes, following your Kling framework: who says what in which scene, the shots, delivery and pronunciation cues. About a minute or two.`
          : "Following your Kling framework: structure, lines, delivery, actions and pronunciation cues. An ad takes about a minute; a VSL up to three.",
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

  // Frames but no direction: Claude reads them and asks what the video is about (once per set of frames).
  useEffect(() => {
    if (!detail || stage !== "direction" || reading) return;
    const ids = detail.scenes.map((sc) => sc.frameId).filter(Boolean).join();
    if (!ids || detail.project.brief?.ask?.frames.join() === ids || readFor.current === ids) return;
    readFor.current = ids;
    setReading(true);
    void send(api(`${detail.project.id}/scenes/read`), "POST").then((r) => {
      setReading(false);
      if (r.ok) apply(r.data);
    });
  }, [detail, stage, reading, apply]);

  // Bring the active step into view when the stage moves on.
  useEffect(() => {
    if (!stage) return;
    if (lastStage.current && lastStage.current !== stage) {
      const id =
        stage === "review" ? "stage-review" : stage === "locked" ? "stage-clips" : stage === "cut" ? "stage-cut" : stage === "edit" ? "stage-edit" : "stage-frame";
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
  // Approved, rendering, rendered (auto-cut) or editing: the script is locked.
  const locked = stage === "locked" || stage === "cut" || stage === "edit";

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

      // Several images (or any image on a video that already has scenes) are scenes, in order.
      const sceneCount = d.scenes.filter((sc) => sc.frameId).length;
      if (images.length > 1 || (images.length > 0 && sceneCount > 1)) {
        const hadScript = d.clips.length > 0;
        if (sceneCount + images.length > MAX_SCENES) {
          setError(`A video can have up to ${MAX_SCENES} scenes. It has ${sceneCount}, so add up to ${Math.max(0, MAX_SCENES - sceneCount)} more.`);
          return false;
        }
        if (hadScript && !confirm(`Add ${images.length === 1 ? "this image as a new scene" : `these ${images.length} images as new scenes`}? The script can work ${images.length === 1 ? "it" : "them"} in afterwards.`)) return false;
        const vertical = (hadScript ? d.project.format : fmt) === "ad_9x16";
        for (let i = 0; i < images.length; i++) {
          setWorking({ label: images.length > 1 ? `Adding scene ${sceneCount + i + 1} of ${sceneCount + images.length}…` : `Adding scene ${sceneCount + 1}…`, accent: "blue" });
          d = (await uploadFrameFile(p.id, images[i], vertical, "new")) as ProjectDetail;
          apply(d);
        }
        setWorking(null);
        if (!hadScript && !text) setAutoWrite(true);
      } else if (images[0]) {
        // A pasted image is the frame.
        const hadScript = d.clips.length > 0;
        if (hadScript && !confirm("Use this image as the new frame? You can rewrite the script for it afterwards.")) return false;
        setWorking({ label: p.studio.kind === "client" ? "Setting the frame…" : "Setting Daniela's frame…", accent: "blue" });
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
      if (st === "edit" && d.edits.length === 0) {
        const cut = d.finalCuts[d.finalCuts.length - 1];
        setWorking({ label: "Claude is building your edit…", detail: `“${text}”`, accent: "cyan" });
        const durationS = cut?.url ? await measureDuration(cut.url) : null;
        const r = await send(api(`${p.id}/edit/start`), "POST", { style: "custom", instruction: text, finalCutId: cut?.id, durationS });
        setWorking(null);
        if (!r.ok) throw new Error(r.error);
        apply(r.data);
        return true;
      }
      if (st === "edit") {
        setWorking({ label: "Claude is changing the edit…", detail: `“${text}”`, accent: "cyan" });
        const r = await send(api(`${p.id}/edit/revise`), "POST", { note: text });
        setWorking(null);
        if (!r.ok) throw new Error(r.error);
        apply(r.data);
        return true;
      }
      if (st === "cut") {
        setWorking({ label: "Re-cutting with your note…", detail: `“${text}”`, accent: "emerald" });
        const r = await send(api(`${p.id}/cut/revise`), "POST", { note: text });
        setWorking(null);
        if (!r.ok) throw new Error(r.error);
        const extra = r.data as unknown as { summary?: string; rerender?: { clipId: string; number: number; note: string }[] };
        apply(r.data);
        setCutSummary(extra.summary ?? null);
        // Problems in the take itself go back to Kling; the cut re-runs when they land.
        for (const rr of extra.rerender ?? []) {
          setWorking({ label: `Re-rendering clip ${rr.number} on Kling…`, detail: rr.note, accent: "cyan" });
          const redo = await send(api(`${p.id}/render`), "POST", { redo: { clipId: rr.clipId, note: rr.note } });
          setWorking(null);
          if (!redo.ok) throw new Error(redo.error);
          apply(redo.data);
        }
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
    if (r.ok) router.push(studioHref(p.studio.key));
    else setError(r.error);
  }

  const base =
    stage === "edit" && detail.edits.length === 0
      ? DESCRIBE_EDIT
      : stage === "direction" && detail.frames.length > 0
        ? { placeholder: "Tell me the story: the angle, who it's for, where it should send people…", hint: "Enter saves it and writes the script" }
        : COMPOSER[stage];
  // A client firm's studio has no Daniela.
  const composer = p.studio.kind === "client" ? { ...base, placeholder: base.placeholder.replace("Daniela's frame", "the frame") } : base;
  const showFormat = stage === "direction" || stage === "frame" || stage === "write";

  return (
    <StudioCanvas>
      <div id="studio-column" className="mx-auto flex min-h-[calc(100dvh-3rem)] max-w-3xl flex-col px-3 sm:px-6">
        {/* Header */}
        {/* Sticks under the fixed phone top bar (md+: to the top of the window). */}
        <header className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 -mx-3 flex items-center gap-2 border-b border-white/5 bg-[#020617]/85 px-3 py-2.5 backdrop-blur-xl sm:-mx-6 sm:gap-3 sm:px-6 sm:py-3 md:top-0">
          <Link href={studioHref(p.studio.key)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 text-neutral-400 hover:bg-white/5 hover:text-white" aria-label={`Back to ${p.studio.name} studio`}>
            <SvgIcon d={SP.chevronLeft} />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold text-white sm:text-lg" style={SYNE}>
              {p.title}
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              {/* Phones: the status sits under the title so the title keeps its room. */}
              <span className="sm:hidden">
                <Chip tone={status.tone}>{status.label}</Chip>
              </span>
              <Link
                href={studioHref(p.studio.key)}
                className={`inline-flex min-h-6 items-center text-[11px] font-semibold hover:text-white ${p.studio.kind === "client" ? "text-violet-300" : "text-neutral-400"}`}
              >
                {p.studio.name} studio
              </Link>
              {p.batchId && (
                <Link href={`/dashboard/creative-studio/batch/${p.batchId}`} className="inline-flex min-h-6 items-center text-[11px] font-semibold text-cyan-300 hover:text-white">
                  ← Back to batch
                </Link>
              )}
            </div>
          </div>
          <span className="hidden sm:inline-flex">
            <Chip tone={status.tone}>{status.label}</Chip>
          </span>
          <button type="button" onClick={remove} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-neutral-500 hover:bg-rose-500/10 hover:text-rose-300" aria-label="Delete video" title="Delete video">
            <SvgIcon d={SP.trash} size={16} />
          </button>
        </header>

        {/* Thread */}
        <div className="flex-1 space-y-5 py-6">
          {p.direction ? (
            <UserBubble meta={<Chip tone="blue">{p.format === "vsl_16x9" ? "VSL · 16:9" : "Ad · 9:16"}</Chip>}>{p.direction}</UserBubble>
          ) : null}

          <FrameCard key={detail.frames[0]?.id ?? "none"} detail={detail} onChange={apply} onError={fail} onFrameChosen={() => (detail.clips.length > 0 ? setFrameChanged(true) : setAutoWrite(true))} />

          {stage === "direction" && (() => {
            const ask = detail.project.brief?.ask;
            const ids = detail.scenes.map((sc) => sc.frameId).filter(Boolean).join();
            const current = ask && ids && ask.frames.join() === ids ? ask : null;
            return (
              <AssistantCard accent="violet" icon={SP.sparkles} title="What's the video?" delay={0.05}>
                {current ? (
                  <div className="space-y-3">
                    <ul className="space-y-1.5">
                      {current.reads.map((r, i) => (
                        <li key={i} className="flex gap-2 text-sm text-neutral-300">
                          {current.reads.length > 1 && <span className="mt-0.5 flex h-5 min-w-5 shrink-0 items-center justify-center rounded-md bg-white/10 px-1 text-[10px] font-black text-white">{i + 1}</span>}
                          <span className="min-w-0">
                            {r.label && <b className="text-white">{r.label}. </b>}
                            {r.read}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <p className="text-[15px] font-semibold leading-snug text-white">{current.question}</p>
                    {current.suggestion && (
                      <button
                        type="button"
                        onClick={() => setSeed({ key: Date.now(), text: current.suggestion })}
                        className="w-full rounded-2xl border border-violet-400/30 bg-violet-500/[0.08] px-3.5 py-2.5 text-left text-sm text-violet-100 transition-colors hover:border-violet-300/60"
                      >
                        <span className="mb-0.5 block text-[10px] font-black uppercase tracking-[0.16em] text-violet-300">Or start from this</span>
                        {current.suggestion}
                      </button>
                    )}
                    <p className="text-xs text-neutral-400">Answer in the box below and pick <b className="text-white">Ad</b> or <b className="text-white">VSL</b>. I&apos;ll write it clip by clip with your Kling framework.</p>
                  </div>
                ) : (
                  <p className="text-sm text-neutral-300">
                    {reading ? (
                      <span className="text-neutral-400">Looking at your {detail.scenes.length > 1 ? "scenes" : "frame"}…</span>
                    ) : (
                      <>
                        Tell me in the box below what this video is about: the angle, who it&apos;s for, what {p.presenter?.pronoun === "he" ? "he" : "she"} should get across, any lines that have to be said. Then pick <b className="text-white">Ad</b> or <b className="text-white">VSL</b>. I&apos;ll write it clip by clip with your Kling framework.
                      </>
                    )}
                  </p>
                )}
              </AssistantCard>
            );
          })()}

          {stage === "write" && !working && isStoryDetail(detail) && (
            <AssistantCard accent="violet" icon={SP.script} title="Ready to write the story">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-neutral-300">
                  {detail.scenes.length} scenes in order. Claude writes it across them: who says what in each scene, to camera, in the scene, voiceover or no talking — whatever your direction calls for.
                </p>
                <button type="button" onClick={() => void writeScript()} className="rounded-full bg-violet-600 px-4 py-2 text-xs font-bold text-white hover:bg-violet-500">
                  Write the script
                </button>
              </div>
            </AssistantCard>
          )}

          {stage === "review" && !working && scriptPresenterMismatch(p.frameSpec, p.presenter) && (
            <AssistantCard accent="blue" icon={SP.script} title={`Rewrite it for ${p.presenter?.name || defaultPresenterName(p.studio)}?`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-neutral-300">
                  This script was written for {p.frameSpec?.presenterId ? "another presenter" : defaultPresenterName(p.studio)}. Rewrite it so every clip names, describes and voices{" "}
                  {p.presenter?.name || defaultPresenterName(p.studio)}?
                </p>
                <button type="button" onClick={() => void writeScript()} className="rounded-full bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-500">
                  Rewrite for {p.presenter?.name || defaultPresenterName(p.studio)}
                </button>
              </div>
            </AssistantCard>
          )}

          {stage === "review" && !working && !scriptPresenterMismatch(p.frameSpec, p.presenter) && (() => {
            const specs = p.frameSpec?.scenes ?? [];
            const withFrames = detail.scenes.filter((sc) => sc.frameId);
            // A one-frame script on a video that now has several scenes.
            if (!detail.story && withFrames.length > 1) {
              return (
                <AssistantCard accent="blue" icon={SP.image} title="Now it's a story">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-neutral-300">This script was written for one frame. Rewrite it across your {withFrames.length} scenes?</p>
                    <button type="button" onClick={() => void writeScript()} className="rounded-full bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-500">
                      Rewrite as a story
                    </button>
                  </div>
                </AssistantCard>
              );
            }
            if (!detail.story) return null;
            const stale = withFrames.filter((sc) => specs.some((x) => x.frameId === sc.frameId && x.stale));
            const unused = withFrames.filter((sc) => !detail.clips.some((c) => c.frameId === sc.frameId));
            if (stale.length === 0 && unused.length === 0) return null;
            const names = (list: typeof withFrames) => list.map((sc) => `scene ${sc.number}`).join(", ").replace(/, ([^,]*)$/, " and $1");
            const note = [
              stale.length
                ? `${stale.map((sc) => `Scene ${sc.number}`).join(", ")} ${stale.length > 1 ? "have" : "has"} a new frame (attached as ${stale.length > 1 ? "those scenes" : "that scene"}). Re-describe ${stale.length > 1 ? "them" : "it"} from the new frame and adjust the actions of ${stale.length > 1 ? "their" : "its"} clips so the new pose supports them. Keep every line exactly as it is.`
                : "",
              unused.length ? `Work ${unused.map((sc) => `Scene ${sc.number}`).join(" and ")} into the story where ${unused.length > 1 ? "they fit" : "it fits"} best.` : "",
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <AssistantCard accent="amber" icon={SP.image} title={stale.length ? "The script needs to catch up" : "A scene isn't in the script yet"}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-neutral-300">
                    {stale.length ? `${names(stale).replace(/^s/, "S")} ${stale.length > 1 ? "have" : "has"} a new frame. ` : ""}
                    {unused.length ? `${names(unused).replace(/^s/, "S")} ${unused.length > 1 ? "aren't" : "isn't"} in the script yet. ` : ""}
                    Update the script for {stale.length + unused.length > 1 ? "them" : "it"}{stale.length ? ", keeping every line" : ""}? Or say how in the box below.
                  </p>
                  <button
                    type="button"
                    onClick={async () => {
                      setError(null);
                      setWorking({ label: "Claude is updating the script…", detail: note, accent: "violet" });
                      const r = await send(api(`${p.id}/script/revise`), "POST", { note });
                      setWorking(null);
                      if (r.ok) apply(r.data);
                      else setError(r.error);
                    }}
                    className="rounded-full bg-amber-500 px-4 py-2 text-xs font-bold text-black hover:bg-amber-400"
                  >
                    Update the script
                  </button>
                </div>
              </AssistantCard>
            );
          })()}

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
          {locked && (stage === "cut" || detail.cuts.length > 0) && <CutCard detail={detail} summary={cutSummary} onChange={apply} onError={fail} />}
          {locked && <FinalCutCard detail={detail} onChange={apply} onError={fail} />}
          {locked && detail.finalCuts.length > 0 && <EditCard detail={detail} onChange={apply} onError={fail} />}
          {locked && detail.finalCuts.length > 0 && p.format === "ad_9x16" && <AdCopyCard detail={detail} onChange={apply} onError={fail} />}

          {working && <ThinkingCard accent={working.accent} label={working.label} detail={working.detail} />}
          {error && <ErrorStrip onClose={() => setError(null)}>{error}</ErrorStrip>}
        </div>

        {/* Composer */}
        <ScrollJump />
        <div
          id="studio-composer"
          className="sticky bottom-0 z-20 -mx-3 bg-gradient-to-t from-[#020617] via-[#020617]/95 to-transparent px-3 pb-4 pt-3 sm:-mx-6 sm:px-6 sm:pt-6"
          style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
        >
          <Composer
            key={seed?.key ?? 0}
            defaultText={seed?.text}
            autoFocus={Boolean(seed)}
            placeholder={composer.placeholder}
            hint={composer.hint}
            busy={Boolean(working)}
            allowFormat={showFormat}
            allowVideo={locked}
            format={format}
            onFormat={showFormat ? changeFormat : undefined}
            maxImages={locked ? 1 : MAX_SCENES}
            onSubmit={onSubmit}
          />
        </div>
      </div>
    </StudioCanvas>
  );
}
