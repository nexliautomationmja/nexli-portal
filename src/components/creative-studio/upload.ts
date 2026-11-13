"use client";

import { createClient } from "@supabase/supabase-js";
import type { ProjectDetail } from "@/lib/creative-studio/service";
import { SOURCE_MAX_BYTES, SOURCE_MAX_SECONDS, tooLongMessage } from "@/lib/creative-studio/reaction-shared";

/**
 * Frame prep + direct-to-storage upload.
 *
 * Ads: center-crop to 9:16 (framework §5: nw = round(h*9/16), x = (w-nw)/2;
 * a frame taller than 9:16 is cropped in height instead). VSLs: used as-is.
 */
export async function prepareFrame(
  file: File,
  cropToVertical: boolean
): Promise<{ blob: Blob; width: number; height: number; mime: string }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("That file isn't a readable image"));
      el.src = url;
    });
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (!cropToVertical) return { blob: file, width: w, height: h, mime: file.type };

    let sx = 0;
    let sy = 0;
    let cw = w;
    let ch = h;
    if (w / h > 9 / 16) {
      cw = Math.round((h * 9) / 16);
      sx = Math.floor((w - cw) / 2);
    } else if (w / h < 9 / 16) {
      ch = Math.round((w * 16) / 9);
      sy = Math.floor((h - ch) / 2);
    } else {
      return { blob: file, width: w, height: h, mime: file.type };
    }
    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Your browser couldn't crop the image");
    ctx.drawImage(img, sx, sy, cw, ch, 0, 0, cw, ch);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Crop failed"))), "image/png")
    );
    return { blob, width: cw, height: ch, mime: "image/png" };
  } finally {
    URL.revokeObjectURL(url);
  }
}

let browserClient: ReturnType<typeof createClient> | null = null;
function storageClient() {
  if (!browserClient) {
    browserClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
  }
  return browserClient;
}

/** Upload with a one-time token issued by our API (the bucket stays private). */
export async function uploadToTarget(target: { path: string; token: string }, blob: Blob, mime: string) {
  const { error } = await storageClient()
    .storage.from("creative-studio")
    .uploadToSignedUrl(target.path, target.token, blob, { contentType: mime, upsert: false });
  if (error) {
    // Supabase refuses files over the project's upload limit (500 MB, set in Supabase → Storage → Settings).
    if (/maximum allowed size|exceeded|too large|payload/i.test(error.message ?? "")) {
      throw new Error(
        `This file is ${Math.round(blob.size / 1e6)} MB, over your storage upload limit (500 MB). Raise it in Supabase → Storage → Settings, or use a smaller file.`
      );
    }
    throw new Error(error.message || "Upload failed");
  }
}

/**
 * Upload an image as a project's opening frame (cropped to 9:16 for ads):
 * sign → direct upload → register → make it the opening frame. With `scene`
 * it becomes a scene's frame instead ("new" adds a scene; a scene id replaces
 * that scene's frame). Returns the fresh project detail.
 */
export async function uploadFrameFile(projectId: string, file: File, vertical: boolean, scene?: string) {
  const base = `/api/dashboard/creative-studio/projects/${projectId}/frames`;
  const prepared = await prepareFrame(file, vertical);
  const kling = prepared.mime === "image/webp" ? await toPng(prepared.blob) : prepared;
  const sign = await fetch(base, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "sign", mime: kling.mime }),
  });
  const target = await sign.json().catch(() => null);
  if (!sign.ok || !target?.token) throw new Error(target?.error || "Couldn't start the upload");
  await uploadToTarget(target, kling.blob, kling.mime);
  const reg = await fetch(base, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "register", path: target.path, mime: kling.mime, width: prepared.width, height: prepared.height, ...(scene ? { scene } : {}) }),
  });
  const detail = await reg.json().catch(() => null);
  if (!reg.ok || !detail?.frames) throw new Error(detail?.error || "Couldn't save the frame");
  if (scene) return detail;
  const newest = [...detail.frames].sort((a: { sort: number }, b: { sort: number }) => b.sort - a.sort)[0];
  if (!newest) return detail;
  const primary = await fetch(base, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ primaryId: newest.id }),
  });
  const out = await primary.json().catch(() => null);
  if (!primary.ok) throw new Error(out?.error || "Couldn't set the frame");
  return out;
}

/**
 * Have Manus recreate a photo for this video: upload the photo (not as a
 * frame), then start Manus with `change` (new suit colour, outfit,
 * background… or empty to copy it as is). Its 2 options land in the frame
 * card to pick from. Returns the fresh project detail.
 */
export async function recreateWithManus(projectId: string, file: File, change: string): Promise<ProjectDetail> {
  const base = `/api/dashboard/creative-studio/projects/${projectId}`;
  const prepared = await prepareFrame(file, false);
  const png = /^image\/(png|jpeg)$/.test(prepared.mime) ? prepared : await toPng(prepared.blob);
  const sign = await fetch(`${base}/frames`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "sign", purpose: "recreate", mime: png.mime }),
  });
  const target = await sign.json().catch(() => null);
  if (!sign.ok || !target?.token) throw new Error(target?.error || "Couldn't start the upload");
  await uploadToTarget(target, png.blob, png.mime);
  const gen = await fetch(`${base}/frame/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recreate: target.path, shot: change }),
  });
  const detail = await gen.json().catch(() => null);
  if (!gen.ok || !detail?.project) throw new Error(detail?.error || "Couldn't start Manus");
  return detail as ProjectDetail;
}

/** A video's length and upright size as the browser reads it (null when it can't, e.g. HEVC in Chrome). */
export function readVideo(file: File): Promise<{ durationS: number; width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    let settled = false;
    const done = (out: { durationS: number; width: number; height: number } | null) => {
      if (settled) return;
      settled = true;
      v.removeAttribute("src");
      v.load();
      URL.revokeObjectURL(url);
      resolve(out);
    };
    v.preload = "metadata";
    v.muted = true;
    v.onloadedmetadata = () =>
      done(Number.isFinite(v.duration) && v.duration > 0 ? { durationS: v.duration, width: v.videoWidth, height: v.videoHeight } : null);
    v.onerror = () => done(null);
    setTimeout(() => done(null), 15_000);
    v.src = url;
  });
}

/**
 * Upload the video a reaction video reacts to: checked in the browser first
 * (type, size, length), then sign → direct upload → register. The server
 * gets it ready from there (the source card drives it). Returns the fresh
 * project detail.
 */
export async function uploadSource(projectId: string, file: File): Promise<ProjectDetail> {
  const mime = file.type === "video/mp4" || file.type === "video/quicktime" ? file.type : /\.mov$/i.test(file.name) ? "video/quicktime" : /\.mp4$/i.test(file.name) ? "video/mp4" : "";
  if (!mime) throw new Error("Upload an MP4 or MOV video.");
  if (file.size > SOURCE_MAX_BYTES) {
    throw new Error(`That file is ${Math.round(file.size / 1024 / 1024)} MB. Upload one under ${SOURCE_MAX_BYTES / 1024 / 1024} MB (export it at 1080p).`);
  }
  const meta = await readVideo(file);
  if (meta && meta.durationS > SOURCE_MAX_SECONDS + 0.5) throw new Error(tooLongMessage(meta.durationS));
  const base = `/api/dashboard/creative-studio/projects/${projectId}/source`;
  const sign = await fetch(base, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "sign", mime, size: file.size }) });
  const target = await sign.json().catch(() => null);
  if (!sign.ok || !target?.token) throw new Error(target?.error || "Couldn't start the upload");
  await uploadToTarget(target, file, mime);
  const reg = await fetch(base, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "register", path: target.path, mime, filename: file.name, ...(meta ?? {}) }),
  });
  const detail = await reg.json().catch(() => null);
  if (!reg.ok || !detail?.project) throw new Error(detail?.error || "Couldn't save the video");
  return detail as ProjectDetail;
}

/** Kling accepts PNG/JPG only — convert a WebP frame to PNG in the browser. */
async function toPng(blob: Blob): Promise<{ blob: Blob; mime: string }> {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
  const png = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't convert the image"))), "image/png")
  );
  return { blob: png, mime: "image/png" };
}

/**
 * Save an image as a reference photo — `qs` is "?studio=…" plus
 * "&presenter=…" for a saved presenter's photos. Returns the refreshed list.
 */
export async function uploadReferenceFile(qs: string, file: File): Promise<{ id: string; url: string | null }[]> {
  const base = `/api/dashboard/creative-studio/references${qs}`;
  const prepared = await prepareFrame(file, false);
  const sign = await fetch(base, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "sign", mime: prepared.mime }),
  });
  const target = await sign.json().catch(() => null);
  if (!sign.ok || !target?.token) throw new Error(target?.error || "Couldn't start the upload");
  await uploadToTarget(target, prepared.blob, prepared.mime);
  const reg = await fetch(base, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "register", path: target.path, mime: prepared.mime, width: prepared.width, height: prepared.height }),
  });
  const b = await reg.json().catch(() => null);
  if (!reg.ok) throw new Error(b?.error || "Couldn't save the photo");
  return b.references;
}
