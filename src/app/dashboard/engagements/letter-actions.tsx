"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, Download, Share } from "lucide-react";
import { Button, Toast, useToast } from "@/components/rainmaker";
import type { OwnerBranding } from "@/lib/branding";
import { letterFileName, letterText, type LetterExport } from "@/lib/engagement-export";
import { useIsTouch } from "@/lib/use-media";

/** Can this device hand a PDF to the share sheet (iPhone / Android: Mail, Messages, Files)? */
function canSharePdf(): boolean {
  try {
    return typeof navigator !== "undefined" && typeof navigator.share === "function" && navigator.canShare?.({ files: [new File([""], "a.pdf", { type: "application/pdf" })] }) === true;
  } catch {
    return false;
  }
}

function saveFile(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

type Built = { for: LetterExport; file: File | null };

/**
 * Keep or send a letter: Download PDF, Share (phones: the share sheet, so the
 * PDF goes straight into an email) and Copy text. The PDF is made as soon as
 * the letter opens — the share sheet only opens straight after a tap, so it
 * has to be ready by then.
 */
export function LetterActions({ letter, branding }: { letter: LetterExport; branding: OwnerBranding }) {
  const touch = useIsTouch();
  const share = touch && canSharePdf();
  const { toast, showToast } = useToast();
  const [built, setBuilt] = useState<Built | null>(null);
  const [attempt, setAttempt] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    import("@/lib/engagement-pdf")
      .then(({ engagementPdf }) => engagementPdf({ ...letter, branding }))
      .then((blob) => live && setBuilt({ for: letter, file: new File([blob], letterFileName(letter), { type: "application/pdf" }) }))
      .catch((err) => {
        console.error("[engagements] PDF failed:", err);
        if (live) setBuilt({ for: letter, file: null });
      });
    return () => {
      live = false;
    };
  }, [letter, branding, attempt]);

  const current = built?.for === letter ? built : null;
  const file = current?.file ?? null;
  const preparing = !current;
  const failed = Boolean(current && !current.file);

  function download() {
    if (!file) return;
    saveFile(file);
  }

  async function sharePdf() {
    if (!file) return;
    try {
      await navigator.share({ files: [file], title: file.name.replace(/\.pdf$/i, "") });
    } catch (err) {
      // Closing the share sheet throws AbortError: nothing to do. Anything else: save it instead.
      if (!(err instanceof DOMException && err.name === "AbortError")) saveFile(file);
    }
  }

  async function copy() {
    const text = letterText(letter);
    try {
      await navigator.clipboard.writeText(text);
      showToast("Letter copied", "success");
      return;
    } catch {
      /* older browsers: the textarea way below */
    }
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;font-size:16px";
    (box.current ?? document.body).appendChild(area);
    area.select();
    area.setSelectionRange(0, text.length);
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    area.remove();
    showToast(ok ? "Letter copied" : "Couldn't copy on this device. Use Download PDF instead.", ok ? "success" : "error");
  }

  const busyLabel = preparing ? "Preparing…" : null;
  return (
    <div ref={box}>
      <div className={share ? "grid grid-cols-3 gap-2 sm:flex sm:flex-wrap" : "grid grid-cols-2 gap-2 sm:flex sm:flex-wrap"}>
        {share && (
          <Button size="sm" onClick={() => void sharePdf()} disabled={!file} busy={preparing} className="px-3">
            {!preparing && <Share className="h-4 w-4" aria-hidden="true" />}
            {busyLabel ?? "Share PDF"}
          </Button>
        )}
        <Button size="sm" variant="secondary" onClick={download} disabled={!file} busy={preparing && !share} className="px-3">
          {!(preparing && !share) && <Download className="h-4 w-4" aria-hidden="true" />}
          {share ? "Download" : (busyLabel ?? "Download PDF")}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => void copy()} className="px-3">
          <Copy className="h-4 w-4" aria-hidden="true" />
          Copy text
        </Button>
      </div>
      {failed && (
        <p className="mt-2 text-xs text-rose-300" role="alert">
          Couldn&apos;t make the PDF.{" "}
          <button
            type="button"
            onClick={() => {
              setBuilt(null);
              setAttempt((n) => n + 1);
            }}
            className="font-semibold underline"
          >
            Try again
          </button>
        </p>
      )}
      {share && !failed && <p className="mt-2 text-[11px] text-neutral-400">Share PDF opens your phone&apos;s share sheet: pick Mail or Gmail to send it as an attachment, or Save to Files.</p>}
      <Toast toast={toast} />
    </div>
  );
}
