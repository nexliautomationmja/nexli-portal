"use client";

// ─── Table of contents: scroll-spy + reading progress ──────

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon, labelCls } from "@/components/launch-pad";
import { LETTER_ICONS as X } from "./icons";
import type { Section } from "./parse";

/**
 * Tracks which section is in view and how far the reader has scrolled
 * through the letter list (monotonic, 0–100). `deps` re-measures when the
 * layout changes (e.g. a clause is expanded).
 */
export function useSectionNav(sections: Section[], deps: unknown) {
  const [active, setActive] = useState<number>(1);
  const [readPct, setReadPct] = useState(0);
  const sectionEls = useRef<Map<number, HTMLElement>>(new Map());
  const listRef = useRef<HTMLDivElement | null>(null);

  // Active section + reading progress, from scroll position (rAF-throttled).
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const vh = window.innerHeight;
      let current = sections[0]?.num ?? 1;
      for (const s of sections) {
        const el = sectionEls.current.get(s.num);
        if (el && el.getBoundingClientRect().top <= vh * 0.3) current = s.num;
      }
      setActive(current);
      const list = listRef.current;
      if (list) {
        const r = list.getBoundingClientRect();
        const atBottom =
          window.scrollY + vh >= document.documentElement.scrollHeight - 4;
        const pct = atBottom
          ? 100
          : Math.round(Math.min(1, Math.max(0, (vh - r.top) / Math.max(1, r.height))) * 100);
        setReadPct((prev) => Math.max(prev, pct));
      }
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    frame = requestAnimationFrame(measure);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [sections, deps]);

  const registerRef = useCallback(
    (num: number) => (el: HTMLElement | null) => {
      if (el) sectionEls.current.set(num, el);
      else sectionEls.current.delete(num);
    },
    []
  );

  return { active, readPct, listRef, registerRef };
}

function TocLink({ s, active, variant }: { s: Section; active: number; variant: "side" | "chip" }) {
  const isActive = s.num === active;
  const cls =
    variant === "side"
      ? `flex items-start gap-2 rounded-lg px-2.5 py-1.5 text-[12px] leading-snug transition-colors ${
          isActive ? "bg-white/10 text-white font-bold" : "text-neutral-500 hover:text-neutral-200"
        }`
      : `shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold whitespace-nowrap border transition-colors ${
          isActive
            ? "bg-blue-600 border-blue-500 text-white"
            : "bg-white/5 border-white/10 text-neutral-400 hover:text-white"
        }`;
  return (
    <a href={`#sec-${s.num}`} aria-current={isActive ? "location" : undefined} className={cls}>
      <span className={variant === "side" ? "w-4 shrink-0 text-right tabular-nums text-neutral-600" : "mr-1 opacity-60"}>
        {s.num}
      </span>
      <span>{s.title}</span>
    </a>
  );
}

/**
 * `side`: desktop table of contents, fixed in the left gutter (the shell's
 * overflow-x-hidden wrapper would defeat position: sticky).
 * `chips`: mobile / tablet horizontal section chips.
 */
export function SectionNav({
  sections,
  active,
  readPct,
  variant,
  signHref = "#sign",
}: {
  sections: Section[];
  active: number;
  readPct: number;
  variant: "side" | "chips";
  signHref?: string;
}) {
  if (variant === "chips") {
    return (
      <nav aria-label="Agreement sections" className="xl:hidden -mx-4 sm:-mx-6">
        <div className="flex gap-2 overflow-x-auto px-4 sm:px-6 pb-1" style={{ scrollbarWidth: "none" }}>
          {sections.map((s) => (
            <TocLink key={s.num} s={s} active={active} variant="chip" />
          ))}
        </div>
      </nav>
    );
  }
  return (
    <nav
      aria-label="Agreement sections"
      className="hidden xl:block fixed top-28 w-[208px] max-h-[calc(100vh-8rem)] overflow-y-auto z-20"
      style={{ left: "max(16px, calc(50% - 384px - 232px))" }}
    >
      <p className={`${labelCls} px-2.5`}>Sections · {readPct}% read</p>
      <div className="space-y-0.5">
        {sections.map((s) => (
          <TocLink key={s.num} s={s} active={active} variant="side" />
        ))}
      </div>
      <a
        href={signHref}
        className="mt-3 flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12px] font-bold text-blue-400 hover:text-blue-300"
      >
        <Icon d={X.penLine} size={13} /> Sign
      </a>
    </nav>
  );
}
