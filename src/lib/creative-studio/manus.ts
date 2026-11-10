/**
 * Manus API v2 — generates Daniela frames from a one-line shot description,
 * using Marcel's Daniela reference images as the baseline.
 *
 *   POST /v2/task.create        { message: { content: [text, file…] }, … }
 *   GET  /v2/task.listMessages  ?task_id=…  (status_update.agent_status,
 *                               assistant_message.attachments[type=image].url)
 *   GET  /v2/task.detail        ?task_id=…  (has_running_background_jobs)
 *
 * Auth: x-manus-api-key (MANUS_API_KEY in Vercel). Attachment URLs from
 * Manus are temporary, so finished images are copied into storage at once.
 */

const BASE = "https://api.manus.ai/v2";

export class ManusError extends Error {}

function apiKey(): string {
  const key = process.env.MANUS_API_KEY;
  if (!key) throw new ManusError("Manus isn't connected yet. Add MANUS_API_KEY in Vercel.");
  return key;
}

export function manusConfigured(): boolean {
  return Boolean(process.env.MANUS_API_KEY);
}

async function manus<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}/${path}`, {
    ...init,
    headers: { "x-manus-api-key": apiKey(), "Content-Type": "application/json", Accept: "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  const body = (await res.json().catch(() => null)) as (T & { ok?: boolean; error?: { code?: string; message?: string } }) | null;
  if (!res.ok || !body || body.ok === false) {
    const msg = body?.error?.message || `Manus returned HTTP ${res.status}`;
    throw new ManusError(`Manus: ${msg}`);
  }
  return body;
}

export interface FrameRequest {
  shot: string;
  aspect: "9:16" | "16:9";
  count: number;
  /** Short-lived public URLs of the reference images (Daniela's in Nexli's studio). */
  referenceUrls: string[];
  /** A client firm's studio: the presenter is whoever is in its reference pictures (never Daniela). */
  client?: boolean;
  /** A chosen presenter (not the studio's default): their photos are the references, or Manus works from the look. */
  presenter?: { name: string; pronoun: "she" | "he"; look: string } | null;
}

/** A chosen presenter: the same person as their photos, or exactly as their look describes. */
function presenterFramePrompt(req: FrameRequest & { presenter: NonNullable<FrameRequest["presenter"]> }, size: string): string {
  const { name, look } = req.presenter;
  const he = req.presenter.pronoun === "he";
  const P = { subj: he ? "he" : "she", Subj: he ? "He" : "She", poss: he ? "his" : "her", obj: he ? "him" : "her" };
  const who = req.referenceUrls.length
    ? `The attached photos are reference images of ${name}. ${P.Subj} must clearly be the same person in every image: same face, hair, skin tone and build.${look ? ` ${name}: ${look}` : ""}`
    : `${name}: ${look}. Make ${P.obj} look exactly like that, and clearly the same person in every image.`;
  return [
    `Create ${req.count} photorealistic still photographs of ${name} to use as the opening frame of a video.`,
    who,
    `The shot: ${req.shot.trim()}`,
    `Format: ${size}. ${req.aspect === "9:16" ? `Framed for a vertical Facebook/Instagram ad, with room above ${P.poss} head.` : `Framed for a landscape video, with ${P.obj} centred.`}`,
    `Unless the shot says otherwise, ${P.subj} faces the camera with ${P.poss} mouth relaxed and closed, in a natural pose ${P.subj} can start talking from. Realistic skin, hair and fabric, natural light, shallow depth of field.`,
    "No text, captions, logos or watermarks anywhere in the image.",
    `Save each image as a separate PNG file and attach all ${req.count} files in your final message.`,
    "This request comes from an automated tool: nobody is available to answer questions or approve steps. Never stop to ask — make sensible choices yourself and finish the task.",
  ].join("\n\n");
}

/** A client studio's presenter isn't Daniela: the person in that studio's reference pictures. */
function clientFramePrompt(req: FrameRequest, size: string): string {
  return [
    `Create ${req.count} photorealistic still photographs of the presenter shown in the attached reference photos, to use as the opening frame of a talking-head video.`,
    "It must clearly be the same person as in the reference photos in every image: same face, hair, skin tone and build.",
    `The shot: ${req.shot.trim()}`,
    `Format: ${size}. ${req.aspect === "9:16" ? "Framed for a vertical Facebook/Instagram ad, with room above the presenter's head." : "Framed for a landscape video, with the presenter centred."}`,
    "The presenter faces the camera with the mouth relaxed and closed, in a natural pose to start talking from. Realistic skin, hair and fabric, natural light, shallow depth of field.",
    "No text, captions, logos or watermarks anywhere in the image.",
    `Save each image as a separate PNG file and attach all ${req.count} files in your final message.`,
    "This request comes from an automated tool: nobody is available to answer questions or approve steps. Never stop to ask — make sensible choices yourself and finish the task.",
  ].join("\n\n");
}

export function framePrompt(req: FrameRequest): string {
  const size = req.aspect === "9:16" ? "1080×1920 pixels, vertical 9:16" : "1920×1080 pixels, horizontal 16:9";
  if (req.presenter) return presenterFramePrompt({ ...req, presenter: req.presenter }, size);
  if (req.client) return clientFramePrompt(req, size);
  const refs = req.referenceUrls.length
    ? "The attached photos are reference images of Daniela. She must be clearly the same woman in every image: same face, hair, skin tone and build."
    : "Daniela is a confident woman in her thirties with long dark wavy hair.";
  return [
    `Create ${req.count} photorealistic still photographs of Daniela to use as the opening frame of a talking-head video.`,
    refs,
    `The shot: ${req.shot.trim()}`,
    `Format: ${size}. ${req.aspect === "9:16" ? "Framed for a vertical Facebook/Instagram ad, with room above her head." : "Framed for a landscape video, with her centred."}`,
    "She faces the camera with her mouth relaxed and closed, in a natural pose she can start talking from. Realistic skin, hair and fabric, natural light, shallow depth of field.",
    "No text, captions, logos or watermarks anywhere in the image.",
    `Save each image as a separate PNG file and attach all ${req.count} files in your final message.`,
    "This request comes from an automated tool: nobody is available to answer questions or approve steps. Never stop to ask — make sensible choices yourself and finish the task.",
  ].join("\n\n");
}

export interface StoryboardRequest {
  scenes: { label: string; shot: string }[];
  aspect: "9:16" | "16:9";
  referenceUrls: string[];
  /** Who presents: their name and pronoun, plus their look when there are no photos. */
  presenter: { name: string; pronoun: "she" | "he"; look: string };
}

/**
 * Every scene of a story in one Manus task (one person, one look, made
 * together), saved as scene-1.png … scene-N.png so each lands in its scene.
 */
export function storyboardPrompt(req: StoryboardRequest): string {
  const n = req.scenes.length;
  const size = req.aspect === "9:16" ? "1080×1920 pixels, vertical 9:16" : "1920×1080 pixels, horizontal 16:9";
  const he = req.presenter.pronoun === "he";
  const P = { obj: he ? "him" : "her" };
  const name = req.presenter.name || "The presenter";
  const who = req.referenceUrls.length
    ? `The attached photos are reference images of ${name}. Wherever ${name} appears, ${he ? "he" : "she"} must clearly be the same person as in the photos: same face, hair, skin tone and build.${req.presenter.look ? ` ${name}: ${req.presenter.look}` : ""}`
    : `${name}: ${req.presenter.look || "a confident professional in their thirties or forties"}. Make ${P.obj} look exactly like that, and identical in every scene.`;
  return [
    `Create ${n} photorealistic still photographs: the opening frames of the ${n} scenes of one short ${req.aspect === "9:16" ? "vertical ad" : "landscape video"}, in story order. Each image is one scene, described below.`,
    who,
    `Keep ${name}'s look consistent across the scenes (the same outfit unless a scene says otherwise), and keep the whole set consistent: realistic photography, natural light, the same color feel.`,
    req.scenes.map((sc, i) => `Scene ${i + 1}${sc.label ? ` (${sc.label})` : ""}: ${sc.shot.trim()}`).join("\n"),
    `Format: ${size}, every image. ${req.aspect === "9:16" ? "Framed for a vertical Facebook/Instagram ad, with room above people's heads." : "Framed for a landscape video."}`,
    "Anyone who will talk in a scene has their mouth relaxed and closed, in a natural pose to start from. Realistic skin, hair and fabric, shallow depth of field.",
    "No text, captions, logos or watermarks anywhere in the images.",
    `Save each scene as a separate PNG named exactly ${n <= 3 ? Array.from({ length: n }, (_, i) => `scene-${i + 1}.png`).join(", ") : `scene-1.png, scene-2.png … scene-${n}.png`} (one per scene, in order), and attach all ${n} files in your final message.`,
    "This request comes from an automated tool: nobody is available to answer questions or approve steps. Never stop to ask — make sensible choices yourself and finish the task.",
  ].join("\n\n");
}

export async function startStoryboardTask(req: StoryboardRequest): Promise<{ taskId: string; taskUrl: string | null }> {
  const who = req.presenter.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "presenter";
  return startManusTask({
    prompt: storyboardPrompt(req),
    files: req.referenceUrls.slice(0, 6).map((url, i) => ({ url, filename: `${who}-reference-${i + 1}.png` })),
    title: `Creative Studio · ${req.scenes.length} story scenes`,
  });
}

/** The scene number in a storyboard file name ("scene-3.png" → 3), else null. */
export function sceneNumberOf(filename: string | null): number | null {
  const m = filename?.match(/scene[\s_-]*(\d+)/i);
  return m ? Number(m[1]) : null;
}

/**
 * Which scene (1-based) each storyboard image belongs to: by file name
 * first, then the unclaimed images fill the unclaimed scenes in order;
 * 0 = an extra image no scene is left for.
 */
export function storyboardPlacement(filenames: (string | null)[], count: number): number[] {
  const taken = new Set<number>();
  const out = filenames.map((f) => {
    const n = sceneNumberOf(f);
    if (n && n >= 1 && n <= count && !taken.has(n)) {
      taken.add(n);
      return n;
    }
    return 0;
  });
  return out.map((n) => {
    if (n) return n;
    for (let i = 1; i <= count; i++) {
      if (!taken.has(i)) {
        taken.add(i);
        return i;
      }
    }
    return 0;
  });
}

export async function startFrameTask(req: FrameRequest): Promise<{ taskId: string; taskUrl: string | null }> {
  const content: Record<string, unknown>[] = [{ type: "text", text: framePrompt(req) }];
  req.referenceUrls.slice(0, 6).forEach((url, i) => {
    const who = req.presenter ? req.presenter.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "presenter" : req.client ? "presenter" : "daniela";
    content.push({ type: "file", file_url: url, filename: `${who}-reference-${i + 1}.png` });
  });
  const res = await manus<{ task_id: string; task_url?: string }>("task.create", {
    method: "POST",
    body: JSON.stringify({
      message: { content },
      agent_profile: "standard",
      interactive_mode: false,
      hide_in_task_list: true,
      share_visibility: "private",
      title: req.presenter ? `Creative Studio · ${req.presenter.name} frame` : req.client ? "Creative Studio · client frame" : "Nexli Creative Studio · Daniela frame",
    }),
  });
  if (!res.task_id) throw new ManusError("Manus didn't return a task id");
  return { taskId: res.task_id, taskUrl: res.task_url ?? null };
}

export type ManusFile =
  | { url: string; filename: string }
  /** Sent inline (base64), up to 20 MB — doesn't count toward the prompt's text limit. */
  | { data: string; filename: string; mimeType: string };

/**
 * Start a Manus task from a prompt and attached files (photo ads, ads analysis).
 * Optional: a structured output schema (result arrives as a
 * `structured_output_result` message), connector ids (or clear the account's
 * default connectors), agent profile, locale, task-list visibility.
 */
export async function startManusTask(args: {
  prompt: string;
  files: ManusFile[];
  title: string;
  schema?: Record<string, unknown>;
  connectors?: string[];
  clearConnectors?: boolean;
  agentProfile?: string;
  locale?: string;
  hideInTaskList?: boolean;
}): Promise<{ taskId: string; taskUrl: string | null }> {
  const content: Record<string, unknown>[] = [{ type: "text", text: args.prompt }];
  for (const f of args.files) {
    if ("data" in f) {
      content.push({ type: "file", file_data: `data:${f.mimeType};base64,${f.data}`, filename: f.filename, mime_type: f.mimeType });
    } else {
      content.push({ type: "file", file_url: f.url, filename: f.filename });
    }
  }
  const connectors = (args.connectors ?? []).filter(Boolean);
  const res = await manus<{ task_id: string; task_url?: string }>("task.create", {
    method: "POST",
    body: JSON.stringify({
      message: { content, ...(connectors.length ? { connectors } : {}) },
      ...(args.clearConnectors && !connectors.length ? { clear_connectors: true } : {}),
      ...(args.schema ? { structured_output_schema: args.schema } : {}),
      ...(args.locale ? { locale: args.locale } : {}),
      agent_profile: args.agentProfile ?? "standard",
      interactive_mode: false,
      hide_in_task_list: args.hideInTaskList ?? true,
      share_visibility: "private",
      title: args.title,
    }),
  });
  if (!res.task_id) throw new ManusError("Manus didn't return a task id");
  return { taskId: res.task_id, taskUrl: res.task_url ?? null };
}

/** A task's messages (newest first by default). */
export async function listTaskMessages(
  taskId: string,
  opts: { verbose?: boolean; limit?: number; order?: "asc" | "desc" } = {}
): Promise<ManusMessage[]> {
  const q = new URLSearchParams({
    task_id: taskId,
    order: opts.order ?? "desc",
    limit: String(opts.limit ?? 100),
    verbose: opts.verbose === false ? "false" : "true",
  });
  const res = await manus<{ messages?: ManusMessage[] }>(`task.listMessages?${q}`, { method: "GET" });
  return res.messages ?? [];
}

export interface ManusConnector {
  id: string;
  name: string;
  type?: string;
  description?: string;
  category?: string;
}

/** Connectors installed on the Manus account behind MANUS_API_KEY. */
export async function listConnectors(): Promise<ManusConnector[]> {
  const res = await manus<{ data?: ManusConnector[] }>("connector.list", { method: "GET" });
  return (res.data ?? []).filter((c) => c && typeof c.id === "string");
}

import type { ManusActivitySnapshot } from "@/lib/creative-studio/tables";

export interface ManusMessage {
  id?: string;
  type?: string;
  timestamp?: number;
  tool_used?: { tool?: string; status?: string; brief?: string; description?: string; message?: { action?: string; param?: string } };
  plan_update?: { steps?: { status?: string; title?: string; started_at?: number | null; end_at?: number | null }[] };
  new_plan_step?: { step_id?: string; title?: string };
  explanation?: { content?: string };
  status_update?: {
    agent_status?: string;
    status_detail?: {
      waiting_for_event_id?: string;
      waiting_for_event_type?: string;
      waiting_description?: string;
      confirm_input_schema?: unknown;
    };
    brief?: string;
    description?: string;
  };
  assistant_message?: {
    content?: string;
    attachments?: { type?: string; filename?: string; url?: string; content_type?: string; file_uid?: string }[];
    question_expectation?: { options?: string[] };
  };
  error_message?: { message?: string; content?: string };
  /** Present on the message of type "structured_output_result" (tasks created with a schema). */
  structured_output_result?: { success?: boolean; value?: unknown; error?: string | null };
}

export type FrameTaskState =
  | { state: "running" }
  | { state: "done"; images: { url: string; filename: string | null }[] }
  | { state: "failed"; error: string }
  | {
      state: "waiting";
      /** question → answer with sendMessage; confirm → an action Manus wants approved. */
      kind: "question" | "confirm";
      eventId: string | null;
      eventType: string | null;
      /** What Manus asked or wants to do, in its words. */
      prompt: string;
      options: string[];
    };

export const QUESTION_TYPES = new Set(["messageAskUser", "cascadeAskUser"]);
/**
 * Manus waiting on its own background sub-job (e.g. an image generation it
 * started). It resumes by itself and can't be confirmed ("Event type
 * 'cascadeJobCall' does not support confirmation"), so it counts as running.
 */
export const isBackgroundWait = (type: string | null) => Boolean(type && /JobCall$/i.test(type));

function imagesFrom(messages: ManusMessage[]): { url: string; filename: string | null }[] {
  const images: { url: string; filename: string | null }[] = [];
  const seen = new Set<string>();
  for (const m of messages) {
    for (const a of m.assistant_message?.attachments ?? []) {
      const url = typeof a.url === "string" ? a.url : null;
      const type = String(a.type ?? a.content_type ?? "");
      const name = typeof a.filename === "string" ? a.filename : null;
      const isImage = type === "image" || type.startsWith("image/") || /\.(png|jpe?g|webp)$/i.test(name ?? "");
      const uid = String(a.file_uid ?? url);
      if (url && isImage && !seen.has(uid)) {
        seen.add(uid);
        images.push({ url, filename: name });
      }
    }
  }
  return images;
}

const clean = (t: string | undefined | null, max = 160) => {
  const v = (t ?? "").replace(/\s+/g, " ").trim();
  return v.length > max ? `${v.slice(0, max - 1)}…` : v;
};

/** Normalise timestamps (Manus mixes ms and s) to ms. */
const toMs = (t: number | null | undefined) => (typeof t === "number" && t > 0 ? (t < 1e12 ? t * 1000 : t) : null);

/** Build the live activity snapshot from listMessages (newest first). */
export function activityFrom(messages: ManusMessage[]): ManusActivitySnapshot {
  const status = messages.find((m) => m.type === "status_update" && m.status_update?.agent_status)?.status_update;
  const plan = messages.find((m) => m.type === "plan_update" && m.plan_update?.steps?.length)?.plan_update?.steps ?? [];
  const chronological = [...messages].reverse();
  const feed: ManusActivitySnapshot["feed"] = [];
  for (const m of chronological) {
    const at = toMs(m.timestamp) ?? Date.now();
    const id = m.id ?? `${m.type}-${at}`;
    if (m.type === "tool_used" && m.tool_used) {
      const t = m.tool_used;
      const action = clean(t.message?.action, 60);
      const param = clean(t.message?.param, 90);
      const title = action ? (param ? `${action} · ${param}` : action) : clean(t.brief, 120) || clean(t.tool, 40) || "Working";
      feed.push({ id, kind: "tool", tool: t.tool ?? null, title, detail: clean(t.description, 200) || null, status: t.status ?? null, at });
    } else if (m.type === "explanation" && m.explanation?.content) {
      feed.push({ id, kind: "explanation", tool: null, title: clean(m.explanation.content, 240), detail: null, status: null, at });
    } else if (m.type === "assistant_message" && m.assistant_message?.content) {
      feed.push({ id, kind: "message", tool: null, title: clean(m.assistant_message.content, 240), detail: null, status: null, at });
    } else if (m.type === "new_plan_step" && m.new_plan_step?.title) {
      feed.push({ id, kind: "step", tool: null, title: clean(m.new_plan_step.title, 120), detail: null, status: null, at });
    }
  }
  const raw = status?.agent_status;
  const known = ["running", "waiting", "stopped", "error"] as const;
  return {
    status: (known as readonly string[]).includes(raw ?? "") ? (raw as ManusActivitySnapshot["status"]) : "unknown",
    now: clean(status?.brief || status?.description, 140) || null,
    plan: plan
      .filter((st) => st.title)
      .map((st) => ({
        title: clean(st.title, 120),
        status: (["todo", "doing", "done", "failed"].includes(st.status ?? "") ? st.status : "todo") as "todo" | "doing" | "done" | "failed",
        startedAt: toMs(st.started_at ?? null),
        endAt: toMs(st.end_at ?? null),
      })),
    feed: feed.slice(-14),
    startedAt: toMs(chronological[0]?.timestamp ?? null),
    updatedAt: Date.now(),
  };
}

export async function checkFrameTask(taskId: string): Promise<{ state: FrameTaskState; activity: ManusActivitySnapshot }> {
  const q = new URLSearchParams({ task_id: taskId, order: "desc", limit: "100", verbose: "true" });
  const res = await manus<{ messages?: ManusMessage[] }>(`task.listMessages?${q}`, { method: "GET" });
  const messages = res.messages ?? [];
  const activity = activityFrom(messages);
  const state = await stateFrom(taskId, messages);
  return { state, activity };
}

async function stateFrom(taskId: string, messages: ManusMessage[]): Promise<FrameTaskState> {
  // Newest first: the first status_update is the current state.
  const status = messages.find((m) => m.type === "status_update" && m.status_update?.agent_status)?.status_update;
  const latest = status?.agent_status;

  if (latest === "error") {
    const err = messages.find((m) => m.type === "error_message")?.error_message;
    return { state: "failed", error: err?.message || err?.content || status?.description || "Manus stopped with an error" };
  }

  if (latest === "waiting") {
    const d = status?.status_detail ?? {};
    const lastAssistant = messages.find((m) => m.type === "assistant_message")?.assistant_message;
    const type = d.waiting_for_event_type ?? null;
    if (isBackgroundWait(type)) return { state: "running" };
    const isQuestion = !type || QUESTION_TYPES.has(type);
    const prompt = (isQuestion ? lastAssistant?.content : d.waiting_description) || d.waiting_description || status?.description || lastAssistant?.content || "Manus needs input to continue.";
    console.info(`[creative-studio] Manus task ${taskId} waiting (${type ?? "unknown"}): ${String(prompt).slice(0, 300)}`);
    return {
      state: "waiting",
      kind: isQuestion ? "question" : "confirm",
      eventId: d.waiting_for_event_id ?? null,
      eventType: type,
      prompt: String(prompt).slice(0, 1500),
      options: isQuestion ? (lastAssistant?.question_expectation?.options ?? []).slice(0, 6) : [],
    };
  }

  if (latest !== "stopped") return { state: "running" };

  const detail = await manus<{ has_running_background_jobs?: boolean; task?: { has_running_background_jobs?: boolean } }>(
    `task.detail?${new URLSearchParams({ task_id: taskId })}`,
    { method: "GET" }
  ).catch(() => null);
  if (detail?.has_running_background_jobs || detail?.task?.has_running_background_jobs) return { state: "running" };

  const images = imagesFrom(messages);
  if (images.length === 0) {
    const said = messages.find((m) => m.type === "assistant_message")?.assistant_message?.content;
    return { state: "failed", error: said ? `Manus finished without an image: “${said.slice(0, 240)}”` : "Manus finished without returning an image. Try again." };
  }
  return { state: "done", images };
}

/** Answer a question Manus asked (messageAskUser / cascadeAskUser). */
export async function replyToTask(taskId: string, text: string): Promise<void> {
  await manus("task.sendMessage", {
    method: "POST",
    body: JSON.stringify({ task_id: taskId, message: { content: text.slice(0, 4000) } }),
  });
}

/** Manus's answer when the paused event isn't an approvable action (e.g. a background job). */
export const isNotConfirmable = (err: unknown) => err instanceof ManusError && /does not support confirmation/i.test(err.message);

/** Approve an action Manus is waiting on — only ever called after the user clicks Allow. */
export async function confirmTaskAction(taskId: string, eventId: string): Promise<boolean> {
  const res = await manus<{ confirmed?: boolean }>("task.confirmAction", {
    method: "POST",
    body: JSON.stringify({ task_id: taskId, event_id: eventId }),
  });
  return res.confirmed !== false;
}

export async function stopTask(taskId: string): Promise<void> {
  await manus("task.stop", { method: "POST", body: JSON.stringify({ task_id: taskId }) }).catch(() => {});
}

/** The automatic answer to Manus's first question: decide yourself and deliver. */
export const AUTO_REPLY =
  "This request comes from an automated tool, so nobody can answer questions. Please use your best judgment from the shot description and the reference photos, and create the images now. Save each one as a PNG file and attach them all in your final message.";
