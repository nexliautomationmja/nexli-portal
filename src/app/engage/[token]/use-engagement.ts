"use client";

// ─── Engagement signing — data + actions shared by both signing pages ─────
// The classic page (engage-client.tsx, used for letters a client firm sends
// to its own clients) and the Launch Pad page (engage-launch-pad-client.tsx,
// used for letters Nexli itself issues) talk to the same /api/engage/[token]
// endpoints through these helpers, so signing behaves identically on both.

import { createElement, useEffect, useState } from "react";

export interface EngageData {
  clientName: string;
  clientCompany: string | null;
  subject: string;
  content: string;
  expiresAt: string;
  status: string;
  role?: string | null;
  from?: {
    name: string;
    company: string;
  };
  sender?: {
    name: string;
    role: string | null;
    signedAt: string | null;
    signatureData: string | null;
  } | null;
}

export type EngagementState =
  | { status: "loading"; data: null; error: null }
  | { status: "ready"; data: EngageData; error: null }
  | { status: "error"; data: null; error: string };

/** GET /api/engage/[token] — the letter, signer and sender details. */
export function useEngagement(token: string): EngagementState {
  const [state, setState] = useState<EngagementState>({
    status: "loading",
    data: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/engage/${token}`);
        if (!res.ok) {
          const body = await res.json();
          if (!cancelled) {
            setState({ status: "error", data: null, error: body.error || "Invalid or expired link" });
          }
          return;
        }
        const d: EngageData = await res.json();
        if (!cancelled) setState({ status: "ready", data: d, error: null });
      } catch {
        if (!cancelled) {
          setState({ status: "error", data: null, error: "Failed to load engagement letter" });
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return state;
}

// ─── Signature rendering ───────────────────────────────────

export const SIGNATURE_CANVAS_WIDTH = 600;
export const SIGNATURE_CANVAS_HEIGHT = 180;

/**
 * Off-screen canvas the typed signature is drawn into before it is sent to
 * the API as a PNG. Render one per signing page and pass its ref to
 * `signEngagement`.
 */
export function SignatureCanvas({ ref }: { ref: React.Ref<HTMLCanvasElement> }) {
  return createElement("canvas", {
    ref,
    width: SIGNATURE_CANVAS_WIDTH,
    height: SIGNATURE_CANVAS_HEIGHT,
    style: { position: "absolute", left: "-10000px", top: "-10000px" },
    "aria-hidden": "true",
  });
}

/**
 * Render the typed name into the hidden canvas using the cursive font.
 * Returns a PNG data URL we can ship to the existing API.
 */
export async function renderTypedSignatureToPng(
  canvas: HTMLCanvasElement | null,
  name: string
): Promise<string | null> {
  if (!canvas) return null;

  // Wait for the cursive font to be loaded so it actually renders correctly.
  if (typeof document !== "undefined" && document.fonts) {
    try {
      await document.fonts.load('48px "Dancing Script"');
      await document.fonts.ready;
    } catch {
      /* ignore — fall back to whatever the system has */
    }
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#1e293b";
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";

  // Auto-shrink font so long names fit
  let fontSize = 72;
  const maxWidth = canvas.width - 40;
  do {
    ctx.font = `${fontSize}px "Dancing Script", "Snell Roundhand", "Brush Script MT", cursive`;
    if (ctx.measureText(name).width <= maxWidth) break;
    fontSize -= 4;
  } while (fontSize > 24);

  ctx.fillText(name, canvas.width / 2, canvas.height / 2);
  return canvas.toDataURL("image/png");
}

/**
 * Cursive SVG preview of typed name — used for the live document preview only.
 * The actual saved signature is rendered to PNG via a hidden canvas in
 * `renderTypedSignatureToPng` so it matches what the recipient sees on submit.
 */
export function buildPreviewSignatureSvg(name: string): string {
  const escaped = name.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<": return "&lt;";
      case ">": return "&gt;";
      case "&": return "&amp;";
      case "'": return "&apos;";
      case '"': return "&quot;";
      default: return c;
    }
  });
  const length = name.length;
  let fontSize = 84;
  if (length > 12) fontSize = 72;
  if (length > 18) fontSize = 60;
  if (length > 26) fontSize = 48;
  if (length > 36) fontSize = 38;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 180" width="600" height="180"><text x="300" y="105" font-family="'Brush Script MT','Snell Roundhand','Lucida Handwriting','Apple Chancery',cursive" font-size="${fontSize}" font-style="italic" font-weight="500" fill="#1e293b" text-anchor="middle" dominant-baseline="middle">${escaped}</text></svg>`;
  const base64 =
    typeof btoa !== "undefined"
      ? btoa(unescape(encodeURIComponent(svg)))
      : "";
  return `data:image/svg+xml;base64,${base64}`;
}

// ─── Actions ───────────────────────────────────────────────

export type SignResult =
  | { ok: true; allSigned: boolean; onboardingUrl: string | null }
  | { ok: false; error: string };

/** POST /api/engage/[token] — renders the typed name to PNG and records the signature. */
export async function signEngagement(
  token: string,
  typedName: string,
  canvas: HTMLCanvasElement | null
): Promise<SignResult> {
  const name = typedName.trim();
  try {
    const signatureData = await renderTypedSignatureToPng(canvas, name);
    if (!signatureData) {
      return { ok: false, error: "Signing failed. Please try again." };
    }
    const res = await fetch(`/api/engage/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signatureData, typedName: name }),
    });
    // Parse defensively: the signature is already recorded server-side on a
    // 2xx, so a malformed body must not surface as a signing failure.
    const body: { error?: string; onboardingUrl?: string; allSigned?: boolean } = await res
      .json()
      .catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: body.error || "Signing failed" };
    }
    return {
      ok: true,
      allSigned: !!body.allSigned,
      onboardingUrl: body.onboardingUrl || null,
    };
  } catch {
    return { ok: false, error: "Signing failed. Please try again." };
  }
}

/** PATCH /api/engage/[token] — declines; the reason is optional. */
export async function declineEngagement(
  token: string,
  reason: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await fetch(`/api/engage/${token}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    return { ok: true };
  } catch {
    return { ok: false, error: "Failed to decline" };
  }
}

/** The consent text beside the "I agree" checkbox (role-aware). */
export function agreementText(role: string | null | undefined): string {
  return role
    ? `I have read the engagement letter above and, as ${role}, agree to sign electronically on behalf of the organization. By signing, I acknowledge that my electronic signature is the legal equivalent of my handwritten signature under the ESIGN Act (15 U.S.C. § 7001) and UETA. My signature, role, IP address, and timestamp will be recorded.`
    : "I have read the engagement letter above and agree to sign electronically. By signing, I acknowledge that my electronic signature is the legal equivalent of my handwritten signature under the ESIGN Act (15 U.S.C. § 7001) and UETA. My signature, IP address, and timestamp will be recorded.";
}
