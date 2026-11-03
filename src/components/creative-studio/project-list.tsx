"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CreativeBrief, CreativeFormat, CreativeRig } from "@/lib/creative-studio/tables";
import { EMPTY_BRIEF, FORMAT_LABEL, RIG_LABEL } from "@/lib/creative-studio/prompts";
import { BriefFields, FormatRigFields, INPUT, LABEL } from "@/components/creative-studio/brief-fields";

interface ProjectRow {
  id: string;
  title: string;
  format: CreativeFormat;
  rig: CreativeRig;
  status: string;
  clips: number;
  thumbUrl: string | null;
  updatedAt: string;
}

export const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "bg-[var(--input-bg)] text-[var(--text-muted)]" },
  scripted: { label: "Script in review", cls: "bg-amber-500/15 text-amber-500" },
  approved: { label: "Approved", cls: "bg-emerald-500/15 text-emerald-500" },
  rendering: { label: "Rendering on Kling", cls: "bg-blue-500/15 text-blue-400" },
  clips_ready: { label: "Clips ready", cls: "bg-emerald-500/15 text-emerald-500" },
};

export function StudioProjectList() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [format, setFormat] = useState<CreativeFormat>("ad_9x16");
  const [rig, setRig] = useState<CreativeRig>("solo_locked");
  const [brief, setBrief] = useState<CreativeBrief>(EMPTY_BRIEF);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard/creative-studio/projects")
      .then((r) => r.json().then((b) => ({ ok: r.ok, b })))
      .then(({ ok, b }) => {
        if (cancelled) return;
        if (!ok) setError(b?.error || "Couldn't load projects");
        else setProjects(b.projects);
      })
      .catch(() => !cancelled && setError("Couldn't load projects"));
    return () => {
      cancelled = true;
    };
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await fetch("/api/dashboard/creative-studio/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, format, rig, brief }),
    });
    const b = await r.json().catch(() => null);
    setBusy(false);
    if (!r.ok || !b?.id) {
      setError(b?.error || "Couldn't create the project");
      return;
    }
    router.push(`/dashboard/creative-studio/${b.id}`);
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-main)" }}>
            Creative Studio
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
            Frame → script → Kling clips → edit. Daniela ads (9:16) and VSLs (16:9), built on your framework.
          </p>
        </div>
        {!creating && (
          <button type="button" onClick={() => setCreating(true)} className="btn-primary px-5 py-2.5 text-sm">
            New project
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-xl border px-4 py-3 text-sm border-rose-500/30 bg-rose-500/10 text-rose-500">{error}</div>
      )}

      {creating && (
        <form onSubmit={create} className="glass-card p-5 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-main)" }}>New project</h2>
            <button type="button" onClick={() => setCreating(false)} className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
              Cancel
            </button>
          </div>
          <label className="block">
            <span className={LABEL} style={{ color: "var(--text-muted)" }}>Title</span>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Volume trap · solo locked-off"
              className={INPUT}
              style={{ color: "var(--text-main)" }}
            />
          </label>
          <FormatRigFields format={format} rig={rig} onChange={(n) => (setFormat(n.format), setRig(n.rig))} />
          <BriefFields brief={brief} onChange={setBrief} />
          <div className="flex justify-end">
            <button type="submit" disabled={busy} className="btn-primary px-6 py-2.5 text-sm">
              {busy ? "Creating…" : "Create and add the frame"}
            </button>
          </div>
        </form>
      )}

      {projects === null && !error ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 animate-pulse">
          {[0, 1, 2].map((i) => (
            <div key={i} className="glass-card h-56" />
          ))}
        </div>
      ) : projects && projects.length === 0 && !creating ? (
        <div className="glass-card p-10 text-center">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            No projects yet. Start one with a title, the angle and the opening frame.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(projects ?? []).map((p) => {
            const status = STATUS_LABEL[p.status] ?? STATUS_LABEL.draft;
            return (
              <Link
                key={p.id}
                href={`/dashboard/creative-studio/${p.id}`}
                className="glass-card overflow-hidden !p-0 flex flex-col transition-transform hover:-translate-y-0.5"
              >
                <div className="relative h-40 bg-black">
                  {p.thumbUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
                    <img src={p.thumbUrl} alt="" className="h-full w-full object-contain" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[10px] font-bold uppercase tracking-[0.16em] text-white/30">
                      No frame yet
                    </div>
                  )}
                  <span className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${status.cls}`}>{status.label}</span>
                </div>
                <div className="p-4 space-y-1">
                  <p className="text-sm font-bold truncate" style={{ color: "var(--text-main)" }}>{p.title}</p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {FORMAT_LABEL[p.format]} · {RIG_LABEL[p.rig]} · {p.clips} clip{p.clips === 1 ? "" : "s"}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
