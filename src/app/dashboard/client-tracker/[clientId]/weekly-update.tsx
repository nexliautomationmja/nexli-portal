"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, Mic, PenLine } from "lucide-react";
import { Button, ButtonLink, Chip, FIELD, Field, Notice, Segmented, Surface } from "@/components/rainmaker";
import { moneyWhole } from "@/lib/format";
import { VoiceRecorder } from "@/components/messages/voice-recorder";
import { voiceFormData } from "@/components/messages/message-thread";
import { mondayOf, shortDate, updateHeaderStatus, weekLabel } from "./detail-status";
import type { UpdateStatusItem, WeeklyUpdateItem } from "./detail-types";

type Message = { kind: "ok" | "warn" | "error"; text: string };
const NOTICE_TONE = { ok: "success", warn: "warn", error: "error" } as const;

/** Write (or record) this week's update; it's emailed and shown on their Overview. */
export function WeeklyUpdatePanel({
  clientId,
  clientLabel,
  clientEmail,
  updates,
  status,
  onChange,
}: {
  clientId: string;
  clientLabel: string;
  clientEmail: string;
  updates: WeeklyUpdateItem[];
  status: UpdateStatusItem | null;
  onChange: (updates: WeeklyUpdateItem[]) => void;
}) {
  const [weekStart, setWeekStart] = useState(() => mondayOf());
  const [headline, setHeadline] = useState("");
  const [body, setBody] = useState("");
  const [adSpend, setAdSpend] = useState("");
  const [busy, setBusy] = useState<"draft" | "send" | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const [mode, setMode] = useState<"type" | "voice">("type");

  const existingForWeek = updates.find((u) => u.weekStart === weekStart) || null;

  // Load the chosen week's note into the composer so Marcel edits in place.
  useEffect(() => {
    setMessage(null);
    if (existingForWeek) {
      setHeadline(existingForWeek.headline || "");
      setBody(existingForWeek.body);
      setAdSpend(existingForWeek.adSpendCents != null ? String(Math.round(existingForWeek.adSpendCents / 100)) : "");
    } else {
      setHeadline("");
      setBody("");
      setAdSpend("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart, existingForWeek?.id]);

  function adSpendCents(): number | null {
    const dollars = adSpend.trim() === "" ? null : Number(adSpend);
    return dollars == null || Number.isNaN(dollars) ? null : Math.round(dollars * 100);
  }

  function merge(saved: WeeklyUpdateItem) {
    onChange([saved, ...updates.filter((u) => u.id !== saved.id)].sort((a, b) => b.weekStart.localeCompare(a.weekStart)));
  }

  async function submit(action: "draft" | "send") {
    if (!body.trim()) {
      setMessage({ kind: "error", text: "Write the update first." });
      return;
    }
    if (action === "send" && !window.confirm(`Email this update to ${clientLabel} now?`)) return;
    setBusy(action);
    setMessage(null);
    try {
      const res = await fetch(`/api/dashboard/client-tracker/${clientId}/weekly-update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStart, headline: headline.trim() || null, body, adSpendCents: adSpendCents(), action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ kind: "error", text: data.error || "Couldn't save. Please try again." });
        return;
      }
      merge(data.update as WeeklyUpdateItem);
      setMessage(data.warning ? { kind: "warn", text: data.warning } : { kind: "ok", text: action === "send" ? `Sent to ${clientLabel}.` : "Draft saved." });
    } catch {
      setMessage({ kind: "error", text: "Couldn't save. Please try again." });
    } finally {
      setBusy(null);
    }
  }

  // Voice mode: the recording is the update — transcribed, posted to their Nexli Team thread and emailed by the voice route.
  async function sendVoice(blob: Blob, mime: string, durationMs: number) {
    setMessage(null);
    const fd = voiceFormData(blob, mime, durationMs);
    if (headline.trim()) fd.append("headline", headline.trim());
    const cents = adSpendCents();
    if (cents != null) fd.append("adSpendCents", String(cents));
    fd.append("weekStart", weekStart);
    const res = await fetch(`/api/dashboard/client-tracker/${clientId}/weekly-update/voice`, { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Couldn't send the voice update. Please try again.");
    const saved = data.update as WeeklyUpdateItem | undefined;
    if (saved?.id) merge(saved);
    setMessage(
      data.emailed === false
        ? { kind: "warn", text: "Sent: it's in their Nexli Team thread (the email didn't go out)." }
        : { kind: "ok", text: "Sent: it's in their Nexli Team thread." }
    );
  }

  const header = updateHeaderStatus(status, updates);

  return (
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
      <Surface className="p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {header.chip && (
                <Chip tone={header.chip.tone} dot>
                  {header.chip.label}
                </Chip>
              )}
              <span className="text-xs text-neutral-400">{header.line ?? "Emailed and shown on their Overview"}</span>
            </div>
          </div>
          <ButtonLink href={`/dashboard/portal-messages?client=${encodeURIComponent(clientEmail)}`} variant="ghost">
            Open thread <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </ButtonLink>
        </div>

        <Segmented
          kind="tabs"
          block
          value={mode}
          onChange={(m) => {
            setMode(m);
            setMessage(null);
          }}
          ariaLabel="Update format"
          options={[
            { value: "type", label: "Type update", icon: <PenLine className="h-3.5 w-3.5" aria-hidden="true" /> },
            { value: "voice", label: "Record voice update", short: "Voice", icon: <Mic className="h-3.5 w-3.5" aria-hidden="true" /> },
          ]}
        />

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Week of" hint="Snaps to that week's Monday">
            {(id) => (
              <input
                id={id}
                type="date"
                value={weekStart}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v) setWeekStart(mondayOf(new Date(`${v}T00:00:00Z`)));
                }}
                className={`${FIELD} [color-scheme:dark]`}
              />
            )}
          </Field>
          <Field label="Ad budget deployed ($)" hint="Optional">
            {(id) => <input id={id} type="number" min={0} step={1} inputMode="numeric" value={adSpend} onChange={(e) => setAdSpend(e.target.value)} placeholder="e.g. 2500" className={FIELD} />}
          </Field>
        </div>
        <Field label="Headline (optional)" counter={{ value: headline.length, max: 200 }} className="mt-4">
          {(id) => (
            <input id={id} type="text" value={headline} onChange={(e) => setHeadline(e.target.value.slice(0, 200))} placeholder="e.g. New landing page live, 3 booked calls" className={FIELD} />
          )}
        </Field>

        {mode === "voice" ? (
          <div className="mt-4 space-y-3">
            <p className="text-xs leading-relaxed text-neutral-400">
              Record what the team worked on. It&apos;s transcribed automatically, posted to {clientLabel}&apos;s Nexli Team thread and emailed to them.
            </p>
            <VoiceRecorder onSend={sendVoice} sendLabel="Send to client" idleLabel="Start recording" className="w-full" />
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <Field label="What the team worked on" counter={{ value: body.length, max: 10_000 }}>
              {(id) => (
                <textarea
                  id={id}
                  value={body}
                  onChange={(e) => setBody(e.target.value.slice(0, 10_000))}
                  placeholder={"What we did this week, what's next, anything we need from them.\n\nBlank lines become paragraphs."}
                  className={`${FIELD} h-44 resize-y leading-relaxed`}
                />
              )}
            </Field>
            {existingForWeek?.status === "sent" && (
              <Notice tone="info">
                This week&apos;s update went out {shortDate(existingForWeek.sentAt)}
                {existingForWeek.viewedAt ? `, opened ${shortDate(existingForWeek.viewedAt)}` : ", not opened yet"}. Sending again re-emails the edited version.
              </Notice>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
              <Button variant="secondary" busy={busy === "draft"} disabled={busy !== null} onClick={() => submit("draft")}>
                {busy === "draft" ? "Saving…" : "Save draft"}
              </Button>
              <Button busy={busy === "send"} disabled={busy !== null} onClick={() => submit("send")}>
                {busy === "send" ? "Sending…" : "Send to client"}
              </Button>
            </div>
          </div>
        )}
        {message && (
          <Notice tone={NOTICE_TONE[message.kind]} className="mt-4" onClose={() => setMessage(null)}>
            {message.text}
          </Notice>
        )}
      </Surface>

      <Surface className="overflow-hidden self-start">
        <div className="border-b border-white/10 px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-neutral-400">History</div>
        {updates.length === 0 ? (
          <p className="px-4 py-6 text-sm text-neutral-400">Nothing sent yet. Your first update will show here.</p>
        ) : (
          <div className="divide-y divide-white/5">
            {updates.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => setWeekStart(u.weekStart)}
                aria-current={u.weekStart === weekStart ? "true" : undefined}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.04] ${u.weekStart === weekStart ? "bg-white/[0.05]" : ""}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-white">{u.headline || `Week of ${weekLabel(u.weekStart)}`}</div>
                  <div className="truncate text-[11px] text-neutral-400">
                    Week of {weekLabel(u.weekStart)}
                    {u.adSpendCents ? ` · ${moneyWhole(u.adSpendCents)} ads` : ""}
                    {u.status === "sent" ? ` · sent ${shortDate(u.sentAt)}` : ` · edited ${shortDate(u.updatedAt)}`}
                    {u.viewedAt ? " · opened" : ""}
                  </div>
                </div>
                <Chip tone={u.status === "sent" ? "green" : "neutral"} size="xs">
                  {u.status === "sent" ? "Sent" : "Draft"}
                </Chip>
              </button>
            ))}
          </div>
        )}
      </Surface>
    </div>
  );
}
