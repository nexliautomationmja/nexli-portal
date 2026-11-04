import type { EnterpriseTier } from "@/lib/enterprise-pricing";
import { ENTERPRISE_TIERS } from "@/lib/enterprise-pricing";

/** The bits of a pipeline lead the letter composer uses (GET /api/dashboard/pipeline). */
export interface ComposerLead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  stage: "open" | "won" | "lost";
  valueCents: number;
  bookedAt: string | null;
  source: string;
}

/** The bits of a sent letter the composer uses (GET /api/dashboard/engagements). */
export interface ComposerLetter {
  id: string;
  status: string;
  sentAt: string | null;
  createdAt: string;
  metadata: Record<string, unknown> | null;
  signers: { email: string; order: number; status: string }[];
}

/** Search a lead by name, firm or email (case-insensitive, every word must match). */
export function leadMatches(lead: ComposerLead, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = [lead.name, lead.company, lead.email].filter(Boolean).join(" ").toLowerCase();
  return words.every((w) => hay.includes(w));
}

/**
 * The newest letter already sent to this lead — linked to it, or sent to its
 * email before leads were linked — as a short chip, so nothing goes out twice
 * by accident.
 */
export function letterStatus(lead: ComposerLead, letters: ComposerLetter[]): { label: string; tone: "amber" | "green" } | null {
  const email = lead.email?.trim().toLowerCase();
  const mine = letters.filter(
    (l) =>
      l.metadata?.pipelineLeadId === lead.id ||
      (email && l.signers.some((s) => s.order > 0 && s.email.trim().toLowerCase() === email))
  );
  if (!mine.length) return null;
  const latest = mine.sort((a, b) => (b.sentAt ?? b.createdAt).localeCompare(a.sentAt ?? a.createdAt))[0];
  const clients = latest.signers.filter((s) => s.order > 0);
  const status =
    clients.length && clients.every((s) => s.status === "signed")
      ? "signed"
      : clients.some((s) => s.status === "declined")
        ? "declined"
        : clients.some((s) => s.status === "viewed")
          ? "viewed"
          : latest.status;
  if (status === "signed") return { label: "✓ Letter signed", tone: "green" };
  if (status === "viewed") return { label: "Letter sent · Viewed", tone: "amber" };
  if (status === "declined") return { label: "Letter declined", tone: "amber" };
  if (status === "expired") return { label: "Letter expired", tone: "amber" };
  return { label: "Letter sent", tone: "amber" };
}

/** The subject that goes with the chosen agreement (until you type your own). */
export function autoSubject(
  offer: string | null,
  tier: EnterpriseTier,
  firm: string,
  templateName?: string
): string {
  const who = firm ? ` · ${firm}` : "";
  if (offer === "drs_monthly" || offer === "drs_annual") return `Digital Rainmaker System — Engagement Agreement${who}`;
  if (offer === "enterprise") return `Nexli Enterprise License — ${ENTERPRISE_TIERS[tier].label}${who}`;
  if (offer?.startsWith("tpl:") && templateName) return `${templateName}${who}`;
  return "";
}
