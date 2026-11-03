/**
 * Kling prompt assembly, clip durations and the script lint — pure functions
 * shared by the server (stored prompts) and the review page (live prompts
 * while a field is being edited). No server imports here.
 *
 * Source of every rule: kling-framework.md (§4 duration, §6 pronunciation,
 * §7 templates). Prompts are assembled in code rather than written by Claude
 * so the standing rules ("She says the line once, word for word…", "no
 * on-screen text") are present in every clip, guaranteed.
 */
import type {
  ClipFields,
  CreativeBrief,
  CreativeFormat,
  CreativeRig,
  FrameSpec,
} from "@/lib/creative-studio/tables";

export const EMPTY_BRIEF: CreativeBrief = {
  oldBelief: "",
  newBelief: "",
  proof: "",
  cta: "",
  requiredLines: "",
  notes: "",
};

// §7 Voice — identical in every single-presenter clip.
export const DANIELA_VOICE =
  "Daniela's voice, the same in every clip: a confident woman talking to a firm owner she respects, warm, honest and direct, no hype and no sales tone, neutral American accent, medium-low pitch, natural conversational pace";

// §7 Multi-person voice line.
const MULTI_VOICE =
  "Daniela's voice: a confident woman, neutral American accent, medium-low pitch, natural conversational pace";

/** §11 Kling credits per second on 3.0 and Omni. */
export const CREDITS_PER_SECOND = 12;

export const RIG_LABEL: Record<CreativeRig, string> = {
  solo_locked: "Solo · locked-off",
  solo_selfie: "Solo · handheld selfie",
  duo: "Two founders (duo)",
  trio: "Three founders (trio)",
};

export const FORMAT_LABEL: Record<CreativeFormat, string> = {
  ad_9x16: "Ad · 9:16",
  vsl_16x9: "VSL · 16:9",
};

export function isMultiPerson(rig: CreativeRig): boolean {
  return rig === "duo" || rig === "trio";
}

/** §11 model per rig. Never v4 for talking heads (it butchers words). */
export function klingModelFor(rig: CreativeRig): string {
  return isMultiPerson(rig) ? "kling-video-v3_0_omni" : "kling-video-v3_0";
}

export function wordCount(line: string): number {
  return line.trim().split(/\s+/).filter(Boolean).length;
}

/** §4: min(12, max(4, ceil(words/2.4 + 1.5) + (1 if "$" in line))) seconds. */
export function clipDuration(line: string): number {
  const words = wordCount(line);
  const base = Math.ceil(words / 2.4 + 1.5) + (line.includes("$") ? 1 : 0);
  return Math.min(12, Math.max(4, base));
}

const sentence = (s: string) => {
  const t = s.trim().replace(/\s+/g, " ");
  if (!t) return "";
  const cap = t.charAt(0).toUpperCase() + t.slice(1);
  return /[.!?]$/.test(cap) ? cap : `${cap}.`;
};

/**
 * Pronunciation cues the playbook (§6) requires whenever a line contains
 * these spellings — added automatically if Claude's cues don't already
 * cover them, so a clip can never ship with "C-P-A" and no letter cue.
 */
function requiredCues(line: string, cues: string): string[] {
  const out: string[] = [];
  const has = (needle: string) => cues.toLowerCase().includes(needle.toLowerCase());
  if (/C-P-A/.test(line) && !has("C, P, A")) out.push("She clearly pronounces each letter: C, P, A.");
  if (/I-R-S/.test(line) && !has("I, R, S")) out.push("She says I-R-S as the letters I, R, S.");
  if (/C-E-O/.test(line) && !has("C, E, O")) out.push("She clearly pronounces each letter: C, E, O.");
  return out;
}

function cuesText(clip: ClipFields): string {
  const parts = [clip.cues.trim(), ...requiredCues(clip.line, clip.cues)].filter(Boolean);
  return parts.length ? ` ${parts.join(" ")}` : "";
}

/** §6: Omni turned "1 million" into "100 million" — write it as a word in multi-person prompts. */
function multiPersonLine(line: string): string {
  return line.replace(/\b1 million\b/gi, "one million");
}

const DEFAULT_REACTIONS = [
  "she turns her head to look at the speaker, listening closely",
  "she gives a small agreeing nod",
  "she shifts her weight and glances over at the speaker",
];

/** Build the complete Kling prompt for one clip (§7). */
export function buildKlingPrompt(args: {
  format: CreativeFormat;
  rig: CreativeRig;
  frame: FrameSpec | null;
  clip: ClipFields;
}): string {
  const { format, rig, clip } = args;
  const frame: FrameSpec = args.frame ?? { subject: "", room: "", base: "", positions: [] };
  const orientation = format === "vsl_16x9" ? "Horizontal 16:9" : "Vertical 9:16";
  const line = clip.line.trim();
  const register = clip.register.trim().replace(/[.]+$/, "");
  const action = sentence(clip.action);
  const room = sentence(frame.room);
  const subject = sentence(frame.subject);
  const cues = cuesText(clip);

  if (isMultiPerson(rig)) {
    const trio = rig === "trio";
    const positions = frame.positions ?? [];
    const speaker = positions.find((p) => p.position === clip.speaker) ?? positions[positions.length - 1];
    const listeners = positions.filter((p) => p !== speaker);
    const people = positions
      .map((p) => {
        const where = p.position === "CENTER" ? "In the CENTER" : `On the ${p.position}`;
        const outfit = p.outfit.trim();
        return `${where}: the woman in ${/^(the|a|an)\s/i.test(outfit) ? outfit : `the ${outfit}`}.`;
      })
      .join(" ");
    const reactions = listeners
      .map((p, i) => {
        const custom = clip.listenerReactions.find(
          (r) => r.shortName.trim().toLowerCase() === p.shortName.trim().toLowerCase()
        );
        return `${p.shortName}: ${custom?.reaction.trim() || DEFAULT_REACTIONS[i % DEFAULT_REACTIONS.length]}.`;
      })
      .join(" ");
    return [
      `Use 图片1 as the exact opening frame: the same ${trio ? "three women" : "two women, same armchairs"}, same outfits, same positions and the same office, framed exactly as in 图片1.`,
      trio ? "Static locked-off wide shot, no zoom." : "Static locked-off camera.",
      "Vertical 9:16.",
      sentence(frame.base),
      people,
      `In this clip ONLY ${speaker?.who ?? "the speaker"} speaks.`,
      action,
      `She starts speaking within the first half-second, with natural lip-sync and subtle head movement, saying: "${multiPersonLine(line)}"`,
      "She says the line once, word for word, then holds a natural expression until the end.",
      trio
        ? "The other two women never speak and keep their lips closed the whole time, but they behave like real people listening, not statues, with natural blinking, breathing and small shifts of weight."
        : "The other woman never speaks and keeps her lips closed the whole time, but she behaves like a real person listening, not a statue, with natural blinking, breathing and small shifts of weight.",
      reactions,
      `Voice: ${MULTI_VOICE}. Delivery: ${register}.${cues}`,
      room,
      "Only one voice is heard: no background music, no other people talking, no on-screen text.",
    ]
      .filter(Boolean)
      .join(" ");
  }

  const opening =
    rig === "solo_selfie"
      ? `Vertical 9:16 handheld selfie video, single continuous shot, no cuts, with only gentle natural hand sway. Selfie-style shot: ${subject}`
      : `Static locked-off camera, single continuous shot, no cuts. ${orientation}. ${subject}`;

  return [
    opening,
    action,
    `She starts speaking within the first half-second, looking into the lens with natural lip-sync and subtle head movement, saying: "${line}"`,
    `Voice: ${DANIELA_VOICE}. Delivery: ${register}.${cues}`,
    "She says the line once, word for word, then holds a natural expression until the end.",
    room,
    "Realistic skin, hair and fabric; everything in the scene stays unchanged. Only her voice is heard: no background music, no on-screen text.",
  ]
    .filter(Boolean)
    .join(" ");
}

export interface LintFlag {
  level: "risk" | "check";
  message: string;
}

/** §1/§6/§10 risky-line checks shown on the review page. */
export function lintClip(clip: ClipFields): LintFlag[] {
  const flags: LintFlag[] = [];
  const line = clip.line;
  const words = wordCount(line);
  const dur = clipDuration(line);
  if (words > 22 || dur >= 12) {
    flags.push({ level: "risk", message: `Long line (${words} words, ${dur}s). Kling drifts past 12s; consider splitting.` });
  }
  if (/\bCPA'?s?\b/.test(line)) flags.push({ level: "risk", message: 'Write "C-P-A", never "CPA".' });
  if (/\bIRS\b/.test(line)) flags.push({ level: "risk", message: 'Write "I-R-S" so she says the letters.' });
  if (/\bprices?\b/i.test(line)) flags.push({ level: "risk", message: 'For Nexli\'s offer say "investment", never "price".' });
  if (/\bguarantee/i.test(line)) flags.push({ level: "risk", message: "No guarantees of results." });
  if (/\b(always|never|everyone|nobody|every single|100%)\b/i.test(line)) {
    flags.push({ level: "check", message: "Absolute claim: soften it (rarely, usually) if it can't be verified." });
  }
  const hasNumber = /\$\s?\d|\b\d[\d,.]*\s?(k|m|x|million|percent|%)?\b/i.test(line);
  if (hasNumber && !/pronunciation guide|pronounces|says .* as/i.test(clip.cues)) {
    flags.push({
      level: "check",
      message: "Number in the line: confirm it has a pronunciation strategy (§6), or is written plainly like 750K.",
    });
  }
  if (/\bten times\b/i.test(line) && !/T-E-N/.test(clip.cues)) {
    flags.push({ level: "check", message: 'Add the "ten times" cue (§6) so she says "ten".' });
  }
  return flags;
}

export function scriptTotals(lines: string[]) {
  const seconds = lines.reduce((s, l) => s + clipDuration(l), 0);
  return {
    clips: lines.length,
    seconds,
    /** §10: approximate minutes after trims (about 0.85×). */
    minutesAfterTrims: Math.round(((seconds * 0.85) / 60) * 10) / 10,
    credits: seconds * CREDITS_PER_SECOND,
  };
}
