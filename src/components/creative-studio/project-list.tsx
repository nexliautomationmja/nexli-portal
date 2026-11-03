"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CreativeFormat } from "@/lib/creative-studio/tables";
import { ErrorNote, STATUS_LABEL } from "@/components/creative-studio/ui";

interface ProjectRow {
  id: string;
  title: string;
  format: CreativeFormat;
  status: string;
  direction: string;
  clips: number;
  thumbUrl: string | null;
  updatedAt: string;
}

export function StudioProjectList() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard/creative-studio/projects")
      .then((r) => r.json().then((b) => ({ ok: r.ok, b })))
      .then(({ ok, b }) => {
        if (cancelled) return;
        if (!ok) setError(b?.error || "Couldn't load your videos");
        else setProjects(b.projects);
      })
      .catch(() => !cancelled && setError("Couldn't load your videos"));
    return () => {
      cancelled = true;
    };
  }, []);

  async function newVideo() {
    setCreating(true);
    const r = await fetch("/api/dashboard/creative-studio/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const b = await r.json().catch(() => null);
    if (!r.ok || !b?.id) {
      setCreating(false);
      setError(b?.error || "Couldn't start a new video");
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
            Make Daniela&apos;s frame, say what the video is, approve the script, and Kling renders it.
          </p>
        </div>
        <button type="button" onClick={newVideo} disabled={creating} className="btn-primary px-5 py-2.5 text-sm">
          {creating ? "Starting…" : "New video"}
        </button>
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}

      {projects === null && !error ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 animate-pulse">
          {[0, 1, 2].map((i) => (
            <div key={i} className="glass-card h-56" />
          ))}
        </div>
      ) : projects && projects.length === 0 ? (
        <div className="glass-card p-10 text-center">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            No videos yet. Press New video to start with Daniela&apos;s frame.
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
                <div className="relative h-44 bg-black">
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
                  <p className="text-xs line-clamp-2" style={{ color: "var(--text-muted)" }}>
                    {p.direction || "No direction yet"}
                  </p>
                  <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                    {p.format === "vsl_16x9" ? "VSL" : "Ad"} · {p.clips} clip{p.clips === 1 ? "" : "s"}
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
