"use client";

import type { ProjectDetail } from "@/lib/creative-studio/service";

export function api(path: string) {
  return `/api/dashboard/creative-studio/projects/${path}`;
}

/** `?studio=…` for the studio-wide lists and creates (videos, batches, references, ad copy). */
export const inStudioQs = (key: string) => `?studio=${encodeURIComponent(key)}`;

/** A studio's home page ("nexli" = Nexli's own studio). */
export const studioHref = (key: string, tab: "videos" | "adcopy" = "videos") =>
  `/dashboard/creative-studio/s/${encodeURIComponent(key)}${tab === "adcopy" ? "/ad-copy" : ""}`;

export async function send(
  url: string,
  method: string,
  body?: unknown
): Promise<{ ok: true; data: ProjectDetail & { rewriteNotes?: string } } | { ok: false; error: string }> {
  try {
    const r = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await r.json().catch(() => null);
    if (!r.ok) return { ok: false, error: data?.error || `Request failed (${r.status})` };
    return { ok: true, data };
  } catch {
    return { ok: false, error: "Network error. Check your connection and try again." };
  }
}


/**
 * A link that saves the file to the computer instead of opening it in a tab:
 * Supabase signed URLs take a `download` filename (Content-Disposition:
 * attachment). Renders kept on AWS are already stored as downloads.
 */
export function downloadHref(url: string, filename: string): string {
  try {
    const u = new URL(url);
    if (!/\.supabase\.(co|in)$/.test(u.hostname)) return url;
    u.searchParams.set("download", filename);
    return u.toString();
  } catch {
    return url;
  }
}

/** "nexli-the-volume-trap-ladder-v4.mp4" */
export function videoFileName(title: string, ...parts: (string | number)[]): string {
  const slug = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);
  return `${["nexli", slug(title) || "video", ...parts.map((p) => slug(String(p)))].filter(Boolean).join("-")}.mp4`;
}
