"use client";

import { useState } from "react";
import { Check, ChevronDown, CircleCheck, Copy, ExternalLink, FileText, Send, Undo2 } from "lucide-react";
import {
  BIG_NUM,
  Button,
  Chip,
  CopyField,
  EYEBROW,
  FIELD,
  FeatureCard,
  Field,
  Inset,
  List,
  NUM_FONT,
  Notice,
  SYNE,
  Segmented,
  Sheet,
  Skeleton,
  StatusDot,
  Surface,
  type Tone,
} from "@/components/rainmaker";
import { DRS_PRICING, TOTAL_MONTHLY_CENTS } from "@/lib/drs-pricing";
import {
  NO_PROCESSOR,
  achLine,
  asPaymentSetup,
  cardLine,
  coverageGaps,
  gapLine,
  processorName,
  wireLine,
} from "@/lib/payment-setup";
import {
  TASK_STATUS,
  dueView,
  formatDate,
  formatShortDate,
  formatUsd,
  type AdminBilling,
  type AdminDetail,
  type AdminPhase,
  type AdminTask,
  type BillingInvoiceRef,
} from "./onboarding-types";

export interface LaunchPadSheetProps {
  open: boolean;
  state: "loading" | "error" | "ready";
  detail: AdminDetail | null;
  /** Shown while the detail loads (the row's client name). */
  name: string;
  /** window.location.origin, for the client's Launch Pad links. */
  origin: string;
  billingBusy: boolean;
  billingError: string | null;
  onClose: () => void;
  onRetry: () => void;
  /** PATCH the onboarding; resolves false when it failed (the container says why). */
  onPatch: (body: Record<string, unknown>) => Promise<boolean>;
  onStartMonthly: () => void;
  /** Something was copied ("Password", "Username"…). */
  onCopied: (what: string) => void;
}

/** Eyebrow + Syne title inside the sheet. */
function Block({ eyebrow, title, right, children }: { eyebrow: string; title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className={`${EYEBROW} text-cyan-300/80`}>{eyebrow}</p>
          <h3 className="mt-0.5 text-base font-bold text-white" style={SYNE}>
            {title}
          </h3>
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

// ─── Progress, links, dates ────────────────────────────────

function ProgressCard({ d }: { d: AdminDetail }) {
  const o = d.onboarding;
  const review = o.tasks.filter((t) => t.status === "submitted").length;
  const due = dueView(o.clientItemsComplete ? 0 : 1, o.daysUntilDue, Boolean(o.clientDueAt));
  return (
    <FeatureCard tone="cyan" eyebrow="Overall progress">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <span className="text-5xl font-extrabold leading-none text-white" style={BIG_NUM}>
          {o.progressPercent}%
        </span>
        <div className="flex flex-wrap gap-1.5">
          {review > 0 && (
            <Chip tone="amber" dot>
              {review} to review
            </Chip>
          )}
          {due && <Chip tone={due.tone} dot>{due.label === "All in" ? "Client items all in" : `Items ${due.label.toLowerCase()}`}</Chip>}
          {o.campaignLaunchedAt && (
            <Chip tone="green" dot>
              Ads live {formatShortDate(o.campaignLaunchedAt)}
            </Chip>
          )}
        </div>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-700" style={{ width: `${o.progressPercent}%` }} />
      </div>
      <p className="mt-2 text-[11px] text-neutral-400">
        Started {formatDate(o.startedAt)} · phases and client items both count
      </p>
    </FeatureCard>
  );
}

function DateField({
  label,
  value,
  hint,
  onChange,
}: {
  label: string;
  value: string | null;
  hint: React.ReactNode;
  onChange: (v: string | null) => void;
}) {
  return (
    <Field label={label} hint={hint}>
      {(id) => <input id={id} type="date" defaultValue={value || ""} onChange={(e) => onChange(e.target.value || null)} className={FIELD} style={NUM_FONT} />}
    </Field>
  );
}

function Dates({ d, onPatch }: { d: AdminDetail; onPatch: LaunchPadSheetProps["onPatch"] }) {
  const o = d.onboarding;
  const due = dueView(o.clientItemsComplete ? 0 : 1, o.daysUntilDue, Boolean(o.clientDueAt));
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <DateField
        label="Estimated launch"
        value={o.targetLaunchDate}
        hint="The client sees this."
        onChange={(v) => void onPatch({ action: "set_launch_date", targetLaunchDate: v })}
      />
      <DateField
        label="Client items due"
        value={o.clientDueAt}
        hint={
          due ? (
            <Chip tone={due.tone} size="xs" dot>
              {due.label}
            </Chip>
          ) : (
            "The client sees this."
          )
        }
        onChange={(v) => void onPatch({ action: "set_client_due_date", clientDueAt: v })}
      />
      <DateField
        label="Ads went live"
        value={o.campaignLaunchedAt}
        hint={
          o.campaignLaunchedAt ? (
            <Chip tone="green" size="xs" dot>
              Live since {formatShortDate(o.campaignLaunchedAt)}
            </Chip>
          ) : (
            "Not launched yet."
          )
        }
        onChange={(v) => void onPatch({ action: "set_campaign_launched", campaignLaunchedAt: v })}
      />
    </div>
  );
}

// ─── DRS billing (setup invoice → Build complete → first monthly) ──

function InvoiceRow({ label, inv, sentAt }: { label: string; inv: BillingInvoiceRef; sentAt?: string }) {
  const paid = inv.status === "paid";
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-sm text-neutral-200" style={NUM_FONT}>
        {label}{" "}
        <a href={`/dashboard/invoices?id=${inv.invoiceId}`} className="font-semibold text-cyan-300 hover:underline">
          {inv.invoiceNumber}
        </a>{" "}
        · {formatUsd(inv.total)}
        {sentAt && <span className="text-neutral-400"> · sent {formatShortDate(sentAt)}</span>}
      </span>
      <Chip tone={paid ? "green" : "amber"} size="xs" dot>
        {paid ? `Paid ${formatShortDate(inv.paidAt)}` : "Awaiting payment"}
      </Chip>
    </div>
  );
}

function Billing({ billing, busy, error, onStart }: { billing: AdminBilling; busy: boolean; error: string | null; onStart: () => void }) {
  const { setup, firstMonthly, plan } = billing;
  const setupPaid = setup?.status === "paid";
  const monthly = plan === "annual" ? `${formatUsd(DRS_PRICING.AD_SPEND_MONTHLY_CENTS)} ad budget` : formatUsd(TOTAL_MONTHLY_CENTS);
  return (
    <Surface className="space-y-3 p-4">
      {setup ? <InvoiceRow label="Setup invoice" inv={setup} /> : <p className="text-sm text-neutral-400">No setup invoice found for this engagement.</p>}
      {firstMonthly ? (
        <div className="space-y-2">
          <InvoiceRow label="First monthly" inv={firstMonthly} sentAt={firstMonthly.createdAt} />
          {firstMonthly.status === "paid" && (
            <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
              <Check className="h-3.5 w-3.5" aria-hidden="true" /> Clear to launch ads.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-1.5">
          <Button size="sm" busy={busy} disabled={!setupPaid} onClick={onStart} className="whitespace-normal text-left">
            {busy ? "Sending…" : `Build complete: send the first monthly invoice (${monthly})`}
          </Button>
          {!setupPaid && <p className="text-[11px] text-neutral-400">Unlocks once the setup invoice is paid.</p>}
        </div>
      )}
      {error && <Notice tone="error">{error}</Notice>}
    </Surface>
  );
}

// ─── Phases ────────────────────────────────────────────────

const PHASE_OPTIONS = [
  { value: "pending", label: "Queued" },
  { value: "in_progress", label: "In progress", short: "Working" },
  { value: "done", label: "Done" },
] as const;

function PhaseRow({ phase, onPatch }: { phase: AdminPhase; onPatch: LaunchPadSheetProps["onPatch"] }) {
  const [busy, setBusy] = useState<AdminPhase["status"] | null>(null);
  return (
    <Surface className="space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="min-w-0 text-sm font-bold text-white">
          {phase.emoji} {phase.title}
        </p>
        <Segmented
          size="sm"
          ariaLabel={`${phase.title} status`}
          value={phase.status}
          options={PHASE_OPTIONS}
          busyValue={busy}
          onChange={async (v) => {
            if (v === phase.status) return;
            setBusy(v);
            await onPatch({ action: "set_phase", phaseId: phase.id, status: v });
            setBusy(null);
          }}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-[190px_1fr]">
        <Field label="Target date">
          {(id) => (
            <input
              id={id}
              type="date"
              defaultValue={phase.targetDate || ""}
              onChange={(e) => void onPatch({ action: "set_phase", phaseId: phase.id, targetDate: e.target.value || null })}
              className={FIELD}
              style={NUM_FONT}
            />
          )}
        </Field>
        <Field label="Note the client sees">
          {(id) => (
            <input
              id={id}
              type="text"
              defaultValue={phase.note || ""}
              placeholder="Optional, e.g. first draft ready Friday"
              maxLength={500}
              onBlur={(e) => {
                const note = e.target.value.trim();
                if ((phase.note || "") !== note) void onPatch({ action: "set_phase", phaseId: phase.id, note });
              }}
              className={FIELD}
            />
          )}
        </Field>
      </div>
    </Surface>
  );
}

// ─── Client items ──────────────────────────────────────────

type Creds = {
  registrar?: string;
  loginUrl?: string;
  username?: string;
  email?: string;
  password?: string;
  notes?: string;
  confirmed?: boolean;
} | null;

function CopyButton({ value, what, onCopied }: { value: string; what: string; onCopied: (w: string) => void }) {
  return (
    <button
      type="button"
      aria-label={`Copy ${what}`}
      onClick={() => {
        void navigator.clipboard?.writeText(value).then(() => onCopied(what), () => {});
      }}
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-white/10 hover:text-white"
    >
      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
    </button>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-8 items-center justify-between gap-3">
      <span className="shrink-0 text-xs text-neutral-400">{label}</span>
      <span className="flex min-w-0 items-center gap-1 text-right text-xs font-semibold text-white">{children}</span>
    </div>
  );
}

function Credentials({ creds, onCopied }: { creds: NonNullable<Creds>; onCopied: (w: string) => void }) {
  const [reveal, setReveal] = useState(false);
  const fields: [string, string | undefined][] = [
    ["Registrar", creds.registrar],
    ["Login URL", creds.loginUrl],
    ["Username", creds.username],
    ["Email", creds.email],
  ];
  return (
    <div className="space-y-0.5">
      {fields
        .filter(([, v]) => v)
        .map(([label, v]) => (
          <Row key={label} label={label}>
            <span className="truncate">{v}</span>
            <CopyButton value={v!} what={label} onCopied={onCopied} />
          </Row>
        ))}
      {creds.password && (
        <Row label="Password">
          <span className="truncate font-mono">{reveal ? creds.password : "••••••••"}</span>
          <button type="button" onClick={() => setReveal((r) => !r)} className="min-h-8 px-1.5 text-[10px] font-bold uppercase tracking-wider text-cyan-300 hover:text-cyan-200">
            {reveal ? "Hide" : "Show"}
          </button>
          <CopyButton value={creds.password} what="Password" onCopied={onCopied} />
        </Row>
      )}
      {creds.notes && <p className="pt-1.5 text-xs leading-relaxed text-neutral-300">“{creds.notes}”</p>}
    </div>
  );
}

/** "How you get paid": the firm's processor and its card / ACH / wire amounts. */
function PaymentAnswers({ task, onCopied }: { task: AdminTask; onCopied: (w: string) => void }) {
  const p = asPaymentSetup(task.submission);
  const stripe = (task.legacyStripe ?? null) as Creds;
  const gaps = p ? coverageGaps(p) : [];
  return (
    <div className="space-y-3">
      {p ? (
        <>
          <dl className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Processor</dt>
              <dd className="mt-0.5 text-sm font-semibold text-white">{processorName(p)}</dd>
              {p.processor !== NO_PROCESSOR && (
                <a
                  href={`https://www.google.com/search?q=${encodeURIComponent(`${processorName(p)} payments API documentation`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-0.5 inline-flex min-h-8 items-center gap-1 text-[11px] font-semibold text-cyan-300 hover:underline"
                >
                  Check for an API <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>
              )}
            </div>
            {(
              [
                ["Cards", cardLine(p)],
                ["ACH", achLine(p)],
                ["Wire", wireLine(p)],
              ] as const
            ).map(([k, v]) => (
              <div key={k}>
                <dt className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">{k}</dt>
                <dd className={`mt-0.5 text-sm font-semibold ${/^Not /.test(v) ? "text-neutral-400" : "text-white"}`} style={NUM_FONT}>
                  {v}
                </dd>
              </div>
            ))}
          </dl>
          {gaps.length > 0 && <p className="text-xs text-amber-300">No way to pay invoices {gaps.map(gapLine).join(" or ")} — check with them.</p>}
          {p.notes && <p className="text-xs leading-relaxed text-neutral-300">“{p.notes}”</p>}
        </>
      ) : (
        <p className="text-xs leading-relaxed text-neutral-400">
          They sent a Stripe login before this question existed. Ask them below for their processor and their card, ACH and wire amounts.
        </p>
      )}
      {stripe && (
        <details className="group rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2">
          <summary className="flex min-h-8 cursor-pointer list-none items-center gap-1 text-xs font-semibold text-neutral-300 hover:text-white [&::-webkit-details-marker]:hidden">
            Stripe login from the earlier step
            <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div className="pt-1">
            <Credentials creds={stripe} onCopied={onCopied} />
          </div>
        </details>
      )}
    </div>
  );
}

function LicenseFiles({ task }: { task: AdminTask }) {
  const files = (task.submission as { files?: Record<string, { fileName: string; signedUrl: string | null; mimeType: string } | null> } | null)?.files;
  return (
    <div className="grid grid-cols-2 gap-3">
      {(["front", "back"] as const).map((side) => {
        const f = files?.[side];
        return (
          <div key={side}>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-neutral-400">{side}</p>
            {f?.signedUrl ? (
              <a href={f.signedUrl} target="_blank" rel="noopener noreferrer" className="block">
                {f.mimeType === "application/pdf" ? (
                  <span className="flex min-h-24 items-center justify-center gap-1.5 rounded-xl border border-white/10 px-2 text-xs font-semibold text-white">
                    <FileText className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="truncate">{f.fileName}</span>
                  </span>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={f.signedUrl} alt={`License ${side}`} className="h-24 w-full rounded-xl border border-white/10 object-cover" />
                )}
              </a>
            ) : (
              <span className="flex min-h-24 items-center justify-center rounded-xl border border-dashed border-white/15 text-xs text-neutral-500">Not uploaded</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

const ASK_PAYMENT_NOTE =
  "We don't need your Stripe login anymore. Instead, tell us who processes your payments and which invoice amounts you want paid by card, ACH or wire.";

function ReviewActions({ task, onPatch }: { task: AdminTask; onPatch: LaunchPadSheetProps["onPatch"] }) {
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"approve" | "back" | "ask" | null>(null);
  const reviewable = task.status === "submitted" || task.status === "needs_attention";
  // An old Stripe login standing in for "How you get paid": one tap asks the new question.
  const askPayment = task.id === "payment_setup" && task.status !== "todo" && task.status !== "needs_attention" && !asPaymentSetup(task.submission);
  if (!reviewable && !askPayment) return null;

  const run = async (kind: "approve" | "back" | "ask", body: Record<string, unknown>) => {
    setBusy(kind);
    const ok = await onPatch({ action: "review_task", taskId: task.id, ...body });
    setBusy(null);
    if (ok && kind === "back") {
      setNoteOpen(false);
      setNote("");
    }
  };

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap gap-2">
        {reviewable && (
          <Button size="sm" busy={busy === "approve"} onClick={() => run("approve", { status: "approved" })}>
            <CircleCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Approve
          </Button>
        )}
        {reviewable && !noteOpen && (
          <Button size="sm" variant="secondary" onClick={() => setNoteOpen(true)}>
            <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
            Send back
          </Button>
        )}
        {askPayment && (
          <Button size="sm" variant="secondary" busy={busy === "ask"} onClick={() => run("ask", { status: "needs_attention", adminNote: ASK_PAYMENT_NOTE })}>
            <Send className="h-3.5 w-3.5" aria-hidden="true" />
            Ask how they get paid
          </Button>
        )}
      </div>
      {noteOpen && (
        <div className="space-y-2">
          <Field label="What should they fix?" hint="They'll see this note on their Launch Pad.">
            {(id) => (
              <input
                id={id}
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
                placeholder="The password didn't work. Can you double-check it?"
                className={FIELD}
                autoFocus
              />
            )}
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" busy={busy === "back"} disabled={!note.trim()} onClick={() => run("back", { status: "needs_attention", adminNote: note.trim() })}>
              Send back with note
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setNoteOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function TaskCard({ task, onPatch, onCopied }: { task: AdminTask; onPatch: LaunchPadSheetProps["onPatch"]; onCopied: (w: string) => void }) {
  const st = TASK_STATUS[task.status];
  const creds = task.type === "credentials" ? (task.submission as Creds) : null;
  const confirm = task.type === "confirm" ? (task.submission as { confirmed?: boolean; notApplicable?: boolean } | null) : null;
  return (
    <Surface className="space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 text-sm font-bold text-white">
          {task.emoji} {task.title}
          {task.optional && <span className="ml-1.5 text-[11px] font-semibold text-neutral-400">optional</span>}
        </p>
        <Chip tone={st.tone} size="xs" dot>
          {st.label}
        </Chip>
      </div>
      {task.submittedAt && task.status !== "todo" && (
        <p className="-mt-1.5 text-[11px] text-neutral-400" style={NUM_FONT}>
          Sent {formatDate(task.submittedAt)}
          {task.reviewedAt && task.status === "approved" ? ` · approved ${formatDate(task.reviewedAt)}` : ""}
        </p>
      )}

      {task.status !== "todo" && (
        <Inset className="p-3">
          {task.id === "payment_setup" ? (
            <PaymentAnswers task={task} onCopied={onCopied} />
          ) : task.type === "credentials" ? (
            creds ? (
              <Credentials creds={creds} onCopied={onCopied} />
            ) : (
              <p className="text-xs text-neutral-400">This submission couldn&apos;t be read (missing or wrong encryption key). Ask the client to send it again, or check ONBOARDING_ENCRYPTION_KEY in Vercel.</p>
            )
          ) : task.type === "confirm" ? (
            <p className="text-xs text-neutral-300">
              {confirm?.notApplicable ? "They don't run Facebook Ads, so this was marked not applicable." : "They say the partner invite is sent. Accept it in Business Manager."}
            </p>
          ) : task.type === "upload" ? (
            <LicenseFiles task={task} />
          ) : null}
        </Inset>
      )}

      {task.adminNote && task.status === "needs_attention" && (
        <p className="text-[11px] leading-relaxed text-neutral-400">
          Note sent to the client: <span className="text-neutral-200">“{task.adminNote}”</span>
        </p>
      )}
      <ReviewActions task={task} onPatch={onPatch} />
    </Surface>
  );
}

// ─── Update + Mission Log ──────────────────────────────────

function UpdateComposer({ onPatch }: { onPatch: LaunchPadSheetProps["onPatch"] }) {
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-2">
      <Field label="Message" hint="It appears in the Mission Log on their Launch Pad." counter={{ value: msg.length, max: 500 }}>
        {(id) => (
          <textarea
            id={id}
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="Your homepage design is looking sharp. First preview coming Friday! 🎨"
            className={`${FIELD} resize-none`}
          />
        )}
      </Field>
      <Button
        size="sm"
        busy={busy}
        disabled={!msg.trim()}
        onClick={async () => {
          setBusy(true);
          const ok = await onPatch({ action: "post_update", message: msg.trim() });
          setBusy(false);
          if (ok) setMsg("");
        }}
      >
        <Send className="h-3.5 w-3.5" aria-hidden="true" />
        Post to Mission Log
      </Button>
    </div>
  );
}

const ACTOR: Record<string, { tone: Tone; label: string }> = {
  client: { tone: "cyan", label: "Client" },
  agency: { tone: "blue", label: "You" },
  system: { tone: "green", label: "Nexli" },
};

function MissionLog({ entries }: { entries: AdminDetail["onboarding"]["activity"] }) {
  if (!entries.length) return <p className="text-xs text-neutral-400">No activity yet.</p>;
  return (
    <List>
      {[...entries].reverse().map((e, i) => {
        const a = ACTOR[e.actor] ?? ACTOR.system;
        return (
          <div key={`${e.at}-${i}`} className="flex items-start gap-3 px-4 py-3">
            <StatusDot tone={a.tone} className="mt-1.5" />
            <div className="min-w-0 flex-1">
              <p className="text-xs leading-snug text-neutral-100">{e.message}</p>
              <p className="mt-0.5 text-[10px] text-neutral-400" style={NUM_FONT}>
                {a.label} · {formatDate(e.at)}
              </p>
            </div>
          </div>
        );
      })}
    </List>
  );
}

// ─── The sheet ─────────────────────────────────────────────

export function LaunchPadSheet(p: LaunchPadSheetProps) {
  const d = p.detail;
  const title = d?.clientSigners[0]?.name || p.name || "Launch Pad";
  return (
    <Sheet open={p.open} onClose={p.onClose} title={title} sub={d?.subject ?? "Launch Pad"} size="lg" fullOnPhone>
      {p.state === "error" ? (
        <Notice
          tone="error"
          title="Couldn't load this Launch Pad"
          action={
            <Button size="sm" onClick={p.onRetry}>
              Try again
            </Button>
          }
        >
          The connection may have dropped. Nothing was changed.
        </Notice>
      ) : p.state === "loading" || !d ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading the Launch Pad">
          <Skeleton className="h-36" />
          <Skeleton className="h-20" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : (
        <div key={d.engagementId} className="space-y-8">
          <ProgressCard d={d} />

          {d.clientSigners.length > 0 && (
            <Block eyebrow="Share" title={d.clientSigners.length > 1 ? "Their Launch Pad links" : "Their Launch Pad link"}>
              <div className="space-y-3">
                {d.clientSigners.map((s) => (
                  <CopyField key={s.id} label={d.clientSigners.length > 1 ? s.name : undefined} value={`${p.origin}/onboarding/${s.token}`} />
                ))}
              </div>
            </Block>
          )}

          <Block eyebrow="Timeline" title="Dates">
            <Dates d={d} onPatch={p.onPatch} />
          </Block>

          {d.billing?.isDrs && (
            <Block eyebrow="Billing" title="Setup and first monthly invoice">
              <Billing billing={d.billing} busy={p.billingBusy} error={p.billingError} onStart={p.onStartMonthly} />
            </Block>
          )}

          <Block eyebrow="The build" title="Build phases">
            <div className="space-y-3">
              {d.onboarding.phases.map((ph) => (
                <PhaseRow key={ph.id} phase={ph} onPatch={p.onPatch} />
              ))}
            </div>
          </Block>

          <Block eyebrow="From the client" title="Client items">
            <div className="space-y-3">
              {d.onboarding.tasks.map((t) => (
                <TaskCard key={t.id} task={t} onPatch={p.onPatch} onCopied={p.onCopied} />
              ))}
            </div>
          </Block>

          <Block eyebrow="Mission Log" title="Post an update">
            <UpdateComposer onPatch={p.onPatch} />
          </Block>

          <Block eyebrow="History" title="Mission Log">
            <MissionLog entries={d.onboarding.activity} />
          </Block>
        </div>
      )}
    </Sheet>
  );
}
