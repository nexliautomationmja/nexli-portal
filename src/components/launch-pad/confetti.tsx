// ─── Confetti ──────────────────────────────────────────────
// Depends on the `lp-confetti-fall` keyframe from <LaunchPadStyles />.

import { useMemo } from "react";

export const CONFETTI_COLORS = ["#2563EB", "#06B6D4", "#8B5CF6", "#F59E0B", "#10B981"];

interface Particle {
  left: number;
  size: number;
  delay: number;
  duration: number;
  drift: number;
  spin: number;
  color: string;
  squash: boolean;
  round: boolean;
}

function makeParticles(): Particle[] {
  return Array.from({ length: 36 }, (_, i) => ({
    left: 10 + Math.random() * 80,
    size: 6 + Math.random() * 8,
    delay: Math.random() * 0.25,
    duration: 1.6 + Math.random() * 1.2,
    drift: -120 + Math.random() * 240,
    spin: 360 + Math.random() * 720,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    squash: Math.random() > 0.5,
    round: Math.random() > 0.6,
  }));
}

export function ConfettiBurst({ burst }: { burst: number }) {
  // One random layout per burst — stable across unrelated parent re-renders
  // so the pieces don't jump mid-fall.
  const particles = useMemo(() => (burst ? makeParticles() : []), [burst]);
  if (!burst) return null;
  return (
    <div
      key={burst}
      className="pointer-events-none fixed inset-0 z-50 overflow-hidden"
      aria-hidden="true"
    >
      {particles.map((p, i) => (
        <span
          key={i}
          style={
            {
              position: "absolute",
              top: "-20px",
              left: `${p.left}%`,
              width: `${p.size}px`,
              height: `${p.size * (p.squash ? 1 : 0.4)}px`,
              background: p.color,
              borderRadius: p.round ? "50%" : "2px",
              animation: `lp-confetti-fall ${p.duration}s cubic-bezier(0.25, 0.4, 0.45, 1) ${p.delay}s forwards`,
              "--lp-drift": `${p.drift}px`,
              "--lp-spin": `${p.spin}deg`,
              opacity: 0,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
