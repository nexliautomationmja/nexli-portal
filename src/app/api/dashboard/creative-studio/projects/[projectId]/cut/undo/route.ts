import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { creativeCuts } from "@/lib/creative-studio/tables";
import { loadProject, notFound, requireStudioAdmin } from "@/lib/creative-studio/access";
import { projectDetail } from "@/lib/creative-studio/service";
import { latestCut } from "@/lib/creative-studio/autocut-service";

type Ctx = { params: Promise<{ projectId: string }> };

/** Undo the last cut change: drop the newest version (its pieces stay cached). */
export async function POST(_req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const project = await loadProject(access.ownerId, (await params).projectId);
  if (!project) return notFound();
  const cut = await latestCut(project.id);
  if (!cut || cut.version <= 1) return NextResponse.json({ error: "Nothing to undo" }, { status: 400 });
  if (cut.status === "approved") return NextResponse.json({ error: "That cut is approved" }, { status: 400 });
  await db.delete(creativeCuts).where(eq(creativeCuts.id, cut.id));
  return NextResponse.json(await projectDetail(project));
}
