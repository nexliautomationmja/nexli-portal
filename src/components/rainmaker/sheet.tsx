"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { RainmakerStyles } from "./canvas";
import { CANVAS_VARS, SYNE } from "./tokens";

const WIDTH = { md: "sm:max-w-lg", lg: "sm:max-w-3xl", xl: "sm:max-w-5xl" } as const;

/**
 * Dialog that slides up from the bottom on phones and sits centered from sm up.
 * Portaled to <body> (so nothing on the page can trap it), always dark, Esc
 * closes it, scrolling is locked on <html>, and focus returns where it was.
 */
export function Sheet({
  open,
  onClose,
  title,
  sub,
  size = "lg",
  fullOnPhone = false,
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  sub?: React.ReactNode;
  size?: keyof typeof WIDTH;
  fullOnPhone?: boolean;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  // eslint-disable-next-line react-hooks/set-state-in-effect -- portal target exists only after mount
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const before = document.activeElement as HTMLElement | null;
    const html = document.documentElement;
    const prevOverflow = html.style.overflow;
    html.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
    };
    window.addEventListener("keydown", onKey);
    requestAnimationFrame(() => panel.current?.focus());
    return () => {
      window.removeEventListener("keydown", onKey);
      html.style.overflow = prevOverflow;
      before?.focus?.();
    };
  }, [open]);

  if (!mounted || !open) return null;
  return createPortal(
    <div
      className="dark fixed inset-0 z-[100] flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-6"
      style={CANVAS_VARS}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <RainmakerStyles />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`flex w-full flex-col overflow-hidden border border-white/10 bg-[#0b1220] text-white shadow-2xl shadow-black/60 outline-none ${WIDTH[size]} ${
          fullOnPhone ? "h-[100dvh] sm:h-auto sm:max-h-[90dvh] sm:rounded-3xl" : "max-h-[94dvh] rounded-t-3xl sm:max-h-[90dvh] sm:rounded-3xl"
        }`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 pb-4 pt-[max(1rem,env(safe-area-inset-top))] sm:pt-4">
          <div className="min-w-0">
            <h2 id={titleId} className="truncate text-lg font-bold text-white" style={SYNE}>
              {title}
            </h2>
            {sub && <div className="mt-0.5 text-xs text-neutral-400">{sub}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="cs-scroll flex-1 overflow-y-auto overscroll-contain px-5 py-5">{children}</div>
        {footer && <div className="border-t border-white/10 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
