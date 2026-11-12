"use client";

import { unzip, type UnzipFileInfo } from "fflate";
import { AVATAR_MAX_PHOTOS } from "@/lib/creative-studio/avatar-shared";

/**
 * An avatar's photos from what Marcel drops: a zip (opened right here in the
 * browser, so only the photos upload) and/or loose photos. Keeps JPG, PNG and
 * WebP, at most 12 (in name order), and says what it skipped and why.
 */

const TYPES: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
/** A zip bigger than this is refused (it's opened in the browser's memory). */
const ZIP_MAX_BYTES = 400 * 1024 * 1024;
/** Photos bigger than this (or wider than LONG_EDGE_MAX) are shrunk before upload: Claude takes ≤5 MB per image, Kling < 4K. */
const PHOTO_MAX_BYTES = 4 * 1024 * 1024;
const LONG_EDGE_MAX = 2560;
const SHRINK_TO = 2048;

export interface PhotoPick {
  photos: File[];
  skipped: string[];
}

const ext = (name: string) => name.toLowerCase().split(".").pop() ?? "";
const base = (path: string) => path.split("/").pop() ?? path;
const isZip = (f: File) => f.type === "application/zip" || f.type === "application/x-zip-compressed" || ext(f.name) === "zip";
const junk = (path: string) => path.startsWith("__MACOSX/") || path.includes("/__MACOSX/") || base(path).startsWith(".") || path.endsWith("/");
const byName = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

/** Why a file in the drop isn't used (null = it's a photo we take). */
function skipReason(name: string): string | null {
  const e = ext(name);
  if (TYPES[e]) return null;
  if (e === "heic" || e === "heif") return `${base(name)}: iPhone HEIC photo — export it as JPG`;
  if (e === "zip") return `${base(name)}: a zip inside the zip`;
  return `${base(name)}: not a photo`;
}

function unzipPhotos(data: Uint8Array): Promise<{ files: File[]; skipped: string[] }> {
  const skipped: string[] = [];
  return new Promise((resolve, reject) => {
    unzip(
      data,
      {
        filter: (f: UnzipFileInfo) => {
          if (junk(f.name)) return false;
          const why = skipReason(f.name);
          if (why) skipped.push(why);
          return !why;
        },
      },
      (err, entries) => {
        if (err) {
          reject(new Error("That zip couldn't be opened. Make it again (right-click → Compress) and drop it here."));
          return;
        }
        const files = Object.entries(entries)
          .filter(([, bytes]) => bytes.length > 0)
          .map(([path, bytes]) => new File([bytes as Uint8Array<ArrayBuffer>], base(path), { type: TYPES[ext(path)] }));
        resolve({ files, skipped });
      }
    );
  });
}

/** Big photos made smaller (JPEG), so Claude and Kling both take them. */
async function shrink(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) throw new Error(`${file.name} isn't a readable photo`);
  const long = Math.max(bitmap.width, bitmap.height);
  if (file.size <= PHOTO_MAX_BYTES && long <= LONG_EDGE_MAX) {
    bitmap.close();
    return file;
  }
  const scale = Math.min(1, SHRINK_TO / long);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.92));
  if (!blob) return file;
  return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
}

/** The photos to upload from a drop (zips opened, junk skipped, at most `room`). */
export async function photosFromDrop(dropped: File[], room = AVATAR_MAX_PHOTOS): Promise<PhotoPick> {
  const skipped: string[] = [];
  let found: File[] = [];
  for (const f of dropped) {
    if (isZip(f)) {
      if (f.size > ZIP_MAX_BYTES) {
        skipped.push(`${f.name}: bigger than 400 MB`);
        continue;
      }
      const out = await unzipPhotos(new Uint8Array(await f.arrayBuffer()));
      found.push(...out.files.sort((a, b) => byName.compare(a.name, b.name)));
      skipped.push(...out.skipped);
    } else {
      const why = skipReason(f.name);
      if (why) skipped.push(why);
      else found.push(f.type ? f : new File([f], f.name, { type: TYPES[ext(f.name)] }));
    }
  }
  if (found.length > room) {
    skipped.push(`${found.length - room} more photo${found.length - room === 1 ? "" : "s"}: an avatar takes ${AVATAR_MAX_PHOTOS}, so the first ones by name are used`);
    found = found.slice(0, Math.max(0, room));
  }
  const photos: File[] = [];
  for (const f of found) {
    try {
      photos.push(await shrink(f));
    } catch (err) {
      skipped.push(err instanceof Error ? err.message : `${f.name} couldn't be read`);
    }
  }
  return { photos, skipped };
}
