"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ACCENT, SHIMMER_CONIC, SYNE, type Accent } from "@/components/launch-pad";
import { LimeBadge, META_LIME, META_LIME_CONIC, META_LIME_FILL, MetaLogo } from "@/components/creative-studio/meta";
import { studioHref, type StudioTab } from "@/components/creative-studio/client";

/**
 * Creative Studio chat-thread primitives. The dark canvas, its variables and
 * GradientText now live in the shared Rainmaker kit (@/components/rainmaker);
 * they are re-exported here so existing imports keep working.
 */
export { CANVAS_VARS, GradientText } from "@/components/rainmaker";
export { RainmakerCanvas as StudioCanvas } from "@/components/rainmaker";
import { RainmakerCanvas } from "@/components/rainmaker";

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
  pen: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20M2 12h20" />
    </>
  ),
  terminal: (
    <>
      <path d="m4 17 6-6-6-6M12 19h8" />
    </>
  ),
  file: (
    <>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </>
  ),
  external: <path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />,
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
    // Hidden on phones (the card's title carries a small icon instead) to give the card its full width.
    <div className={`mt-0.5 hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl sm:flex ${a.chip}`} style={{ filter: a.chipGlow }}>
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
      <div className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-white/[0.04] p-3 backdrop-blur-sm sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex min-w-0 items-center gap-2 text-[15px] font-bold text-white" style={SYNE}>
            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg sm:hidden ${ACCENT[accent].chip}`} aria-hidden="true">
              <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className={ACCENT[accent].icon}>
                {icon}
              </svg>
            </span>
            <span className="min-w-0">{title}</span>
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
      <div className="max-w-[92%] min-w-0 space-y-2 break-words rounded-2xl rounded-br-md border border-blue-400/25 bg-gradient-to-br from-blue-600/25 to-cyan-500/15 px-4 py-3 sm:max-w-[88%]">
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
      <div className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex gap-1" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <span key={i} className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-blue-400 to-cyan-300" style={{ animation: `cs-dot 1.2s ${i * 0.15}s infinite ease-in-out` }} />
            ))}
          </span>
          <span className="min-w-0 text-sm font-semibold text-white">{label}</span>
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
        <button type="button" onClick={onClose} className="-m-2 flex h-10 w-10 shrink-0 items-center justify-center text-rose-300 hover:text-white" aria-label="Dismiss">
          <SvgIcon d={SP.x} size={16} />
        </button>
      )}
    </div>
  );
}

/**
 * Floating ↓ / ↑ button: jumps to the bottom of a long thread (the editor and
 * the chat box), or back to the top once you're there. Hidden when the page
 * is short.
 *
 * Fixed to the window and centred on the studio column (#studio-column).
 * position: sticky doesn't work in the dashboard (globals.css sets
 * overflow-x: hidden on html and body, which makes body a scroll container),
 * so the chat box (#studio-composer) only shows at the end of the page; when
 * it's on screen the button sits just above it.
 */
export function ScrollJump() {
  const [state, setState] = useState<{ dir: "down" | "up"; left: number; bottom: number; compact: boolean } | null>(null);

  useEffect(() => {
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const doc = document.documentElement;
        const vh = window.innerHeight;
        const fromBottom = doc.scrollHeight - (window.scrollY + vh);
        const dir = fromBottom > 400 ? "down" : window.scrollY > 400 ? "up" : null;
        if (!dir) return setState(null);
        const col = document.getElementById("studio-column")?.getBoundingClientRect();
        const comp = document.getElementById("studio-composer")?.getBoundingClientRect();
        const left = col ? col.left + col.width / 2 : window.innerWidth / 2;
        const bottom = comp && comp.top < vh ? Math.max(24, vh - comp.top + 12) : 24;
        setState({ dir, left: Math.round(left), bottom: Math.round(bottom), compact: window.innerWidth < 640 });
      });
    };
    measure();
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    // Cards load and grow (clips, previews): re-check when the page height changes.
    const ro = new ResizeObserver(measure);
    ro.observe(document.body);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      ro.disconnect();
    };
  }, []);

  if (!state) return null;
  const down = state.dir === "down";
  const go = () => window.scrollTo({ top: down ? document.documentElement.scrollHeight : 0, behavior: "smooth" });
  if (state.compact) {
    // Phones: a small round button at the bottom right, clear of the content and the home indicator.
    return (
      <button
        type="button"
        onClick={go}
        aria-label={down ? "Scroll to bottom" : "Back to top"}
        className="fixed right-3 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-600/40 ring-1 ring-blue-300/40"
        style={{ bottom: `calc(${state.bottom}px + env(safe-area-inset-bottom))` }}
      >
        <SvgIcon d={<path d={down ? "m6 9 6 6 6-6" : "m18 15-6-6-6 6"} />} size={20} />
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={go}
      className="fixed z-40 inline-flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-600/40 ring-1 ring-blue-300/40 transition hover:bg-blue-500"
      style={{ left: state.left, bottom: state.bottom }}
    >
      <SvgIcon d={<path d={down ? "m6 9 6 6 6-6" : "m18 15-6-6-6 6"} />} size={18} />
      {down ? "Scroll to bottom" : "Back to top"}
    </button>
  );
}

const STUDIO_TABS = [
  {
    id: "videos",
    label: "Videos",
    sub: "Script → Kling → edit",
  },
  {
    id: "photos",
    label: "Photo Ads",
    sub: "Prompt → Manus statics",
  },
  {
    id: "adcopy",
    label: "Meta Ad Copy",
    sub: "Drop creatives, get the copy",
  },
] as const;

/**
 * The studio's tabs — Videos, Photo Ads and Meta Ad Copy — as a glass segmented
 * control in a shimmer frame, so it reads as navigation at a glance. Meta Ad
 * Copy wears the lime "Campaigns built and run on Meta" chip look from
 * nexli.net; the frame's shimmer follows the active tab.
 */
export function StudioTabs({ active, studioKey }: { active: StudioTab; studioKey: string }) {
  const frame = active === "adcopy" ? META_LIME_CONIC : SHIMMER_CONIC;
  return (
    <nav aria-label="Creative Studio" className="relative inline-flex w-full max-w-2xl overflow-hidden rounded-[22px] p-[1.5px] sm:w-auto">
      <span aria-hidden="true" className="pointer-events-none absolute inset-[-100%] animate-[shimmer_8s_linear_infinite] opacity-70" style={{ background: frame }} />
      <span aria-hidden="true" className="pointer-events-none absolute inset-[-100%] animate-[shimmer_8s_linear_infinite] opacity-40 blur-md" style={{ background: frame }} />
      <div className="relative z-10 grid w-full grid-cols-3 gap-1 rounded-[21px] bg-[#0b1220]/95 p-1 backdrop-blur-xl">
        {STUDIO_TABS.map((t) => {
          const on = t.id === active;
          const meta = t.id === "adcopy";
          const tabClass = on
            ? meta
              ? "text-lime-300"
              : "bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-500/40"
            : "text-neutral-400 hover:bg-white/[0.06] hover:text-white";
          return (
            <Link
              key={t.id}
              href={studioHref(studioKey, t.id)}
              aria-current={on ? "page" : undefined}
              className={`group relative flex min-h-11 min-w-0 items-center gap-2 rounded-[18px] px-2.5 py-2 transition-all duration-200 sm:gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60 sm:px-4 sm:py-2.5 ${tabClass}`}
              style={
                on && meta
                  ? { background: META_LIME_FILL, boxShadow: "inset 0 0 0 1px rgba(190,242,100,0.55), 0 10px 28px -10px rgba(163,230,53,0.55)" }
                  : undefined
              }
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors sm:h-9 sm:w-9 sm:rounded-xl ${
                  on
                    ? meta
                      ? "bg-[#0a0f1c] ring-1 ring-lime-300/40"
                      : "bg-white/20 text-white"
                    : meta
                      ? "bg-white/5 group-hover:bg-lime-400/15"
                      : "bg-white/5 text-neutral-400 group-hover:bg-blue-500/20 group-hover:text-blue-200"
                }`}
              >
                {meta ? <MetaLogo className="h-auto w-[19px]" /> : <SvgIcon d={t.id === "photos" ? SP.image : SP.film} size={18} />}
              </span>
              <span className="min-w-0 flex-1 text-left">
                <span className="flex min-w-0 items-center gap-1.5 whitespace-nowrap text-sm font-bold leading-tight" style={SYNE}>
                  <span className="truncate sm:hidden">{meta ? "Ad Copy" : t.id === "photos" ? "Photos" : t.label}</span>
                  <span className="hidden sm:inline">{t.label}</span>
                  {meta && on && <LimeBadge size={14} />}
                  {meta && !on && (
                    <span className="hidden animate-pulse rounded-full px-1.5 py-px text-[8px] font-black uppercase tracking-wider text-[#0a0f1c] shadow shadow-lime-400/40 sm:inline" style={{ background: META_LIME }}>
                      New
                    </span>
                  )}
                </span>
                <span className={`hidden truncate text-[11px] leading-tight sm:block ${on ? (meta ? "text-lime-200/70" : "text-white/75") : "text-neutral-500 group-hover:text-neutral-300"}`}>
                  {t.sub}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/** The same dark Launch Pad canvas, for pages outside Creative Studio (e.g. the engagement letter composer). */
export const LaunchPadCanvas = RainmakerCanvas;
