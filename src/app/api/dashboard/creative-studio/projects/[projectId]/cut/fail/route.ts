import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { creativeCuts } from "@/lib/creative-studio/tables";
import { loadProject, notFound, requireStudioAdmin } from "@/lib/creative-studio/access";
import { projectDetail } from "@/lib/creative-studio/service";

type Ctx = { params: Promise<{ projectId: string }> };

/**
 * The page gave up on a cut (a clip kept failing after retries): mark it
 * failed so the card shows the reason and "Try again" instead of a progress
 * bar nobody is driving. Pieces already cut stay cached for the retry.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const project = await loadProject(access.ownerId, (await params).projectId);
  if (!project) return notFound();
  const body = (await req.json().catch(() => null)) as { cutId?: string; error?: string } | null;
  if (!body?.cutId || !/^[0-9a-f-]{36}$/i.test(body.cutId)) return NextResponse.json({ error: "Cut not found" }, { status: 404 });
  await db
    .update(creativeCuts)
    .set({ status: "failed", error: (body.error || "The cut didn't finish.").slice(0, 500) })
    .where(and(eq(creativeCuts.id, body.cutId), eq(creativeCuts.projectId, project.id), eq(creativeCuts.status, "cutting")));
  return NextResponse.json(await projectDetail(project));
}
