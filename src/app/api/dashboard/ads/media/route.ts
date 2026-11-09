import { NextRequest, NextResponse } from "next/server";
import { requireAdsAdmin } from "@/lib/ads/access";
import { adsCache } from "@/lib/ads/cache";
import { getAdCreativesMeta, type AdCreativeMeta } from "@/lib/meta-ads";

export const maxDuration = 60;

type Media = Pick<AdCreativeMeta, "mediaType" | "thumbnailUrl" | "posterUrl" | "videoUrl" | "permalinkUrl" | "primaryText" | "headline" | "ctaLabel" | "linkDomain">;

/** Full creative media for up to 12 ads (big stills, playable video, copy) — loaded as cards scroll in. */
export async function GET(req: NextRequest) {
  const access = await requireAdsAdmin();
  if (!access.ok) return access.response;
  const ids = [...new Set((req.nextUrl.searchParams.get("ids") ?? "").split(",").map((s) => s.trim()).filter((s) => /^\d{5,25}$/.test(s)))].slice(0, 12).sort();
  if (!ids.length) return NextResponse.json({ byId: {} });
  const r = await adsCache<{ byId: Record<string, Media>; error: string | null }>({
    userId: access.ownerId,
    layer: "media",
    key: `v1:${ids.join(",")}`,
    ttlMs: 30 * 60 * 1000,
    load: async () => {
      const meta = await getAdCreativesMeta(ids);
      if (!meta.ok) return { ok: false, value: { byId: {}, error: meta.error } };
      const byId: Record<string, Media> = {};
      for (const [id, m] of Object.entries(meta.byId)) {
        byId[id] = {
          mediaType: m.mediaType,
          thumbnailUrl: m.thumbnailUrl,
          posterUrl: m.posterUrl,
          videoUrl: m.videoUrl,
          permalinkUrl: m.permalinkUrl,
          primaryText: m.primaryText,
          headline: m.headline,
          ctaLabel: m.ctaLabel,
          linkDomain: m.linkDomain,
        };
      }
      return { ok: true, value: { byId, error: meta.errors[0] ?? null } };
    },
  });
  return NextResponse.json(r.value);
}
