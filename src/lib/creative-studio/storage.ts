import { getSupabase } from "@/lib/supabase";

/**
 * Private Supabase bucket for Creative Studio files (frames, Kling clips,
 * renders). The browser uploads straight to it with signed upload URLs —
 * Vercel caps request bodies at ~4.5 MB, far below a frame or a clip — and
 * everything is read back through short-lived signed URLs.
 */
export const CREATIVE_BUCKET = "creative-studio";

const MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "video/mp4",
  "video/quicktime",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
  "audio/x-m4a",
];

export const FRAME_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"];

let ready: Promise<void> | null = null;

/** Ensure the bucket exists, is private and accepts our types. Memoized per lambda. */
export function ensureCreativeBucket(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      const storage = getSupabase().storage;
      const withLimit = { public: false, allowedMimeTypes: MIME_TYPES, fileSizeLimit: "500MB" };
      const noLimit = { public: false, allowedMimeTypes: MIME_TYPES };
      const { data, error } = await storage.getBucket(CREATIVE_BUCKET);
      if (error || !data) {
        // The project-wide upload limit may be lower than 500MB; fall back to it.
        let created = await storage.createBucket(CREATIVE_BUCKET, withLimit);
        if (created.error && !/already exists/i.test(created.error.message)) {
          created = await storage.createBucket(CREATIVE_BUCKET, noLimit);
        }
        if (created.error && !/already exists/i.test(created.error.message)) throw created.error;
        return;
      }
      const allowed = (data.allowed_mime_types ?? []) as string[];
      const missing = allowed.length > 0 && MIME_TYPES.some((m) => !allowed.includes(m));
      if (data.public || missing) {
        let updated = await storage.updateBucket(CREATIVE_BUCKET, withLimit);
        if (updated.error) updated = await storage.updateBucket(CREATIVE_BUCKET, noLimit);
        if (updated.error) throw updated.error;
      }
    })().catch((err) => {
      ready = null;
      throw err;
    });
  }
  return ready;
}

/** A one-time upload URL + token for `path` (valid ~2 hours). */
export async function createUploadTarget(path: string): Promise<{ path: string; token: string }> {
  await ensureCreativeBucket();
  const { data, error } = await getSupabase().storage.from(CREATIVE_BUCKET).createSignedUploadUrl(path);
  if (error || !data) throw error ?? new Error("Couldn't create an upload URL");
  return { path: data.path, token: data.token };
}

/** Signed read URLs for several paths at once (missing paths map to null). */
export async function signPaths(paths: (string | null | undefined)[], seconds = 3600): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter((p): p is string => Boolean(p)))];
  const out = new Map<string, string>();
  if (unique.length === 0) return out;
  const { data, error } = await getSupabase().storage.from(CREATIVE_BUCKET).createSignedUrls(unique, seconds);
  if (error) {
    console.error("[creative-studio] signing failed:", error.message);
    return out;
  }
  for (const row of data ?? []) if (row.path && row.signedUrl) out.set(row.path, row.signedUrl);
  return out;
}

export async function removePaths(paths: (string | null | undefined)[]): Promise<void> {
  const list = paths.filter((p): p is string => Boolean(p));
  if (list.length === 0) return;
  const { error } = await getSupabase().storage.from(CREATIVE_BUCKET).remove(list);
  if (error) console.error("[creative-studio] remove failed:", error.message);
}
