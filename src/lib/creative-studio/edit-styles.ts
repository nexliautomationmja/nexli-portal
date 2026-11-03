import type { EditStyle } from "@/remotion/types";
import type { CreativeFormat, CreativeRig } from "@/lib/creative-studio/tables";

/** The four edit styles from the editing rulebook (client-safe). */
export const EDIT_STYLES: { id: EditStyle; label: string; blurb: string; slots: string }[] = [
  { id: "solo", label: "Solo", blurb: "Captions plus one title banner. Nothing else.", slots: "Captions · title" },
  { id: "pov", label: "Organic / POV", blurb: "Instagram's white text stickers. No captions, no brand colors.", slots: "Stickers" },
  { id: "vsl", label: "VSL", blurb: "One left-column card at a time, sequenced. No top banner.", slots: "Captions · cards" },
  { id: "ladder", label: "Ladder", blurb: "Title, a price pill and client tag per person, red qualifier, CTA.", slots: "Captions · title · rungs · qualifier · CTA" },
];

export const STYLE_LABEL: Record<EditStyle, string> = {
  solo: "Solo",
  pov: "Organic / POV",
  vsl: "VSL",
  ladder: "Ladder",
};

/** The style that fits the video: rig for ads, VSL for 16:9. */
export function suggestedStyle(format: CreativeFormat, rig: CreativeRig): EditStyle {
  if (format === "vsl_16x9") return "vsl";
  if (rig === "duo" || rig === "trio") return "ladder";
  if (rig === "solo_selfie") return "pov";
  return "solo";
}

export const isEditStyle = (v: unknown): v is EditStyle => v === "solo" || v === "pov" || v === "vsl" || v === "ladder";
