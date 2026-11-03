import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { creativeAssets } from "@/lib/creative-studio/tables";
import { loadProject, notFound, requireStudioAdmin } from "@/lib/creative-studio/access";
import { projectDetail } from "@/lib/creative-studio/service";
import { readStorage, setOpeningFrame } from "@/lib/creative-studio/frames";

export const maxDuration = 60;

type Ctx = { params: Promise<{ projectId: string }> };

/** Use a Manus option or a Daniela reference as the opening frame (cropped to 9:16 for ads). */
export async function POST(req: NextRequest, { params }: Ctx) {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  const project = await loadProject(access.ownerId, (await params).projectId);
  if (!project) return notFound();
  const body = (await req.json().catch(() => null)) as { assetId?: string } | null;
  const id = typeof body?.assetId === "string" ? body.assetId : "";

  const [asset] = await db
    .select()
    .from(creativeAssets)
    .where(
      and(
        eq(creativeAssets.id, id),
        or(
          and(eq(creativeAssets.projectId, project.id), eq(creativeAssets.kind, "frame_option")),
          and(isNull(creativeAssets.projectId), eq(creativeAssets.ownerId, access.ownerId), eq(creativeAssets.kind, "reference"))
        )
      )
    )
    .limit(1);
  if (!asset?.storagePath) return NextResponse.json({ error: "Image not found" }, { status: 404 });

  try {
    await setOpeningFrame(project, await readStorage(asset.storagePath), asset.source === "manus" ? "manus" : "reference", {
      fromAssetId: asset.id,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't use that image" }, { status: 500 });
  }
  const fresh = await loadProject(access.ownerId, project.id);
  return NextResponse.json(await projectDetail(fresh!));
}
