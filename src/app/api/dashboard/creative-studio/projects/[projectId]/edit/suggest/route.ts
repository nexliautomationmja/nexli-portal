import { NextRequest, NextResponse } from "next/server";
import { loadProject, notFound, requireStudioAdmin } from "@/lib/creative-studio/access";
import { clipsOf } from "@/lib/creative-studio/service";
import { claudeError } from "@/lib/creative-studio/script";
import { suggestText } from "@/lib/creative-studio/edit";
import { latestEdit } from "@/lib/creative-studio/edit-service";
import { getText, parseTarget, sameTarget, slotBrief, textLimit, windowOf, type TextTarget } from "@/lib/creative-studio/edit-text";

export const maxDuration = 60;

type Ctx = { params: Promise<{ projectId: string }> };

/**
 * Claude's versions of what the user typed for one piece of on-screen text.
 * POST { target, text } → { options: string[], aboutYours: string }. Nothing
 * is saved until the user picks one (edit/text).
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const project = await loadProject(access.ownerId, (await params).projectId);
  if (!project) return notFound();
  const body = (await req.json().catch(() => null)) as { target?: unknown; text?: unknown } | null;
  const target = parseTarget(body?.target);
  const typed = typeof body?.text === "string" ? body.text.replace(/\s+/g, " ").trim().slice(0, 300) : "";
  if (!target || !typed) return NextResponse.json({ error: "Type something first" }, { status: 400 });
  const edit = await latestEdit(project.id);
  if (!edit) return NextResponse.json({ error: "Pick a style first" }, { status: 400 });
  const o = edit.props.overlays;

  // The rest of what's on screen, so the versions don't clash with it.
  const others: { label: string; t: TextTarget }[] = [
    { label: "Title", t: { slot: "title" } },
    { label: "Qualifier", t: { slot: "qualifier" } },
    { label: "CTA", t: { slot: "cta" } },
    ...o.stickers.map((_, i) => ({ label: `Sticker ${i + 1}`, t: { slot: "sticker", index: i } as TextTarget })),
    ...o.cards.map((_, i) => ({ label: `Card ${i + 1}`, t: { slot: "card", index: i, field: "text" } as TextTarget })),
  ];
  const onScreen = others
    .filter((x) => !sameTarget(x.t, target))
    .map((x) => {
      const v = getText(o, x.t);
      return v ? `${x.label}: ${v}` : "";
    })
    .filter(Boolean);

  try {
    const clips = await clipsOf(project.id);
    const result = await suggestText({
      slot: slotBrief(target),
      limit: textLimit(target),
      typed,
      window: windowOf(o, target),
      words: edit.props.words,
      onScreen,
      direction: project.brief?.direction ?? "",
      script: clips.map((c) => c.line),
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[creative-studio] text suggestions failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: claudeError(err, "Getting versions failed") }, { status: 500 });
  }
}
