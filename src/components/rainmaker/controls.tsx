"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { Check, Copy } from "lucide-react";
import { FOCUS_RING, NUM_FONT, labelCls } from "./tokens";

// ─── Buttons ───────────────────────────────────────────────

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "rounded-full bg-blue-600 font-bold text-white shadow-xl shadow-blue-600/20 hover:bg-blue-500",
  secondary: "rounded-full border border-white/10 bg-white/5 font-semibold text-neutral-200 hover:bg-white/10 hover:text-white",
  ghost: "rounded-full font-semibold text-cyan-300 hover:text-cyan-200 hover:underline",
  danger: "rounded-full border border-rose-500/30 bg-rose-500/10 font-semibold text-rose-200 hover:bg-rose-500/20",
};
const SIZE = {
  md: { solid: "min-h-11 px-5 text-sm", ghost: "min-h-9 px-1 text-xs" },
  sm: { solid: "min-h-9 px-4 text-xs", ghost: "min-h-8 px-1 text-xs" },
};

/** Class string for a button or a link styled as one. */
export function buttonCls(variant: ButtonVariant = "primary", size: "md" | "sm" = "md") {
  const s = variant === "ghost" ? SIZE[size].ghost : SIZE[size].solid;
  return `inline-flex items-center justify-center gap-2 whitespace-nowrap transition-all active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 ${FOCUS_RING} ${VARIANT[variant]} ${s}`;
}

/** The small busy spinner buttons use (inherits the text color). */
export const Spinner = ({ className = "h-3.5 w-3.5" }: { className?: string }) => (
  <span className={`${className} inline-block animate-spin rounded-full border-2 border-current border-t-transparent`} aria-hidden="true" />
);

export function Button({
  variant = "primary",
  size = "md",
  busy = false,
  className = "",
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: "md" | "sm"; busy?: boolean }) {
  return (
    <button type="button" {...rest} disabled={rest.disabled || busy} className={`${buttonCls(variant, size)} ${className}`}>
      {busy && <Spinner />}
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  variant = "secondary",
  size = "md",
  className = "",
  external = false,
  children,
}: {
  href: string;
  variant?: ButtonVariant;
  size?: "md" | "sm";
  className?: string;
  external?: boolean;
  children: React.ReactNode;
}) {
  const cls = `${buttonCls(variant, size)} ${className}`;
  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
      {children}
    </a>
  ) : (
    <Link href={href} className={cls}>
      {children}
    </Link>
  );
}

/** Round icon-only button. `label` is required: it is the accessible name. `danger` = destructive (rose on hover). */
export function IconButton({
  label,
  danger = false,
  className = "",
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string; danger?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...rest}
      className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-neutral-400 transition-colors disabled:opacity-40 ${
        danger ? "hover:bg-rose-500/10 hover:text-rose-300" : "hover:bg-white/10 hover:text-white"
      } ${FOCUS_RING} ${className}`}
    >
      {children}
    </button>
  );
}

// ─── Segmented control ─────────────────────────────────────

export type SegmentOption<T extends string> = { value: T; label: React.ReactNode; short?: React.ReactNode; icon?: React.ReactNode };

/**
 * One choice out of a few (date range, tabs). The selected value gets the
 * blue→cyan gradient. `kind="tabs"` exposes it as a tab list.
 */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  kind = "radio",
  size = "md",
  busyValue,
  block = false,
  numeric = false,
}: {
  value: T;
  options: readonly SegmentOption<T>[];
  onChange: (v: T) => void;
  ariaLabel: string;
  kind?: "radio" | "tabs";
  size?: "md" | "sm";
  busyValue?: T | null;
  block?: boolean;
  numeric?: boolean;
}) {
  return (
    <div
      className={`${block ? "flex w-full" : "inline-flex"} rounded-2xl border border-white/10 bg-white/[0.04] p-1`}
      role={kind === "tabs" ? "tablist" : "radiogroup"}
      aria-label={ariaLabel}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role={kind === "tabs" ? "tab" : "radio"}
            aria-checked={kind === "radio" ? on : undefined}
            aria-selected={kind === "tabs" ? on : undefined}
            onClick={() => onChange(o.value)}
            className={`${block ? "flex-1" : ""} ${size === "sm" ? "min-h-9" : "min-h-10"} inline-flex min-w-[3.25rem] items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-bold transition-all ${FOCUS_RING} ${
              on ? "bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-500/30" : "text-neutral-400 hover:bg-white/[0.06] hover:text-white"
            }`}
            style={numeric ? NUM_FONT : undefined}
          >
            {busyValue != null && busyValue === o.value ? (
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white/80 border-t-transparent align-middle" aria-hidden="true" />
            ) : (
              <>
                {o.icon}
                {o.short ? (
                  <>
                    <span className="sm:hidden">{o.short}</span>
                    <span className="hidden sm:inline">{o.label}</span>
                  </>
                ) : (
                  o.label
                )}
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Fields ────────────────────────────────────────────────

/** The one input recipe: dark well, 16px on phones (no iOS zoom), cyan focus. */
export const FIELD =
  "w-full rounded-xl border border-white/10 bg-black/30 px-3.5 py-2.5 text-[16px] text-white outline-none transition-colors placeholder:text-neutral-500 focus:border-cyan-400/60 sm:text-sm";

/** Label + control + hint/counter. Pass the control as children with the given id. */
export function Field({
  label,
  hint,
  counter,
  children,
  className = "",
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  counter?: { value: number; max: number };
  children: (id: string) => React.ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className={labelCls}>
        {label}
      </label>
      {children(id)}
      {(hint || counter) && (
        <div className="mt-1.5 flex items-start justify-between gap-3 text-[11px] text-neutral-400">
          <span>{hint}</span>
          {counter && (
            <span className={counter.value > counter.max ? "text-rose-300" : ""} style={NUM_FONT}>
              {counter.value.toLocaleString("en-US")}/{counter.max.toLocaleString("en-US")}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/** A read-only value with a Copy button ("Copied!" is announced to screen readers). */
export function CopyField({ label, value, mono = true, className = "" }: { label?: React.ReactNode; value: string; mono?: boolean; className?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked: the value stays selectable */
    }
  };
  return (
    <div className={className}>
      {label && <div className={labelCls}>{label}</div>}
      <div className="flex items-stretch gap-2">
        <div
          className={`min-w-0 flex-1 select-all break-all rounded-xl border border-white/5 bg-black/30 px-3.5 py-2.5 text-xs leading-relaxed text-neutral-200 ${mono ? "font-mono" : ""}`}
        >
          {value || <span className="text-neutral-500">—</span>}
        </div>
        <button type="button" onClick={copy} disabled={!value} className={`${buttonCls("primary", "sm")} shrink-0 self-start`}>
          {copied ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <span className="sr-only" aria-live="polite">
        {copied ? "Copied to clipboard" : ""}
      </span>
    </div>
  );
}
