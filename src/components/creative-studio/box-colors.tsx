"use client";

// ─── Colors for one text box (edit card ✎ → Colors) ────────
// The card (its box) and its words, each: Nexli (the rulebook's colour), a
// quick swatch, any colour from the system picker, or a typed hex. The
// edit card previews every change live on the video before it's saved.

import { useState } from "react";
import { cleanHex } from "@/lib/creative-studio/edit-text";
import type { BoxColors } from "@/remotion/types";
import { NUM_FONT } from "@/components/engagement-launch-pad/styles";

const SWATCHES: { name: string; hex: string }[] = [
  { name: "White", hex: "#FFFFFF" },
  { name: "Black", hex: "#000000" },
  { name: "Navy", hex: "#0A0E1E" },
  { name: "Blue", hex: "#2563EB" },
  { name: "Cyan", hex: "#06B6D4" },
  { name: "Green", hex: "#22C55E" },
  { name: "Gold", hex: "#FACC15" },
  { name: "Orange", hex: "#F97316" },
  { name: "Red", hex: "#DC2626" },
  { name: "Purple", hex: "#7C3AED" },
];

/** WCAG contrast ratio of two #RRGGBB colours (1–21). */
function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function ColorRow({
  label,
  value,
  fallback,
  onChange,
}: {
  label: string;
  /** The hand-picked colour, or undefined for Nexli's. */
  value: string | undefined;
  /** Nexli's colour for this box. */
  fallback: string;
  onChange: (hex: string | undefined) => void;
}) {
  const shown = value ?? fallback;
  const [draft, setDraft] = useState(shown);
  // A swatch or the picker changed the colour: the hex box follows.
  const [was, setWas] = useState(shown);
  if (was !== shown) {
    setWas(shown);
    setDraft(shown);
  }
  const custom = Boolean(value && !SWATCHES.some((s) => s.hex === value));

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-bold text-neutral-300">{label}</span>
        <span className="h-3.5 w-3.5 rounded-full border border-white/20" style={{ background: shown }} aria-hidden="true" />
        <input
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            const hex = cleanHex(e.target.value);
            if (hex && e.target.value.replace(/^#/, "").length === 6) onChange(hex === fallback && !value ? undefined : hex);
          }}
          onBlur={() => {
            const hex = cleanHex(draft);
            if (hex) {
              if (hex !== shown) onChange(hex);
              setDraft(hex);
            } else setDraft(shown);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          spellCheck={false}
          autoCapitalize="characters"
          maxLength={7}
          className="w-[112px] rounded-md border border-white/10 bg-black/30 px-2 py-1 text-center text-xs uppercase text-white focus:border-cyan-400/50 focus:outline-none"
          style={NUM_FONT}
          aria-label={`${label}, as a hex code`}
        />
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => onChange(undefined)}
          aria-pressed={!value}
          title="Nexli's color for this text"
          className={`flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-bold ${
            !value ? "border-cyan-400 bg-cyan-500/15 text-white" : "border-white/10 text-neutral-400 hover:text-white"
          }`}
        >
          <span className="h-3.5 w-3.5 rounded-full border border-white/25" style={{ background: fallback }} aria-hidden="true" />
          Nexli
        </button>
        {SWATCHES.map((s) => {
          const on = value === s.hex;
          return (
            <button
              key={s.hex}
              type="button"
              onClick={() => onChange(s.hex)}
              aria-pressed={on}
              aria-label={s.name}
              title={s.name}
              className={`h-8 w-8 rounded-full border transition ${on ? "border-transparent ring-2 ring-cyan-400 ring-offset-2 ring-offset-[#0b1020]" : "border-white/20 hover:scale-110"}`}
              style={{ background: s.hex }}
            />
          );
        })}
        {/* Any colour: the system picker over a rainbow swatch */}
        <label
          title="Any color"
          className={`relative h-8 w-8 cursor-pointer overflow-hidden rounded-full border transition ${
            custom ? "border-transparent ring-2 ring-cyan-400 ring-offset-2 ring-offset-[#0b1020]" : "border-white/20 hover:scale-110"
          }`}
          style={{ background: custom ? value : "conic-gradient(#EF4444, #FACC15, #22C55E, #06B6D4, #2563EB, #A855F7, #EF4444)" }}
        >
          {!custom && <span className="absolute inset-[9px] rounded-full bg-[#0b1020]" aria-hidden="true" />}
          <input
            type="color"
            value={shown.toLowerCase()}
            onChange={(e) => onChange(cleanHex(e.target.value) ?? undefined)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            aria-label={`${label}: any color`}
          />
        </label>
      </div>
    </div>
  );
}

export function BoxColorPicker({
  value,
  defaults,
  onChange,
}: {
  value: BoxColors;
  defaults: Required<BoxColors>;
  onChange: (c: BoxColors) => void;
}) {
  const set = (key: keyof BoxColors, hex: string | undefined) => {
    const next: BoxColors = { ...value };
    if (hex) next[key] = hex;
    else delete next[key];
    onChange(next);
  };
  const bg = value.bg ?? defaults.bg;
  const text = value.text ?? defaults.text;
  const hard = (value.bg || value.text) && contrast(bg, text) < 3;
  return (
    <div className="space-y-3">
      <ColorRow label="Card color" value={value.bg} fallback={defaults.bg} onChange={(h) => set("bg", h)} />
      <ColorRow label="Text color" value={value.text} fallback={defaults.text} onChange={(h) => set("text", h)} />
      {hard && (
        <p className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-100">
          The words may be hard to read on that card color. Check it on the video before you save.
        </p>
      )}
    </div>
  );
}
