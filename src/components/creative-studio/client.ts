"use client";

import type { ProjectDetail } from "@/lib/creative-studio/service";

export function api(path: string) {
  return `/api/dashboard/creative-studio/projects/${path}`;
}

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

