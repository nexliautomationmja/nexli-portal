"use client";

import { useEffect, useMemo, useState } from "react";
import { EYEBROW, SYNE } from "./tokens";

const EYEBROW_TONE = { cyan: "text-cyan-300/80", violet: "text-violet-300/80", lime: "text-lime-300/80", amber: "text-amber-300/80" } as const;
export type EyebrowTone = keyof typeof EYEBROW_TONE;

/** Section heading: eyebrow + Syne title + one-line sub, with an optional right-hand slot. */
export function SectionHead({
  id,
  eyebrow,
  title,
  sub,
  right,
  tone = "cyan",
}: {
  id?: string;
  eyebrow: string;
  title: React.ReactNode;
  sub?: React.ReactNode;
  right?: React.ReactNode;
  tone?: EyebrowTone;
}) {
  return (
    <div id={id} className="mb-4 flex scroll-mt-28 flex-wrap items-end justify-between gap-3 md:scroll-mt-20">
      <div className="min-w-0">
        <p className={`${EYEBROW} ${EYEBROW_TONE[tone]}`}>{eyebrow}</p>
        <h2 className="mt-1 text-xl font-bold tracking-tight text-white sm:text-2xl" style={SYNE}>
          {title}
        </h2>
        {sub && <div className="mt-1 max-w-2xl text-sm text-neutral-400">{sub}</div>}
      </div>
      {right}
    </div>
  );
}

/** A page section: entrance animation, bottom rhythm, and its heading. */
export function Section({
  id,
  eyebrow,
  title,
  sub,
  right,
  tone,
  className = "",
  children,
}: {
  id: string;
  eyebrow: string;
  title: React.ReactNode;
  sub?: React.ReactNode;
  right?: React.ReactNode;
  tone?: EyebrowTone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`rm-enter mb-10 ${className}`} aria-labelledby={`${id}-title`}>
      <SectionHead id={id} eyebrow={eyebrow} title={<span id={`${id}-title`}>{title}</span>} sub={sub} right={right} tone={tone} />
      {children}
    </section>
  );
}

const smooth = (): ScrollBehavior =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";

/** Scroll-spy: the id of the section currently near the top of the screen. */
export function useActiveSection(ids: readonly string[]) {
  const [active, setActive] = useState<string>(ids[0]);
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      let cur = ids[0];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= window.innerHeight * 0.3) cur = id;
      }
      setActive(cur);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [ids]);
  return active;
}

/** Sticky chips that jump between a page's sections and show which one is on screen. */
export function SectionNav({ sections }: { sections: readonly { id: string; label: string }[] }) {
  const ids = useMemo(() => sections.map((s) => s.id), [sections]);
  const active = useActiveSection(ids);
  return (
    <nav aria-label="Sections" className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-30 -mx-4 mb-6 border-b border-white/5 bg-[#020617]/85 px-4 py-2 backdrop-blur-xl sm:-mx-6 sm:px-6 md:top-0">
      <div className="cs-scroll flex gap-1.5 overflow-x-auto">
        {sections.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            aria-current={active === s.id ? "location" : undefined}
            onClick={(e) => {
              e.preventDefault();
              document.getElementById(s.id)?.scrollIntoView({ behavior: smooth(), block: "start" });
            }}
            className={`flex min-h-9 shrink-0 items-center whitespace-nowrap rounded-full border px-3 text-[11px] font-bold transition-colors ${
              active === s.id ? "border-blue-500 bg-blue-600 text-white" : "border-white/10 bg-white/5 text-neutral-400 hover:text-white"
            }`}
          >
            {s.label}
          </a>
        ))}
      </div>
    </nav>
  );
}

/** Once the page's data is on screen, honour a #section in the URL (deep links from other pages). */
export function useHashScroll(ready: boolean) {
  useEffect(() => {
    if (!ready) return;
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!id) return;
    const raf = requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: "start" }));
    return () => cancelAnimationFrame(raf);
  }, [ready]);
}
