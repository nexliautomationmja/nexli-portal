"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const RANGES = [
  { label: "7d", value: "7d" },
  { label: "30d", value: "30d" },
  { label: "90d", value: "90d" },
];

export function DateRangePicker({ className }: { className?: string }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const current = searchParams.get("range") || "7d";

  function setRange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", value);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className={cn("inline-flex rounded-xl border border-[var(--glass-border)] overflow-hidden", className)}>
      {RANGES.map((r) => (
        <button
          key={r.value}
          onClick={() => setRange(r.value)}
          className={cn(
            "px-4 py-2 text-xs font-bold uppercase tracking-[0.1em] transition-all duration-200",
            current === r.value
              ? "bg-blue-500/20 text-blue-400"
              : "text-[var(--text-muted)] hover:bg-[var(--glass-bg)]"
          )}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
