// ══════════════════════════════════════════════════════════
// "Facebook Ads Account" — the Launch Pad item (fb_ads_invite) as of Nov 10
// 2026: does the firm already have a Meta ad account?
//   Yes → they give us its IDs; Nexli requests access from its own Business
//         Manager and they tap Approve in Meta.
//   No  → Nexli sets one up during the build.
// Older answers ({ confirmed } = "I sent the partner invite", { notApplicable }
// = "I don't run Facebook Ads") still read.
//
// Client-safe (no db): shared by the Launch Pad, the submit route and the
// admin Onboarding page.
// ══════════════════════════════════════════════════════════

export interface FbAdsAnswer {
  hasAccount: boolean;
  /** Digits only ("act_" and spaces stripped). */
  adAccountId: string | null;
  /** Business portfolio (Business Manager) ID — not everyone has one. */
  businessId: string | null;
  /** The Facebook Page their ads run from, as typed (link or name). */
  pageUrl: string | null;
  notes: string;
}

export type FbAdsSubmission = FbAdsAnswer | { confirmed: true } | { notApplicable: true };

/** "act_123 456-789" → "123456789". */
export function metaId(v: unknown): string {
  const s = typeof v === "number" ? String(v) : typeof v === "string" ? v : "";
  return s.trim().replace(/^act_/i, "").replace(/[\s-]/g, "");
}

const ID = /^\d{5,20}$/;
const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Check what the Launch Pad sent. Errors are written for the client. */
export function cleanFbAds(raw: unknown): { ok: true; value: FbAdsSubmission } | { ok: false; error: string } {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  if (r.hasAccount === false) {
    return { ok: true, value: { hasAccount: false, adAccountId: null, businessId: null, pageUrl: null, notes: text(r.notes, 1000) } };
  }
  if (r.hasAccount === true) {
    const adAccountId = metaId(r.adAccountId);
    if (!adAccountId) return { ok: false, error: "Enter your ad account ID." };
    if (!ID.test(adAccountId)) return { ok: false, error: "Your ad account ID should be numbers only, like 123456789012345." };
    const businessId = metaId(r.businessId);
    if (businessId && !ID.test(businessId)) return { ok: false, error: "Your Business portfolio ID should be numbers only, or leave it blank." };
    return {
      ok: true,
      value: { hasAccount: true, adAccountId, businessId: businessId || null, pageUrl: text(r.pageUrl, 300) || null, notes: text(r.notes, 1000) },
    };
  }
  // A Launch Pad tab opened before this change can still send the old answers.
  if (r.notApplicable) return { ok: true, value: { notApplicable: true } };
  if (r.confirmed) return { ok: true, value: { confirmed: true } };
  return { ok: false, error: "Tell us whether you have a Facebook ad account." };
}

/** The yes/no answer, or null for older answers and empty submissions. */
export function asFbAnswer(sub: unknown): FbAdsAnswer | null {
  const s = sub as Partial<FbAdsAnswer> | null;
  return s && typeof s === "object" && typeof s.hasAccount === "boolean" ? (s as FbAdsAnswer) : null;
}

/** They said they have no ad account: Nexli has to set one up. */
export const needsAdAccount = (sub: unknown) => asFbAnswer(sub)?.hasAccount === false;

/** A Page answer as a link when it looks like one (else null: show it as text). */
export function pageHref(page: string | null | undefined): string | null {
  if (!page) return null;
  if (/^https?:\/\//i.test(page)) return page;
  if (/^(www\.|m\.)?(facebook|fb)\.com\//i.test(page)) return `https://${page}`;
  return null;
}
