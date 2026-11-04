"use client";

import { useState } from "react";
import { downloadHref } from "@/components/creative-studio/client";
import { useIsTouch } from "@/lib/use-media";

/** Can this device hand a video file to the share sheet (iOS / Android "Save Video")? */
function canShareVideo(): boolean {
  try {
    return typeof navigator !== "undefined" && "canShare" in navigator && navigator.canShare({ files: [new File([""], "v.mp4", { type: "video/mp4" })] });
  } catch {
    return false;
  }
}

/**
 * Download on a computer; on a phone, "Save to Photos" through the share
 * sheet so the video lands in the camera roll (falls back to a download).
 */
export function SaveVideoLink({
  url,
  filename,
  className,
  children,
}: {
  url: string;
  filename: string;
  className?: string;
  /** The desktop label (e.g. an icon + "Download"). */
  children: React.ReactNode;
}) {
  const touch = useIsTouch();
  const [busy, setBusy] = useState(false);
  const href = downloadHref(url, filename);

  if (!touch) {
    return (
      <a href={href} download className={className}>
        {children}
      </a>
    );
  }

  async function save() {
    if (!canShareVideo()) {
      window.location.href = href;
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(String(res.status));
      const file = new File([await res.blob()], filename, { type: "video/mp4" });
      await navigator.share({ files: [file], title: filename });
    } catch (err) {
      // Cancelled share sheets throw AbortError: nothing to do. Anything else: plain download.
      if (!(err instanceof DOMException && err.name === "AbortError")) window.location.href = href;
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" onClick={() => void save()} disabled={busy} className={className}>
      {busy ? "Preparing…" : "Save to Photos"}
    </button>
  );
}
