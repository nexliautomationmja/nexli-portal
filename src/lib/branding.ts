import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Per-firm branding shown to a firm's clients — portal chrome, outbound
 * emails, and the invoice / engagement documents. Nexli-owned records (admin
 * role) and unknown owners fall back to NEXLI_BRANDING.
 */
export type OwnerBranding = {
  displayName: string;
  /** Absolute URL or a site-relative path (starts with "/"). */
  logoUrl: string;
  /** Sanitized hex color like "#0f766e", or null to use the default accent. */
  brandColor: string | null;
  /** Email From display name, e.g. "Smith CPA via Nexli Portal". */
  fromName: string;
  isNexli: boolean;
};

export const NEXLI_LOGO_PATH = "/logos/nexli-logo-white-wordmark@2x.png";

export const NEXLI_BRANDING: OwnerBranding = {
  displayName: "Nexli Portal",
  logoUrl: NEXLI_LOGO_PATH,
  brandColor: null,
  fromName: "Nexli Portal",
  isNexli: true,
};

/**
 * Normalize a user-supplied hex color to "#rrggbb". Accepts 3- or 6-digit hex
 * with or without the leading "#". Returns null for anything else.
 */
export function sanitizeHexColor(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const raw = input.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{6}$/.test(raw)) return `#${raw.toLowerCase()}`;
  if (/^[0-9a-fA-F]{3}$/.test(raw)) {
    const [r, g, b] = raw.toLowerCase().split("");
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return null;
}

/** Resolve a branding logo to an absolute URL for use in emails. */
export function absoluteLogoUrl(logoUrl: string): string {
  if (logoUrl.startsWith("/")) {
    const base = (
      process.env.NEXT_PUBLIC_PORTAL_URL || "https://portal.nexli.net"
    ).replace(/\/+$/, "");
    return `${base}${logoUrl}`;
  }
  return logoUrl;
}

export async function getOwnerBranding(
  ownerId: string | null | undefined
): Promise<OwnerBranding> {
  if (!ownerId) return NEXLI_BRANDING;

  let row:
    | {
        portalDisplayName: string | null;
        companyName: string | null;
        name: string | null;
        logoUrl: string | null;
        brandColor: string | null;
        role: "admin" | "client";
      }
    | undefined;

  try {
    [row] = await db
      .select({
        portalDisplayName: users.portalDisplayName,
        companyName: users.companyName,
        name: users.name,
        logoUrl: users.logoUrl,
        brandColor: users.brandColor,
        role: users.role,
      })
      .from(users)
      .where(eq(users.id, ownerId))
      .limit(1);
  } catch (err) {
    console.error("[branding] lookup failed:", err);
    return NEXLI_BRANDING;
  }

  if (!row || row.role === "admin") return NEXLI_BRANDING;

  const displayName =
    row.portalDisplayName?.trim() ||
    row.companyName?.trim() ||
    row.name?.trim() ||
    "Your Firm";

  return {
    displayName,
    logoUrl: row.logoUrl?.trim() || NEXLI_LOGO_PATH,
    brandColor: sanitizeHexColor(row.brandColor),
    fromName: `${displayName} via Nexli Portal`,
    isNexli: false,
  };
}
