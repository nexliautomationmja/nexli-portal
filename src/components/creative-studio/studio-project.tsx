"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ProjectDetail } from "@/lib/creative-studio/service";
import type { CreativeBrief, CreativeFormat, CreativeRig, FrameSpec } from "@/lib/creative-studio/tables";
import { FORMAT_LABEL, RIG_LABEL, isMultiPerson } from "@/lib/creative-studio/prompts";
import { BriefFields, FormatRigFields, INPUT, LABEL } from "@/components/creative-studio/brief-fields";
import { STATUS_LABEL } from "@/components/creative-studio/project-list";
import { ScriptStep } from "@/components/creative-studio/script-step";
import { prepareFrame, uploadToTarget } from "@/components/creative-studio/upload";
import { api, send } from "@/components/creative-studio/client";

type Step = "frame" | "script" | "clips" | "edit";

const STEPS: { id: Step; label: string; sub: string }[] = [
  { id: "frame", label: "1 · Brief & frame", sub: "Angle, presenter setup, opening frame" },
  { id: "script", label: "2 · Script", sub: "Claude writes it, you review and approve" },
  { id: "clips", label: "3 · Kling clips", sub: "Render one clip per line" },
  { id: "edit", label: "4 · Edit", sub: "Captions and graphics in Remotion" },
];

export function StudioProject({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("frame");
  const stepChosen = useRef(false);

  const apply = useCallback((d: ProjectDetail) => {
    setDetail(d);
    setError(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    send(api(projectId), "GET").then((r) => {
      if (cancelled) return;
      if (!r.ok) {
        setError(r.error);
        return;
      }
      apply(r.data);
      // Open on the step that needs attention next.
      if (!stepChosen.current && r.data.clips.length > 0) setStep("script");
    });
    return () => {
      cancelled = true;
    };
  }, [projectId, apply]);

  if (!detail) {
    return (
      <div className="max-w-6xl mx-auto">
        {error ? (
          <div className="rounded-xl border px-4 py-3 text-sm border-rose-500/30 bg-rose-500/10 text-rose-500">{error}</div>
        ) : (
          <div className="glass-card h-64 animate-pulse" />
        )}
      </div>
    );
  }

  const p = detail.project;
  const status = STATUS_LABEL[p.status] ?? STATUS_LABEL.draft;

  async function remove() {
    if (!confirm(`Delete "${p.title}" and all its frames and clips? This can't be undone.`)) return;
    const r = await send(api(p.id), "DELETE");
    if (r.ok) router.push("/dashboard/creative-studio");
    else setError(r.error);
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href="/dashboard/creative-studio" className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
            ← Creative Studio
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight truncate" style={{ color: "var(--text-main)" }}>
            {p.title}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full border px-2.5 py-0.5 font-semibold" style={{ borderColor: "var(--card-border)", color: "var(--text-main)" }}>
              {FORMAT_LABEL[p.format]}
            </span>
            <span className="rounded-full border px-2.5 py-0.5 font-semibold" style={{ borderColor: "var(--card-border)", color: "var(--text-main)" }}>
              {RIG_LABEL[p.rig]}
            </span>
            <span className={`rounded-full px-2.5 py-0.5 font-bold ${status.cls}`}>{status.label}</span>
          </div>
        </div>
        <button type="button" onClick={remove} className="text-xs font-semibold text-rose-500 hover:underline">
          Delete project
        </button>
      </div>

      {error && (
        <div className="rounded-xl border px-4 py-3 text-sm border-rose-500/30 bg-rose-500/10 text-rose-500">{error}</div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {STEPS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => {
              stepChosen.current = true;
              setStep(s.id);
            }}
            className={`rounded-xl border px-3.5 py-2.5 text-left transition-colors ${
              step === s.id ? "border-blue-500 bg-blue-500/10" : "border-[var(--glass-border)] hover:bg-[var(--input-bg)]"
            }`}
          >
            <span className={`block text-sm font-bold ${step === s.id ? "text-blue-400" : ""}`} style={step === s.id ? undefined : { color: "var(--text-main)" }}>
              {s.label}
            </span>
            <span className="block text-[11px]" style={{ color: "var(--text-muted)" }}>{s.sub}</span>
          </button>
        ))}
      </div>

      {step === "frame" && <FrameStep detail={detail} onChange={apply} onError={setError} onNext={() => setStep("script")} />}
      {step === "script" && <ScriptStep detail={detail} onChange={apply} onError={setError} />}
      {step === "clips" && (
        <Upcoming
          title="Kling clip rendering is the next phase"
          body={
            p.status === "approved"
              ? "Your script is approved and locked, ready to render. Rendering one clip per line on Kling (with redos and downloads) is being built next. It needs your Kling API keys from the Kling developer console."
              : "Approve the script in step 2 first. Rendering one clip per line on Kling (with redos and downloads) is being built next."
          }
        />
      )}
      {step === "edit" && (
        <Upcoming
          title="Remotion editing comes after Kling rendering"
          body="Captions, title banners and the comparison ladders from your editing rulebook, rendered on Remotion Lambda. This needs an AWS account for Remotion."
        />
      )}
    </div>
  );
}

function Upcoming({ title, body }: { title: string; body: string }) {
  return (
    <div className="glass-card p-8 text-center">
      <p className="text-sm font-bold" style={{ color: "var(--text-main)" }}>{title}</p>
      <p className="mt-2 text-sm max-w-xl mx-auto" style={{ color: "var(--text-muted)" }}>{body}</p>
    </div>
  );
}

// ─── Step 1: brief, presenter setup, frames, frame description ────────

function FrameStep({
  detail,
  onChange,
  onError,
  onNext,
}: {
  detail: ProjectDetail;
  onChange: (d: ProjectDetail) => void;
  onError: (msg: string) => void;
  onNext: () => void;
}) {
  const p = detail.project;
  const [brief, setBrief] = useState<CreativeBrief>(p.brief);
  const [format, setFormat] = useState<CreativeFormat>(p.format);
  const [rig, setRig] = useState<CreativeRig>(p.rig);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const dirty =
    JSON.stringify(brief) !== JSON.stringify(p.brief) || format !== p.format || rig !== p.rig;

  async function save() {
    if (detail.clips.length > 0 && (format !== p.format || rig !== p.rig)) {
      if (!confirm("Changing the format or presenter setup rebuilds every clip's Kling prompt. Continue?")) return;
    }
    setSaving(true);
    const r = await send(api(p.id), "PATCH", { brief, format, rig });
    setSaving(false);
    if (r.ok) onChange(r.data);
    else onError(r.error);
  }

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    const vertical = p.format === "ad_9x16";
    for (const file of Array.from(files)) {
      try {
        setUploading(`Preparing ${file.name}…`);
        const prepared = await prepareFrame(file, vertical);
        const sign = await fetch(api(`${p.id}/frames`), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "sign", mime: prepared.mime }),
        });
        const target = await sign.json().catch(() => null);
        if (!sign.ok || !target?.token) throw new Error(target?.error || "Couldn't start the upload");
        setUploading(`Uploading ${file.name}…`);
        await uploadToTarget(target, prepared.blob, prepared.mime);
        const r = await send(api(`${p.id}/frames`), "POST", {
          action: "register",
          path: target.path,
          mime: prepared.mime,
          width: prepared.width,
          height: prepared.height,
        });
        if (!r.ok) throw new Error(r.error);
        onChange(r.data);
      } catch (err) {
        onError(err instanceof Error ? err.message : "Upload failed");
      }
    }
    setUploading(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function makePrimary(id: string) {
    const r = await send(api(`${p.id}/frames`), "PATCH", { primaryId: id });
    if (r.ok) onChange(r.data);
    else onError(r.error);
  }

  async function removeFrame(id: string) {
    if (!confirm("Remove this frame?")) return;
    const r = await send(`${api(`${p.id}/frames`)}?assetId=${encodeURIComponent(id)}`, "DELETE");
    if (r.ok) onChange(r.data);
    else onError(r.error);
  }

  const aspect = p.format === "ad_9x16" ? "9 / 16" : "16 / 9";

  return (
    <div className="space-y-5">
      <section className="glass-card p-5 space-y-5">
        <h2 className="text-sm font-semibold" style={{ color: "var(--text-main)" }}>Angle</h2>
        <FormatRigFields format={format} rig={rig} onChange={(n) => (setFormat(n.format), setRig(n.rig))} />
        <BriefFields brief={brief} onChange={setBrief} />
        <div className="flex justify-end">
          <button type="button" onClick={save} disabled={!dirty || saving} className="btn-primary px-5 py-2 text-sm">
            {saving ? "Saving…" : dirty ? "Save angle" : "Saved"}
          </button>
        </div>
      </section>

      <section className="glass-card p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-main)" }}>Opening frame</h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              {p.format === "ad_9x16"
                ? "Ad frames are center-cropped to 9:16 on upload. The starred frame opens every clip."
                : "VSL frames are used as they are (16:9). The starred frame opens every clip."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled
              title="Manus frame generation is Phase 3 of the Creative Studio"
              className="rounded-xl border px-4 py-2 text-xs font-semibold opacity-50 cursor-not-allowed"
              style={{ borderColor: "var(--card-border)", color: "var(--text-muted)" }}
            >
              Generate with Manus · soon
            </button>
            <button type="button" onClick={() => fileRef.current?.click()} disabled={!!uploading} className="btn-primary px-4 py-2 text-xs">
              {uploading ?? "Upload frame"}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              hidden
              onChange={(e) => upload(e.target.files)}
            />
          </div>
        </div>

        {detail.frames.length === 0 ? (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="w-full rounded-xl border-2 border-dashed py-12 text-sm transition-colors hover:bg-[var(--input-bg)]"
            style={{ borderColor: "var(--card-border)", color: "var(--text-muted)" }}
          >
            Drop in the exact opening frame Daniela starts every clip from
          </button>
        ) : (
          <div className="flex flex-wrap gap-3">
            {detail.frames.map((f, i) => (
              <div key={f.id} className="relative w-40 overflow-hidden rounded-xl border bg-black" style={{ aspectRatio: aspect, borderColor: i === 0 ? "#3b82f6" : "var(--card-border)" }}>
                {f.url && (
                  // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
                  <img src={f.url} alt={`Frame ${i + 1}`} className="h-full w-full object-cover" />
                )}
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-black/60 px-2 py-1.5 text-[10px] font-bold text-white">
                  {i === 0 ? (
                    <span>★ Opening frame</span>
                  ) : (
                    <button type="button" onClick={() => makePrimary(f.id)} className="hover:underline">
                      Use as opening
                    </button>
                  )}
                  <button type="button" onClick={() => removeFrame(f.id)} className="text-rose-300 hover:underline">
                    Remove
                  </button>
                </div>
                {f.width && f.height && (
                  <span className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-semibold text-white/80">
                    {f.width}×{f.height}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {p.frameSpec && <FrameSpecEditor detail={detail} onChange={onChange} onError={onError} />}

      <div className="flex justify-end">
        <button type="button" onClick={onNext} disabled={detail.frames.length === 0} className="btn-primary px-6 py-2.5 text-sm">
          {detail.clips.length > 0 ? "Go to the script" : "Next: write the script"}
        </button>
      </div>
    </div>
  );
}

function FrameSpecEditor({
  detail,
  onChange,
  onError,
}: {
  detail: ProjectDetail;
  onChange: (d: ProjectDetail) => void;
  onError: (msg: string) => void;
}) {
  const p = detail.project;
  const [spec, setSpec] = useState<FrameSpec>(p.frameSpec!);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(spec) !== JSON.stringify(p.frameSpec);
  const multi = isMultiPerson(p.rig);

  async function save() {
    setSaving(true);
    const r = await send(api(p.id), "PATCH", { frameSpec: spec });
    setSaving(false);
    if (r.ok) onChange(r.data);
    else onError(r.error);
  }

  return (
    <section className="glass-card p-5 space-y-4">
      <div>
        <h2 className="text-sm font-semibold" style={{ color: "var(--text-main)" }}>Frame description</h2>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
          Claude wrote this from the frame (framework §5). It goes into every Kling prompt, so fix anything it got wrong. Saving rebuilds all prompts.
        </p>
      </div>
      <label className="block">
        <span className={LABEL} style={{ color: "var(--text-muted)" }}>{multi ? "Shared description" : "Subject"}</span>
        <textarea rows={3} value={spec.subject} onChange={(e) => setSpec({ ...spec, subject: e.target.value })} className={`${INPUT} resize-y`} style={{ color: "var(--text-main)" }} />
      </label>
      {multi && (
        <>
          <label className="block">
            <span className={LABEL} style={{ color: "var(--text-muted)" }}>Who they are (base)</span>
            <textarea rows={2} value={spec.base} onChange={(e) => setSpec({ ...spec, base: e.target.value })} className={`${INPUT} resize-y`} style={{ color: "var(--text-main)" }} />
          </label>
          <div className="grid gap-3 md:grid-cols-3">
            {spec.positions.map((pos, i) => (
              <div key={pos.position} className="rounded-xl border p-3 space-y-2" style={{ borderColor: "var(--card-border)" }}>
                <p className="text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: "var(--text-muted)" }}>{pos.position}</p>
                {(["who", "outfit", "shortName"] as const).map((k) => (
                  <input
                    key={k}
                    value={pos[k]}
                    placeholder={k === "shortName" ? "Short name (The woman in olive)" : k}
                    onChange={(e) => {
                      const positions = spec.positions.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x));
                      setSpec({ ...spec, positions });
                    }}
                    className={INPUT}
                    style={{ color: "var(--text-main)" }}
                  />
                ))}
              </div>
            ))}
          </div>
        </>
      )}
      <label className="block">
        <span className={LABEL} style={{ color: "var(--text-muted)" }}>Room</span>
        <textarea rows={3} value={spec.room} onChange={(e) => setSpec({ ...spec, room: e.target.value })} className={`${INPUT} resize-y`} style={{ color: "var(--text-main)" }} />
      </label>
      <div className="flex justify-end">
        <button type="button" onClick={save} disabled={!dirty || saving} className="btn-primary px-5 py-2 text-sm">
          {saving ? "Saving…" : dirty ? "Save and rebuild prompts" : "Saved"}
        </button>
      </div>
    </section>
  );
}
