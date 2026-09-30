/**
 * Firm Foundation website config — DATA SHAPE ONLY.
 *
 * Mirror of the marketing app's /lib/firm-sites/types.ts (repo root). The
 * marketing app renders the site from this object; the dashboard generates,
 * edits and stores it in `firm_sites.config`. Keep the two interfaces in sync.
 */
export interface FirmSiteConfig {
  /** URL segment under /sites/<slug>. Lowercase, hyphenated. */
  slug: string;
  /** Apex custom domain (no protocol, no www). Enables host-based routing. */
  domain?: string;
  firmName: string;
  /** Short positioning line shown as the hero eyebrow and in the footer. */
  tagline: string;
  heroHeadline: string;
  heroSub: string;
  logo?: { src: string; alt: string; width?: number; ink?: "dark" | "light" | "mixed" };
  colors: {
    primary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
    textMuted: string;
    border: string;
  };
  /** Optional dark palette; `colors` is then the light one and `theme` picks the default. */
  darkColors?: FirmSiteConfig["colors"];
  theme?: "dark" | "light";
  fonts: {
    heading: string;
    body: string;
  };
  style: "glass" | "solid" | "minimal";
  services: { title: string; description: string; icon?: string }[];
  about: { heading: string; body: string; highlights?: string[] };
  team?: { name: string; role: string; photo?: string; bio?: string }[];
  testimonials?: { quote: string; name: string; detail?: string }[];
  stats?: { value: string; label: string }[];
  bookingUrl: string;
  portalUrl: string;
  contact: { phone?: string; email?: string; address?: string; hours?: string };
  seo: { title: string; description: string; ogImage?: string };
  social?: { linkedin?: string; facebook?: string; google?: string };
}

/** Slugs that can never be assigned to a firm (route names / static demo). */
export const RESERVED_SLUGS = ["host", "example-firm"];

export const FIRM_SITE_STYLES = ["glass", "solid", "minimal"] as const;

export const FIRM_SITE_COLOR_KEYS = [
  "primary",
  "accent",
  "background",
  "surface",
  "text",
  "textMuted",
  "border",
] as const;

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const RGB_COLOR = /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(?:,\s*(?:0|1|0?\.\d+)\s*)?\)$/i;
const isCssColor = (v: string) => HEX_COLOR.test(v) || RGB_COLOR.test(v);
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type FirmSiteValidation =
  | { ok: true; config: FirmSiteConfig }
  | { ok: false; errors: string[] };

/**
 * Structural validation for a config coming from the editor, the generator
 * or the database. Returns a cleaned copy (unknown keys dropped) on success.
 */
export function validateFirmSiteConfig(input: unknown): FirmSiteValidation {
  const errors: string[] = [];
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, errors: ["config must be an object"] };
  }
  const c = input as Record<string, unknown>;

  const isStr = (v: unknown): v is string => typeof v === "string";
  const req = (key: string, v: unknown, max = 2000): string => {
    if (!isStr(v) || !v.trim()) {
      errors.push(`${key} is required`);
      return "";
    }
    if (v.length > max) errors.push(`${key} is longer than ${max} characters`);
    return v.trim();
  };
  const opt = (key: string, v: unknown, max = 2000): string | undefined => {
    if (v === undefined || v === null || v === "") return undefined;
    if (!isStr(v)) {
      errors.push(`${key} must be a string`);
      return undefined;
    }
    if (v.length > max) errors.push(`${key} is longer than ${max} characters`);
    return v.trim();
  };

  const slug = req("slug", c.slug, 80);
  if (slug && !SLUG.test(slug)) errors.push("slug must be lowercase letters, numbers and hyphens");
  if (slug && RESERVED_SLUGS.includes(slug)) errors.push(`slug "${slug}" is reserved`);

  const domain = opt("domain", c.domain, 253);
  if (domain && !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) errors.push("domain must be a bare hostname like firm.com");

  const firmName = req("firmName", c.firmName, 120);
  const tagline = req("tagline", c.tagline, 200);
  const heroHeadline = req("heroHeadline", c.heroHeadline, 160);
  const heroSub = req("heroSub", c.heroSub, 600);

  // colors (and the optional dark palette)
  const readPalette = (src: unknown, label: string): FirmSiteConfig["colors"] | null => {
    const input = (src && typeof src === "object" ? src : {}) as Record<string, unknown>;
    const out = {} as FirmSiteConfig["colors"];
    let ok = true;
    for (const key of FIRM_SITE_COLOR_KEYS) {
      const v = input[key];
      if (!isStr(v) || !isCssColor(v.trim())) {
        errors.push(`${label}.${key} must be a hex or rgb()/rgba() color`);
        ok = false;
      } else {
        out[key] = v.trim();
      }
    }
    return ok ? out : null;
  };
  const colors = (readPalette(c.colors, "colors") ?? {}) as FirmSiteConfig["colors"];
  let darkColors: FirmSiteConfig["colors"] | undefined;
  if (c.darkColors !== undefined && c.darkColors !== null) {
    darkColors = readPalette(c.darkColors, "darkColors") ?? undefined;
  }
  let theme: FirmSiteConfig["theme"];
  if (c.theme !== undefined && c.theme !== null) {
    if (c.theme === "dark" || c.theme === "light") theme = c.theme;
    else errors.push("theme must be dark or light");
  }

  // fonts
  const fontsIn = (c.fonts && typeof c.fonts === "object" ? c.fonts : {}) as Record<string, unknown>;
  const fonts = {
    heading: req("fonts.heading", fontsIn.heading, 200),
    body: req("fonts.body", fontsIn.body, 200),
  };

  const style = isStr(c.style) && (FIRM_SITE_STYLES as readonly string[]).includes(c.style)
    ? (c.style as FirmSiteConfig["style"])
    : (errors.push("style must be glass, solid or minimal"), "solid" as const);

  // services
  const services: FirmSiteConfig["services"] = [];
  if (!Array.isArray(c.services) || c.services.length === 0) {
    errors.push("services must contain at least one item");
  } else if (c.services.length > 12) {
    errors.push("services may contain at most 12 items");
  } else {
    c.services.forEach((s, i) => {
      const o = (s && typeof s === "object" ? s : {}) as Record<string, unknown>;
      const title = req(`services[${i}].title`, o.title, 80);
      const description = req(`services[${i}].description`, o.description, 400);
      const icon = opt(`services[${i}].icon`, o.icon, 40);
      services.push(icon ? { title, description, icon } : { title, description });
    });
  }

  // about
  const aboutIn = (c.about && typeof c.about === "object" ? c.about : {}) as Record<string, unknown>;
  const about: FirmSiteConfig["about"] = {
    heading: req("about.heading", aboutIn.heading, 160),
    body: req("about.body", aboutIn.body, 2000),
  };
  if (aboutIn.highlights !== undefined) {
    if (!Array.isArray(aboutIn.highlights) || !aboutIn.highlights.every(isStr)) {
      errors.push("about.highlights must be a list of strings");
    } else {
      about.highlights = aboutIn.highlights.map((h) => h.trim()).filter(Boolean).slice(0, 8);
    }
  }

  // optional lists
  const team: FirmSiteConfig["team"] = [];
  if (c.team !== undefined) {
    if (!Array.isArray(c.team)) errors.push("team must be a list");
    else
      c.team.forEach((t, i) => {
        const o = (t && typeof t === "object" ? t : {}) as Record<string, unknown>;
        const entry: NonNullable<FirmSiteConfig["team"]>[number] = {
          name: req(`team[${i}].name`, o.name, 80),
          role: req(`team[${i}].role`, o.role, 80),
        };
        const photo = opt(`team[${i}].photo`, o.photo, 500);
        const bio = opt(`team[${i}].bio`, o.bio, 500);
        if (photo) entry.photo = photo;
        if (bio) entry.bio = bio;
        team.push(entry);
      });
  }

  const testimonials: FirmSiteConfig["testimonials"] = [];
  if (c.testimonials !== undefined) {
    if (!Array.isArray(c.testimonials)) errors.push("testimonials must be a list");
    else
      c.testimonials.forEach((t, i) => {
        const o = (t && typeof t === "object" ? t : {}) as Record<string, unknown>;
        const entry: NonNullable<FirmSiteConfig["testimonials"]>[number] = {
          quote: req(`testimonials[${i}].quote`, o.quote, 600),
          name: req(`testimonials[${i}].name`, o.name, 80),
        };
        const detail = opt(`testimonials[${i}].detail`, o.detail, 120);
        if (detail) entry.detail = detail;
        testimonials.push(entry);
      });
  }

  const stats: FirmSiteConfig["stats"] = [];
  if (c.stats !== undefined) {
    if (!Array.isArray(c.stats)) errors.push("stats must be a list");
    else
      c.stats.forEach((t, i) => {
        const o = (t && typeof t === "object" ? t : {}) as Record<string, unknown>;
        stats.push({
          value: req(`stats[${i}].value`, o.value, 20),
          label: req(`stats[${i}].label`, o.label, 80),
        });
      });
  }

  const bookingUrl = req("bookingUrl", c.bookingUrl, 500);
  const portalUrl = req("portalUrl", c.portalUrl, 500);

  const contactIn = (c.contact && typeof c.contact === "object" ? c.contact : {}) as Record<string, unknown>;
  const contact: FirmSiteConfig["contact"] = {};
  for (const key of ["phone", "email", "address", "hours"] as const) {
    const v = opt(`contact.${key}`, contactIn[key], 200);
    if (v) contact[key] = v;
  }

  const seoIn = (c.seo && typeof c.seo === "object" ? c.seo : {}) as Record<string, unknown>;
  const seo: FirmSiteConfig["seo"] = {
    title: req("seo.title", seoIn.title, 120),
    description: req("seo.description", seoIn.description, 320),
  };
  const ogImage = opt("seo.ogImage", seoIn.ogImage, 500);
  if (ogImage) seo.ogImage = ogImage;

  let logo: FirmSiteConfig["logo"];
  if (c.logo && typeof c.logo === "object") {
    const o = c.logo as Record<string, unknown>;
    const srcRaw = typeof o.src === "string" ? o.src.trim() : "";
    // Inline data: URLs (cleaned preview logos) may be large; plain URLs stay short.
    const src = srcRaw.startsWith("data:image/")
      ? (srcRaw.length <= 700_000 ? srcRaw : (errors.push("logo.src data URL is too large"), undefined))
      : opt("logo.src", o.src, 500);
    if (src) {
      logo = { src, alt: opt("logo.alt", o.alt, 120) || firmName };
      if (typeof o.width === "number" && o.width > 0) logo.width = o.width;
      if (o.ink === "dark" || o.ink === "light" || o.ink === "mixed") logo.ink = o.ink;
    }
  }

  let social: FirmSiteConfig["social"];
  if (c.social && typeof c.social === "object") {
    const o = c.social as Record<string, unknown>;
    social = {};
    for (const key of ["linkedin", "facebook", "google"] as const) {
      const v = opt(`social.${key}`, o[key], 500);
      if (v) social[key] = v;
    }
    if (Object.keys(social).length === 0) social = undefined;
  }

  if (errors.length) return { ok: false, errors };

  const config: FirmSiteConfig = {
    slug,
    ...(domain ? { domain: domain.toLowerCase() } : {}),
    firmName,
    tagline,
    heroHeadline,
    heroSub,
    ...(logo ? { logo } : {}),
    colors,
    ...(darkColors ? { darkColors } : {}),
    ...(theme ? { theme } : {}),
    fonts,
    style,
    services,
    about,
    ...(team.length ? { team } : {}),
    ...(testimonials.length ? { testimonials } : {}),
    ...(stats.length ? { stats } : {}),
    bookingUrl,
    portalUrl,
    contact,
    seo,
    ...(social ? { social } : {}),
  };
  return { ok: true, config };
}
