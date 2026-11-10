"use client";

import { useState } from "react";
import { Check, Copy, KeyRound } from "lucide-react";
import { Button, Chip, CopyField, FIELD, Inset, Notice, Surface } from "@/components/rainmaker";
import { buildTrackingSnippet } from "@/lib/tracking-snippet";
import { generatePassword } from "./detail-status";
import type { DetailData } from "./detail-types";

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <Surface className="p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-cyan-400/30 bg-cyan-500/15 text-xs font-bold text-cyan-200">{n}</span>
        <h3 className="text-sm font-bold text-white">{title}</h3>
      </div>
      {children}
    </Surface>
  );
}

/** Tracking snippet, their website and their portal password. Saves through PATCH /api/dashboard/client-tracker/[id]. */
export function SetupPanel({ client, onWebsiteSaved }: { client: DetailData["client"]; onWebsiteSaved: (url: string | null) => void }) {
  const [url, setUrl] = useState(client.websiteUrl || "");
  const [urlBusy, setUrlBusy] = useState(false);
  const [urlSaved, setUrlSaved] = useState(false);
  const [password, setPassword] = useState<string | null>(null);
  const [pwCopied, setPwCopied] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);
  const [pwSaved, setPwSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const snippet = buildTrackingSnippet(client.id);

  async function patch(body: Record<string, unknown>): Promise<{ ok: boolean; websiteUrl?: string | null }> {
    const res = await fetch(`/api/dashboard/client-tracker/${client.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Something went wrong. Please try again.");
      return { ok: false };
    }
    setError(null);
    return { ok: true, websiteUrl: data.websiteUrl ?? null };
  }

  async function saveUrl() {
    setUrlBusy(true);
    setUrlSaved(false);
    try {
      const result = await patch({ websiteUrl: url.trim() || null });
      if (result.ok) {
        // Use the server-normalized URL (https:// prepended etc.), not the raw input.
        const normalized = result.websiteUrl ?? null;
        setUrl(normalized || "");
        onWebsiteSaved(normalized);
        setUrlSaved(true);
        setTimeout(() => setUrlSaved(false), 2500);
      }
    } finally {
      setUrlBusy(false);
    }
  }

  async function savePassword() {
    if (!password) return;
    setPwBusy(true);
    try {
      const result = await patch({ newPassword: password });
      if (result.ok) setPwSaved(true);
    } finally {
      setPwBusy(false);
    }
  }

  function copyPassword() {
    if (!password) return;
    try {
      navigator.clipboard?.writeText(password);
      setPwCopied(true);
      setTimeout(() => setPwCopied(false), 2000);
    } catch {
      // Clipboard unavailable — the password stays selectable.
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <Notice tone="error" onClose={() => setError(null)}>
          {error}
        </Notice>
      )}
      <div className="grid gap-3 lg:grid-cols-3">
        <Step n={1} title="Tracking snippet">
          <p className="mb-3 text-xs leading-relaxed text-neutral-400">
            Paste this on their website before <code className="rounded bg-white/10 px-1">&lt;/body&gt;</code> when you build it. Every visit reports back to your portal under this
            client.
          </p>
          <CopyField value={snippet} />
        </Step>
        <Step n={2} title="Their website">
          <label htmlFor="client-website" className="sr-only">
            Their website
          </label>
          <input id="client-website" type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://theirfirm.com" className={FIELD} />
          <div className="mt-3 flex items-center gap-2">
            <Button size="sm" busy={urlBusy} onClick={saveUrl}>
              {urlBusy ? "Saving…" : "Save"}
            </Button>
            {urlSaved && (
              <Chip tone="green" size="xs" icon={<Check className="h-3 w-3" aria-hidden="true" />}>
                Saved
              </Chip>
            )}
          </div>
        </Step>
        <Step n={3} title="Their portal login">
          <p className="mb-3 text-xs text-neutral-400">
            Login email: <span className="font-semibold text-white">{client.email}</span>
          </p>
          {!password ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setPassword(generatePassword());
                setPwSaved(false);
              }}
            >
              <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
              Generate new password
            </Button>
          ) : (
            <div className="space-y-3">
              <Inset className="flex items-center justify-between gap-2 border-amber-400/25 bg-amber-400/[0.06] px-3 py-2">
                <code className="select-all break-all font-mono text-sm text-white">{password}</code>
                <button
                  type="button"
                  onClick={copyPassword}
                  aria-label="Copy password"
                  className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full px-2 text-xs font-semibold text-cyan-300 hover:bg-white/10"
                >
                  {pwCopied ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
                  {pwCopied ? "Copied" : "Copy"}
                </button>
              </Inset>
              <div className="flex flex-wrap items-center gap-2">
                {!pwSaved ? (
                  <Button size="sm" busy={pwBusy} onClick={savePassword}>
                    {pwBusy ? "Setting…" : "Set as their password"}
                  </Button>
                ) : (
                  <>
                    <Chip tone="green" size="xs" icon={<Check className="h-3 w-3" aria-hidden="true" />}>
                      Password set
                    </Chip>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setPassword(generatePassword());
                        setPwSaved(false);
                      }}
                    >
                      Generate another
                    </Button>
                  </>
                )}
              </div>
              <p className="text-xs leading-relaxed text-neutral-400">Copy it now: it won&apos;t be shown again. Share it with the client when you hand over their dashboard.</p>
            </div>
          )}
        </Step>
      </div>
    </div>
  );
}
