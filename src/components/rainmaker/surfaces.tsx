"use client";

import { SYNE, labelCls } from "./tokens";

/** The glass card: the default surface for anything grouped. `elevated` = solid #0b1220 (tables, sheets). */
export function Surface({
  className = "",
  elevated = false,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { elevated?: boolean }) {
  return (
    <div {...rest} className={`rounded-2xl border border-white/10 ${elevated ? "bg-[#0b1220]" : "bg-white/[0.04]"} ${className}`}>
      {children}
    </div>
  );
}

/** A recessed well inside a card (code, outputs, quotes). */
export function Inset({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <div className={`rounded-xl border border-white/5 bg-black/30 ${className}`}>{children}</div>;
}

const FEATURE = {
  cyan: "border-cyan-400/25 from-blue-600/[0.16] to-cyan-500/[0.08]",
  blue: "border-blue-400/25 from-blue-600/[0.18] to-violet-500/[0.06]",
  emerald: "border-emerald-400/25 from-emerald-500/[0.14] to-cyan-500/[0.06]",
  violet: "border-violet-400/25 from-violet-600/[0.16] to-fuchsia-500/[0.06]",
  amber: "border-amber-400/25 from-amber-500/[0.12] to-orange-500/[0.05]",
} as const;
export type FeatureTone = keyof typeof FEATURE;

/** The tinted hero card (the Ads Command Center's headline-metric look), for the one thing that matters most in a section. */
export function FeatureCard({
  tone = "cyan",
  eyebrow,
  title,
  right,
  className = "",
  children,
}: {
  tone?: FeatureTone;
  eyebrow?: React.ReactNode;
  title?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br via-[#0b1220] p-4 sm:p-5 ${FEATURE[tone]} ${className}`}>
      {(eyebrow || title || right) && (
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {eyebrow && <div className={labelCls}>{eyebrow}</div>}
            {title && (
              <h3 className="text-[15px] font-bold leading-snug text-white" style={SYNE}>
                {title}
              </h3>
            )}
          </div>
          {right}
        </div>
      )}
      {children}
    </div>
  );
}
