import Anthropic from "@anthropic-ai/sdk";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { KLING_FRAMEWORK, REACTION_RULES, STORY_RULES } from "@/lib/creative-studio/rules.generated";
import { withoutNexliSections } from "@/lib/creative-studio/framework-sections";
import { FRAME_SCHEMA, STORY_SCENE_SCHEMA, askClaude, cleanPeople, presenterLine } from "@/lib/creative-studio/script";
import { RIG_LABEL, isMultiPerson, presenterOf } from "@/lib/creative-studio/prompts";
import { creativeClips, creativeProjects, type FrameSpec, type SceneCamera, type SceneSpec } from "@/lib/creative-studio/tables";
import { clipsOf, framesOf, rebuildPrompts } from "@/lib/creative-studio/service";
import { signPaths } from "@/lib/creative-studio/storage";
import { firmBrief, studioById } from "@/lib/creative-studio/studios";

/**
 * A new frame on a video whose script is written (and whose clips may be
 * rendered): Claude re-describes just that frame for the Kling prompts — the
 * framework's §5 subject and room, or a story scene's camera, setting and
 * people — and changes only the actions the new pose can't support. Lines,
 * deliveries, cues and sections stay exactly as written, and everything is
 * updated in place: no new script, so the clips and their takes stay.
 */

type Project = typeof creativeProjects.$inferSelect;
type Clip = typeof creativeClips.$inferSelect;

const ADDENDUM = `
---

# Re-describing a new frame (Creative Studio)

This video's script is already written, and its clips may already be rendered. The user swapped in a new frame and wants the clips re-made from it with the same script. Your only job:
- Describe the new frame for the Kling prompts, from the image, the way the framework describes a frame (§5): for a one-frame video the subject and the room, plus the shared base and one position per person for two or three people; for a story scene its camera, setting and people, as the story rules describe them. Use the description in use as a guide to the style and level of detail, not to the facts: describe what the new frame shows.
- The lines, deliveries, cues and sections stay exactly as they are. You don't return them.
- Read each listed clip's action against the new frame. Return a new action only for a clip whose action this pose or place can't support (no desk to lean on, standing instead of sitting, no phone in hand…), written as one short physical beat in the spirit of the old one. Leave every other clip out of "actions".
- notes: one or two plain sentences for the user: what's different in the new frame, and any action you changed and why.
`;

const STR = { type: "string" } as const;
const ACTIONS = {
  type: "array",
  items: {
    type: "object",
    additionalProperties: false,
    required: ["clip", "action"],
    properties: { clip: { type: "integer" }, action: STR },
  },
} as const;

const CLASSIC_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["frame", "actions", "notes"],
  properties: { frame: FRAME_SCHEMA, actions: ACTIONS, notes: STR },
} as const;

const SCENES_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["scenes", "actions", "notes"],
  properties: { scenes: { type: "array", items: STORY_SCENE_SCHEMA }, actions: ACTIONS, notes: STR },
} as const;

interface RawAction {
  clip: number;
  action: string;
}
interface RawScene {
  scene: number;
  camera: SceneCamera;
  setting: string;
  people: unknown;
}

const CAMERAS: SceneCamera[] = ["locked", "selfie", "handheld"];

const clipLine = (c: Clip) =>
  `${c.idx + 1}. [${c.kind === "silent" ? "no talking" : c.kind ?? "to_camera"}] action: ${c.action || "(none)"}${c.line ? ` · line: "${c.line}"` : ""}`;

/**
 * Which scene description a new frame takes over: the scene already pointing
 * at it (a story's swap), the scene its clips' takes were made in (a
 * one-scene video whose frame was replaced), or the only scene there is.
 */
export function sceneIndexFor(spec: FrameSpec, frameId: string, clips: Clip[], project: Project): number {
  const scenes = spec.scenes ?? [];
  const direct = scenes.findIndex((s) => s.frameId === frameId);
  if (direct >= 0) return direct;
  const from = new Set(clips.filter((c) => c.frameAssetId === frameId && c.takeFrameId).map((c) => c.takeFrameId as string));
  const viaTakes = scenes.findIndex((s) => from.has(s.frameId));
  if (viaTakes >= 0) return viaTakes;
  const slot = (project.scenes ?? []).findIndex((s) => s.frameId === frameId);
  if (slot >= 0 && slot < scenes.length) return slot;
  return scenes.length === 1 ? 0 : -1;
}

export async function redescribeFrames(project: Project, frameIds: string[]): Promise<{ project: Project; notes: string }> {
  const ids = [...new Set(frameIds)];
  if (ids.length === 0) return { project, notes: "" };
  const [frames, clips, studio] = await Promise.all([framesOf(project.id), clipsOf(project.id), studioById(project.ownerId, project.studioId)]);
  const byId = new Map(frames.map((f) => [f.id, f]));
  const targets = ids.filter((id) => byId.get(id)?.storagePath);
  if (targets.length === 0) throw new Error("That frame is missing. Pick it again.");
  const signed = await signPaths(targets.map((id) => byId.get(id)!.storagePath), 3600);
  const urlOf = (id: string) => signed.get(byId.get(id)!.storagePath!) ?? "";
  if (targets.some((id) => !urlOf(id))) throw new Error("Couldn't read the new frame from storage. Please try again.");

  const firm = firmBrief(studio);
  const system = (base: string) => (firm ? `${withoutNexliSections(base)}${firm}` : base);
  const format = project.format === "vsl_16x9" ? "VSL, 16:9 horizontal" : "ad creative, 9:16 vertical";
  const presenter = presenterLine(presenterOf(project));
  const ask = {
    maxTokens: 8000,
    effort: "medium" as const,
    refusal: "Claude declined to describe the new frame. Try another frame.",
    tooLong: "The description came back too long. Please try again.",
    unreadable: "Claude returned an unreadable description. Please try again.",
  };
  const spec = project.frameSpec;
  let next: FrameSpec;
  let described: string[];
  let raw: { actions?: RawAction[]; notes?: string };

  if (spec?.scenes?.length) {
    // A story (or a one-scene reaction): each new frame takes over its scene's description.
    const jobs = targets.map((frameId) => ({ frameId, i: sceneIndexFor(spec, frameId, clips, project) })).filter((j) => j.i >= 0);
    if (jobs.length === 0) throw new Error("Couldn't tell which scene the new frame belongs to. Rewrite the script for it instead.");
    const content: Anthropic.ContentBlockParam[] = [];
    for (const j of jobs) {
      const old = spec.scenes[j.i];
      content.push(
        { type: "text", text: `Scene ${j.i + 1}, the NEW frame:` },
        { type: "image", source: { type: "url", url: urlOf(j.frameId) } },
        {
          type: "text",
          text: [
            `Description in use (written for the old frame): ${JSON.stringify({
              camera: old.camera,
              setting: old.setting,
              people: old.people.map((p) => ({ position: p.position, presenter: p.presenter, who: p.who, look: p.look, shortName: p.shortName, pronoun: p.pronoun })),
            })}`,
            `Clips in scene ${j.i + 1}:\n${clips.filter((c) => c.frameAssetId === j.frameId).map(clipLine).join("\n") || "(none)"}`,
          ].join("\n"),
        }
      );
    }
    content.push({
      type: "text",
      text: [`Format: ${format}`, presenter, "Re-describe each new frame above (scene numbers as given) and change only the actions it can't support."].filter(Boolean).join("\n\n"),
    });
    const base = `${KLING_FRAMEWORK}\n${STORY_RULES}${project.reaction ? `\n${REACTION_RULES}` : ""}\n${ADDENDUM}`;
    const res = (await askClaude({ system: system(base), content, schema: SCENES_SCHEMA, ...ask })) as { scenes?: RawScene[]; actions?: RawAction[]; notes?: string };
    raw = res;
    const scenes: SceneSpec[] = [...spec.scenes];
    described = [];
    for (const j of jobs) {
      const r = (res.scenes ?? []).find((x) => Math.round(Number(x?.scene)) === j.i + 1) ?? (jobs.length === 1 ? res.scenes?.[0] : undefined);
      if (!r) continue;
      const old = scenes[j.i];
      scenes[j.i] = {
        frameId: j.frameId,
        label: old.label,
        camera: CAMERAS.includes(r.camera) ? r.camera : old.camera,
        setting: (r.setting ?? "").trim() || old.setting,
        people: cleanPeople(r.people),
      };
      described.push(j.frameId);
    }
    if (described.length === 0) throw new Error("Claude didn't describe the new frame. Please try again.");
    // Scene 1 also stands in for the one-frame fields (subject / room).
    const lead = scenes[0].people.find((p) => p.presenter) ?? scenes[0].people[0];
    next = { ...spec, scenes, subject: lead?.look ?? spec.subject, room: scenes[0].setting };
  } else {
    // A one-frame video: the opening frame.
    const frameId = targets[0];
    const multi = isMultiPerson(project.rig);
    const current = spec ?? { subject: "", room: "", base: "", positions: [] };
    const content: Anthropic.ContentBlockParam[] = [
      { type: "image", source: { type: "url", url: urlOf(frameId) } },
      {
        type: "text",
        text: [
          `Format: ${format} · rig: ${RIG_LABEL[project.rig]}${multi ? "" : " (single presenter: base \"\" and positions [])"}`,
          presenter,
          `Frame description in use (written for the old frame): ${JSON.stringify({ subject: current.subject, room: current.room, base: current.base, positions: current.positions })}`,
          `Clips:\n${clips.map(clipLine).join("\n")}`,
          "Re-describe the new frame above and change only the actions it can't support.",
        ]
          .filter(Boolean)
          .join("\n\n"),
      },
    ];
    const res = (await askClaude({ system: system(`${KLING_FRAMEWORK}\n${ADDENDUM}`), content, schema: CLASSIC_SCHEMA, ...ask })) as {
      frame?: FrameSpec;
      actions?: RawAction[];
      notes?: string;
    };
    raw = res;
    const f = res.frame;
    next = {
      ...current,
      subject: f?.subject?.trim() || current.subject,
      room: f?.room?.trim() || current.room,
      base: multi ? f?.base?.trim() ?? current.base : "",
      positions: multi && Array.isArray(f?.positions) && f.positions.length ? f.positions : multi ? current.positions : [],
      describedFrameId: frameId,
    };
    described = [frameId];
  }

  // Actions: only for clips on the frames just described, and only real changes.
  const allowed = new Set(clips.filter((c) => c.frameAssetId && described.includes(c.frameAssetId)).map((c) => c.idx + 1));
  const changed: number[] = [];
  for (const a of raw.actions ?? []) {
    const n = Math.round(Number(a?.clip));
    const clip = clips.find((c) => c.idx + 1 === n);
    const action = (a?.action ?? "").trim().slice(0, 500);
    if (!clip || !allowed.has(n) || !action || action === clip.action) continue;
    await db.update(creativeClips).set({ action, updatedAt: new Date() }).where(eq(creativeClips.id, clip.id));
    changed.push(n);
  }
  const [updated] = await db.update(creativeProjects).set({ frameSpec: next, updatedAt: new Date() }).where(eq(creativeProjects.id, project.id)).returning();
  await rebuildPrompts(updated);
  const notes = [
    (raw.notes ?? "").trim(),
    changed.length ? `New action for clip ${changed.sort((a, b) => a - b).join(", ")} to fit the new frame; every line stays as written.` : "",
  ]
    .filter(Boolean)
    .join(" ");
  return { project: updated, notes };
}
