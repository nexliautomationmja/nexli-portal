import Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";
import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { getAdCreativesMeta } from "@/lib/meta-ads";
import { adCreativeTags } from "@/lib/ads/tables";
import { money } from "@/lib/ads/format";
import { ANGLES, FORMATS, fallbackMake, fitCounts, typeLabel, type CreativeTags, type MakeCard, type TypeStat } from "@/lib/ads/creative-types";

export { fallbackMake, fitCounts };
import type { AdPlan } from "@/lib/ads/decide";
import type { AdRow } from "@/lib/ads/types";

/**
 * Claude's two jobs in the daily plan: read each creative once (what format,
 * what angle, what hook — from its still, name and copy), and each morning
 * write the "what to make" cards from how each type performs. Counts always
 * add up to the number the rules asked for; if Claude fails, the cards fall
 * back to variations of the best performer.
 */

const MODEL = "claude-opus-5-5";
const BATCH = 8;

const tagKey = (a: AdRow) => createHash("sha1").update([a.name, a.creative.headline ?? "", a.creative.primaryText ?? "", a.creative.mediaType].join("|")).digest("hex").slice(0, 20);

export async function loadTags(ownerId: string, accountId: string): Promise<Record<string, CreativeTags>> {
  const rows = await db
    .select({ adId: adCreativeTags.adId, tags: adCreativeTags.tags })
    .from(adCreativeTags)
    .where(and(eq(adCreativeTags.ownerId, ownerId), eq(adCreativeTags.accountId, accountId)));
  return Object.fromEntries(rows.map((r) => [r.adId, r.tags as CreativeTags]));
}

function client(timeout: number) {
  return new Anthropic({ timeout, maxRetries: 1 });
}

/** Text of a structured-output reply (throws on refusal / empty). */
export async function structured(params: Record<string, unknown>, timeout: number): Promise<unknown> {
  const c = client(timeout);
  const message = await c.beta.messages
    .stream({ model: MODEL, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default", ...params } as unknown as Parameters<typeof c.beta.messages.stream>[0])
    .finalMessage();
  if (message.stop_reason === "refusal") throw new Error("Claude declined");
  const text = message.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  return JSON.parse(text);
}

// ── Tagging ─────────────────────────────────────────────

const TAG_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["ads"],
  properties: {
    ads: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["number", "format", "angle", "hook", "summary"],
        properties: {
          number: { type: "integer", description: "The ad's number as given (1-based)." },
          format: { type: "string", enum: Object.keys(FORMATS) },
          angle: { type: "string", enum: Object.keys(ANGLES) },
          hook: { type: "string", description: "The opening line or image that's meant to stop the scroll, in at most 12 words." },
          summary: { type: "string", description: "What the creative is, in one plain sentence (max 25 words)." },
        },
      },
    },
  },
} as const;

const TAG_RULES = `You label Facebook / Instagram ad creatives for a marketing agency that sells to CPA and accounting firm owners.
For each numbered ad you get its name, its copy and a still image (for a video, its cover frame). Return one entry per ad:
- format: talking_head (a real person talking to camera) · ai_presenter (a presenter that looks AI-generated — too smooth, rendered) · b_roll_video (footage without a presenter, voice-over or captions) · screen_recording · static_photo (a photo, no big text) · text_graphic (the image is mostly words, stats or a design) · carousel · other. Use the media type given when the still isn't clear.
- angle: pain (leads with a problem the viewer has) · proof (results, testimonials, numbers) · mechanism (how the system works) · offer (the deal, a free thing, a call to book) · authority (credentials, expertise) · curiosity (a question or tease) · other.
- hook: the opening words or image.
- summary: what it is, plainly.
Judge from what you see and read; never invent results.`;

/** Tag the ads that aren't tagged yet (or whose creative changed): most spend first, at most `max`. */
export async function tagCreatives(ownerId: string, accountId: string, ads: AdRow[], opts: { max?: number; deadline?: number } = {}): Promise<{ tagged: number; error: string | null }> {
  const existing = await db
    .select({ adId: adCreativeTags.adId, key: adCreativeTags.key })
    .from(adCreativeTags)
    .where(and(eq(adCreativeTags.ownerId, ownerId), eq(adCreativeTags.accountId, accountId)));
  const have = new Map(existing.map((r) => [r.adId, r.key]));
  const todo = ads
    .filter((a) => (a.effectiveStatus === "ACTIVE" || (a.l30?.spendCents ?? 0) > 0) && have.get(a.id) !== tagKey(a))
    .sort((a, b) => (b.l30?.spendCents ?? 0) - (a.l30?.spendCents ?? 0))
    .slice(0, opts.max ?? 24);
  if (!todo.length) return { tagged: 0, error: null };

  // Big stills (video covers / full images) when Meta gives them; the thumbnail otherwise.
  const media = await getAdCreativesMeta(todo.map((a) => a.id)).catch(() => null);
  const still = (a: AdRow) => (media && media.ok ? media.byId[a.id]?.posterUrl || media.byId[a.id]?.thumbnailUrl : null) || a.creative.imageUrl || a.creative.thumbnailUrl;

  let tagged = 0;
  let error: string | null = null;
  for (let i = 0; i < todo.length; i += BATCH) {
    if (opts.deadline && Date.now() > opts.deadline - 60_000) break;
    const batch = todo.slice(i, i + BATCH);
    const images = await Promise.all(batch.map((a) => smallJpeg(still(a))));
    const content: Record<string, unknown>[] = [];
    batch.forEach((a, n) => {
      content.push({
        type: "text",
        text: [
          `Ad ${n + 1} — name: "${a.name}" · media: ${a.creative.mediaType}`,
          a.creative.headline ? `Headline: ${a.creative.headline}` : null,
          a.creative.primaryText ? `Copy: ${a.creative.primaryText.slice(0, 500)}` : null,
          images[n] ? null : "(no image available)",
        ]
          .filter(Boolean)
          .join("\n"),
      });
      if (images[n]) content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: images[n] } });
    });
    content.push({ type: "text", text: `Label all ${batch.length} ads.` });
    try {
      const raw = (await structured(
        { max_tokens: 3000, system: TAG_RULES, messages: [{ role: "user", content }], output_config: { effort: "low", format: { type: "json_schema", schema: TAG_SCHEMA } } },
        120_000
      )) as { ads?: { number?: number; format?: string; angle?: string; hook?: string; summary?: string }[] };
      for (const r of raw.ads ?? []) {
        const a = batch[(r.number ?? 0) - 1];
        if (!a) continue;
        const tags: CreativeTags = {
          format: (r.format && r.format in FORMATS ? r.format : "other") as CreativeTags["format"],
          angle: (r.angle && r.angle in ANGLES ? r.angle : "other") as CreativeTags["angle"],
          hook: (r.hook ?? "").slice(0, 120),
          summary: (r.summary ?? "").slice(0, 240),
        };
        await db
          .insert(adCreativeTags)
          .values({ ownerId, accountId, adId: a.id, key: tagKey(a), tags })
          .onConflictDoUpdate({ target: [adCreativeTags.ownerId, adCreativeTags.accountId, adCreativeTags.adId], set: { key: tagKey(a), tags, createdAt: new Date() } });
        tagged++;
      }
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      console.error("[ads] creative tagging failed:", error);
    }
  }
  return { tagged, error };
}

/** A still as a small JPEG (base64), or null. */
async function smallJpeg(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    const out = await sharp(buf, { failOn: "none" }).rotate().resize({ width: 512, height: 512, fit: "inside" }).jpeg({ quality: 78 }).toBuffer();
    return out.toString("base64");
  } catch {
    return null;
  }
}

// ── What to make ────────────────────────────────────────

const MAKE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["make"],
  properties: {
    make: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type_key", "count", "format", "why", "brief", "based_on"],
        properties: {
          type_key: { type: "string", description: "The type's key from the list (format:angle), or a new combination worth testing." },
          count: { type: "integer" },
          format: { type: "string", enum: ["video", "photo"] },
          why: { type: "string", description: "One sentence with the numbers from the data: why this type, why this many." },
          brief: { type: "string", description: "A Creative Studio brief: the angle, the hook ideas, what to keep from the ad(s) it's based on, what to change. 60-140 words. Plain words, no prices, no guarantees, no competitor names." },
          based_on: { type: "array", items: { type: "integer" }, description: "Numbers of the ads it copies (from the ads list)." },
        },
      },
    },
  },
} as const;

const MAKE_RULES = `You plan the next ad creatives for a marketing agency (Nexli) whose ads sell its "Digital Rainmaker System" to CPA and accounting firm owners. Results are judged by booked calls.
You get: how many new creatives the account needs, how each creative type performed over 30 days (cost per booked call is what matters most; cost per lead next), the ads with their results, and notes from the owner.
Split exactly the requested number into 1-3 cards:
- Most of them copy the best-performing type (more booked calls per dollar), as fresh variations of its best ads: new hooks, new scenes, same angle.
- If there are 3 or more to make, one card may test a promising type that hasn't had enough spend yet.
- Never put a type that spent 2x the target with no booked calls in a card.
- format is "video" for talking head / AI presenter / b-roll / screen recording types, "photo" for photo / text graphic / carousel.
The counts must add up to the requested number exactly.`;

/** The "make" cards for today (counts add up to `add`). */
export async function writeMakeCards(input: {
  add: number;
  types: TypeStat[];
  ads: AdRow[];
  tags: Record<string, CreativeTags>;
  plan: AdPlan;
  context: string;
  timeoutMs?: number;
}): Promise<{ cards: MakeCard[]; source: "claude" | "fallback" }> {
  if (input.add <= 0) return { cards: [], source: "fallback" };
  const ranked = input.ads.filter((a) => (a.l30?.spendCents ?? 0) > 0).slice(0, 20);
  const callOf = new Map(input.plan.calls.map((c) => [c.adId, c]));
  const adsText = ranked
    .map((a, i) => {
      const t = input.tags[a.id];
      const m = a.l30;
      const c = callOf.get(a.id);
      return `${i + 1}. "${a.name}" — ${t ? typeLabel(t) : a.creative.mediaType} — 30d: ${money(m?.spendCents ?? 0)} spent, ${m?.ghlLeads ?? 0} leads, ${m?.booked ?? 0} booked${m?.costPerBookedCents ? ` (${money(m.costPerBookedCents)}/booked)` : ""} — today's call: ${c ? (c.call === "cut" ? "CUT" : `KEEP (${c.tag})`) : "not running"}${t ? `\n   hook: ${t.hook} · ${t.summary}` : ""}${a.creative.primaryText ? `\n   copy: ${a.creative.primaryText.slice(0, 280)}` : ""}`;
    })
    .join("\n");
  const typesText = input.types.length
    ? input.types
        .map((t) => `- ${t.key} (${t.label}): ${t.ads} ads, ${money(t.spendCents)} spent, ${t.leads} leads, ${t.booked} booked${t.cpbCents !== null ? `, ${money(t.cpbCents)}/booked` : ""}${t.cplCents !== null ? `, ${money(t.cplCents)}/lead` : ""} → ${t.verdict}`)
        .join("\n")
    : "(no types tagged yet)";
  const prompt = `Make ${input.add} new creative${input.add === 1 ? "" : "s"}.
Targets: ${money(input.plan.targets.cpbCents)} per booked call, ${money(input.plan.targets.cplCents)} per lead.
Why new creatives are needed: ${input.plan.need.why}

Creative types (30 days):
${typesText}

Ads (30 days, most spend first):
${adsText}
${input.context.trim() ? `\nNotes from the owner: ${input.context.trim().slice(0, 1200)}` : ""}`;
  try {
    const raw = (await structured(
      { max_tokens: 4000, system: MAKE_RULES, messages: [{ role: "user", content: prompt }], output_config: { effort: "medium", format: { type: "json_schema", schema: MAKE_SCHEMA } } },
      Math.max(20_000, Math.min(150_000, input.timeoutMs ?? 150_000))
    )) as { make?: { type_key?: string; count?: number; format?: string; why?: string; brief?: string; based_on?: number[] }[] };
    const cards = fitCounts(
      (raw.make ?? []).map((m) => {
        const [f, an] = (m.type_key ?? "").split(":");
        const label = f && f in FORMATS ? typeLabel({ format: f as CreativeTags["format"], angle: (an && an in ANGLES ? an : "other") as CreativeTags["angle"] }) : "New creatives";
        return {
          label,
          count: Math.max(0, Math.round(m.count ?? 0)),
          format: m.format === "video" ? ("video" as const) : ("photo" as const),
          why: (m.why ?? "").slice(0, 400),
          brief: (m.brief ?? "").slice(0, 1600),
          basedOn: (m.based_on ?? []).map((n) => ranked[n - 1]).filter((a): a is AdRow => Boolean(a)).slice(0, 3).map((a) => ({ adId: a.id, name: a.name })),
        };
      }),
      input.add
    );
    if (cards.length) return { cards, source: "claude" };
  } catch (err) {
    console.error("[ads] make cards failed (using the fallback):", err instanceof Error ? err.message : err);
  }
  return { cards: fallbackMake(input), source: "fallback" };
}
