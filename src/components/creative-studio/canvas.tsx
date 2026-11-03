"use client";

import { useEffect, useState } from "react";
import { ACCENT, LaunchPadStyles, SYNE, type Accent } from "@/components/launch-pad";

/**
 * Creative Studio visual foundation: a Launch Pad canvas (the dark navy,
 * glass and glow look of the client onboarding and invoice pages) that lives
 * inside the dashboard, plus chat-thread primitives.
 *
 * The canvas is always dark, whatever the dashboard theme. globals.css colors
 * h1–h6 and p through --text-main / --text-muted in an unlayered rule that
 * beats Tailwind colour classes, so the canvas sets those variables to the
 * dark values on itself — otherwise light mode would paint dark text on navy.
 */
const CANVAS_VARS = {
  "--text-main": "#f8fafc",
  "--text-muted": "#94a3b8",
  "--card-border": "rgba(255,255,255,0.1)",
  "--glass-border": "rgba(255,255,255,0.1)",
  "--input-bg": "rgba(255,255,255,0.05)",
  colorScheme: "dark",
} as React.CSSProperties;

export function StudioCanvas({ children }: { children: React.ReactNode }) {
  return (
    // overflow-clip (not hidden) so the sticky composer still sticks to the viewport.
    <div className="relative isolate overflow-clip rounded-3xl bg-[#020617] text-white min-h-[calc(100dvh-3rem)] border border-white/5" style={CANVAS_VARS}>
      <LaunchPadStyles />
      <style>{`
        @keyframes cs-dot { 0%, 80%, 100% { opacity: .25; transform: translateY(0) } 40% { opacity: 1; transform: translateY(-3px) } }
        .cs-scroll::-webkit-scrollbar { height: 6px } .cs-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,.12); border-radius: 9999px }
      `}</style>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -right-32 h-[560px] w-[560px] rounded-full" style={{ background: "radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)" }} />
        <div className="absolute top-1/3 -left-40 h-[480px] w-[480px] rounded-full" style={{ background: "radial-gradient(circle, rgba(139,92,246,0.09) 0%, transparent 70%)" }} />
        <div className="absolute -bottom-32 -right-24 h-[480px] w-[480px] rounded-full" style={{ background: "radial-gradient(circle, rgba(6,182,212,0.09) 0%, transparent 70%)" }} />
      </div>
      {children}
    </div>
  );
}

/** Gradient text used for headline words (blue → violet → cyan). */
export function GradientText({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-gradient-to-r from-blue-400 via-violet-400 to-cyan-300 bg-clip-text text-transparent">{children}</span>
  );
}

// Lucide-style stroke icons used only by the studio.
export const SP = {
  image: (
    <>
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </>
  ),
  paperclip: <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />,
  arrowUp: (
    <>
      <path d="m5 12 7-7 7 7" />
      <path d="M12 19V5" />
    </>
  ),
  film: (
    <>
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M7 3v18M3 7.5h4M3 12h18M3 16.5h4M17 3v18M17 7.5h4M17 16.5h4" />
    </>
  ),
  wand: (
    <>
      <path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72" />
      <path d="m14 7 3 3M5 6v4M19 14v4M10 2v2M7 8H3M21 16h-4M11 3H9" />
    </>
  ),
  undo: (
    <>
      <path d="M3 7v6h6" />
      <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
    </>
  ),
  download: (
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="m7 10 5 5 5-5M12 15V3" />
    </>
  ),
  upload: (
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="m17 8-5-5-5 5M12 3v12" />
    </>
  ),
  script: (
    <>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4M10 9H8M16 13H8M16 17H8" />
    </>
  ),
  sparkles: (
    <>
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
      <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />
    </>
  ),
  x: <path d="M18 6 6 18M6 6l12 12" />,
  chevronLeft: <path d="m15 18-6-6 6-6" />,
  copy: (
    <>
      <rect width="14" height="14" x="8" y="8" rx="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </>
  ),
  trash: <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />,
};

/** Small square avatar chip for assistant cards (the 48px IconChip shrunk). */
function AvatarChip({ accent, icon }: { accent: Accent; icon: React.ReactNode }) {
  const a = ACCENT[accent];
  return (
    <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${a.chip}`} style={{ filter: a.chipGlow }}>
      <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={a.icon}>
        {icon}
      </svg>
    </div>
  );
}

export function SvgIcon({ d, size = 18, className }: { d: React.ReactNode; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {d}
    </svg>
  );
}

/** The studio's side of the conversation: avatar chip + glass card. */
export function AssistantCard({
  id,
  accent,
  icon,
  title,
  right,
  delay = 0,
  children,
}: {
  id?: string;
  accent: Accent;
  icon: React.ReactNode;
  title: string;
  right?: React.ReactNode;
  delay?: number;
  children: React.ReactNode;
}) {
  return (
    <div id={id} className="lp-card flex gap-3 scroll-mt-24" style={{ animationDelay: `${delay}s` }}>
      <AvatarChip accent={accent} icon={icon} />
      <div className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-5 backdrop-blur-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[15px] font-bold text-white" style={SYNE}>
            {title}
          </h2>
          {right}
        </div>
        {children}
      </div>
    </div>
  );
}

/** Your side of the conversation. */
export function UserBubble({
  children,
  images,
  meta,
}: {
  children?: React.ReactNode;
  images?: (string | null)[];
  meta?: React.ReactNode;
}) {
  return (
    <div className="lp-card flex justify-end">
      <div className="max-w-[88%] space-y-2 rounded-2xl rounded-br-md border border-blue-400/25 bg-gradient-to-br from-blue-600/25 to-cyan-500/15 px-4 py-3">
        {images && images.filter(Boolean).length > 0 && (
          <div className="flex flex-wrap justify-end gap-2">
            {images.filter(Boolean).map((src) => (
              // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
              <img key={src!} src={src!} alt="" className="h-28 w-auto rounded-lg border border-white/10 object-cover" />
            ))}
          </div>
        )}
        {children && <div className="whitespace-pre-line text-sm leading-relaxed text-white">{children}</div>}
        {meta && <div className="flex flex-wrap justify-end gap-1.5">{meta}</div>}
      </div>
    </div>
  );
}

/** "Claude is writing the script… 34s" with animated dots. */
export function ThinkingCard({ accent = "violet", label, detail }: { accent?: Accent; label: string; detail?: string }) {
  const [started] = useState(() => Date.now());
  const [now, setNow] = useState(started);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="lp-card flex gap-3">
      <AvatarChip accent={accent} icon={SP.sparkles} />
      <div className="flex-1 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3.5">
        <div className="flex items-center gap-3">
          <span className="flex gap-1" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <span key={i} className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-blue-400 to-cyan-300" style={{ animation: `cs-dot 1.2s ${i * 0.15}s infinite ease-in-out` }} />
            ))}
          </span>
          <span className="text-sm font-semibold text-white">{label}</span>
          <span className="ml-auto text-xs tabular-nums text-neutral-500">{Math.round((now - started) / 1000)}s</span>
        </div>
        {detail && <p className="mt-1.5 text-xs text-neutral-400">{detail}</p>}
      </div>
    </div>
  );
}

export function Chip({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "blue" | "red" | "amber" | "green" }) {
  const cls = {
    neutral: "bg-white/5 text-neutral-300 border-white/10",
    blue: "bg-blue-500/15 text-blue-300 border-blue-500/30",
    red: "bg-rose-500/15 text-rose-300 border-rose-500/30",
    amber: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    green: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  }[tone];
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{children}</span>;
}

export const STATUS_PILL: Record<string, { label: string; tone: "neutral" | "blue" | "amber" | "green" }> = {
  draft: { label: "Getting started", tone: "neutral" },
  scripted: { label: "Script to review", tone: "amber" },
  approved: { label: "Approved", tone: "green" },
  rendering: { label: "Rendering on Kling", tone: "blue" },
  clips_ready: { label: "Done", tone: "green" },
};

export function ErrorStrip({ children, onClose }: { children: React.ReactNode; onClose?: () => void }) {
  return (
    <div className="lp-card flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
      <span className="flex-1">{children}</span>
      {onClose && (
        <button type="button" onClick={onClose} className="text-rose-300 hover:text-white" aria-label="Dismiss">
          <SvgIcon d={SP.x} size={16} />
        </button>
      )}
    </div>
  );
}
