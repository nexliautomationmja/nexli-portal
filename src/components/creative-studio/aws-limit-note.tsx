"use client";

import { useEffect, useState } from "react";

interface QuotaRequest {
  desired: number;
  status: string;
  caseId: string | null;
  requestedAt: string | null;
}

interface Limits {
  connected: boolean;
  limit?: number;
  known?: boolean;
  parallel?: number;
  accountId?: string | null;
  request?: QuotaRequest | null;
  wanted?: number;
  consoleUrl?: string;
  error?: string | null;
}

const AWS_URL = "/api/dashboard/creative-studio/aws";
const n = (v: number) => v.toLocaleString("en-US");
const day = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";
const accountLabel = (id: string) => (/^\d{12}$/.test(id) ? `${id.slice(0, 4)}-${id.slice(4, 8)}-${id.slice(8)}` : id);

/**
 * The AWS Lambda limit behind final renders, while it's still a new account's
 * low one: how many renders run at once, the account id, and a button that
 * asks AWS to raise it (Service Quotas). Hidden once the limit is high.
 */
export function AwsLimitNote({ className = "" }: { className?: string }) {
  const [limits, setLimits] = useState<Limits | null>(null);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let live = true;
    fetch(AWS_URL)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Limits | null) => {
        if (live && d) setLimits(d);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  async function ask() {
    setAsking(true);
    setError(null);
    try {
      const r = await fetch(AWS_URL, { method: "POST" });
      const d = (await r.json().catch(() => null)) as (Limits & { error?: string }) | null;
      if (d?.connected) setLimits(d);
      if (!r.ok) setError(d?.error || `Request failed (${r.status})`);
    } catch {
      setError("Couldn't reach the portal. Try again.");
    } finally {
      setAsking(false);
    }
  }

  if (!limits?.connected || typeof limits.limit !== "number") return null;
  const wanted = limits.wanted ?? 1000;
  if (limits.limit >= wanted) return null;

  const req = limits.request ?? null;
  const pending = req && (req.status === "PENDING" || req.status === "CASE_OPENED");
  const approved = req && req.status === "APPROVED";
  const refused = req && ["DENIED", "NOT_APPROVED", "CASE_CLOSED", "INVALID_REQUEST"].includes(req.status);
  const caseUrl = req?.caseId ? `https://console.aws.amazon.com/support/home#/case/?displayId=${encodeURIComponent(req.caseId)}` : null;
  const oneAtATime = (limits.parallel ?? 1) <= 1;

  return (
    <div className={`rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-3.5 py-3 text-xs leading-relaxed text-neutral-300 ${className}`}>
      <p>
        <span className="font-semibold text-amber-200">AWS limit: {n(limits.limit)} Lambda copies at once</span>
        {limits.known ? "" : " (assumed — AWS didn't say)"}.{limits.limit <= 50 ? " That's AWS's cap for new accounts, so" : " So"} final videos render{" "}
        {oneAtATime ? "one at a time" : `${limits.parallel} at a time`} and the rest wait in line by themselves.
      </p>

      {pending && (
        <p className="mt-1.5 text-neutral-400">
          Asked AWS {day(req.requestedAt) && `on ${day(req.requestedAt)} `}to raise it to {n(req.desired)} — waiting for their answer (often a day or
          two). Renders keep working in the meantime.
          {caseUrl && (
            <>
              {" "}
              <a href={caseUrl} target="_blank" rel="noreferrer" className="font-semibold text-cyan-300 hover:underline">
                See the AWS case
              </a>
            </>
          )}
        </p>
      )}
      {approved && (
        <p className="mt-1.5 text-neutral-400">AWS approved {n(req.desired)} — it can take a little while to show up here.</p>
      )}
      {refused && (
        <p className="mt-1.5 text-neutral-400">
          AWS didn&apos;t raise it{day(req.requestedAt) && ` (asked ${day(req.requestedAt)})`}. Asking again from the{" "}
          {limits.consoleUrl ? (
            <a href={limits.consoleUrl} target="_blank" rel="noreferrer" className="font-semibold text-cyan-300 hover:underline">
              AWS Service Quotas page
            </a>
          ) : (
            "AWS Service Quotas page"
          )}{" "}
          with a reason (&quot;rendering marketing videos with Remotion Lambda&quot;) usually works.
        </p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
        {!pending && !approved && (
          <button
            type="button"
            onClick={ask}
            disabled={asking}
            className="min-h-9 rounded-full bg-amber-300/90 px-3.5 text-xs font-bold text-black hover:bg-amber-200 disabled:opacity-60"
          >
            {asking ? "Asking AWS…" : `Ask AWS to raise it to ${n(wanted)}`}
          </button>
        )}
        {limits.accountId && (
          <span className="inline-flex items-center gap-1.5 text-neutral-400">
            AWS account <span className="font-mono text-neutral-200">{accountLabel(limits.accountId)}</span>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(limits.accountId ?? "").then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                });
              }}
              className="min-h-9 px-1 font-semibold text-cyan-300 hover:underline"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </span>
        )}
      </div>
      {error && <p className="mt-1.5 text-rose-300">{error}</p>}
    </div>
  );
}
