"use client";

export function SectionBadge({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1 md:px-4 md:py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20">
      <span className="text-blue-400 text-[9px] md:text-xs font-black tracking-[0.2em] uppercase">
        {children}
      </span>
    </div>
  );
}
