"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ShimmerPill } from "@/components/launch-pad";
import { NUM_FONT, SHIMMER_CONIC, SHIMMER_CONIC_WARM, SYNE } from "./tokens";

/**
 * Page header: shimmer pill → Syne headline (wrap the key phrase in <GradientText>)
 * → one-line sub → meta line → actions. `full` for a page's home, `compact` for
 * detail pages. Cool conic on admin tools, warm on pages client firms use.
 */
export function PageHero({
  pill,
  conic = "cool",
  title,
  sub,
  meta,
  actions,
  back,
  size = "full",
}: {
  pill: { icon?: React.ReactNode; label: string };
  conic?: "cool" | "warm";
  title: React.ReactNode;
  sub?: React.ReactNode;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  back?: { href: string; label: string };
  size?: "full" | "compact";
}) {
  const full = size === "full";
  return (
    <header className={`rm-enter pb-6 text-center ${full ? "pt-8 sm:pt-14" : "pt-5 sm:pt-8"}`}>
      {back && (
        <div className="mb-5 flex justify-start">
          <Link
            href={back.href}
            className="inline-flex min-h-10 items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-3 text-xs font-semibold text-neutral-300 transition-colors hover:border-white/20 hover:text-white"
          >
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
            {back.label}
          </Link>
        </div>
      )}
      <ShimmerPill conic={conic === "warm" ? SHIMMER_CONIC_WARM : SHIMMER_CONIC}>
        {pill.icon}
        <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white">{pill.label}</span>
      </ShimmerPill>
      <h1 className={`text-white ${full ? "mt-5 text-4xl sm:text-6xl" : "mt-4 text-3xl sm:text-5xl"} font-bold tracking-tight break-words`} style={SYNE}>
        {title}
      </h1>
      {sub && <p className="mx-auto mt-3 max-w-2xl text-sm text-neutral-400 sm:text-base">{sub}</p>}
      {meta && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-[11px] text-neutral-400" style={NUM_FONT}>
          {meta}
        </div>
      )}
      {actions && <div className="mt-5 flex flex-wrap items-center justify-center gap-2">{actions}</div>}
    </header>
  );
}
