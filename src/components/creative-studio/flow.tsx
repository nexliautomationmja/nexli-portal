"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ProjectDetail } from "@/lib/creative-studio/service";
import { api, send } from "@/components/creative-studio/client";
import { ErrorNote, STATUS_LABEL } from "@/components/creative-studio/ui";
import { FrameStep } from "@/components/creative-studio/frame-step";
import { DirectionStep } from "@/components/creative-studio/direction-step";
import { ReviewStep } from "@/components/creative-studio/review-step";
import { ClipsStep } from "@/components/creative-studio/clips-step";
import { FinalCutStep } from "@/components/creative-studio/final-cut-step";

type StepId = "frame" | "direction" | "review" | "clips" | "final";

/**
 * The Creative Studio as one guided page: frame → what the video is →
 * review the script → Kling clips → upload the final cut. Each step opens
 * when the one before is done; finished steps fold into a one-line summary.
 */
export function StudioFlow({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [opened, setOpened] = useState<Partial<Record<StepId, boolean>>>({});
  const [klingNotice] = useState(() =>
    typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("kling")
  );

  const apply = useCallback((d: ProjectDetail) => {
    setDetail(d);
    setError(null);
  }, []);

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

  if (!detail) {
    return <div className="max-w-6xl mx-auto">{error ? <ErrorNote>{error}</ErrorNote> : <div className="glass-card h-64 animate-pulse" />}</div>;
  }

  const p = detail.project;
  const hasFrame = detail.frames.length > 0;
  const hasScript = detail.clips.length > 0;
  const locked = ["approved", "rendering", "clips_ready"].includes(p.status);
  const status = STATUS_LABEL[p.status] ?? STATUS_LABEL.draft;
  const doneClips = detail.clips.filter((c) => c.status === "done").length;

  // Which step is "current" (open by default).
  const current: StepId = !hasFrame ? "frame" : !hasScript ? "direction" : !locked ? "review" : "clips";
  const isOpen = (id: StepId) => opened[id] ?? (id === current || (id === "final" && locked));
  const toggle = (id: StepId) => setOpened((o) => ({ ...o, [id]: !isOpen(id) }));

  async function remove() {
    if (!confirm(`Delete "${p.title}" and everything in it? This can't be undone.`)) return;
    const r = await send(api(p.id), "DELETE");
    if (r.ok) router.push("/dashboard/creative-studio");
    else setError(r.error);
  }

  const frame = detail.frames[0];

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href="/dashboard/creative-studio" className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
            ← Creative Studio
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight truncate" style={{ color: "var(--text-main)" }}>{p.title}</h1>
          <span className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${status.cls}`}>{status.label}</span>
        </div>
        <button type="button" onClick={remove} className="text-xs font-semibold text-rose-500 hover:underline">
          Delete video
        </button>
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}

      <Step
        n={1}
        title="Daniela's frame"
        done={hasFrame}
        enabled
        open={isOpen("frame")}
        onToggle={() => toggle("frame")}
        summary={
          frame?.url ? (
            <span className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URL */}
              <img src={frame.url} alt="" className="h-8 w-auto rounded" />
              Opening frame set
            </span>
          ) : null
        }
      >
        <FrameStep detail={detail} onChange={apply} onError={setError} />
      </Step>

      <Step
        n={2}
        title="What's the video?"
        done={hasScript}
        enabled={hasFrame}
        open={isOpen("direction") && hasFrame}
        onToggle={() => toggle("direction")}
        summary={p.direction ? <span className="truncate">{p.format === "vsl_16x9" ? "VSL" : "Ad"} · {p.direction}</span> : null}
      >
        <DirectionStep detail={detail} onChange={apply} onError={setError} />
      </Step>

      <Step
        n={3}
        title="Review the script"
        done={locked}
        enabled={hasScript}
        open={isOpen("review") && hasScript}
        onToggle={() => toggle("review")}
        summary={hasScript ? <span>{detail.clips.length} clips · v{p.scriptVersion}{locked ? " · approved" : ""}</span> : null}
      >
        <ReviewStep detail={detail} locked={locked} onChange={apply} onError={setError} />
      </Step>

      <Step
        n={4}
        title="Kling clips"
        done={p.status === "clips_ready"}
        enabled={locked}
        open={isOpen("clips") && locked}
        onToggle={() => toggle("clips")}
        summary={locked ? <span>{doneClips} of {detail.clips.length} done</span> : null}
      >
        <ClipsStep detail={detail} klingNotice={klingNotice} onChange={apply} onError={setError} />
      </Step>

      <Step
        n={5}
        title="Upload your final cut"
        done={detail.finalCuts.length > 0}
        enabled={locked}
        open={isOpen("final") && locked}
        onToggle={() => toggle("final")}
        summary={detail.finalCuts.length > 0 ? <span>{detail.finalCuts.length} cut{detail.finalCuts.length === 1 ? "" : "s"} uploaded</span> : null}
      >
        <FinalCutStep detail={detail} onChange={apply} onError={setError} />
      </Step>
    </div>
  );
}

function Step({
  n,
  title,
  done,
  enabled,
  open,
  onToggle,
  summary,
  children,
}: {
  n: number;
  title: string;
  done: boolean;
  enabled: boolean;
  open: boolean;
  onToggle: () => void;
  summary: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className={`glass-card p-0 overflow-hidden ${enabled ? "" : "opacity-50"}`}>
      <button type="button" onClick={onToggle} disabled={!enabled} className="flex w-full items-center gap-3 px-5 py-4 text-left">
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
            done ? "bg-emerald-500 text-white" : "bg-blue-500/15 text-blue-400"
          }`}
        >
          {done ? "✓" : n}
        </span>
        <span className="text-sm font-bold" style={{ color: "var(--text-main)" }}>{title}</span>
        {!open && summary && (
          <span className="min-w-0 flex-1 truncate text-xs" style={{ color: "var(--text-muted)" }}>
            {summary}
          </span>
        )}
        {enabled && <span className="ml-auto text-xs" style={{ color: "var(--text-muted)" }}>{open ? "▾" : "▸"}</span>}
      </button>
      {open && enabled && <div className="border-t px-5 py-5" style={{ borderColor: "var(--card-border)" }}>{children}</div>}
    </section>
  );
}
