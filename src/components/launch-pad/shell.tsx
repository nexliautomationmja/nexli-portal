// ─── Launch Pad page shell ─────────────────────────────────
// #020617 canvas, ambient brand glows, confetti layer, and the header
// (Nexli logo + shimmer badge). Children render inside the centered column.

import { NexliLogo } from "@/components/ui/nexli-logo";
import { LaunchPadStyles } from "./styles";
import { ConfettiBurst } from "./confetti";
import { ShimmerPill } from "./primitives";

export function LaunchPadShell({
  badge,
  badgeIcon,
  maxWidth = "3xl",
  burst,
  children,
}: {
  badge: string;
  badgeIcon?: React.ReactNode;
  maxWidth?: "3xl" | "xl";
  burst?: number;
  children: React.ReactNode;
}) {
  const widthCls = maxWidth === "xl" ? "max-w-xl" : "max-w-3xl";
  return (
    <div className="min-h-screen relative overflow-x-hidden bg-[#020617] text-white">
      <LaunchPadStyles />

      {/* Ambient brand glows. Clipped by their own fixed, viewport-sized
          layer: the wrapper's overflow-x-hidden does not clip fixed
          descendants, and on iOS Safari off-screen fixed boxes can let the
          page pan sideways. */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute -top-40 -right-32 w-[560px] h-[560px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(59, 130, 246, 0.10) 0%, transparent 70%)" }}
        />
        <div
          className="absolute top-1/3 -left-40 w-[480px] h-[480px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(139, 92, 246, 0.08) 0%, transparent 70%)" }}
        />
        <div
          className="absolute -bottom-32 -right-24 w-[480px] h-[480px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(6, 182, 212, 0.08) 0%, transparent 70%)" }}
        />
      </div>

      <ConfettiBurst burst={burst ?? 0} />

      <div className={`relative ${widthCls} mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-10 break-words`}>
        {/* ─── Header ─── */}
        <header className="flex items-center justify-between gap-3 lp-card">
          <NexliLogo size="md" />
          <ShimmerPill>
            {badgeIcon}
            <span className="text-white text-[10px] md:text-xs font-black tracking-[0.12em] sm:tracking-[0.2em] uppercase min-[360px]:whitespace-nowrap">
              {badge}
            </span>
          </ShimmerPill>
        </header>

        {children}
      </div>
    </div>
  );
}
