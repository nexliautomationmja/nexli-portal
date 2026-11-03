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
  /** Short-lived public URLs of the Daniela reference images. */
  referenceUrls: string[];
}

export function framePrompt(req: FrameRequest): string {
  const size = req.aspect === "9:16" ? "1080×1920 pixels, vertical 9:16" : "1920×1080 pixels, horizontal 16:9";
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

export async function startFrameTask(req: FrameRequest): Promise<{ taskId: string; taskUrl: string | null }> {
  const content: Record<string, unknown>[] = [{ type: "text", text: framePrompt(req) }];
  req.referenceUrls.slice(0, 6).forEach((url, i) => {
    content.push({ type: "file", file_url: url, filename: `daniela-reference-${i + 1}.png` });
  });
  const res = await manus<{ task_id: string; task_url?: string }>("task.create", {
    method: "POST",
    body: JSON.stringify({
      message: { content },
      agent_profile: "standard",
      interactive_mode: false,
      hide_in_task_list: true,
      share_visibility: "private",
      title: "Nexli Creative Studio · Daniela frame",
    }),
  });
  if (!res.task_id) throw new ManusError("Manus didn't return a task id");
  return { taskId: res.task_id, taskUrl: res.task_url ?? null };
}

interface ManusMessage {
  id?: string;
  type?: string;
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

const QUESTION_TYPES = new Set(["messageAskUser", "cascadeAskUser"]);

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

export async function checkFrameTask(taskId: string): Promise<FrameTaskState> {
  const q = new URLSearchParams({ task_id: taskId, order: "desc", limit: "100" });
  const res = await manus<{ messages?: ManusMessage[] }>(`task.listMessages?${q}`, { method: "GET" });
  const messages = res.messages ?? [];

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
