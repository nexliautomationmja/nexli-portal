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
  if (error) throw new Error(error.message || "Upload failed");
}
