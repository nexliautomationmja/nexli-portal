import { and, desc, eq, gt, inArray } from "drizzle-orm";
import { db } from "@/db";
import { creativeEdits, creativeProjects } from "@/lib/creative-studio/tables";
import { adCreativeIdeas } from "@/lib/ads/tables";
import { getSettings } from "@/lib/ads/settings";
import { snapshot30 } from "@/lib/ads/pack";
import { latestResearchForPack } from "@/lib/ads/research-service";
import { decideAds } from "@/lib/ads/decide";
import { loadTags, structured } from "@/lib/ads/creative-ai";
import { ANGLES, FORMATS, typeLabel, typeStats, type CreativeTags } from "@/lib/ads/creative-types";
import { money } from "@/lib/ads/format";
import { shortDay } from "@/lib/ads/time";
import { IDEAS_MAX, type CreativeIdea, type DeckItem, type DeckStage, type IdeaBacking, type IdeaSetView } from "@/lib/ads/ideas-shared";
import { AUDIENCE } from "@/lib/creative-studio/offer-facts";

/**
 * "Create new creatives": Claude comes up with 1–5 fresh video ideas for the
 * account, each backed by what already books calls for Marcel (his best
 * creative types and ads, with the numbers) and what's been running for a
 * long time for others selling to CPA firms (the latest Ad Library
 * research). The ideas become Creative Studio videos; the ones not live yet
 * are "on deck", ready for the next time a creative gets cut.
 */

type Row = typeof adCreativeIdeas.$inferSelect;

const IDEAS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["ideas"],
  properties: {
    ideas: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "type_key", "hook", "concept", "direction", "shot", "why_ours", "why_market", "based_on_ads", "based_on_market"],
        properties: {
          title: { type: "string", description: "A short working name, max 60 characters — it also works as the Meta ad name." },
          type_key: { type: "string", description: "format:angle, e.g. ai_presenter:pain (formats and angles as listed)." },
          hook: { type: "string", description: "The first spoken line, max 15 words — what stops the scroll." },
          concept: { type: "string", description: "What happens in the video, 2-3 plain sentences." },
          direction: { type: "string", description: "The brief for Creative Studio's script writer, 80-180 words." },
          shot: { type: "string", description: "The opening frame for the image generator, 1-2 sentences." },
          why_ours: { type: "string", description: "Evidence from Marcel's own results with the numbers, or an empty string." },
          why_market: { type: "string", description: "Evidence from the Ad Library research, or an empty string when there's none." },
          based_on_ads: { type: "array", items: { type: "integer" }, description: "Numbers of Marcel's ads it builds on." },
          based_on_market: { type: "array", items: { type: "integer" }, description: "Numbers of the market ads it borrows a pattern from." },
        },
      },
    },
  },
} as const;

const RULES = `You come up with new video ad ideas for Nexli. Nexli sells the Digital Rainmaker System — done-for-you client acquisition (website, funnel, Meta ads, CRM, automations) — to owners of US CPA and accounting firms doing ${AUDIENCE.written} (the qualifier line: "${AUDIENCE.qualifier}"). Every ad has one job: get the right firm owner to book a free strategy call.
Each idea is a 9:16 video of 15-35 seconds, made in Creative Studio (an AI presenter on Kling, or b-roll), for Facebook and Instagram.

Make exactly the number of ideas asked for, each clearly different (different hook, scene and opening frame).
Back every idea with evidence:
- Marcel's own results: his creative types and ads, judged by booked calls (cost per booked call first, cost per lead next). Copy what books calls: a fresh hook and scene in the same type and angle.
- The market: ads others selling to CPA firms have kept running for 30+ days (long-running = it works for them), and the patterns and gaps the research found.
Spread them: most ideas build on Marcel's best type; when asked for 3 or more and there is market research, at least one borrows a proven market pattern he hasn't tried. With no research, leave why_market empty.
Never: repeat a type marked "stop" (spent 2x the target with no booked calls), repeat an idea already on deck, copy a competitor's words, names, logos, offers or footage, mention prices, promise results or income, or claim anything about the IRS or the government.
direction (for the script writer): who's on screen and where, the hook line word for word, 2-4 beats, the call to action (book a free strategy call), the tone. Plain words.
shot (for the image generator): the presenter or scene, setting, framing and light for the first frame — vertical, no text in the image.
why_ours / why_market: one sentence each with the actual numbers or the advertiser pattern, e.g. "Your AI presenter · pain-led ads book calls at $190 (Daniela — Referrals dried up)".`;

const viewOf = (r: Row): IdeaSetView => ({
  id: r.id,
  count: r.count,
  note: r.note,
  ideas: (r.ideas as CreativeIdea[]) ?? [],
  backing: (r.backing as IdeaBacking | null) ?? null,
  batchId: r.batchId,
  projectIds: r.projectIds ?? [],
  createdAt: r.createdAt.toISOString(),
});

/** Come up with `count` ideas (1–5) and save them as a set. */
export async function writeIdeas(o: { ownerId: string; accountId: string; actorId: string; count: number; note: string }): Promise<IdeaSetView> {
  const count = Math.max(1, Math.min(IDEAS_MAX, Math.round(o.count)));
  const settings = await getSettings(o.ownerId, o.accountId);
  const [s, tags, research, recent] = await Promise.all([
    snapshot30(o.ownerId, o.accountId, settings),
    loadTags(o.ownerId, o.accountId).catch(() => ({}) as Record<string, CreativeTags>),
    latestResearchForPack(o.ownerId, o.accountId).catch(() => null),
    db
      .select({ ideas: adCreativeIdeas.ideas })
      .from(adCreativeIdeas)
      .where(and(eq(adCreativeIdeas.ownerId, o.ownerId), eq(adCreativeIdeas.accountId, o.accountId), gt(adCreativeIdeas.createdAt, new Date(Date.now() - 45 * 86400000))))
      .orderBy(desc(adCreativeIdeas.createdAt))
      .limit(10),
  ]);
  if (!s) throw new Error("Meta ads aren't connected.");

  const plan = decideAds(s);
  const callOf = new Map(plan.calls.map((c) => [c.adId, c]));
  const types = typeStats(s.ads, tags, { cpbCents: plan.targets.cpbCents, cplCents: plan.targets.cplCents });
  const ours = s.ads.filter((a) => (a.l30?.spendCents ?? 0) > 0).slice(0, 20);
  const oursText = ours.length
    ? ours
        .map((a, i) => {
          const t = tags[a.id];
          const m = a.l30;
          const c = callOf.get(a.id);
          return `${i + 1}. "${a.name}" — ${t ? typeLabel(t) : a.creative.mediaType} — 30d: ${money(m?.spendCents ?? 0)} spent, ${m?.ghlLeads ?? 0} leads, ${m?.booked ?? 0} booked${m?.costPerBookedCents ? ` (${money(m.costPerBookedCents)} per booked call)` : ""} — today's call: ${c ? (c.call === "cut" ? (c.cutKind === "early_read" ? "CUT (early read: weak first look)" : "CUT") : `KEEP (${c.tag})`) + (c.override ? " (Marcel's call)" : "") : "not running"}${t ? `\n   hook: ${t.hook} · ${t.summary}` : ""}${a.creative.primaryText ? `\n   copy: ${a.creative.primaryText.slice(0, 240)}` : ""}`;
        })
        .join("\n")
    : "(no ads with spend in the last 30 days)";
  const typesText = types.length
    ? types.map((t) => `- ${t.key} (${t.label}): ${t.ads} ads, ${money(t.spendCents)} spent, ${t.leads} leads, ${t.booked} booked${t.cpbCents !== null ? `, ${money(t.cpbCents)} per booked call` : ""} → ${t.verdict === "weak" ? "stop" : t.verdict}`).join("\n")
    : "(creative types aren't tagged yet — judge from the ad list)";
  const marketAds = research?.long_running_competitor_ads ?? [];
  const marketText = research
    ? [
        `Research from ${research.finished_at ? shortDay(research.finished_at.slice(0, 10)) : "recently"} (${research.age_days ?? "?"} days old): ${research.headline}`,
        research.market_patterns.length ? `Patterns:\n${research.market_patterns.map((p) => `- ${p.title}: ${p.detail}`).join("\n")}` : null,
        research.gaps.length ? `Gaps nobody fills:\n${research.gaps.map((p) => `- ${p.title}: ${p.detail}`).join("\n")}` : null,
        marketAds.length ? `Long-running ads (30+ days):\n${marketAds.map((a, i) => `${i + 1}. ${a.advertiser} — ${a.format}, ${a.angle}, ${a.days_active ?? "?"} days, hook: "${a.hook}", offer: ${a.offer}`).join("\n")}` : null,
        research.briefs.length ? `Briefs it suggested:\n${research.briefs.map((b) => `- ${b.title} (${b.format}, ${b.angle}): ${b.hook_lines.slice(0, 2).join(" / ")}`).join("\n")}` : null,
      ]
        .filter(Boolean)
        .join("\n\n")
    : "(no Ad Library research from the last 60 days)";
  const onDeck = recent.flatMap((r) => ((r.ideas as CreativeIdea[]) ?? []).map((i) => i.title)).slice(0, 25);
  const prompt = `Come up with ${count} new video ad idea${count === 1 ? "" : "s"}.
Targets: ${money(plan.targets.cpbCents)} per booked call, ${money(plan.targets.cplCents)} per lead.
${o.note.trim() ? `Marcel's note for this batch: ${o.note.trim().slice(0, 600)}\n` : ""}${settings.context.trim() ? `Marcel's standing notes: ${settings.context.trim().slice(0, 1000)}\n` : ""}
Formats: ${Object.keys(FORMATS).join(", ")}. Angles: ${Object.keys(ANGLES).join(", ")}.

Marcel's creative types (30 days):
${typesText}

Marcel's ads (30 days, most spend first):
${oursText}

The market (Meta Ad Library):
${marketText}

Already on deck (don't repeat): ${onDeck.length ? onDeck.map((t) => `"${t}"`).join(", ") : "nothing yet"}`;

  const raw = (await structured(
    { max_tokens: 8000, system: RULES, messages: [{ role: "user", content: prompt }], output_config: { effort: "medium", format: { type: "json_schema", schema: IDEAS_SCHEMA } } },
    200_000
  )) as {
    ideas?: { title?: string; type_key?: string; hook?: string; concept?: string; direction?: string; shot?: string; why_ours?: string; why_market?: string; based_on_ads?: number[]; based_on_market?: number[] }[];
  };
  const ideas: CreativeIdea[] = (raw.ideas ?? [])
    .filter((x) => x.direction && x.title)
    .slice(0, count)
    .map((x) => {
      const [f, an] = (x.type_key ?? "").split(":");
      return {
        title: (x.title ?? "").slice(0, 80),
        typeLabel: f && f in FORMATS ? typeLabel({ format: f as CreativeTags["format"], angle: (an && an in ANGLES ? an : "other") as CreativeTags["angle"] }) : "New type",
        hook: (x.hook ?? "").slice(0, 200),
        concept: (x.concept ?? "").slice(0, 600),
        direction: (x.direction ?? "").slice(0, 3000),
        shot: (x.shot ?? "").slice(0, 600),
        whyOurs: (x.why_ours ?? "").slice(0, 400),
        whyMarket: research ? (x.why_market ?? "").slice(0, 400) : "",
        basedOn: (x.based_on_ads ?? []).map((n) => ours[n - 1]).filter(Boolean).slice(0, 3).map((a) => ({ adId: a.id, name: a.name })),
        marketRefs: research ? (x.based_on_market ?? []).map((n) => marketAds[n - 1]).filter(Boolean).slice(0, 3).map((a) => ({ advertiser: a.advertiser, url: a.ad_library_url })) : [],
      };
    });
  if (!ideas.length) throw new Error("Claude didn't come back with any ideas. Try again.");

  const best = types.find((t) => t.verdict === "best") ?? types.find((t) => t.verdict === "good") ?? null;
  const backing: IdeaBacking = {
    ours: `${ours.length} ad${ours.length === 1 ? "" : "s"} with 30-day results${best ? ` · best type: ${best.label}${best.cpbCents !== null ? ` at ${money(best.cpbCents)} per booked call` : ""}` : ""}`,
    market: research ? `Ad Library research from ${research.finished_at ? shortDay(research.finished_at.slice(0, 10)) : "recently"} · ${marketAds.length} long-running ad${marketAds.length === 1 ? "" : "s"}, ${research.market_patterns.length} pattern${research.market_patterns.length === 1 ? "" : "s"}` : null,
  };
  const [row] = await db
    .insert(adCreativeIdeas)
    .values({ ownerId: o.ownerId, accountId: o.accountId, count, note: o.note.slice(0, 600), ideas, backing, projectIds: ideas.map(() => null), createdBy: o.actorId })
    .returning();
  return viewOf(row);
}

async function loadSet(ownerId: string, id: string): Promise<Row | null> {
  const [row] = await db.select().from(adCreativeIdeas).where(and(eq(adCreativeIdeas.id, id), eq(adCreativeIdeas.ownerId, ownerId))).limit(1);
  return row ?? null;
}

/** The Creative Studio videos made from a set (index-aligned with its ideas). */
export async function linkProjects(ownerId: string, id: string, projectIds: (string | null)[], batchId: string | null): Promise<IdeaSetView | null> {
  const row = await loadSet(ownerId, id);
  if (!row) return null;
  const ideas = (row.ideas as CreativeIdea[]) ?? [];
  const clean = ideas.map((_, i) => {
    const v = projectIds[i];
    return typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v) ? v : (row.projectIds?.[i] ?? null);
  });
  const [saved] = await db.update(adCreativeIdeas).set({ projectIds: clean, batchId: batchId ?? row.batchId }).where(eq(adCreativeIdeas.id, row.id)).returning();
  return viewOf(saved);
}

/** Marcel uploaded it to Meta (or takes it back off the "live" list). */
export async function markLive(ownerId: string, id: string, projectId: string, live: boolean): Promise<boolean> {
  const row = await loadSet(ownerId, id);
  if (!row || !(row.projectIds ?? []).includes(projectId)) return false;
  const next = { ...(row.live ?? {}) };
  if (live) next[projectId] = new Date().toISOString();
  else delete next[projectId];
  await db.update(adCreativeIdeas).set({ live: next }).where(eq(adCreativeIdeas.id, row.id));
  return true;
}

/** The latest idea set (for the sheet) and the videos on deck / gone live (last 60 days). */
export async function deckState(ownerId: string, accountId: string): Promise<{ latest: IdeaSetView | null; deck: DeckItem[]; live: DeckItem[]; hasResearch: boolean }> {
  const [rows, research] = await Promise.all([
    db
      .select()
      .from(adCreativeIdeas)
      .where(and(eq(adCreativeIdeas.ownerId, ownerId), eq(adCreativeIdeas.accountId, accountId), gt(adCreativeIdeas.createdAt, new Date(Date.now() - 60 * 86400000))))
      .orderBy(desc(adCreativeIdeas.createdAt))
      .limit(30),
    latestResearchForPack(ownerId, accountId).catch(() => null),
  ]);
  const refs = rows.flatMap((r) =>
    (r.projectIds ?? []).map((pid, i) => (pid ? { pid, set: r, idea: ((r.ideas as CreativeIdea[]) ?? [])[i] } : null)).filter((x): x is { pid: string; set: Row; idea: CreativeIdea } => Boolean(x))
  );
  const ids = refs.map((r) => r.pid);
  const [projects, edits] = ids.length
    ? await Promise.all([
        db.select({ id: creativeProjects.id, title: creativeProjects.title, status: creativeProjects.status }).from(creativeProjects).where(and(inArray(creativeProjects.id, ids), eq(creativeProjects.ownerId, ownerId))),
        db.select({ projectId: creativeEdits.projectId }).from(creativeEdits).where(and(inArray(creativeEdits.projectId, ids), eq(creativeEdits.status, "done"))),
      ])
    : [[], []];
  const byId = new Map(projects.map((p) => [p.id, p]));
  const done = new Set(edits.map((e) => e.projectId));
  const stageOf = (id: string, status: string): DeckStage =>
    done.has(id) ? "ready" : status === "clips_ready" ? "clips" : status === "rendering" || status === "approved" ? "rendering" : status === "scripted" ? "script" : "starting";
  const items: DeckItem[] = refs
    .filter((r) => byId.has(r.pid))
    .map((r) => {
      const p = byId.get(r.pid)!;
      return { projectId: r.pid, setId: r.set.id, title: p.title || r.idea?.title || "Untitled video", typeLabel: r.idea?.typeLabel ?? "", stage: stageOf(r.pid, p.status), createdAt: r.set.createdAt.toISOString(), liveAt: r.set.live?.[r.pid] ?? null };
    });
  const order: Record<DeckStage, number> = { ready: 0, clips: 1, rendering: 2, script: 3, starting: 4 };
  return {
    latest: rows[0] ? viewOf(rows[0]) : null,
    deck: items.filter((i) => !i.liveAt).sort((a, b) => order[a.stage] - order[b.stage] || b.createdAt.localeCompare(a.createdAt)),
    live: items.filter((i) => i.liveAt).sort((a, b) => (b.liveAt ?? "").localeCompare(a.liveAt ?? "")).slice(0, 10),
    hasResearch: Boolean(research),
  };
}
