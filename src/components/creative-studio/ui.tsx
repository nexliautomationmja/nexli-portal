"use client";

export const INPUT =
  "w-full px-3.5 py-2.5 rounded-xl border border-[var(--glass-border)] bg-transparent text-sm outline-none focus:border-blue-500 transition-colors";

export const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  draft: { label: "Getting started", cls: "bg-[var(--input-bg)] text-[var(--text-muted)]" },
  scripted: { label: "Script to review", cls: "bg-amber-500/15 text-amber-500" },
  approved: { label: "Approved", cls: "bg-emerald-500/15 text-emerald-500" },
  rendering: { label: "Rendering on Kling", cls: "bg-blue-500/15 text-blue-400" },
  clips_ready: { label: "Done", cls: "bg-emerald-500/15 text-emerald-500" },
};

export function ErrorNote({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border px-4 py-3 text-sm border-rose-500/30 bg-rose-500/10 text-rose-500">{children}</div>;
}
