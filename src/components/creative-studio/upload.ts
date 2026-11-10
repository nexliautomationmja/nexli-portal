"use client";

import { createClient } from "@supabase/supabase-js";

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
