import crypto from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { creativeKlingConnections } from "@/lib/creative-studio/tables";

/**
 * Kling through its MCP server — the same connection Marcel uses in Claude,
 * so renders spend his kling.ai plan credits (the developer API is a
 * separate, prepaid billing system).
 *
 * The portal is a standard MCP client:
 *   • OAuth 2.1 with PKCE against https://kling.ai/auth (dynamic client
 *     registration, public client, refresh tokens; scopes below).
 *   • Streamable-HTTP JSON-RPC to https://kling.ai/mcp (initialize →
 *     notifications/initialized → tools/call), one short session per call
 *     because serverless functions don't keep connections.
 *
 * Tools used (confirmed with who_am_i, MCP v1.3.3): image_to_video with
 * kling-video-v3_0 (first_image) or kling-video-v3_0_omni (image_1,
 * aspect_ratio), file_upload, query_tasks, query_membership_and_credits.
 * Every model is named explicitly — Kling's default is v4, which the
 * framework rules out for talking heads.
 *
 * Tokens never leave the server and are never logged.
 */

const AUTH_BASE = "https://kling.ai/auth";
export const KLING_MCP_URL = "https://kling.ai/mcp";
const RESOURCE = "https://kling.ai/mcp";
const SCOPES = "generation.create generation.read account.credit.read";
const PROTOCOL_VERSION = "2025-06-18";

// ── Encryption at rest ────────────────────────────────────────────────

function key(): Buffer {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return crypto.createHash("sha256").update(`creative-studio:kling:${secret}`).digest();
}

function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), enc].map((b) => b.toString("base64url")).join(".");
}

function decrypt(blob: string | null): string | null {
  if (!blob) return null;
  try {
    const [iv, tag, enc] = blob.split(".").map((p) => Buffer.from(p, "base64url"));
    const decipher = crypto.createDecipheriv("aes-256-gcm", key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

// ── OAuth ─────────────────────────────────────────────────────────────

export class KlingNotConnectedError extends Error {
  constructor(message = "Kling isn't connected. Connect your Kling account in the Creative Studio.") {
    super(message);
  }
}

const b64url = (buf: Buffer) => buf.toString("base64url");

export function pkcePair(): { verifier: string; challenge: string } {
  const verifier = b64url(crypto.randomBytes(48));
  const challenge = b64url(crypto.createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

/** Register (or reuse) this portal as an OAuth client for `redirectUri`. */
export async function ensureClient(ownerId: string, redirectUri: string): Promise<string> {
  const [row] = await db
    .select()
    .from(creativeKlingConnections)
    .where(eq(creativeKlingConnections.ownerId, ownerId))
    .limit(1);
  if (row && row.redirectUri === redirectUri) return row.clientId;

  const res = await fetch(`${AUTH_BASE}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_name: "Nexli Portal · Creative Studio",
      redirect_uris: [redirectUri],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      scope: SCOPES,
    }),
  });
  const body = (await res.json().catch(() => null)) as { client_id?: string; error_description?: string } | null;
  if (!res.ok || !body?.client_id) {
    throw new Error(`Kling refused the client registration (${res.status}${body?.error_description ? `: ${body.error_description}` : ""})`);
  }
  if (row) {
    await db
      .update(creativeKlingConnections)
      .set({ clientId: body.client_id, redirectUri, updatedAt: new Date() })
      .where(eq(creativeKlingConnections.ownerId, ownerId));
  } else {
    await db.insert(creativeKlingConnections).values({ ownerId, clientId: body.client_id, redirectUri });
  }
  return body.client_id;
}

export function authorizeUrl(args: { clientId: string; redirectUri: string; state: string; challenge: string }): string {
  const q = new URLSearchParams({
    response_type: "code",
    client_id: args.clientId,
    redirect_uri: args.redirectUri,
    scope: SCOPES,
    state: args.state,
    code_challenge: args.challenge,
    code_challenge_method: "S256",
    resource: RESOURCE,
  });
  return `${AUTH_BASE}/authorize?${q}`;
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

async function tokenRequest(params: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(`${AUTH_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ ...params, resource: RESOURCE }),
  });
  const body = ((await res.json().catch(() => null)) ?? {}) as TokenResponse;
  if (!res.ok || !body.access_token) {
    throw new Error(`Kling sign-in failed (${res.status}${body.error ? `: ${body.error_description || body.error}` : ""})`);
  }
  return body;
}

async function saveTokens(ownerId: string, t: TokenResponse, keepRefresh: string | null) {
  await db
    .update(creativeKlingConnections)
    .set({
      accessTokenEnc: encrypt(t.access_token!),
      refreshTokenEnc: t.refresh_token ? encrypt(t.refresh_token) : keepRefresh ? encrypt(keepRefresh) : null,
      expiresAt: new Date(Date.now() + Math.max(60, t.expires_in ?? 3600) * 1000),
      updatedAt: new Date(),
    })
    .where(eq(creativeKlingConnections.ownerId, ownerId));
}

export async function completeAuthorization(args: {
  ownerId: string;
  code: string;
  verifier: string;
}): Promise<void> {
  const [row] = await db
    .select()
    .from(creativeKlingConnections)
    .where(eq(creativeKlingConnections.ownerId, args.ownerId))
    .limit(1);
  if (!row) throw new Error("Start the Kling connection again from the Creative Studio.");
  const t = await tokenRequest({
    grant_type: "authorization_code",
    code: args.code,
    redirect_uri: row.redirectUri,
    client_id: row.clientId,
    code_verifier: args.verifier,
  });
  await saveTokens(args.ownerId, t, null);
  await db
    .update(creativeKlingConnections)
    .set({ connectedAt: new Date() })
    .where(eq(creativeKlingConnections.ownerId, args.ownerId));
}

/** A valid access token for the workspace, refreshed when close to expiry. */
export async function accessToken(ownerId: string): Promise<string> {
  const [row] = await db
    .select()
    .from(creativeKlingConnections)
    .where(eq(creativeKlingConnections.ownerId, ownerId))
    .limit(1);
  const access = decrypt(row?.accessTokenEnc ?? null);
  if (!row || !access) throw new KlingNotConnectedError();
  if (row.expiresAt && row.expiresAt.getTime() - Date.now() > 60_000) return access;

  const refresh = decrypt(row.refreshTokenEnc);
  if (!refresh) throw new KlingNotConnectedError("Your Kling sign-in expired. Reconnect Kling in the Creative Studio.");
  try {
    const t = await tokenRequest({ grant_type: "refresh_token", refresh_token: refresh, client_id: row.clientId });
    await saveTokens(ownerId, t, refresh);
    return t.access_token!;
  } catch {
    throw new KlingNotConnectedError("Your Kling sign-in expired. Reconnect Kling in the Creative Studio.");
  }
}

export async function connectionStatus(ownerId: string): Promise<{ connected: boolean; connectedAt: string | null }> {
  const [row] = await db
    .select()
    .from(creativeKlingConnections)
    .where(eq(creativeKlingConnections.ownerId, ownerId))
    .limit(1);
  return {
    connected: Boolean(row?.accessTokenEnc && (row.refreshTokenEnc || (row.expiresAt && row.expiresAt > new Date()))),
    connectedAt: row?.connectedAt?.toISOString() ?? null,
  };
}

export async function disconnect(ownerId: string): Promise<void> {
  await db
    .update(creativeKlingConnections)
    .set({ accessTokenEnc: null, refreshTokenEnc: null, expiresAt: null, connectedAt: null, updatedAt: new Date() })
    .where(eq(creativeKlingConnections.ownerId, ownerId));
}

// ── MCP (streamable HTTP JSON-RPC) ────────────────────────────────────

export class KlingToolError extends Error {
  constructor(
    message: string,
    public readonly kind: "rate_limited" | "auth" | "tool" | "transport"
  ) {
    super(message);
  }
}

/** Parse a JSON-RPC response that may arrive as JSON or as an SSE stream. */
async function readRpc(res: Response): Promise<{ result?: unknown; error?: { message?: string; code?: number } }> {
  const text = await res.text();
  const type = res.headers.get("content-type") || "";
  if (type.includes("text/event-stream")) {
    const events = text
      .split(/\n\n/)
      .map((chunk) =>
        chunk
          .split("\n")
          .filter((l) => l.startsWith("data:"))
          .map((l) => l.slice(5).trim())
          .join("")
      )
      .filter(Boolean);
    for (let i = events.length - 1; i >= 0; i--) {
      try {
        const msg = JSON.parse(events[i]);
        if (msg && ("result" in msg || "error" in msg)) return msg;
      } catch {
        /* keep looking */
      }
    }
    return {};
  }
  try {
    return JSON.parse(text);
  } catch {
    return { error: { message: text.slice(0, 300) } };
  }
}

async function rpc(token: string, sessionId: string | null, body: object) {
  const res = await fetch(KLING_MCP_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "MCP-Protocol-Version": PROTOCOL_VERSION,
      ...(sessionId ? { "Mcp-Session-Id": sessionId } : {}),
    },
    body: JSON.stringify(body),
  });
  if (res.status === 401 || res.status === 403) {
    throw new KlingToolError("Kling rejected the sign-in. Reconnect Kling.", "auth");
  }
  if (res.status === 429) throw new KlingToolError("Kling says too many requests.", "rate_limited");
  return { res, session: res.headers.get("mcp-session-id") ?? sessionId };
}

/** Call one Kling MCP tool and return its parsed result. */
export async function callTool(token: string, name: string, args: Record<string, unknown>): Promise<unknown> {
  const init = await rpc(token, null, {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: PROTOCOL_VERSION, capabilities: {}, clientInfo: { name: "nexli-portal", version: "1.0" } },
  });
  const initMsg = await readRpc(init.res);
  if (initMsg.error) throw new KlingToolError(`Kling MCP: ${initMsg.error.message ?? "initialize failed"}`, "transport");
  const session = init.session;

  const note = await rpc(token, session, { jsonrpc: "2.0", method: "notifications/initialized" });
  await note.res.text().catch(() => "");

  const call = await rpc(token, session, {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: { name, arguments: args },
  });
  const msg = await readRpc(call.res);
  if (msg.error) {
    const m = msg.error.message ?? "tool call failed";
    throw new KlingToolError(m, /too many requests|rate limit/i.test(m) ? "rate_limited" : "tool");
  }
  const result = (msg.result ?? {}) as {
    isError?: boolean;
    structuredContent?: unknown;
    content?: { type: string; text?: string }[];
  };
  const text = (result.content ?? [])
    .filter((c) => c.type === "text" && c.text)
    .map((c) => c.text)
    .join("\n");
  if (result.isError) {
    throw new KlingToolError(text || "Kling returned an error", /too many requests|rate limit/i.test(text) ? "rate_limited" : "tool");
  }
  if (result.structuredContent) return result.structuredContent;
  try {
    return JSON.parse(text);
  } catch {
    return { text };
  }
}

/** Depth-first search for the first value under any of `keys`. */
export function findValue(obj: unknown, keys: string[], depth = 0): unknown {
  if (!obj || typeof obj !== "object" || depth > 6) return undefined;
  for (const k of keys) {
    if (k in (obj as Record<string, unknown>)) {
      const v = (obj as Record<string, unknown>)[k];
      if (v !== undefined && v !== null && v !== "") return v;
    }
  }
  for (const v of Object.values(obj as Record<string, unknown>)) {
    const hit = findValue(v, keys, depth + 1);
    if (hit !== undefined) return hit;
  }
  return undefined;
}

// ── Kling operations ──────────────────────────────────────────────────

/** RFC 4122 v7 UUID for taskTraceId (one per render batch). */
export function uuidv7(): string {
  const bytes = crypto.randomBytes(16);
  const ms = BigInt(Date.now());
  for (let i = 0; i < 6; i++) bytes[i] = Number((ms >> BigInt(8 * (5 - i))) & BigInt(0xff));
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const h = bytes.toString("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Upload a frame to Kling (file_upload ticket → multipart POST) and return Kling's URL. */
export async function uploadFrame(
  token: string,
  file: { bytes: Buffer; mime: string; filename: string },
  taskTraceId: string
): Promise<string> {
  const ticketResult = await callTool(token, "file_upload", {
    contentType: file.mime,
    filename: file.filename,
    size: file.bytes.length,
    taskTraceId,
  });
  const ticket = findValue(ticketResult, ["ticket"]) as string | undefined;
  const uploadUrl = (findValue(ticketResult, ["upload_url", "uploadUrl"]) as string | undefined) ?? "https://kling.ai/api/mcp/files";
  if (!ticket) throw new KlingToolError("Kling didn't return an upload ticket", "tool");

  const form = new FormData();
  form.append("ticket", ticket);
  form.append("file", new Blob([new Uint8Array(file.bytes)], { type: file.mime }), file.filename);
  const res = await fetch(uploadUrl, { method: "POST", body: form });
  const body = await res.json().catch(() => null);
  const url = findValue(body, ["url", "fileUrl", "file_url"]) as string | undefined;
  if (!res.ok || !url) throw new KlingToolError(`Kling frame upload failed (${res.status})`, "tool");
  return url;
}

export async function submitClip(
  token: string,
  args: {
    multiPerson: boolean;
    prompt: string;
    durationS: number;
    frameUrl: string;
    taskTraceId: string;
    rationale: string;
    /** Omni needs the aspect ratio (its default is 16:9): 9:16 for ads, 16:9 for VSLs. */
    aspectRatio?: "9:16" | "16:9";
  }
): Promise<{ generationId: string; model: string }> {
  const model = args.multiPerson ? "kling-video-v3_0_omni" : "kling-video-v3_0";
  const common = [
    { name: "prompt", value: args.prompt },
    { name: "duration", value: String(Math.min(12, Math.max(3, Math.round(args.durationS)))) },
    { name: "resolution", value: "1080p" },
    { name: "imageCount", value: "1" },
    { name: "prefer_multi_shots", value: "false" },
    { name: "enable_audio", value: "true" },
  ];
  const result = await callTool(token, "image_to_video", {
    model,
    arguments: args.multiPerson ? [...common, { name: "aspect_ratio", value: args.aspectRatio ?? "9:16" }] : common,
    inputs: [{ name: args.multiPerson ? "image_1" : "first_image", inputType: "URL", url: args.frameUrl }],
    rationale: args.rationale,
    taskTraceId: args.taskTraceId,
  });
  const generationId = findValue(result, ["generationId", "generation_id", "taskId", "task_id"]);
  if (!generationId) throw new KlingToolError("Kling accepted the job but returned no generation id", "tool");
  return { generationId: String(generationId), model };
}

export type TaskState =
  | { state: "running"; raw: string }
  | { state: "done"; videoUrl: string; raw: string }
  | { state: "failed"; error: string; raw: string };

export async function queryTask(token: string, generationId: string): Promise<TaskState> {
  const result = await callTool(token, "query_tasks", { generationId });
  const raw = JSON.stringify(result).slice(0, 1500);
  const works = findValue(result, ["works"]);
  const first = Array.isArray(works) ? works[0] : undefined;
  const videoUrl =
    (findValue(first, ["urlWithoutWatermark"]) as string | undefined) ??
    (findValue(result, ["urlWithoutWatermark"]) as string | undefined) ??
    (findValue(first, ["url", "resource"]) as string | undefined);
  const status = String(findValue(result, ["status", "taskStatus", "state"]) ?? "").toUpperCase();
  const error = findValue(result, ["errorMessage", "error_message", "failReason", "message"]);

  if (videoUrl && /^https?:\/\//.test(videoUrl) && !/FAIL|ERROR/.test(status)) {
    return { state: "done", videoUrl, raw };
  }
  if (/FAIL|ERROR|REJECT|BLOCK|CANCEL/.test(status)) {
    return { state: "failed", error: typeof error === "string" && error ? error : `Kling status ${status}`, raw };
  }
  return { state: "running", raw };
}

export async function credits(token: string): Promise<{ remaining: number | null; raw: unknown }> {
  const result = await callTool(token, "query_membership_and_credits", {});
  const v = findValue(result, ["remainingCredits", "remaining_credits", "availableCredits", "credits", "balance", "remaining"]);
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return { remaining: Number.isFinite(n) ? n : null, raw: result };
}
