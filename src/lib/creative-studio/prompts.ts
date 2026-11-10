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
  ClipKind,
  CreativeBrief,
  CreativeFormat,
  CreativeRig,
  FrameSpec,
  PresenterInfo,
  Pronoun,
  ScenePerson,
  SceneSpec,
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

/** Nexli's default presenter (a video with no presenter chosen, in Nexli's studio). */
export const DANIELA: PresenterInfo = { id: "", name: "Daniela", pronoun: "she", voice: DANIELA_VOICE, look: "" };

/** A client studio's presenter before one is chosen: unnamed, Daniela's voice wording without her name. */
export const STUDIO_PRESENTER: PresenterInfo = {
  id: "",
  name: "",
  pronoun: "she",
  voice:
    "The presenter's voice, the same in every clip: a confident woman talking to a business owner she respects, warm, honest and direct, no hype and no sales tone, neutral American accent, medium-low pitch, natural conversational pace",
  look: "",
};

/** Who presents this video: the chosen presenter, else the studio's default. */
export function presenterOf(project: { studioId: string | null; presenter?: PresenterInfo | null }): PresenterInfo {
  return project.presenter ?? (project.studioId ? STUDIO_PRESENTER : DANIELA);
}

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
function requiredCues(line: string, cues: string, subj = "She"): string[] {
  const out: string[] = [];
  const has = (needle: string) => cues.toLowerCase().includes(needle.toLowerCase());
  if (/C-P-A/.test(line) && !has("C, P, A")) out.push(`${subj} clearly pronounces each letter: C, P, A.`);
  if (/I-R-S/.test(line) && !has("I, R, S")) out.push(`${subj} says I-R-S as the letters I, R, S.`);
  if (/C-E-O/.test(line) && !has("C, E, O")) out.push(`${subj} clearly pronounces each letter: C, E, O.`);
  return out;
}

function cuesText(clip: ClipFields, subj = "She"): string {
  const parts = [clip.cues.trim(), ...requiredCues(clip.line, clip.cues, subj)].filter(Boolean);
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
  /** Who presents (story videos); defaults to Daniela. */
  presenter?: PresenterInfo;
}): string {
  // A story video: the clip's own scene, kind of shot and speaker.
  if (args.frame?.scenes?.length) {
    return buildStoryPrompt({
      format: args.format,
      scene: sceneFor(args.frame, args.clip),
      clip: args.clip,
      presenter: args.presenter ?? DANIELA,
    });
  }
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

// ── Story videos (several scenes, any kind of shot) ─────────────────────

/** Most scenes one video can have (Claude reads every frame; Manus makes them in one go). */
export const MAX_SCENES = 8;

const PRONOUNS: Record<Pronoun, { Subj: string; subj: string; poss: string; Poss: string }> = {
  she: { Subj: "She", subj: "she", poss: "her", Poss: "Her" },
  he: { Subj: "He", subj: "he", poss: "his", Poss: "His" },
};

export const KIND_LABEL: Record<ClipKind, string> = {
  to_camera: "To camera",
  in_scene: "In the scene",
  voiceover: "Voiceover",
  silent: "No talking",
};

export const isStory = (frame: FrameSpec | null | undefined): boolean => Boolean(frame?.scenes?.length);

/** The scene a clip plays in (its frame's description), else the first scene. */
export function sceneFor(frame: FrameSpec, clip: { frameId?: string | null }): SceneSpec {
  const scenes = frame.scenes ?? [];
  return scenes.find((s) => s.frameId === clip.frameId) ?? scenes[0];
}

/** §11 model for a story clip: Omni when two or more people share the frame. */
export function storyModelFor(scene: SceneSpec | null | undefined): string {
  return (scene?.people?.length ?? 0) >= 2 ? "kling-video-v3_0_omni" : "kling-video-v3_0";
}

/** The Kling model for one clip (story videos choose per scene). */
export function klingModelForClip(rig: CreativeRig, frame: FrameSpec | null, clip: { frameId?: string | null }): string {
  return frame?.scenes?.length ? storyModelFor(sceneFor(frame, clip)) : klingModelFor(rig);
}

/** Who talks in a speaking clip: the named position, else the presenter, else the first person. */
function speakerIn(scene: SceneSpec, clip: ClipFields): ScenePerson | null {
  const people = scene.people ?? [];
  if (people.length === 0) return null;
  if (people.length === 1) return people[0];
  return (clip.speaker ? people.find((p) => p.position === clip.speaker) : null) ?? people.find((p) => p.presenter) ?? people[0];
}

function genericVoice(pronoun: Pronoun): string {
  return `${pronoun === "he" ? "A man's" : "A woman's"} natural conversational voice, neutral American accent`;
}

function voiceOf(person: ScenePerson | null, presenter: PresenterInfo): string {
  if (!person || person.presenter) return presenter.voice;
  return person.voice.trim().replace(/[.]+$/, "") || genericVoice(person.pronoun);
}

const where = (p: ScenePerson) =>
  p.position === "CENTER" ? "In the CENTER" : p.position === "ONLY" ? "In the frame" : `On the ${p.position}`;

const noPeriod = (s: string) => s.trim().replace(/[.]+$/, "");

/** Listener directions for a multi-person clip, with each listener's own pronoun. */
function reactionsFor(listeners: ScenePerson[], clip: ClipFields): string {
  return listeners
    .map((p, i) => {
      const P = PRONOUNS[p.pronoun] ?? PRONOUNS.she;
      const custom = clip.listenerReactions.find((r) => r.shortName.trim().toLowerCase() === p.shortName.trim().toLowerCase());
      const fallback = [
        `${P.subj} turns ${P.poss} head to look at the speaker, listening closely`,
        `${P.subj} gives a small agreeing nod`,
        `${P.subj} shifts ${P.poss} weight and glances over at the speaker`,
      ][i % 3];
      return `${p.shortName}: ${noPeriod(custom?.reaction ?? "") || fallback}.`;
    })
    .join(" ");
}

/**
 * The Kling prompt for one clip of a story video. Same standing rules as §7
 * (spoken line inside the prompt, said once word for word, one voice, no
 * music, no on-screen text), with the scene's camera and people, the
 * presenter's name, pronouns and voice, and the clip's kind of shot.
 */
export function buildStoryPrompt(args: {
  format: CreativeFormat;
  scene: SceneSpec;
  clip: ClipFields;
  presenter: PresenterInfo;
}): string {
  const { format, scene, clip, presenter } = args;
  const orientation = format === "vsl_16x9" ? "Horizontal 16:9" : "Vertical 9:16";
  const people = scene.people ?? [];
  const line = clip.line.trim();
  const register = clip.register.trim().replace(/[.]+$/, "");
  const action = sentence(clip.action);
  const setting = sentence(scene.setting);
  const requested = clip.kind ?? "to_camera";
  // Nobody on screen can't talk on camera: the line becomes a voiceover.
  const kind: ClipKind = (requested === "to_camera" || requested === "in_scene") && people.length === 0 ? "voiceover" : requested;
  const talking = kind === "to_camera" || kind === "in_scene";
  const looking =
    kind === "to_camera" ? "looking into the lens" : "looking where the action says, not into the lens,";
  const presenterPerson = people.find((p) => p.presenter) ?? null;

  // Who is heard: the speaker (talking) or the narrator (voiceover; the presenter unless a person is named).
  const named = clip.speaker ? people.find((p) => p.position === clip.speaker) ?? null : null;
  const voicePerson = talking ? speakerIn(scene, clip) : kind === "voiceover" ? named ?? presenterPerson : null;
  const heard = voicePerson ?? (kind === "voiceover" ? null : people[0] ?? null);
  const heardPronoun: Pronoun = heard ? heard.pronoun : presenter.pronoun;
  const H = PRONOUNS[heardPronoun] ?? PRONOUNS.she;
  const voice = voiceOf(heard, presenter);
  const cues = cuesText(clip, H.Subj);
  const narrator = heard && !heard.presenter ? `${noPeriod(heard.shortName) || "The narrator"}'s` : presenter.name ? `${presenter.name}'s` : "The narrator's";

  if (people.length >= 2) {
    const count = people.length === 2 ? "two" : people.length === 3 ? "three" : String(people.length);
    const camera =
      scene.camera === "handheld"
        ? "Handheld camera with gentle natural movement, no cuts."
        : scene.camera === "selfie"
          ? `Handheld selfie video held by ${presenterPerson?.who || "one of them"}, with only gentle natural hand sway, no cuts.`
          : "Static locked-off camera, no zoom.";
    const lineup = people.map((p) => `${where(p)}: ${noPeriod(p.look || p.who)}.`).join(" ");
    const head = [
      `Use 图片1 as the exact opening frame: the same ${count} people, same outfits, same positions and the same place, framed exactly as in 图片1.`,
      camera,
      `${orientation}.`,
      lineup,
    ];
    const quiet =
      "No one speaks: everyone keeps their lips closed the whole time, but they behave like real people, not statues, with natural blinking, breathing and small shifts of weight.";
    if (talking && heard) {
      const listeners = people.filter((p) => p !== heard);
      return [
        ...head,
        `In this clip ONLY ${heard.who || heard.shortName} speaks.`,
        action,
        `${H.Subj} starts speaking within the first half-second, ${looking} with natural lip-sync and subtle head movement, saying: "${multiPersonLine(line)}"`,
        `${H.Subj} says the line once, word for word, then holds a natural expression until the end.`,
        listeners.length === 1
          ? "The other person never speaks and keeps their lips closed the whole time, but behaves like a real person listening, not a statue, with natural blinking, breathing and small shifts of weight."
          : "The other people never speak and keep their lips closed the whole time, but they behave like real people listening, not statues, with natural blinking, breathing and small shifts of weight.",
        reactionsFor(listeners, clip),
        `Voice: ${voice}. Delivery: ${register}.${cues}`,
        setting,
        "Only one voice is heard: no background music, no other people talking, no on-screen text.",
      ]
        .filter(Boolean)
        .join(" ");
    }
    if (kind === "voiceover") {
      return [
        ...head,
        quiet.replace("No one speaks", "No one on screen speaks"),
        action,
        `${narrator} voice is heard as a voiceover over the shot, saying: "${multiPersonLine(line)}"`,
        `Voice: ${voice}. Delivery: ${register}.${cues}`,
        "The voiceover says the line once, word for word.",
        setting,
        "Only the voiceover is heard: no background music, no on-screen text.",
      ]
        .filter(Boolean)
        .join(" ");
    }
    return [...head, quiet, action, setting, "Only quiet natural sound: no voices, no background music, no on-screen text."]
      .filter(Boolean)
      .join(" ");
  }

  // One person in the frame, or nobody.
  const person = people[0] ?? null;
  const P = person ? PRONOUNS[person.pronoun] ?? PRONOUNS.she : null;
  const look = person ? sentence(person.look || person.who) : "";
  const opening =
    scene.camera === "selfie" && person
      ? `${orientation} handheld selfie video, single continuous shot, no cuts, with only gentle natural hand sway. Selfie-style shot: ${look}`
      : scene.camera === "handheld"
        ? `Handheld camera with gentle natural movement, single continuous shot, no cuts. ${orientation}.${look ? ` ${look}` : ""}`
        : `Static locked-off camera, single continuous shot, no cuts. ${orientation}.${look ? ` ${look}` : ""}`;
  const realism = person
    ? kind === "to_camera"
      ? "Realistic skin, hair and fabric; everything in the scene stays unchanged."
      : "Realistic skin, hair and fabric; the place stays exactly as in the frame."
    : "Realistic textures and light; the place stays exactly as in the frame.";

  if (talking && person && P) {
    return [
      opening,
      action,
      `${P.Subj} starts speaking within the first half-second, ${looking} with natural lip-sync and subtle head movement, saying: "${line}"`,
      `Voice: ${voice}. Delivery: ${register}.${cues}`,
      `${P.Subj} says the line once, word for word, then holds a natural expression until the end.`,
      setting,
      `${realism} Only ${P.poss} voice is heard: no background music, no on-screen text.`,
    ]
      .filter(Boolean)
      .join(" ");
  }
  if (kind === "voiceover") {
    const self = Boolean(person && heard === person);
    return [
      opening,
      action,
      person && P ? `${P.Subj} doesn't speak on camera: ${P.poss} lips stay closed the whole time.` : "",
      `${self && P ? P.Poss : narrator} voice is heard as a voiceover over the shot, saying: "${line}"`,
      `Voice: ${voice}. Delivery: ${register}.${cues}`,
      "The voiceover says the line once, word for word.",
      setting,
      `${realism} Only the voiceover is heard: no background music, no on-screen text.`,
    ]
      .filter(Boolean)
      .join(" ");
  }
  return [
    opening,
    action,
    person && P ? `${P.Subj} doesn't speak: ${P.poss} lips stay closed the whole time.` : "",
    setting,
    `${realism} Nobody speaks: only quiet natural sound, no voices, no background music, no on-screen text.`,
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
