"use client";

import type { CreativeBrief, CreativeFormat, CreativeRig } from "@/lib/creative-studio/tables";
import { FORMAT_LABEL, RIG_LABEL } from "@/lib/creative-studio/prompts";

export const INPUT =
  "w-full px-3.5 py-2.5 rounded-xl border border-[var(--glass-border)] bg-transparent text-sm outline-none focus:border-blue-500 transition-colors";
export const LABEL = "block text-[10px] font-black uppercase tracking-[0.2em] mb-1.5";

const BRIEF_FIELDS: { key: keyof CreativeBrief; label: string; placeholder: string; rows: number }[] = [
  { key: "oldBelief", label: "Old belief", placeholder: "What the prospect believes now, in their words", rows: 2 },
  { key: "newBelief", label: "New belief", placeholder: "What replaces it", rows: 2 },
  { key: "proof", label: "Proof or math", placeholder: "e.g. 300 × $800 = $240,000 vs 50 × $15,000 = $750,000", rows: 2 },
  { key: "cta", label: "CTA destination", placeholder: "Angle-specific VSL, lead magnet, or book a call", rows: 1 },
  { key: "requiredLines", label: "Required lines", placeholder: "Qualifier, scarcity, investment, anything said verbatim", rows: 3 },
  { key: "notes", label: "Extra notes", placeholder: "Anything else Claude should know", rows: 2 },
];

export function FormatRigFields({
  format,
  rig,
  onChange,
  disabled,
}: {
  format: CreativeFormat;
  rig: CreativeRig;
  onChange: (next: { format: CreativeFormat; rig: CreativeRig }) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <span className={LABEL} style={{ color: "var(--text-muted)" }}>Format</span>
        <div className="flex gap-2">
          {(Object.keys(FORMAT_LABEL) as CreativeFormat[]).map((f) => (
            <button
              key={f}
              type="button"
              disabled={disabled}
              onClick={() => onChange({ format: f, rig: f === "vsl_16x9" ? "solo_locked" : rig })}
              className={`flex-1 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${
                format === f ? "border-blue-500 bg-blue-500/15 text-blue-400" : "border-[var(--glass-border)] text-[var(--text-muted)] hover:bg-[var(--input-bg)]"
              }`}
            >
              {FORMAT_LABEL[f]}
            </button>
          ))}
        </div>
      </div>
      <div>
        <span className={LABEL} style={{ color: "var(--text-muted)" }}>Presenter setup</span>
        <select
          className={INPUT}
          style={{ color: "var(--text-main)", background: "var(--card-bg, transparent)" }}
          value={rig}
          disabled={disabled || format === "vsl_16x9"}
          onChange={(e) => onChange({ format, rig: e.target.value as CreativeRig })}
        >
          {(Object.keys(RIG_LABEL) as CreativeRig[]).map((r) => (
            <option key={r} value={r}>
              {RIG_LABEL[r]}
            </option>
          ))}
        </select>
        {format === "vsl_16x9" && (
          <p className="mt-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
            VSLs are single presenter, locked-off camera.
          </p>
        )}
      </div>
    </div>
  );
}

export function BriefFields({
  brief,
  onChange,
  disabled,
}: {
  brief: CreativeBrief;
  onChange: (next: CreativeBrief) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {BRIEF_FIELDS.map((f) => (
        <label key={f.key} className={f.rows >= 3 ? "sm:col-span-2" : ""}>
          <span className={LABEL} style={{ color: "var(--text-muted)" }}>{f.label}</span>
          <textarea
            rows={f.rows}
            disabled={disabled}
            value={brief[f.key]}
            placeholder={f.placeholder}
            onChange={(e) => onChange({ ...brief, [f.key]: e.target.value })}
            className={`${INPUT} resize-y`}
            style={{ color: "var(--text-main)" }}
          />
        </label>
      ))}
    </div>
  );
}
