"use client";

import { useRef, useState } from "react";
import type { ProjectDetail } from "@/lib/creative-studio/service";
import { api, send } from "@/components/creative-studio/client";
import { uploadToTarget } from "@/components/creative-studio/upload";
import { AssistantCard, Chip, SP, SvgIcon } from "@/components/creative-studio/canvas";

/** Upload a final cut (MP4/MOV) with an optional note. Shared by the card and the chat box. */
export async function uploadFinalCut(projectId: string, file: File, note: string): Promise<ProjectDetail> {
  const mime = file.type === "video/quicktime" ? "video/quicktime" : file.type === "video/mp4" ? "video/mp4" : "";
  if (!mime) throw new Error("Upload an MP4 or MOV file");
  const sign = await fetch(api(`${projectId}/final-cut`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "sign", mime }),
  });
  const target = await sign.json().catch(() => null);
  if (!sign.ok || !target?.token) throw new Error(target?.error || "Couldn't start the upload");
  await uploadToTarget(target, file, mime);
  const r = await send(api(`${projectId}/final-cut`), "POST", { action: "register", path: target.path, mime, filename: file.name, note });
  if (!r.ok) throw new Error(r.error);
  return r.data;
}

/** Your edited cut of the whole video, for the Remotion edit. */
export function FinalCutCard({
  detail,
  onChange,
  onError,
}: {
  detail: ProjectDetail;
  onChange: (d: ProjectDetail) => void;
  onError: (msg: string) => void;
}) {
  const p = detail.project;
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function upload(file: File | undefined) {
    if (!file) return;
    try {
      setBusy(`Uploading ${file.name} · ${Math.round(file.size / 1e6)} MB…`);
      onChange(await uploadFinalCut(p.id, file, ""));
    } catch (err) {
      onError(err instanceof Error ? `Upload failed: ${err.message}` : "Upload failed");
    } finally {
      setBusy(null);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <AssistantCard
      id="stage-final"
      accent="emerald"
      icon={SP.upload}
      title="Your final cut"
      right={detail.finalCuts.length > 0 ? <Chip tone="green">{detail.finalCuts.length} uploaded</Chip> : null}
    >
      {detail.finalCuts.length > 0 && (
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          {detail.finalCuts.map((f) => (
            <div key={f.id} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
              {f.url && <video src={f.url} controls playsInline preload="metadata" className="w-full bg-black" />}
              <div className="space-y-1 p-3 text-xs">
                <p className="font-semibold text-white">{f.filename}</p>
                <p className="text-neutral-500">{new Date(f.uploadedAt).toLocaleString()}</p>
                {f.note && <p className="text-neutral-300">“{f.note}”</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragging(false);
          void upload(Array.from(e.dataTransfer.files).find((f) => f.type.startsWith("video/")));
        }}
        disabled={!!busy}
        className={`flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
          dragging ? "border-emerald-400 bg-emerald-500/10" : "border-white/15 hover:border-emerald-400/50 hover:bg-white/[0.02]"
        }`}
      >
        {busy ? (
          <span className="h-7 w-7 animate-spin rounded-full border-2 border-emerald-400/20 border-t-emerald-300" />
        ) : (
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/15 text-emerald-300">
            <SvgIcon d={SP.upload} size={22} />
          </span>
        )}
        <span className="text-sm font-semibold text-white">
          {busy ?? (
            <>
              <span className="[@media(hover:none)]:hidden">Drop your edited cut here</span>
              <span className="[@media(hover:hover)]:hidden">Tap to upload your edited cut</span>
            </>
          )}
        </span>
        <span className="text-xs text-neutral-500">
          MP4 or MOV · <span className="[@media(hover:none)]:hidden">or click to choose · </span>or attach it in the chat box with a note
        </span>
      </button>
      <input ref={input} type="file" accept="video/mp4,video/quicktime" hidden onChange={(e) => upload(e.target.files?.[0])} />
      <p className="mt-3 text-[11px] text-neutral-500">
        Approving the auto-cut puts it here automatically. You can also drop your own edit. The Remotion edit below (captions, title and graphics from your editing rulebook) runs on the newest one.
      </p>
    </AssistantCard>
  );
}
