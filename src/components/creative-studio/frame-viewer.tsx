"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CANVAS_VARS, SP, SvgIcon } from "@/components/creative-studio/canvas";

export interface ViewerItem {
  id: string;
  url: string | null;
  /** "Opening frame", "Scene 2 · Desk", "Manus option 1"… */
  label: string;
  width?: number | null;
  height?: number | null;
  /** E.g. "Use this" on a Manus option. */
  action?: { label: string; onClick: () => void };
}

/**
 * A frame up close: full screen, fitted to the window. Tap or click the
 * image for actual size (scroll or drag to look around), tap again to fit.
 * ← / → and swipe move between frames (a story's scenes, Manus's options).
 */
export function FrameViewer({
  items,
  index,
  onIndex,
  onClose,
}: {
  items: ViewerItem[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const item = items[Math.min(Math.max(0, index), items.length - 1)];
  const [zoomed, setZoomed] = useState<string | null>(null);
  const actual = Boolean(item && zoomed === item.id);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const many = items.length > 1;

  useEffect(() => {
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = "hidden";
    const back = document.activeElement as HTMLElement | null;
    closeBtn.current?.focus();
    return () => {
      root.style.overflow = prev;
      back?.focus?.();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight" && many) onIndex((index + 1) % items.length);
      else if (e.key === "ArrowLeft" && many) onIndex((index - 1 + items.length) % items.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, items.length, many, onIndex, onClose]);

  if (!item) return null;
  const size = item.width && item.height ? `${item.width}×${item.height}` : null;

  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex flex-col bg-[#020617] text-white"
      style={{ ...CANVAS_VARS, paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
      role="dialog"
      aria-modal="true"
      aria-label={item.label}
    >
      <div className="flex items-center gap-3 px-3 py-2.5 sm:px-5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{item.label}</p>
          <p className="text-[11px] text-neutral-400">
            {many ? `${index + 1} of ${items.length}` : ""}
            {many && size ? " · " : ""}
            {size ?? ""}
            {" · "}
            {actual ? "Actual size: tap to fit" : "Tap the frame for actual size"}
          </p>
        </div>
        {item.url && (
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="hidden min-h-10 items-center gap-1.5 rounded-full border border-white/15 px-3.5 text-xs font-semibold text-neutral-200 hover:bg-white/10 hover:text-white sm:inline-flex"
          >
            <SvgIcon d={SP.external} size={14} /> Open original
          </a>
        )}
        <button
          ref={closeBtn}
          type="button"
          onClick={onClose}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          aria-label="Close"
        >
          <SvgIcon d={SP.x} size={18} />
        </button>
      </div>

      <div
        className={`relative min-h-0 flex-1 ${actual ? "overflow-auto" : "flex items-center justify-center overflow-hidden px-2 sm:px-16"}`}
        onPointerDown={(e) => {
          swipe.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={(e) => {
          const s = swipe.current;
          swipe.current = null;
          if (!s || actual || !many) return;
          const dx = e.clientX - s.x;
          if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(e.clientY - s.y)) onIndex((index + (dx < 0 ? 1 : -1) + items.length) % items.length);
        }}
      >
        {item.url ? (
          <button
            type="button"
            onClick={() => setZoomed(actual ? null : item.id)}
            className={actual ? "mx-auto block w-fit cursor-zoom-out" : "flex h-full w-full cursor-zoom-in items-center justify-center"}
            aria-label={actual ? "Fit to the screen" : "Show at actual size"}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URL, shown at its own size */}
            <img
              src={item.url}
              alt={item.label}
              draggable={false}
              className={actual ? "max-w-none select-none" : "max-h-full max-w-full select-none rounded-lg object-contain"}
              style={actual && item.width ? { width: item.width } : undefined}
            />
          </button>
        ) : (
          <p className="text-sm text-neutral-500">No image yet.</p>
        )}
        {many && !actual && (
          <>
            <button
              type="button"
              onClick={() => onIndex((index - 1 + items.length) % items.length)}
              className="absolute left-2 top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-2xl text-white hover:bg-white/20 sm:flex"
              aria-label="Previous"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => onIndex((index + 1) % items.length)}
              className="absolute right-2 top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-2xl text-white hover:bg-white/20 sm:flex"
              aria-label="Next"
            >
              ›
            </button>
          </>
        )}
      </div>

      {(item.action || many) && (
        <div className="flex items-center justify-center gap-2 px-3 py-3">
          {many && (
            <button
              type="button"
              onClick={() => onIndex((index - 1 + items.length) % items.length)}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-xl sm:hidden"
              aria-label="Previous"
            >
              ‹
            </button>
          )}
          {item.action && (
            <button type="button" onClick={item.action.onClick} className="min-h-11 rounded-full bg-blue-600 px-5 text-sm font-bold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500">
              {item.action.label}
            </button>
          )}
          {many && (
            <button
              type="button"
              onClick={() => onIndex((index + 1) % items.length)}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-xl sm:hidden"
              aria-label="Next"
            >
              ›
            </button>
          )}
        </div>
      )}
    </div>,
    document.body
  );
}
