import type { CreativeBrief, CreativeFormat, CreativeRig } from "@/lib/creative-studio/tables";

const FORMATS: CreativeFormat[] = ["ad_9x16", "vsl_16x9"];
const RIGS: CreativeRig[] = ["solo_locked", "solo_selfie", "duo", "trio"];

export function cleanBrief(input: unknown): CreativeBrief {
  const b = (input ?? {}) as Partial<Record<keyof CreativeBrief, unknown>>;
  const s = (v: unknown) => (typeof v === "string" ? v.slice(0, 4000) : "");
  return {
    oldBelief: s(b.oldBelief),
    newBelief: s(b.newBelief),
    proof: s(b.proof),
    cta: s(b.cta),
    requiredLines: s(b.requiredLines),
    notes: s(b.notes),
  };
}

export function cleanFormatRig(format: unknown, rig: unknown): { format: CreativeFormat; rig: CreativeRig } {
  const f = FORMATS.includes(format as CreativeFormat) ? (format as CreativeFormat) : "ad_9x16";
  let r = RIGS.includes(rig as CreativeRig) ? (rig as CreativeRig) : "solo_locked";
  // VSLs are single presenter, locked-off (framework §3b).
  if (f === "vsl_16x9") r = "solo_locked";
  return { format: f, rig: r };
}

