"use client";

import { useState } from "react";
import type { ProjectDetail } from "@/lib/creative-studio/service";
import { CTA_CLASSES } from "@/components/launch-pad";
import { api, send } from "@/components/creative-studio/client";
import { AssistantCard, Chip, SP, ThinkingCard, UserBubble } from "@/components/creative-studio/canvas";
import { AdCopyResults } from "@/components/creative-studio/ad-copy-results";

/**
 * Meta ad copy written from the finished video: 4 primary texts (mid-length,
 * spaced out with emojis, each with a different hook) and 4 headlines, plus
 * description and button — shown as the post will look in the feed, with
 * one-click copy for each.
 */
export function AdCopyCard({
  detail,
  onChange,
  onError,
}: {
  detail: ProjectDetail;
  onChange: (d: ProjectDetail) => void;
  onError: (msg: string) => void;
}) {
  const p = detail.project;
  const copies = detail.adCopies;
  const copy = copies[copies.length - 1];
  const [busy, setBusy] = useState<string | null>(null);

  // The video under the copy: the newest rendered edit, else the final cut.
  const rendered = [...detail.edits].reverse().find((e) => e.status === "done" && e.outputUrl);
  const media = rendered?.outputUrl ?? detail.finalCuts[detail.finalCuts.length - 1]?.url ?? null;

  async function write(body: { note?: string }) {
    setBusy(body.note ? "Claude is changing the copy…" : "Claude is writing 4 primary texts and 4 headlines…");
    const r = await send(api(`${p.id}/copy`), "POST", body);
    setBusy(null);
    if (r.ok) onChange(r.data);
    else onError(r.error);
  }
  async function undo() {
    const r = await send(api(`${p.id}/copy/undo`), "POST");
    if (r.ok) onChange(r.data);
    else onError(r.error);
  }

  return (
    <div className="space-y-4">
      {copies
        .filter((c) => c.note)
        .slice(-2)
        .map((c) => (
          <UserBubble key={c.id}>{c.note}</UserBubble>
        ))}

      <AssistantCard id="stage-copy" accent="violet" icon={SP.script} title="Meta ad copy" right={copy ? <Chip>v{copy.version}</Chip> : null}>
        {!copy ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-md text-sm text-neutral-300">
              Ad copy written from this video: 4 primary texts (mid-length, spaced out with emojis, each with a different hook) and 4 headlines, plus the description and button.
            </p>
            <button type="button" onClick={() => void write({})} disabled={Boolean(busy)} className={`${CTA_CLASSES} disabled:opacity-50`}>
              Write the ad copy
            </button>
          </div>
        ) : (
          <AdCopyResults
            copy={copy}
            versions={copies.length}
            media={{ url: media, kind: "video" }}
            busy={Boolean(busy)}
            onRevise={(note) => void write({ note })}
            onFresh={() => void write({})}
            onUndo={() => void undo()}
            onError={onError}
          />
        )}
      </AssistantCard>

      {busy && <ThinkingCard accent="violet" label={busy} detail="Following your copy rules: no guarantees, “investment” never “price”, and only the numbers the video uses." />}
    </div>
  );
}
