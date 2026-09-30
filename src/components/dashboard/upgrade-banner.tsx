"use client";

import { useSyncExternalStore } from "react";
import { XIcon } from "@/components/ui/icons";

const STORAGE_KEY = "nexli-upgrade-banner-dismissed-at";
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const UPGRADE_URL =
  process.env.NEXT_PUBLIC_UPGRADE_BOOKING_URL ||
  "https://www.nexli.net/vslfunnel-offer";

// ── Dismissal store ───────────────────────────────────────
// localStorage is the source of truth (7-day dismissal); an in-memory flag
// backs it up so the banner still hides for this page load when storage is
// blocked. useSyncExternalStore keeps the server render ("hidden") and the
// first client render in sync, then reveals once the browser snapshot runs.

let dismissedThisLoad = false;
const listeners = new Set<() => void>();

function readDismissedAt(): number | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const ts = Number(raw);
    return Number.isFinite(ts) ? ts : null;
  } catch {
    return null;
  }
}

function isVisibleSnapshot(): boolean {
  if (dismissedThisLoad) return false;
  const dismissedAt = readDismissedAt();
  return !(dismissedAt && Date.now() - dismissedAt < DISMISS_MS);
}

function serverSnapshot(): boolean {
  return false;
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

function dismissBanner() {
  dismissedThisLoad = true;
  try {
    window.localStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch {
    // Storage unavailable (private mode, blocked) — in-memory flag still hides it.
  }
  listeners.forEach((l) => l());
}

export function UpgradeBanner() {
  const visible = useSyncExternalStore(subscribe, isVisibleSnapshot, serverSnapshot);

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label="Upgrade"
      className="mb-6 flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border px-4 py-3"
      style={{
        borderColor: "rgba(37, 99, 235, 0.35)",
        background:
          "linear-gradient(135deg, rgba(37,99,235,0.12), rgba(6,182,212,0.10))",
      }}
    >
      <p
        className="flex-1 text-sm leading-relaxed"
        style={{ color: "var(--text-main)" }}
      >
        Upgrade to the full Digital Rainmaker System. Your $497 is credited if
        you upgrade in your first 90 days.
      </p>
      <div className="flex items-center gap-2 shrink-0">
        <a
          href={UPGRADE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 rounded-lg text-sm font-bold text-white no-underline transition-all hover:opacity-90"
          style={{ background: "linear-gradient(135deg, #2563EB, #06B6D4)" }}
        >
          Book an upgrade call
        </a>
        <button
          type="button"
          onClick={dismissBanner}
          aria-label="Dismiss for 7 days"
          title="Dismiss for 7 days"
          className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[var(--input-bg)] transition-colors"
          style={{ color: "var(--text-muted)" }}
        >
          <XIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
