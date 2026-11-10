"use client";

import { LaunchPadStyles } from "@/components/launch-pad/styles";
import { CANVAS_VARS } from "./tokens";

// Canvas-only CSS: chat/thinking effects, scrollbars, the entrance animation,
// and reduced-motion fallbacks for all of them.
const CANVAS_CSS = `
  @keyframes cs-dot { 0%, 80%, 100% { opacity: .25; transform: translateY(0) } 40% { opacity: 1; transform: translateY(-3px) } }
  .cs-scroll::-webkit-scrollbar { height: 6px; width: 6px } .cs-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,.12); border-radius: 9999px }
  @keyframes cs-shimmer { from { background-position: 200% 0 } to { background-position: -200% 0 } }
  .cs-shimmer-text { background: linear-gradient(90deg, #94a3b8 0%, #ffffff 35%, #67e8f9 50%, #ffffff 65%, #94a3b8 100%); background-size: 200% 100%; -webkit-background-clip: text; background-clip: text; color: transparent; animation: cs-shimmer 2.4s linear infinite }
  @keyframes cs-sweep { from { transform: translateX(-100%) } to { transform: translateX(100%) } }
  .cs-sweep { position: relative; overflow: hidden }
  .cs-sweep::after { content: ""; position: absolute; inset: 0; background: linear-gradient(100deg, transparent 20%, rgba(255,255,255,.08) 45%, rgba(103,232,249,.12) 50%, rgba(255,255,255,.08) 55%, transparent 80%); animation: cs-sweep 1.8s ease-in-out infinite }
  @keyframes cs-pulse-ring { 0% { box-shadow: 0 0 0 0 rgba(59,130,246,.45) } 70% { box-shadow: 0 0 0 10px rgba(59,130,246,0) } 100% { box-shadow: 0 0 0 0 rgba(59,130,246,0) } }
  .rm-enter { animation: lp-fade-up 0.5s ease-out backwards; }
  @media (prefers-reduced-motion: reduce) {
    .rm-enter { animation: none; }
    .cs-shimmer-text { animation: none; background: none; color: #e2e8f0; }
    .cs-sweep::after { animation: none; display: none; }
    html { scroll-behavior: auto; }
  }
`;

/** Keyframes + canvas CSS (also used by portaled sheets that render outside the canvas). */
export function RainmakerStyles() {
  return (
    <>
      <LaunchPadStyles />
      <style>{CANVAS_CSS}</style>
    </>
  );
}

/**
 * The dark Rainmaker canvas inside the dashboard: navy, glass and glow, the same
 * whatever the dashboard theme. It is a "dark island": the `dark` class makes
 * theme-following pieces inside it (legacy .dark rules, dark: variants) render dark.
 * Edge to edge on phones, framed from sm up. overflow-clip (not hidden) keeps
 * sticky children sticking to the viewport.
 */
export function RainmakerCanvas({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rm-canvas dark relative isolate -mx-4 min-h-[calc(100dvh-5.75rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] overflow-clip border-y border-white/5 bg-[#020617] text-white sm:mx-0 sm:min-h-[calc(100dvh-3rem)] sm:rounded-3xl sm:border md:min-h-[calc(100dvh-3rem)]"
      style={CANVAS_VARS}
    >
      <RainmakerStyles />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -right-32 h-[560px] w-[560px] rounded-full" style={{ background: "radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)" }} />
        <div className="absolute top-1/3 -left-40 h-[480px] w-[480px] rounded-full" style={{ background: "radial-gradient(circle, rgba(139,92,246,0.09) 0%, transparent 70%)" }} />
        <div className="absolute -bottom-32 -right-24 h-[480px] w-[480px] rounded-full" style={{ background: "radial-gradient(circle, rgba(6,182,212,0.09) 0%, transparent 70%)" }} />
      </div>
      {children}
    </div>
  );
}

const COLUMN = { data: "max-w-6xl", form: "max-w-5xl", thread: "max-w-3xl" } as const;

/** The page column inside the canvas. Data pages use the widest. */
export function PageColumn({ width = "data", className = "", children }: { width?: keyof typeof COLUMN; className?: string; children: React.ReactNode }) {
  return <div className={`mx-auto px-4 pb-24 sm:px-6 ${COLUMN[width]} ${className}`}>{children}</div>;
}

const GRADIENT = {
  brand: "from-blue-400 via-violet-400 to-cyan-300",
  success: "from-emerald-300 to-cyan-300",
} as const;

/** Gradient text for headline words. */
export function GradientText({ children, tone = "brand" }: { children: React.ReactNode; tone?: keyof typeof GRADIENT }) {
  return <span className={`bg-gradient-to-r ${GRADIENT[tone]} bg-clip-text text-transparent`}>{children}</span>;
}
