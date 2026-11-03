import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { creativeAssets } from "@/lib/creative-studio/tables";
import { loadProject, notFound, requireStudioAdmin } from "@/lib/creative-studio/access";
import { projectDetail } from "@/lib/creative-studio/service";

type Ctx = { params: Promise<{ projectId: string }> };

/** Undo the last ad copy change: drop the newest version. */
export async function POST(_req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const project = await loadProject(access.ownerId, (await params).projectId);
  if (!project) return notFound();
  const rows = await db
    .select({ id: creativeAssets.id })
    .from(creativeAssets)
    .where(and(eq(creativeAssets.projectId, project.id), eq(creativeAssets.kind, "ad_copy")))
    .orderBy(desc(creativeAssets.sort))
    .limit(2);
  if (rows.length < 2) return NextResponse.json({ error: "Nothing to undo" }, { status: 400 });
  await db.delete(creativeAssets).where(eq(creativeAssets.id, rows[0].id));
  return NextResponse.json(await projectDetail(project));
}
