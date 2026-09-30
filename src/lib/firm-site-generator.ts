/**
 * Firm Foundation website generator.
 *
 * Two stages:
 *  1. buildScaffold() — deterministic config from the user row + intake
 *     (always valid, no network).
 *  2. enhanceWithClaude() — optional copy pass over the scaffold. Only the
 *     text fields Claude returns *and* that pass type/length checks are
 *     applied; anything else keeps the scaffold value.
 */
import Anthropic from "@anthropic-ai/sdk";
import type { users } from "@/db/schema";
import { getPortalUrl } from "@/lib/foundation-config";
import { derivePalette } from "@/lib/firm-sites/palette";
import { servicesFromIntake } from "@/lib/firm-sites/service-library";
import { validateFirmSiteConfig, type FirmSiteConfig } from "@/lib/firm-sites/types";

export type UserRow = typeof users.$inferSelect;

/** Shape of leads.onboarding_intake written by the marketing app. */
export interface OnboardingIntake {
  firmName?: string;
  services?: string[];
  currentWebsite?: string | null;
  preferredDomain?: string | null;
  bookingUrl?: string | null;
  primaryColor?: string | null;
  accentColor?: string | null;
  notes?: string | null;
  submittedAt?: string;
}

/** Model used for the copy pass. See the claude-api skill: Opus 5 is the default. */
export const FIRM_SITE_COPY_MODEL = "claude-opus-5";

export const HEADING_FONT = "'Fraunces', Georgia, 'Times New Roman', serif";
export const BODY_FONT = "'Inter', system-ui, -apple-system, sans-serif";

export const DEFAULT_HIGHLIGHTS = [
  "Licensed CPAs on every engagement",
  "Secure client portal for documents, e-signatures and payments",
  "Fixed-fee pricing agreed before work starts",
  "Responses within one business day",
];

export function slugify(name: string): string {
  const s = (name || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return s || "firm";
}

function clean(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t ? t : undefined;
}

export function resolveFirmName(user: UserRow, intake: OnboardingIntake | null): string {
  return (
    clean(intake?.firmName) ||
    clean(user.companyName) ||
    clean(user.name) ||
    "Your Firm"
  );
}

export function buildScaffold(args: {
  user: UserRow;
  intake: OnboardingIntake | null;
  slug: string;
}): FirmSiteConfig {
  const { user, intake, slug } = args;
  const firmName = resolveFirmName(user, intake);

  const colors = derivePalette(
    clean(intake?.primaryColor) || clean(user.brandColor) || null,
    clean(intake?.accentColor) || null
  );

  const config: FirmSiteConfig = {
    slug,
    firmName,
    tagline: "CPA & Tax Advisory",
    heroHeadline: `Clear, proactive tax and accounting from ${firmName}`,
    heroSub: `${firmName} prepares your taxes, keeps your books in order and plans ahead so you pay only what you owe. Work with a licensed CPA who answers your questions and keeps you informed all year, not just in April.`,
    ...(clean(user.logoUrl) ? { logo: { src: clean(user.logoUrl)!, alt: `${firmName} logo` } } : {}),
    colors,
    fonts: { heading: HEADING_FONT, body: BODY_FONT },
    style: "solid",
    services: servicesFromIntake(intake?.services),
    about: {
      heading: `About ${firmName}`,
      body: `${firmName} is a CPA firm built around long-term relationships. We take the time to understand how you earn, spend and plan, then handle the filings, bookkeeping and strategy that let you focus on running your business. Every engagement is led by a licensed CPA, priced up front and supported by a secure client portal for documents, signatures and payments.`,
      highlights: [...DEFAULT_HIGHLIGHTS],
    },
    bookingUrl: clean(intake?.bookingUrl) || clean(user.bookingUrl) || "#contact",
    portalUrl: `${getPortalUrl()}/portal`,
    contact: {
      email: user.email,
      ...(clean(user.phone) ? { phone: clean(user.phone) } : {}),
    },
    seo: {
      title: `${firmName} | CPA & Tax Advisory`,
      description: `${firmName} provides tax preparation, bookkeeping and year-round tax planning for individuals and business owners. Licensed CPAs, fixed-fee pricing and a secure client portal.`,
    },
  };

  const validated = validateFirmSiteConfig(config);
  if (!validated.ok) {
    // Should never happen — the scaffold is built from constants. Surface loudly.
    throw new Error(`Scaffold failed validation: ${validated.errors.join("; ")}`);
  }
  return validated.config;
}

// ── Claude copy pass ─────────────────────────────────────

const CAPS = {
  tagline: 120,
  heroHeadline: 90,
  heroSub: 400,
  aboutHeading: 120,
  aboutBody: 900,
  highlight: 120,
  serviceTitle: 80,
  serviceDescription: 280,
  seoTitle: 70,
  seoDescription: 160,
} as const;

const SYSTEM_PROMPT = `You are an expert copywriter for CPA and accounting firm websites.

You will receive a firm's name, the services it offers, any notes from the owner and a draft of the current website copy. Rewrite the copy so it is specific, warm and credible.

Rules:
- Return ONLY a JSON object, no prose, no code fences.
- Shape: {"tagline": string, "heroHeadline": string, "heroSub": string, "about": {"heading": string, "body": string, "highlights": string[]}, "services": [{"title": string, "description": string}], "seo": {"title": string, "description": string}}
- "services" must have exactly the same number of entries, in the same order, as the services provided. Keep each service's meaning; improve the wording.
- Length caps (characters): tagline ${CAPS.tagline}, heroHeadline ${CAPS.heroHeadline}, heroSub ${CAPS.heroSub}, about.heading ${CAPS.aboutHeading}, about.body ${CAPS.aboutBody}, each highlight ${CAPS.highlight}, service title ${CAPS.serviceTitle}, service description ${CAPS.serviceDescription}, seo.title ${CAPS.seoTitle}, seo.description ${CAPS.seoDescription}.
- Plain, professional tone. No exclamation marks. No hype words.
- Do not invent credentials, years in business, client counts, awards, locations or any number that was not provided.
- Provide 3 to 5 highlights: short, factual phrases about how the firm works.
- Write in the second person where natural ("your books", "your return").`;

function buildUserMessage(scaffold: FirmSiteConfig, ctx: { intake: OnboardingIntake | null; user: UserRow }): string {
  const lines: string[] = [];
  lines.push(`Firm name: ${scaffold.firmName}`);
  lines.push(`Services (keep this order):`);
  scaffold.services.forEach((s, i) => lines.push(`  ${i + 1}. ${s.title} — ${s.description}`));
  const notes = clean(ctx.intake?.notes);
  if (notes) lines.push(`Owner notes: ${notes.slice(0, 2000)}`);
  const site = clean(ctx.intake?.currentWebsite) || clean(ctx.user.websiteUrl);
  if (site) lines.push(`Current website: ${site}`);
  const domain = clean(ctx.intake?.preferredDomain);
  if (domain) lines.push(`Preferred domain: ${domain}`);
  lines.push("");
  lines.push("Current draft copy:");
  lines.push(
    JSON.stringify(
      {
        tagline: scaffold.tagline,
        heroHeadline: scaffold.heroHeadline,
        heroSub: scaffold.heroSub,
        about: scaffold.about,
        seo: scaffold.seo,
      },
      null,
      2
    )
  );
  return lines.join("\n");
}

function extractJsonObject(text: string): unknown | null {
  // First balanced-looking object in the response. Strip code fences first.
  const stripped = text.replace(/```(?:json)?/gi, "");
  const m = /\{[\s\S]*\}/.exec(stripped);
  if (!m) return null;
  try {
    return JSON.parse(m[0]);
  } catch {
    return null;
  }
}

function okStr(v: unknown, cap: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t || t.length > cap) return null;
  return t;
}

/**
 * Apply Claude's suggestions to a copy of the scaffold, field by field.
 * Returns the new config and the list of applied field names.
 */
export function applyCopySuggestions(
  scaffold: FirmSiteConfig,
  raw: unknown
): { config: FirmSiteConfig; applied: string[]; skipped: string[] } {
  const applied: string[] = [];
  const skipped: string[] = [];
  const next: FirmSiteConfig = structuredClone(scaffold);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { config: next, applied, skipped: ["response was not an object"] };
  }
  const r = raw as Record<string, unknown>;

  const take = (key: string, v: unknown, cap: number, set: (s: string) => void) => {
    if (v === undefined) return;
    const s = okStr(v, cap);
    if (s) {
      set(s);
      applied.push(key);
    } else skipped.push(key);
  };

  take("tagline", r.tagline, CAPS.tagline, (s) => (next.tagline = s));
  take("heroHeadline", r.heroHeadline, CAPS.heroHeadline, (s) => (next.heroHeadline = s));
  take("heroSub", r.heroSub, CAPS.heroSub, (s) => (next.heroSub = s));

  if (r.about && typeof r.about === "object" && !Array.isArray(r.about)) {
    const a = r.about as Record<string, unknown>;
    take("about.heading", a.heading, CAPS.aboutHeading, (s) => (next.about.heading = s));
    take("about.body", a.body, CAPS.aboutBody, (s) => (next.about.body = s));
    if (a.highlights !== undefined) {
      if (Array.isArray(a.highlights)) {
        const hs = a.highlights
          .map((h) => okStr(h, CAPS.highlight))
          .filter((h): h is string => h !== null)
          .slice(0, 8);
        if (hs.length >= 2) {
          next.about.highlights = hs;
          applied.push("about.highlights");
        } else skipped.push("about.highlights");
      } else skipped.push("about.highlights");
    }
  }

  if (r.services !== undefined) {
    if (Array.isArray(r.services) && r.services.length === scaffold.services.length) {
      let any = false;
      r.services.forEach((s, i) => {
        const o = (s && typeof s === "object" ? s : {}) as Record<string, unknown>;
        const title = okStr(o.title, CAPS.serviceTitle);
        const description = okStr(o.description, CAPS.serviceDescription);
        if (title) {
          next.services[i].title = title;
          any = true;
        }
        if (description) {
          next.services[i].description = description;
          any = true;
        }
        if (!title || !description) skipped.push(`services[${i}]`);
      });
      if (any) applied.push("services");
    } else skipped.push("services (length mismatch)");
  }

  if (r.seo && typeof r.seo === "object" && !Array.isArray(r.seo)) {
    const s = r.seo as Record<string, unknown>;
    take("seo.title", s.title, CAPS.seoTitle, (v) => (next.seo.title = v));
    take("seo.description", s.description, CAPS.seoDescription, (v) => (next.seo.description = v));
  }

  // No exclamation marks — strip rather than reject.
  for (const key of ["tagline", "heroHeadline", "heroSub"] as const) {
    next[key] = next[key].replace(/!/g, ".").replace(/\.\./g, ".");
  }

  const validated = validateFirmSiteConfig(next);
  if (!validated.ok) {
    return { config: structuredClone(scaffold), applied: [], skipped: [...skipped, ...validated.errors] };
  }
  return { config: validated.config, applied, skipped };
}

export async function enhanceWithClaude(
  scaffold: FirmSiteConfig,
  ctx: { intake: OnboardingIntake | null; user: UserRow }
): Promise<{ config: FirmSiteConfig; notes: string; applied: string[] }> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { config: scaffold, notes: "ANTHROPIC_API_KEY not set; template copy used.", applied: [] };
  }

  const client = new Anthropic({ timeout: 60_000, maxRetries: 1 });
  let text = "";
  try {
    const response = await client.messages.create({
      model: FIRM_SITE_COPY_MODEL,
      // Short JSON payload; well under the cap even for 12 services.
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserMessage(scaffold, ctx) }],
    });

    if (response.stop_reason === "refusal") {
      return {
        config: scaffold,
        notes: "Claude declined the request (stop_reason refusal); template copy used.",
        applied: [],
      };
    }
    if (response.stop_reason === "max_tokens") {
      return { config: scaffold, notes: "Claude output hit max_tokens; template copy used.", applied: [] };
    }

    text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
  } catch (err) {
    const why =
      err instanceof Anthropic.APIError
        ? `API error ${err.status ?? ""} ${err.message}`.trim()
        : err instanceof Error
          ? err.message
          : String(err);
    return { config: scaffold, notes: `Claude call failed (${why}); template copy used.`, applied: [] };
  }

  const parsed = extractJsonObject(text);
  if (!parsed) {
    return { config: scaffold, notes: "Claude response was not parsable JSON; template copy used.", applied: [] };
  }

  const { config, applied, skipped } = applyCopySuggestions(scaffold, parsed);
  if (applied.length === 0) {
    return {
      config: scaffold,
      notes: `Claude returned JSON but no field passed validation (${skipped.join(", ") || "empty"}); template copy used.`,
      applied: [],
    };
  }
  const notes =
    `Copy written by ${FIRM_SITE_COPY_MODEL}: ${applied.join(", ")}.` +
    (skipped.length ? ` Skipped: ${skipped.join(", ")}.` : "");
  return { config, notes, applied };
}

export async function generateFirmSiteConfig(args: {
  user: UserRow;
  intake: OnboardingIntake | null;
  slug: string;
}): Promise<{ config: FirmSiteConfig; generatedBy: "claude" | "template"; notes: string }> {
  const scaffold = buildScaffold(args);
  const { config, notes, applied } = await enhanceWithClaude(scaffold, {
    intake: args.intake,
    user: args.user,
  });
  return { config, generatedBy: applied.length > 0 ? "claude" : "template", notes };
}
