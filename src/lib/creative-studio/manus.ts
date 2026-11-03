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
    `Save each image as a separate PNG file and attach all ${req.count} files in your final message. Do not ask me any questions; make sensible choices and finish.`,
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

/** All values under `key` anywhere in the object. */
function collect(obj: unknown, key: string, out: unknown[] = [], depth = 0): unknown[] {
  if (!obj || typeof obj !== "object" || depth > 8) return out;
  if (Array.isArray(obj)) {
    for (const v of obj) collect(v, key, out, depth + 1);
    return out;
  }
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (k === key) out.push(v);
    collect(v, key, out, depth + 1);
  }
  return out;
}

export type FrameTaskState =
  | { state: "running" }
  | { state: "done"; images: { url: string; filename: string | null }[] }
  | { state: "failed"; error: string };

export async function checkFrameTask(taskId: string): Promise<FrameTaskState> {
  const q = new URLSearchParams({ task_id: taskId, order: "desc", limit: "100" });
  const messages = await manus<Record<string, unknown>>(`task.listMessages?${q}`, { method: "GET" });

  // Newest first: the first agent_status we see is the latest.
  const statuses = collect(messages, "agent_status").filter((s): s is string => typeof s === "string");
  const latest = statuses[0];
  if (latest === "error") {
    const err = collect(messages, "error_message").find((e) => typeof e === "string") as string | undefined;
    return { state: "failed", error: err || "Manus stopped with an error" };
  }
  if (latest === "waiting") {
    return { state: "failed", error: "Manus stopped to ask a question. Try a more specific shot description." };
  }
  if (latest !== "stopped") return { state: "running" };

  const detail = await manus<{ has_running_background_jobs?: boolean; task?: { has_running_background_jobs?: boolean } }>(
    `task.detail?${new URLSearchParams({ task_id: taskId })}`,
    { method: "GET" }
  ).catch(() => null);
  if (detail?.has_running_background_jobs || detail?.task?.has_running_background_jobs) return { state: "running" };

  const images: { url: string; filename: string | null }[] = [];
  const seen = new Set<string>();
  for (const list of collect(messages, "attachments")) {
    if (!Array.isArray(list)) continue;
    for (const a of list as Record<string, unknown>[]) {
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
  if (images.length === 0) return { state: "failed", error: "Manus finished without returning an image. Try again." };
  return { state: "done", images };
}
