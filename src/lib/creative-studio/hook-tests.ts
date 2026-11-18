import type Anthropic from "@anthropic-ai/sdk";
import { and, asc, desc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { getSupabase } from "@/lib/supabase";
import {
  creativeAssets,
  creativeHookTakes,
  creativeHookTests,
  creativeProjects,
  type ClipFields,
} from "@/lib/creative-studio/tables";
import { KLING_FRAMEWORK, STORY_RULES } from "@/lib/creative-studio/rules.generated";
import { withoutNexliSections } from "@/lib/creative-studio/framework-sections";
import { askClaude } from "@/lib/creative-studio/script";
import { clipDuration, isStory, presenterOf, sceneFor } from "@/lib/creative-studio/prompts";
import { clipFieldsOf, clipsOf, derivedClip, framesOf } from "@/lib/creative-studio/service";
import { CREATIVE_BUCKET, ensureCreativeBucket, removePaths, signPaths } from "@/lib/creative-studio/storage";
import { firmBrief, studioById, type Studio } from "@/lib/creative-studio/studios";
import { sourceTranscriptLines } from "@/lib/creative-studio/reaction-shared";
import { klingFrameUrl } from "@/lib/creative-studio/render";
import { credits, KlingToolError, queryTask, submitClip, uuidv7 } from "@/lib/creative-studio/kling-mcp";
import { avatarElementFor, avatarOnScreen } from "@/lib/creative-studio/avatar-kling";
import {
  HOOK_CREDITS_PER_SECOND,
  HOOK_KIND_IDS,
  HOOK_KINDS,
  HOOK_MAX_WORDS,
  HOOK_UPLOAD_TYPES,
  hookClipFields,
  hookFrameId,
  hookSpan,
  wordCountOf,
  type HookBasis,
  type HookIdea,
  type HookIdeaView,
  type HookKind,
  type HookRead,
  type HookTestRow,
  type HookTestView,
} from "@/lib/creative-studio/hook-shared";

/**
 * Hook Tester, server side: read the video (a video made here from its
 * script, a dropped-in one from stills and its words), have Claude write the
 * three hooks most worth testing, and — for a video made here — make each
 * hook's clip on Kling from the video's own frame.
 */

type Project = typeof creativeProjects.$inferSelect;
type Test = typeof creativeHookTests.$inferSelect;
type Take = typeof creativeHookTakes.$inferSelect;

/** A problem to show the user as-is. */
export class HookError extends Error {
  constructor(
    message: string,
    public status = 400,
    public needsKling = false
  ) {
    super(message);
  }
}

const CLAIM_STALE_MS = 320_000;
/** A take still "draft" after this long never reached Kling (its request died): it reads as failed, so it can be sent again. */
const DRAFT_STALE_MS = 360_000;
const draftLive = (t: Pick<Take, "status" | "createdAt">) => t.status === "draft" && Date.now() - t.createdAt.getTime() < DRAFT_STALE_MS;
const MAX_HOOKS = 9;
const uuidRe = /^[0-9a-f-]{36}$/i;

// ── Loading ────────────────────────────────────────────────

export async function loadTest(ownerId: string, id: string): Promise<Test | null> {
  if (!uuidRe.test(id)) return null;
  const [t] = await db
    .select()
    .from(creativeHookTests)
    .where(and(eq(creativeHookTests.id, id), eq(creativeHookTests.ownerId, ownerId)))
    .limit(1);
  return t ?? null;
}

async function projectOf(test: Pick<Test, "ownerId" | "projectId">): Promise<Project | null> {
  if (!test.projectId) return null;
  const [p] = await db
    .select()
    .from(creativeProjects)
    .where(and(eq(creativeProjects.id, test.projectId), eq(creativeProjects.ownerId, test.ownerId)))
    .limit(1);
  return p ?? null;
}

/** The newest take per hook. */
async function takesOf(testId: string): Promise<Map<string, Take>> {
  const rows = await db.select().from(creativeHookTakes).where(eq(creativeHookTakes.testId, testId)).orderBy(asc(creativeHookTakes.createdAt));
  const by = new Map<string, Take>();
  for (const r of rows) by.set(r.hookId, r);
  return by;
}

const uploadPrefix = (ownerId: string) => `hooks/${ownerId}/`;
const framesPrefix = (t: Pick<Test, "ownerId" | "id">) => `hooks/${t.ownerId}/${t.id}/frames`;

// ── Starting a test ────────────────────────────────────────

/** A hook test on a video made in this studio. */
export async function createProjectTest(ownerId: string, actorId: string, studio: Studio, projectId: string): Promise<Test> {
  if (!uuidRe.test(projectId)) throw new HookError("Pick a video from this studio.");
  const [project] = await db
    .select()
    .from(creativeProjects)
    .where(and(eq(creativeProjects.id, projectId), eq(creativeProjects.ownerId, ownerId)))
    .limit(1);
  if (!project || (project.studioId ?? null) !== studio.id) throw new HookError("Pick a video from this studio.", 404);
  const clips = await clipsOf(project.id);
  if (clips.length < 2) throw new HookError("That video has no script yet. Write its script first.");
  if (clips[0].kind === "silent") throw new HookError("That video opens with a shot with no talking, so it has no spoken hook to swap.");
  const [row] = await db
    .insert(creativeHookTests)
    .values({ ownerId, createdBy: actorId, studioId: studio.id, source: "project", projectId: project.id, title: project.title })
    .returning();
  return row;
}

/** A hook test on a video dropped in (already uploaded to `path`). */
export async function createUploadTest(
  ownerId: string,
  actorId: string,
  studio: Studio,
  upload: { path: string; mime: string; filename: string; size: number | null }
): Promise<Test> {
  const ext = HOOK_UPLOAD_TYPES[upload.mime];
  const shape = new RegExp(`^${uploadPrefix(ownerId).replace(/[/]/g, "\\/")}[0-9a-f-]{36}\\.(mp4|mov)$`, "i");
  if (!ext || !shape.test(upload.path)) throw new HookError("Upload an MP4 or MOV video.");
  const title = upload.filename.replace(/\.[a-z0-9]{2,5}$/i, "").replace(/[_-]+/g, " ").trim().slice(0, 120) || "Dropped-in video";
  const [row] = await db
    .insert(creativeHookTests)
    .values({
      ownerId,
      createdBy: actorId,
      studioId: studio.id,
      source: "upload",
      title,
      upload: { path: upload.path, mime: upload.mime, filename: upload.filename.slice(0, 200), sizeBytes: upload.size },
    })
    .returning();
  return row;
}

// ── Writing the hooks ──────────────────────────────────────

const STR = { type: "string" } as const;
const HOOK_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["read", "hooks"],
  properties: {
    read: {
      type: "object",
      additionalProperties: false,
      required: ["summary", "currentHook", "said", "kind", "replaces", "hookEndS", "notes"],
      properties: {
        summary: STR,
        currentHook: STR,
        said: STR,
        kind: { type: "string", enum: [...HOOK_KIND_IDS, "none"] },
        replaces: { type: "integer" },
        hookEndS: { type: "number" },
        notes: STR,
      },
    },
    hooks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "line", "register", "action", "cues", "editNote", "title", "why", "evidence"],
        properties: {
          kind: { type: "string", enum: HOOK_KIND_IDS },
          line: STR,
          register: STR,
          action: STR,
          cues: STR,
          editNote: STR,
          title: STR,
          why: STR,
          evidence: { type: "array", items: STR },
        },
      },
    },
  },
} as const;

const HOOK_RULES = `
---

# Hook test (the portal's Hook Tester)

The user has a video and wants to test new openings for it. Your one job: write the hooks most worth testing against the hook it has now, best first. A hook here is the video's first clip: one spoken line (22 words or fewer, about 4 to 9 seconds), said by the same presenter, that takes the place of the current hook and leads straight into the next line, which stays exactly as it is.

Rules for the hooks
- Each one is a different kind of opening, not the same idea in new words. Kinds: ${HOOK_KIND_IDS.map((k) => `${k} (${HOOK_KINDS[k].toLowerCase()})`).join(", ")}. Say which kind each is, and don't use a kind twice unless the user asks for it.
- Earn the first three seconds: the audience and the tension land in the first few words. No warm-up ("Hey", "So", "Let me tell you"), no greeting, no name.
- Keep the video's promise. The hook has to set up what the rest of the video actually says and run into the next line as if it had always been there. Don't spend the body's best line or its numbers unless the body still works after it.
- The current hook is the control in this test: don't restate its idea.
- Every standing rule in §1 applies to the line (C-P-A with hyphens and its cue, dollar figures as digits, no guarantees, no savior positioning, nothing unverifiable). Use only facts and numbers that are in the script, the brief, the video or the offer facts.
- register, action, cues and editNote follow §4 and §6. The action is one small beat the pose in the frame can support.
- title: the on-screen title that would go with this hook: 2 to 6 words, 36 characters or fewer, a distillation, never the spoken words.
- why: one or two plain sentences on why this is worth testing against the current hook. When evidence is given (the user's own ad results, or long-running ads in the niche), ground the reason in it and list the refs you used in evidence (for example "A3", "N2"). Never invent a number. With no evidence, say it's judged on craft and leave evidence empty.

The read
- summary: one sentence on what the video is about and who it's for.
- currentHook: what the hook now does and its main weakness, in one or two plain sentences. Blunt. No praise words.
- said: the current hook's words. kind: what kind of hook it is, or "none".
- replaces: for a video made in the studio, how many clips at the start make up the current hook (usually 1; 2 when it's split over two clips). For a dropped-in video, 0.
- hookEndS: for a dropped-in video, the second its current hook ends at. Otherwise 0.
- notes: anything the user should know before making these (a line that leans on a claim, a hook that needs the next line reworded). Empty when there's nothing.
`;

interface RawHooks {
  read?: Partial<HookRead> & { kind?: string };
  hooks?: { kind?: string; line?: string; register?: string; action?: string; cues?: string; editNote?: string; title?: string; why?: string; evidence?: string[] }[];
}

const kindOf = (v: unknown): HookKind => (HOOK_KIND_IDS.includes(v as HookKind) ? (v as HookKind) : "pain");
const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

/** What the hooks can lean on: his ad results and the niche (Nexli's studio only; a client firm's hooks are judged on craft). */
async function evidenceFor(ownerId: string, studio: Studio): Promise<(HookBasis & { text: string }) | null> {
  if (studio.id !== null) return null;
  try {
    const [{ metaAdAccountId }, { ensureAdsTables }, { hookEvidence }] = await Promise.all([import("@/lib/meta-ads"), import("@/lib/ads/tables"), import("@/lib/ads/grader")]);
    const accountId = metaAdAccountId();
    if (!accountId) return null;
    await ensureAdsTables();
    const found = await Promise.race([hookEvidence(ownerId, accountId), new Promise<null>((r) => setTimeout(() => r(null), 35_000))]);
    return found ? { judged: found.judged, market: found.market, researchAgeDays: found.researchAgeDays, refs: found.refs, text: found.text } : null;
  } catch (err) {
    console.error("[creative-studio] hook evidence failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

interface Ask {
  system: string;
  content: Anthropic.ContentBlockParam[];
  /** Section names of the video's clips (a video made here), for the hook's span. */
  sections: string[] | null;
}

/** What Claude reads for a video made here: its frame, its brief and its script. */
async function askForProject(project: Project, studio: Studio): Promise<Ask> {
  const [clips, frames] = await Promise.all([clipsOf(project.id), framesOf(project.id)]);
  if (clips.length < 2) throw new HookError("That video has no script yet.");
  const first = clips[0];
  // Claude looks at the frame Kling will be given.
  const frameId = hookFrameId(first, frames.map((f) => f.id), project.frameSpec);
  const frame = frames.find((f) => f.id === frameId) ?? frames[0];
  const signed = await signPaths([frame?.storagePath], 2 * 3600);
  const url = frame?.storagePath ? signed.get(frame.storagePath) : undefined;
  const story = isStory(project.frameSpec);
  const b = project.brief;
  const presenter = presenterOf(project);
  const scene = story && project.frameSpec ? sceneFor(project.frameSpec, { frameId: first.frameAssetId }) : null;
  const script = clips.map((c, i) => `${i + 1}. [${c.section}${c.speaker ? ` · ${c.speaker}` : ""}${c.kind && c.kind !== "to_camera" ? ` · ${c.kind}` : ""}] ${c.kind === "silent" ? `(no talking) ${c.action}` : c.line}`).join("\n");
  const text = [
    `A video made in the studio: "${project.title}" (${project.format === "vsl_16x9" ? "VSL, 16:9 horizontal" : "ad creative, 9:16 vertical"}).`,
    b.direction?.trim()
      ? `What the user wanted this video to be, in their words:\n${b.direction.trim()}`
      : [`Old belief: ${b.oldBelief || "(not given)"}`, `New belief: ${b.newBelief || "(not given)"}`, `Proof or math: ${b.proof || "(none given)"}`, `CTA: ${b.cta || "(not given)"}`].join("\n"),
    `The presenter: ${presenter.name || "the presenter"}. The hook is said ${first.speaker ? `by the person on the ${first.speaker}` : "to camera"}, from the frame attached (the same frame the current hook was made from).`,
    scene
      ? `That scene, as it's described: ${JSON.stringify({ camera: scene.camera, setting: scene.setting, people: scene.people })}`
      : `Frame description in use:\nSubject: ${project.frameSpec?.subject ?? ""}\nRoom: ${project.frameSpec?.room ?? ""}`,
    `The script as it is:\n${script}`,
    `The hook now is the start of that script. Everything after the hook stays word for word, so each new hook must lead into the first line that's kept.`,
  ].join("\n\n");
  const base = `${KLING_FRAMEWORK}\n${story ? `${STORY_RULES}\n` : ""}${HOOK_RULES}`;
  const firm = firmBrief(studio);
  return {
    system: firm ? `${withoutNexliSections(base)}${firm}` : base,
    content: [...(url ? [{ type: "image" as const, source: { type: "url" as const, url } }] : []), { type: "text", text }],
    sections: clips.map((c) => c.section),
  };
}

/** What Claude reads for a dropped-in video: stills with their times, and every word with its time. */
async function askForUpload(test: Test, studio: Studio): Promise<Ask> {
  const m = test.media;
  if (!m) throw new HookError("The video hasn't been watched yet.");
  // The hook's own stills, a few through the middle, and the end.
  const hook = m.frames.filter((f) => f.role === "hook");
  const rest = m.frames.filter((f) => f.role !== "hook");
  const pick = [...hook.filter((_, i) => i % 2 === 0 || hook.length <= 4), ...rest].slice(0, 9);
  const signed = await signPaths(pick.map((f) => f.path), 2 * 3600);
  const blocks: Anthropic.ContentBlockParam[] = [];
  for (const f of pick) {
    const url = signed.get(f.path);
    if (!url) continue;
    blocks.push({ type: "text", text: `Still at ${f.t} s:` }, { type: "image", source: { type: "url", url } });
  }
  const lines = sourceTranscriptLines(m.words);
  const text = [
    `A video the user dropped in: "${test.title}". It wasn't made in the studio, so you only have what's below: stills from it and what's said in it.`,
    `${m.width ?? "?"}×${m.height ?? "?"}, ${m.durationS ?? "?"} seconds${m.hasAudio ? "" : ", no sound"}.`,
    m.firstWordAt !== null ? `First word at ${m.firstWordAt} s. Said in the first 3 seconds: "${m.hookWords || "—"}".` : "No words in the first 3 seconds.",
    lines.length ? `What's said, with times:\n${lines.join("\n").slice(0, 7000)}` : "No words could be heard in it. Judge the hook from the stills.",
    `The user will re-make this video in the studio with one of your hooks. Each hook is written for a presenter talking to camera and has to lead into what the video says right after its current hook.`,
  ].join("\n\n");
  const base = `${KLING_FRAMEWORK}\n${HOOK_RULES}`;
  const firm = firmBrief(studio);
  return { system: firm ? `${withoutNexliSections(base)}${firm}` : base, content: [...blocks, { type: "text", text }], sections: null };
}

/** One round of hooks from Claude, cleaned up. One retry when a line is too long to be one clip. */
async function writeHooks(
  ask: Ask,
  o: { want: number; evidence: (HookBasis & { text: string }) | null; avoid: string[]; note: string | null; rewriting: HookIdea | null }
): Promise<{ read: HookRead; hooks: Omit<HookIdea, "id" | "rank">[] }> {
  const tail = [
    o.evidence ? `EVIDENCE (cite by ref)\n${o.evidence.text}` : "No evidence is available for this studio. Judge on craft.",
    o.avoid.length ? `Already on the table (don't repeat these or their ideas):\n${o.avoid.map((l) => `- ${l}`).join("\n")}` : "",
    o.rewriting ? `Rewrite this one hook only: "${o.rewriting.line}" (${o.rewriting.kind}). Return exactly 1 hook.` : `Return exactly ${o.want} hook${o.want === 1 ? "" : "s"}, best first.`,
    o.note ? `What the user asked for: ${o.note}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  let complaint = "";
  for (let attempt = 0; ; attempt++) {
    const raw = (await askClaude({
      system: ask.system,
      content: [...ask.content, { type: "text", text: complaint ? `${tail}\n\n${complaint}` : tail }],
      schema: HOOK_SCHEMA,
      maxTokens: 6_000,
      effort: "high",
      refusal: "Claude declined to write hooks for this video. Try a note on what you want.",
      tooLong: "The hooks came back too long. Please try again.",
      unreadable: "Claude returned something unreadable. Please try again.",
    })) as RawHooks;
    const refs = new Set(Object.keys(o.evidence?.refs ?? {}));
    const seen = new Set<string>();
    const hooks = (raw.hooks ?? [])
      .map((h) => ({
        kind: kindOf(h.kind),
        line: clean(h.line, 400),
        register: clean(h.register, 200),
        action: clean(h.action, 300),
        cues: clean(h.cues, 600),
        editNote: clean(h.editNote, 300),
        title: clean(h.title, 60),
        why: clean(h.why, 600),
        // Stored as what each ref stands for, so a later round's numbering can't change what an older hook cites.
        evidence: [...new Set((h.evidence ?? []).map((e) => clean(e, 8).toUpperCase()).filter((e) => refs.has(e)))].slice(0, 4).map((e) => o.evidence?.refs[e] ?? e),
      }))
      .filter((h) => {
        const key = h.line.toLowerCase();
        if (!h.line || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, o.want);
    if (hooks.length === 0) throw new HookError("Claude returned no hooks. Please try again.", 502);
    const long = hooks.filter((h) => wordCountOf(h.line) > HOOK_MAX_WORDS);
    if (long.length && attempt === 0) {
      complaint = `Your last answer had ${long.length === 1 ? "a hook" : "hooks"} too long to be one clip (${long.map((h) => `${wordCountOf(h.line)} words`).join(", ")}). Every hook is 22 words or fewer.`;
      continue;
    }
    const r = raw.read ?? {};
    return {
      read: {
        summary: clean(r.summary, 400),
        currentHook: clean(r.currentHook, 600),
        said: clean(r.said, 400),
        kind: r.kind === "none" ? "none" : kindOf(r.kind),
        replaces: ask.sections ? hookSpan(ask.sections, typeof r.replaces === "number" ? r.replaces : null) : 0,
        hookEndS: ask.sections ? null : typeof r.hookEndS === "number" && r.hookEndS > 0 ? Math.round(r.hookEndS * 10) / 10 : null,
        notes: clean(r.notes, 600),
      },
      hooks: hooks.filter((h) => wordCountOf(h.line) <= HOOK_MAX_WORDS + 4),
    };
  }
}

/** Hooks that already cost something (a clip on Kling, or a video made): a rewrite leaves them alone. */
function keptIds(hooks: HookIdea[], takes: Map<string, Take>): Set<string> {
  return new Set(hooks.filter((h) => h.projectId || ["rendering", "done"].includes(takes.get(h.id)?.status ?? "")).map((h) => h.id));
}

/**
 * The hooks after a round of writing. A rewrite of one hook swaps it in
 * place (same rank). A new round leads with the fresh hooks, ranked 1 to 3;
 * hooks already made (a clip or a video) follow as "earlier rounds" (rank 0),
 * and the rest are dropped.
 */
export function mergeHooks(existing: HookIdea[], kept: Set<string>, rewritingId: string | null, fresh: Omit<HookIdea, "id" | "rank">[], uuid: () => string): HookIdea[] {
  const old = rewritingId ? existing.find((h) => h.id === rewritingId) : null;
  if (old) return fresh[0] ? existing.map((h) => (h.id === old.id ? { ...fresh[0], id: uuid(), rank: old.rank } : h)) : existing;
  return [...fresh.map((h, i) => ({ ...h, id: uuid(), rank: i + 1 })), ...existing.filter((h) => kept.has(h.id)).map((h) => ({ ...h, rank: 0 }))].slice(0, MAX_HOOKS);
}

/**
 * Carry a test forward: watch a dropped-in video (once), then write the
 * hooks. One request at a time (a claim); a second caller gets the row as it
 * stands. Failures land on the row, so the page can show them and retry.
 */
export async function advanceTest(test: Test, deadline: number): Promise<Test> {
  if (test.status === "ready" || test.status === "failed") return test;
  const [mine] = await db
    .update(creativeHookTests)
    .set({ claimedAt: new Date(), status: "reading", updatedAt: new Date() })
    .where(
      and(
        eq(creativeHookTests.id, test.id),
        inArray(creativeHookTests.status, ["new", "reading"]),
        or(isNull(creativeHookTests.claimedAt), lt(creativeHookTests.claimedAt, new Date(Date.now() - CLAIM_STALE_MS)))
      )
    )
    .returning();
  if (!mine) return (await loadTest(test.ownerId, test.id)) ?? test;
  let row = mine;
  try {
    const studio = await studioById(row.ownerId, row.studioId);
    if (row.source === "upload" && !row.media) {
      if (!row.upload) throw new HookError("The video file is missing. Drop it in again.");
      const signed = await signPaths([row.upload.path], 3600);
      const url = signed.get(row.upload.path);
      if (!url) throw new HookError("The video file is missing. Drop it in again.");
      const { watchVideo } = await import("@/lib/ads/grader-media");
      const media = await watchVideo(url, framesPrefix(row), { deadline: deadline - 100_000 });
      [row] = await db.update(creativeHookTests).set({ media, updatedAt: new Date() }).where(eq(creativeHookTests.id, row.id)).returning();
    }
    const project = row.source === "project" ? await projectOf(row) : null;
    if (row.source === "project" && !project) throw new HookError("The original video was deleted.", 404);
    const [ask, evidence, takes] = await Promise.all([project ? askForProject(project, studio) : askForUpload(row, studio), evidenceFor(row.ownerId, studio), takesOf(row.id)]);
    const kept = keptIds(row.hooks, takes);
    const rewriting = row.noteHookId ? row.hooks.find((h) => h.id === row.noteHookId && !kept.has(h.id)) ?? null : null;
    const out = await writeHooks(ask, {
      want: rewriting ? 1 : 3,
      evidence,
      avoid: row.hooks.map((h) => h.line),
      note: row.note,
      rewriting,
    });
    const hooks = mergeHooks(row.hooks, kept, rewriting?.id ?? null, out.hooks, () => crypto.randomUUID());
    const basis: HookBasis = evidence ? { judged: evidence.judged, market: evidence.market, researchAgeDays: evidence.researchAgeDays, refs: evidence.refs } : { judged: 0, market: 0, researchAgeDays: null, refs: {} };
    // The span of the current hook is fixed once a clip has been made for it.
    // (And a rewrite of one hook leaves the read of the video as it was.)
    const read = rewriting && row.read ? row.read : row.read && kept.size ? { ...out.read, replaces: row.read.replaces } : out.read;
    [row] = await db
      .update(creativeHookTests)
      .set({ read, hooks, basis, status: "ready", error: null, claimedAt: null, noteHookId: null, updatedAt: new Date() })
      .where(eq(creativeHookTests.id, row.id))
      .returning();
    return row;
  } catch (err) {
    const { MediaError } = await import("@/lib/ads/grader-media");
    const known = err instanceof HookError || err instanceof MediaError;
    if (!known) console.error("[creative-studio] hook test failed:", err instanceof Error ? err.message : err);
    const message = err instanceof Error && (known || /Claude|try again/i.test(err.message)) ? err.message : "Writing the hooks failed. Try again.";
    // A round that fails after hooks exist keeps them (the page shows the error over them).
    const [failed] = await db
      .update(creativeHookTests)
      .set({ status: row.hooks.length ? "ready" : "failed", error: message.slice(0, 500), claimedAt: null, noteHookId: null, updatedAt: new Date() })
      .where(eq(creativeHookTests.id, row.id))
      .returning();
    return failed ?? row;
  }
}

/** Ask for new hooks (all that have no clip yet, or just one), optionally with a note. */
export async function askAgain(test: Test, note: string, hookId: string | null): Promise<Test> {
  if (test.status === "reading" && test.claimedAt && Date.now() - test.claimedAt.getTime() < CLAIM_STALE_MS) throw new HookError("Claude is still writing. Give it a moment.", 409);
  if (hookId) {
    const takes = await takesOf(test.id);
    if (!test.hooks.some((h) => h.id === hookId)) throw new HookError("That hook isn't in this test.", 404);
    if (keptIds(test.hooks, takes).has(hookId)) throw new HookError("That hook already has a clip. Ask for new hooks instead.", 409);
  }
  const [row] = await db
    .update(creativeHookTests)
    .set({ status: "new", note: note.trim().slice(0, 600) || null, noteHookId: hookId, error: null, claimedAt: null, updatedAt: new Date() })
    .where(eq(creativeHookTests.id, test.id))
    .returning();
  return row;
}

// ── Kling: the hook clips ──────────────────────────────────

const isModeration = (m: string) => /disallowed|moderation|content polic|sensitive|violat/i.test(m);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface HookSubmitReport {
  submitted: number;
  failed: number;
  creditsNeeded: number;
  creditsRemaining: number | null;
  message: string | null;
}

/** The video a hook clip is made for, checked: it still exists and every clip is rendered. */
async function readyProject(test: Test): Promise<Project> {
  if (test.source !== "project") throw new HookError("Kling makes hook clips for videos made in the studio. For a dropped-in video, re-make it with the hook.");
  const project = await projectOf(test);
  if (!project) throw new HookError("The original video was deleted.", 404);
  return project;
}

/** Make the chosen hooks' clips on Kling, from the frame the video's own hook was made from. */
export async function submitTakes(token: string, test: Test, hookIds: string[]): Promise<HookSubmitReport> {
  const project = await readyProject(test);
  const [clips, frames, existing] = await Promise.all([clipsOf(project.id), framesOf(project.id), takesOf(test.id)]);
  const first = clips[0];
  if (!first) throw new HookError("That video has no script.");
  // The frame the original's hook was made from, so the new clip matches the clips kept after it.
  const frameId = hookFrameId(first, frames.map((f) => f.id), project.frameSpec);
  if (!frameId) throw new HookError("That video has no opening frame.");
  // Not twice: a hook with a clip, one rendering, or one being sent right now (a double tap) is left alone.
  const chosen = test.hooks.filter((h) => {
    const t = existing.get(h.id);
    return hookIds.includes(h.id) && !h.projectId && !(t && (["rendering", "done"].includes(t.status) || draftLive(t)));
  });
  if (chosen.length === 0) throw new HookError("Pick at least one hook that doesn't have a clip yet.");
  const firstFields = clipFieldsOf(first);
  const planned = chosen.map((h) => {
    const fields: ClipFields = hookClipFields(firstFields, h);
    return { hook: h, fields, ...derivedClip(project, fields) };
  });
  const report: HookSubmitReport = { submitted: 0, failed: 0, creditsNeeded: planned.reduce((s, p) => s + p.durationS * HOOK_CREDITS_PER_SECOND, 0), creditsRemaining: null, message: null };
  try {
    report.creditsRemaining = (await credits(token)).remaining;
  } catch {
    report.creditsRemaining = null; // unknown: Kling itself refuses if short
  }
  if (report.creditsRemaining !== null && report.creditsNeeded > report.creditsRemaining) {
    throw new HookError(`These clips need about ${report.creditsNeeded.toLocaleString("en-US")} Kling credits and your balance is ${report.creditsRemaining.toLocaleString("en-US")}. Pick fewer hooks or top up.`, 402);
  }
  const element = await avatarElementFor(token, project).catch(() => null);
  const taskTraceId = uuidv7();
  let stop = false;
  for (const p of planned) {
    if (stop) break;
    const [take] = await db
      .insert(creativeHookTakes)
      .values({ testId: test.id, hookId: p.hook.id, fields: p.fields, durationS: p.durationS, prompt: p.prompt, model: p.model, frameAssetId: frameId, status: "draft" })
      .returning();
    let attempt = 0;
    while (true) {
      try {
        const frameUrl = await klingFrameUrl(token, frameId, taskTraceId);
        const { generationId, model } = await submitClip(token, {
          multiPerson: p.model === "kling-video-v3_0_omni",
          aspectRatio: project.format === "vsl_16x9" ? "16:9" : "9:16",
          prompt: p.prompt,
          durationS: p.durationS,
          frameUrl,
          taskTraceId,
          ...(element && avatarOnScreen(project.frameSpec, { kind: p.fields.kind ?? "to_camera", frameAssetId: frameId }) ? { element } : {}),
          rationale: `Nexli Creative Studio: an alternative opening line for the approved script "${project.title}", rendered with native audio as the framework specifies, to test against the current hook.`,
        });
        await db.update(creativeHookTakes).set({ status: "rendering", klingTaskId: generationId, model, error: null, updatedAt: new Date() }).where(eq(creativeHookTakes.id, take.id));
        report.submitted++;
        break;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (err instanceof KlingToolError && err.kind === "rate_limited" && attempt === 0) {
          attempt++;
          await sleep(60_000); // framework: wait 60 s, resend once
          continue;
        }
        if (err instanceof KlingToolError && (err.kind === "rate_limited" || err.kind === "auth")) {
          await db.delete(creativeHookTakes).where(eq(creativeHookTakes.id, take.id));
          if (err.kind === "auth") throw new HookError(message, 400, true);
          report.message = "Kling is rate-limiting. Try the rest again in a minute.";
          stop = true;
        } else if (/insufficient|credits? (are )?not enough|top up/i.test(message)) {
          await db.delete(creativeHookTakes).where(eq(creativeHookTakes.id, take.id));
          report.message = `Kling: ${message}`;
          stop = true;
        } else {
          await db
            .update(creativeHookTakes)
            .set({ status: isModeration(message) ? "blocked" : "failed", error: message.slice(0, 500), updatedAt: new Date() })
            .where(eq(creativeHookTakes.id, take.id));
          report.failed++;
        }
        break;
      }
    }
  }
  return report;
}

/** Check the hook clips on Kling and store the finished ones. Returns how many are still rendering. */
export async function pollTakes(token: string, test: Test): Promise<number> {
  const rendering = await db
    .select()
    .from(creativeHookTakes)
    .where(and(eq(creativeHookTakes.testId, test.id), eq(creativeHookTakes.status, "rendering")));
  if (rendering.length === 0) return 0;
  const project = await projectOf(test);
  let left = rendering.length;
  for (const take of rendering) {
    if (!take.klingTaskId) continue;
    let state;
    try {
      state = await queryTask(token, take.klingTaskId);
    } catch (err) {
      if (err instanceof KlingToolError && err.kind === "auth") throw new HookError(err.message, 400, true);
      console.error("[creative-studio] hook take query failed:", err instanceof Error ? err.message : err);
      continue;
    }
    if (state.state === "running") continue;
    if (state.state === "failed") {
      await db
        .update(creativeHookTakes)
        .set({ status: isModeration(state.error) ? "blocked" : "failed", error: state.error.slice(0, 500), updatedAt: new Date() })
        .where(eq(creativeHookTakes.id, take.id));
      left--;
      continue;
    }
    try {
      if (!project) throw new Error("the original video was deleted");
      const res = await fetch(state.videoUrl);
      if (!res.ok) throw new Error(`download ${res.status}`);
      const bytes = Buffer.from(await res.arrayBuffer());
      await ensureCreativeBucket();
      // Stored with the original video, so deleting that video cleans these up too.
      const path = `${project.id}/hooks/${test.id}/${take.id}.mp4`;
      const { error } = await getSupabase().storage.from(CREATIVE_BUCKET).upload(path, bytes, { contentType: "video/mp4", upsert: true });
      if (error) throw new Error(error.message);
      const [asset] = await db
        .insert(creativeAssets)
        .values({
          projectId: project.id,
          kind: "hook_take",
          storagePath: path,
          mime: "video/mp4",
          durationMs: take.durationS * 1000,
          source: "kling",
          providerTaskId: take.klingTaskId,
          metadata: { testId: test.id, hookId: take.hookId, takeId: take.id },
        })
        .returning({ id: creativeAssets.id });
      await db.update(creativeHookTakes).set({ status: "done", videoAssetId: asset.id, error: null, updatedAt: new Date() }).where(eq(creativeHookTakes.id, take.id));
      left--;
    } catch (err) {
      console.error("[creative-studio] storing hook take failed:", err instanceof Error ? err.message : err);
    }
  }
  return Math.max(0, left);
}

// ── What the page shows ────────────────────────────────────

/** The best video of a project to play: final render > final cut > auto-cut > the first clip. */
async function projectVideoPath(projectId: string): Promise<string | null> {
  const RANK: Record<string, number> = { render: 0, final_cut: 1, rough_cut: 2 };
  const rows = await db
    .select({ kind: creativeAssets.kind, path: creativeAssets.storagePath })
    .from(creativeAssets)
    .where(and(eq(creativeAssets.projectId, projectId), inArray(creativeAssets.kind, ["render", "final_cut", "rough_cut"])))
    .orderBy(desc(creativeAssets.createdAt));
  const best = rows.filter((r) => r.path).sort((a, b) => (RANK[a.kind] ?? 9) - (RANK[b.kind] ?? 9))[0];
  if (best?.path) return best.path;
  const clips = await clipsOf(projectId);
  const id = clips.find((c) => c.videoAssetId)?.videoAssetId;
  if (!id) return null;
  const [a] = await db.select({ path: creativeAssets.storagePath }).from(creativeAssets).where(eq(creativeAssets.id, id)).limit(1);
  return a?.path ?? null;
}

export async function testView(test: Test): Promise<HookTestView> {
  const [project, takes] = await Promise.all([projectOf(test), takesOf(test.id)]);
  const [clips, frames] = project ? await Promise.all([clipsOf(project.id), framesOf(project.id)]) : [[], []];
  const hookFrame = project && clips[0] ? frames.find((f) => f.id === hookFrameId(clips[0], frames.map((f) => f.id), project.frameSpec)) : undefined;
  const takeAssets = [...takes.values()].map((t) => t.videoAssetId).filter((v): v is string => Boolean(v));
  const madeIds = test.hooks.map((h) => h.projectId).filter((v): v is string => Boolean(v));
  const [assets, made, sourcePath] = await Promise.all([
    takeAssets.length ? db.select({ id: creativeAssets.id, path: creativeAssets.storagePath }).from(creativeAssets).where(inArray(creativeAssets.id, takeAssets)) : Promise.resolve([]),
    madeIds.length
      ? db
          .select({ id: creativeProjects.id, title: creativeProjects.title })
          .from(creativeProjects)
          .where(and(inArray(creativeProjects.id, madeIds), eq(creativeProjects.ownerId, test.ownerId)))
      : Promise.resolve([]),
    project ? projectVideoPath(project.id) : Promise.resolve(test.upload?.path ?? null),
  ]);
  const pathOf = new Map(assets.map((a) => [a.id, a.path]));
  const signed = await signPaths([sourcePath, hookFrame?.storagePath, ...assets.map((a) => a.path)], 6 * 3600);
  const titleOf = new Map(made.map((m) => [m.id, m.title]));
  const m = test.media;
  const hooks: HookIdeaView[] = test.hooks.map((h) => {
    const take = takes.get(h.id) ?? null;
    const durationS = take?.durationS ?? clipDuration(h.line);
    const path = take?.videoAssetId ? pathOf.get(take.videoAssetId) : null;
    return {
      ...h,
      durationS,
      credits: durationS * HOOK_CREDITS_PER_SECOND,
      take: take
        ? take.status === "draft" && !draftLive(take)
          ? { status: "failed", videoUrl: null, error: "It never reached Kling. Try again.", durationS: take.durationS }
          : { status: take.status, videoUrl: path ? signed.get(path) ?? null : null, error: take.error, durationS: take.durationS }
        : null,
      video: h.projectId && titleOf.has(h.projectId) ? { id: h.projectId, title: titleOf.get(h.projectId) as string } : null,
    };
  });
  const span = project && clips.length ? hookSpan(clips.map((c) => c.section), test.read?.replaces ?? null) : 0;
  return {
    id: test.id,
    title: test.title,
    source: test.source,
    // A reading whose request died reads as waiting, so the page picks it up again.
    status: test.status === "reading" && test.claimedAt && Date.now() - test.claimedAt.getTime() > CLAIM_STALE_MS ? "new" : test.status,
    error: test.error,
    note: test.note,
    createdAt: test.createdAt.toISOString(),
    video: {
      url: sourcePath ? signed.get(sourcePath) ?? null : null,
      vertical: project ? project.format !== "vsl_16x9" : !(m?.width && m?.height) || m.height >= m.width,
      durationS: m?.durationS ?? null,
    },
    project:
      test.source === "project"
        ? {
            id: test.projectId ?? "",
            title: project?.title ?? test.title,
            exists: Boolean(project),
            ready: Boolean(project) && clips.length > 1 && clips.every((c) => c.status === "done" && c.videoAssetId),
            frameUrl: hookFrame?.storagePath ? signed.get(hookFrame.storagePath) ?? null : null,
          }
        : null,
    read: test.read,
    basis: test.basis,
    hooks,
    replacing: span ? { lines: clips.slice(0, span).map((c) => c.line), next: clips[span]?.line ?? null } : null,
  };
}

/** The studio's hook tests, newest first. */
export async function listTests(ownerId: string, studio: Studio): Promise<HookTestRow[]> {
  const rows = await db
    .select()
    .from(creativeHookTests)
    .where(and(eq(creativeHookTests.ownerId, ownerId), studio.id ? eq(creativeHookTests.studioId, studio.id) : isNull(creativeHookTests.studioId)))
    .orderBy(desc(creativeHookTests.createdAt))
    .limit(40);
  const projectIds = [...new Set(rows.map((r) => r.projectId).filter((v): v is string => Boolean(v)))];
  const frames = projectIds.length
    ? await db
        .select({ projectId: creativeAssets.projectId, path: creativeAssets.storagePath, sort: creativeAssets.sort })
        .from(creativeAssets)
        .where(and(inArray(creativeAssets.projectId, projectIds), eq(creativeAssets.kind, "frame")))
        .orderBy(asc(creativeAssets.sort), asc(creativeAssets.createdAt))
    : [];
  const frameOf = new Map<string, string>();
  for (const f of frames) if (f.projectId && f.path && !frameOf.has(f.projectId)) frameOf.set(f.projectId, f.path);
  const thumb = (r: Test) => (r.projectId ? frameOf.get(r.projectId) ?? null : r.media?.frames.find((f) => f.t >= 1)?.path ?? r.media?.frames[0]?.path ?? null);
  const signed = await signPaths(rows.map(thumb), 6 * 3600);
  return rows.map((r) => {
    const t = thumb(r);
    return {
      id: r.id,
      title: r.title,
      source: r.source,
      status: r.status,
      hooks: r.hooks.length,
      made: r.hooks.filter((h) => h.projectId).length,
      thumbUrl: t ? signed.get(t) ?? null : null,
      createdAt: r.createdAt.toISOString(),
    };
  });
}

/** Remove a test: its hook clips, and a dropped-in video's file and stills. Videos made from it stay. */
export async function deleteTest(test: Test): Promise<void> {
  const takeFiles = await db
    .select({ id: creativeAssets.id, path: creativeAssets.storagePath })
    .from(creativeAssets)
    .where(and(eq(creativeAssets.kind, "hook_take"), sql`${creativeAssets.metadata}->>'testId' = ${test.id}`));
  await removePaths([...takeFiles.map((a) => a.path), test.upload?.path, ...(test.media?.frames ?? []).map((f) => f.path)]);
  if (takeFiles.length) await db.delete(creativeAssets).where(inArray(creativeAssets.id, takeFiles.map((a) => a.id)));
  await db.delete(creativeHookTests).where(eq(creativeHookTests.id, test.id));
}

/** Record that a hook's video was made. */
export async function markMade(test: Test, hookId: string, projectId: string): Promise<void> {
  const hooks = test.hooks.map((h) => (h.id === hookId ? { ...h, projectId } : h));
  await db.update(creativeHookTests).set({ hooks, updatedAt: new Date() }).where(eq(creativeHookTests.id, test.id));
}

export { takesOf as hookTakesOf, projectOf as hookProjectOf, uploadPrefix as hookUploadPrefix };
export const _writeHooksForTest = writeHooks;
