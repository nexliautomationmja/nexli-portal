"use client";

import type { CreativeCall, KeepTag } from "@/lib/ads/decide";
import { Ico } from "@/components/ads/parts";
import { VIZ } from "@/components/ads/viz";

/** The one call on a creative — CUT or KEEP (with what kind of keep) — the same on the plan and the cards. */

export const KEEP_TAG: Record<KeepTag, string> = { winner: "Winner", working: "Working", testing: "Testing", tiring: "Tiring" };

const CROWN = <path d="M2 18h20M3 7l4.5 4L12 4l4.5 7L21 7l-2 11H5L3 7Z" />;
const CHECK = <path d="M20 6 9 17l-5-5" />;
const X = <path d="M18 6 6 18M6 6l12 12" />;
const FLASK = <path d="M9 3h6M10 3v6L4 19a1 1 0 0 0 .9 1.5h14.2A1 1 0 0 0 20 19l-6-10V3" />;
const BATTERY = (
  <>
    <rect x="2" y="7" width="16" height="10" rx="2" />
    <path d="M22 11v2M6 11v2" />
  </>
);

export function CallBadge({ call, size = "md", onImage = false }: { call: CreativeCall; size?: "sm" | "md"; onImage?: boolean }) {
  const cut = call.call === "cut";
  const color = cut ? (call.done ? VIZ.inkMuted : VIZ.status.critical) : call.tag === "tiring" ? VIZ.status.warning : VIZ.status.good;
  const icon = cut ? (call.done ? CHECK : X) : call.tag === "winner" ? CROWN : call.tag === "testing" ? FLASK : call.tag === "tiring" ? BATTERY : CHECK;
  const early = cut && call.cutKind === "early_read";
  const word = (cut ? (call.done ? "Cut · done" : early ? "Cut · early read" : "Cut") : `Keep${call.tag ? ` · ${KEEP_TAG[call.tag]}` : ""}`) + (call.override ? " · yours" : "");
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border font-black uppercase tracking-wide ${size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]"} ${onImage ? "backdrop-blur-sm" : ""}`}
      style={{ color: cut && !call.done ? "#fecaca" : call.tag === "tiring" ? "#fde68a" : cut ? "#cbd5e1" : "#bbf7d0", borderColor: `${color}80`, background: onImage ? `${color}55` : `${color}22` }}
    >
      <Ico d={icon} size={size === "sm" ? 10 : 12} />
      {word}
    </span>
  );
}
