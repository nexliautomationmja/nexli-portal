"use client";

import { useRef, useState } from "react";
import type { ProjectDetail } from "@/lib/creative-studio/service";
import { api, send } from "@/components/creative-studio/client";
import { uploadToTarget } from "@/components/creative-studio/upload";
import { INPUT } from "@/components/creative-studio/ui";

/** Step 5 — upload your edited cut of the whole video for the Remotion edit. */
export function FinalCutStep({
  detail,
  onChange,
  onError,
}: {
  detail: ProjectDetail;
  onChange: (d: ProjectDetail) => void;
  onError: (msg: string) => void;
}) {
  const p = detail.project;
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function upload(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    const mime = file.type === "video/quicktime" ? "video/quicktime" : file.type === "video/mp4" ? "video/mp4" : "";
    if (!mime) {
      onError("Upload an MP4 or MOV file");
      return;
    }
    try {
      setBusy(`Uploading ${file.name} (${Math.round(file.size / 1e6)} MB)…`);
      const sign = await fetch(api(`${p.id}/final-cut`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sign", mime }),
      });
      const target = await sign.json().catch(() => null);
      if (!sign.ok || !target?.token) throw new Error(target?.error || "Couldn't start the upload");
      await uploadToTarget(target, file, mime);
      const r = await send(api(`${p.id}/final-cut`), "POST", { action: "register", path: target.path, mime, filename: file.name, note });
      if (!r.ok) throw new Error(r.error);
      onChange(r.data);
      setNote("");
    } catch (err) {
      onError(err instanceof Error ? `Upload failed: ${err.message}` : "Upload failed");
    } finally {
      setBusy(null);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Put the clips together however you like, then upload the whole cut here. The Remotion edit (captions, title and graphics from your editing rulebook) runs on it once Remotion is connected.
      </p>
      {detail.finalCuts.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {detail.finalCuts.map((f) => (
            <div key={f.id} className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--card-border)" }}>
              {f.url && <video src={f.url} controls playsInline preload="metadata" className="w-full bg-black" />}
              <div className="p-3 text-xs space-y-1" style={{ color: "var(--text-main)" }}>
                <p className="font-semibold">{f.filename}</p>
                <p style={{ color: "var(--text-muted)" }}>Uploaded {new Date(f.uploadedAt).toLocaleString()}</p>
                {f.note && <p>Edit note: {f.note}</p>}
                <p className="text-emerald-500 font-semibold">Saved. The Remotion edit is the next part being connected.</p>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional: what should the edit do? (title, captions, anything specific)"
          className={INPUT}
          style={{ color: "var(--text-main)" }}
        />
        <button type="button" onClick={() => input.current?.click()} disabled={!!busy} className="btn-primary px-5 py-2 text-sm shrink-0">
          {busy ? "Uploading…" : "Upload your cut"}
        </button>
        <input ref={input} type="file" accept="video/mp4,video/quicktime" hidden onChange={(e) => upload(e.target.files)} />
      </div>
      {busy && <p className="text-xs" style={{ color: "var(--text-muted)" }}>{busy}</p>}
    </div>
  );
}
