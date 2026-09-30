"use client";

import { useState } from "react";
import Link from "next/link";
import { GlassCard } from "@/components/ui/glass-card";

export interface ProvisioningClient {
  id: string;
  email: string;
  tier: string | null;
  subscriptionStatus: string | null;
  subscriptionCurrentPeriodEnd: string | null;
  provisionedAt: string | null;
  foundationAgreementEngagementId: string | null;
  foundationAgreementSentAt: string | null;
  welcomeEmailSentAt: string | null;
  site?: {
    status: string;
    slug: string;
    domain: string | null;
    /** 'claude' | 'template' | 'manual' | 'preview' (imported pre-purchase) */
    generatedBy?: string | null;
  } | null;
}

interface FirmProvisioningCardProps {
  client: ProvisioningClient;
  onChanged: () => void;
}

function fmtDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function tierLabel(tier: string | null): string {
  if (tier === "foundation") return "Foundation";
  if (tier === "drs") return "DRS";
  return "DRS (legacy)";
}

export function tierBadge(tier: string | null): string {
  return tier === "foundation" ? "badge-violet" : "badge-blue";
}

export function subscriptionBadge(status: string | null): string {
  switch (status) {
    case "active":
    case "trialing":
      return "badge-emerald";
    case "past_due":
    case "unpaid":
    case "incomplete":
      return "badge-amber";
    case "canceled":
    case "incomplete_expired":
      return "badge-rose";
    default:
      return "badge-gray";
  }
}

export function siteBadge(
  status: string | null | undefined,
  generatedBy?: string | null
): { label: string; cls: string } {
  if (status === "published") return { label: "Published", cls: "badge-emerald" };
  if (status === "draft") {
    return generatedBy === "preview"
      ? { label: "Draft (from preview)", cls: "badge-amber" }
      : { label: "Draft", cls: "badge-amber" };
  }
  return { label: "None", cls: "badge-gray" };
}

type Busy =
  | "welcome"
  | "agreement"
  | "generate"
  | "preview"
  | "publish"
  | "unpublish"
  | "links"
  | null;

interface IssuedLinks {
  setupUrl: string;
  setupExpiresAt: string;
  agreementUrl: string | null;
  portalUrl: string;
}

const BTN =
  "px-3.5 py-2 rounded-full text-xs font-bold border border-[var(--glass-border)] hover:bg-[var(--input-bg)] transition-colors disabled:opacity-50";

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="text-[10px] font-black uppercase tracking-[0.2em]"
      style={{ color: "var(--text-muted)", opacity: 0.6 }}
    >
      {children}
    </span>
  );
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through — caller shows the URL inline
  }
  return false;
}

export function FirmProvisioningCard({ client, onChanged }: FirmProvisioningCardProps) {
  const [busy, setBusy] = useState<Busy>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [links, setLinks] = useState<IssuedLinks | null>(null);
  const [shownLink, setShownLink] = useState<{ label: string; url: string } | null>(null);

  const site = client.site ?? null;
  const siteState = siteBadge(site?.status, site?.generatedBy);

  async function resend(what: "welcome" | "agreement") {
    setBusy(what);
    setMessage(null);
    try {
      const res = await fetch(`/api/dashboard/admin/clients/${client.id}/resend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ what }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setMessage({ tone: "err", text: data?.error || "Resend failed" });
      } else {
        const label =
          data.action === "agreement_created"
            ? "Agreement created and sent."
            : data.action === "agreement_resent"
              ? "Agreement reminder sent."
              : "Welcome email sent with a fresh password link.";
        setMessage({ tone: "ok", text: label });
        onChanged();
      }
    } catch (err) {
      setMessage({ tone: "err", text: err instanceof Error ? err.message : "Network error" });
    } finally {
      setBusy(null);
    }
  }

  async function siteAction(action: "generate" | "publish" | "unpublish") {
    if (action === "generate" && site) {
      const ok = window.confirm(
        "Regenerate the website? This rewrites the copy and services from the intake and overwrites any manual edits. Slug, domain and publish status are kept."
      );
      if (!ok) return;
    }
    setBusy(action);
    setMessage(null);
    try {
      const res = await fetch(`/api/dashboard/admin/sites/${client.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ tone: "err", text: data?.error || "Request failed" });
      } else {
        const notes = data?.site?.generationNotes;
        setMessage({
          tone: "ok",
          text:
            action === "generate"
              ? `Website ${site ? "regenerated" : "generated"} (${data?.site?.generatedBy || "template"}).${notes ? ` ${notes}` : ""}`
              : action === "publish"
                ? "Website published."
                : "Website unpublished (back to draft).",
        });
        onChanged();
      }
    } catch (err) {
      setMessage({ tone: "err", text: err instanceof Error ? err.message : "Network error" });
    } finally {
      setBusy(null);
    }
  }

  async function openPreview() {
    setBusy("preview");
    setMessage(null);
    // Open the tab synchronously so popup blockers allow it, then navigate.
    const win = window.open("", "_blank");
    try {
      const res = await fetch(`/api/dashboard/admin/sites/${client.id}`);
      const data = await res.json().catch(() => ({}));
      const url: string | undefined = data?.site?.previewUrl;
      if (!res.ok || !url) {
        win?.close();
        setMessage({ tone: "err", text: data?.error || "No preview available" });
        return;
      }
      if (win) win.location.href = url;
      else window.open(url, "_blank", "noopener");
    } catch (err) {
      win?.close();
      setMessage({ tone: "err", text: err instanceof Error ? err.message : "Network error" });
    } finally {
      setBusy(null);
    }
  }

  async function issueLinks(): Promise<IssuedLinks | null> {
    const res = await fetch(`/api/dashboard/admin/clients/${client.id}/links`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage({ tone: "err", text: data?.error || "Could not create links" });
      return null;
    }
    setLinks(data as IssuedLinks);
    return data as IssuedLinks;
  }

  async function copyLink(which: "setup" | "agreement") {
    setBusy("links");
    setMessage(null);
    setShownLink(null);
    try {
      // Reuse an already-issued agreement link (it doesn't rotate); always
      // mint a fresh set-password link since that's what the admin asked for.
      const issued = which === "agreement" && links ? links : await issueLinks();
      if (!issued) return;
      const url = which === "setup" ? issued.setupUrl : issued.agreementUrl;
      const label = which === "setup" ? "Set-password link" : "Agreement link";
      if (!url) {
        setMessage({
          tone: "err",
          text: client.foundationAgreementEngagementId
            ? "Agreement is already signed — no signing link to copy."
            : "No agreement exists yet. Use “Send agreement” first.",
        });
        return;
      }
      const copied = await copyText(url);
      setShownLink({ label, url });
      setMessage({
        tone: "ok",
        text: copied
          ? `${label} copied to clipboard.${which === "setup" ? " The link from the welcome email is now invalid." : ""}`
          : `Clipboard unavailable — copy the ${label.toLowerCase()} below.`,
      });
      if (which === "setup") onChanged();
    } catch (err) {
      setMessage({ tone: "err", text: err instanceof Error ? err.message : "Network error" });
    } finally {
      setBusy(null);
    }
  }

  const agreementState = !client.foundationAgreementEngagementId
    ? { label: "Not created", cls: "badge-gray" }
    : client.foundationAgreementSentAt
      ? { label: `Sent ${fmtDate(client.foundationAgreementSentAt)}`, cls: "badge-emerald" }
      : { label: "Created, not sent", cls: "badge-amber" };

  return (
    <GlassCard variant="compact" className="mb-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-2">
            <Label>Tier</Label>
            <span className={`badge ${tierBadge(client.tier)}`}>{tierLabel(client.tier)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Label>Subscription</Label>
            <span className={`badge ${subscriptionBadge(client.subscriptionStatus)}`}>
              {client.subscriptionStatus || "none"}
            </span>
            {client.subscriptionCurrentPeriodEnd && (
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                renews {fmtDate(client.subscriptionCurrentPeriodEnd)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Label>Provisioned</Label>
            <span className={`badge ${client.provisionedAt ? "badge-emerald" : "badge-gray"}`}>
              {client.provisionedAt ? fmtDate(client.provisionedAt) : "No"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Label>Agreement</Label>
            <span className={`badge ${agreementState.cls}`}>{agreementState.label}</span>
          </div>
          <div className="flex items-center gap-2">
            <Label>Welcome</Label>
            <span className={`badge ${client.welcomeEmailSentAt ? "badge-emerald" : "badge-gray"}`}>
              {client.welcomeEmailSentAt ? `Sent ${fmtDate(client.welcomeEmailSentAt)}` : "Not sent"}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => resend("welcome")}
            disabled={busy !== null}
            className={BTN}
            style={{ color: "var(--text-main)" }}
          >
            {busy === "welcome" ? "Sending..." : "Resend welcome"}
          </button>
          <button
            type="button"
            onClick={() => resend("agreement")}
            disabled={busy !== null}
            className={BTN}
            style={{ color: "var(--text-main)" }}
            title={
              client.foundationAgreementEngagementId
                ? "Email the signing link again"
                : "Create the Firm Foundation agreement and send it"
            }
          >
            {busy === "agreement"
              ? "Sending..."
              : client.foundationAgreementEngagementId
                ? "Resend agreement"
                : "Send agreement"}
          </button>
          <button
            type="button"
            onClick={() => copyLink("setup")}
            disabled={busy !== null}
            className={BTN}
            style={{ color: "var(--text-main)" }}
            title="Mint a fresh set-password link and copy it. This invalidates the link that was emailed."
          >
            {busy === "links" ? "Working..." : "Copy set-password link"}
          </button>
          <button
            type="button"
            onClick={() => copyLink("agreement")}
            disabled={busy !== null || !client.foundationAgreementEngagementId}
            className={BTN}
            style={{ color: "var(--text-main)" }}
            title={
              client.foundationAgreementEngagementId
                ? "Copy the client's signing link"
                : "Send the agreement first"
            }
          >
            Copy agreement link
          </button>
        </div>
      </div>

      {/* Website row */}
      <div
        className="mt-4 pt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
        style={{ borderTop: "1px solid var(--glass-border)" }}
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-2">
            <Label>Website</Label>
            <span className={`badge ${siteState.cls}`}>{siteState.label}</span>
          </div>
          {site && (
            <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
              /sites/{site.slug}
              {site.domain ? ` · ${site.domain}` : ""}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => siteAction("generate")}
            disabled={busy !== null}
            className={BTN}
            style={{ color: "var(--text-main)" }}
            title={
              site
                ? "Rebuild copy and services from the intake (overwrites edits)"
                : "Build a draft website from the onboarding intake"
            }
          >
            {busy === "generate" ? "Generating…" : site ? "Regenerate" : "Generate"}
          </button>
          {site && (
            <>
              <button
                type="button"
                onClick={openPreview}
                disabled={busy !== null}
                className={BTN}
                style={{ color: "var(--text-main)" }}
              >
                {busy === "preview" ? "Opening…" : "Preview"}
              </button>
              <Link
                href={`/dashboard/admin/sites/${client.id}`}
                className={BTN}
                style={{ color: "var(--text-main)" }}
              >
                Edit
              </Link>
              {site.status === "published" ? (
                <button
                  type="button"
                  onClick={() => siteAction("unpublish")}
                  disabled={busy !== null}
                  className={BTN}
                  style={{ color: "var(--text-main)" }}
                >
                  {busy === "unpublish" ? "Working…" : "Unpublish"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => siteAction("publish")}
                  disabled={busy !== null}
                  className="px-3.5 py-2 rounded-full text-xs font-bold bg-blue-600 text-white hover:bg-blue-500 transition-colors disabled:opacity-50"
                >
                  {busy === "publish" ? "Publishing…" : "Publish"}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {message && (
        <p
          className={`mt-3 text-xs font-medium ${message.tone === "ok" ? "text-emerald-400" : "text-red-400"}`}
        >
          {message.text}
        </p>
      )}

      {shownLink && (
        <div className="mt-2">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-1" style={{ color: "var(--text-muted)", opacity: 0.6 }}>
            {shownLink.label}
          </p>
          <code
            className="block w-full px-3 py-2 rounded-lg text-[11px] break-all select-all border border-[var(--glass-border)]"
            style={{ background: "var(--input-bg)", color: "var(--text-main)" }}
          >
            {shownLink.url}
          </code>
          {shownLink.label === "Set-password link" && links?.setupExpiresAt && (
            <p className="mt-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
              Expires {fmtDate(links.setupExpiresAt)}. Portal sign-in: {links.portalUrl}
            </p>
          )}
        </div>
      )}
    </GlassCard>
  );
}
