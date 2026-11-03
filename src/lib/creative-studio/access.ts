import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { creativeProjects, ensureCreativeStudioTables } from "@/lib/creative-studio/tables";

/** Creative Studio is admin-only (Marcel and team members). */
export async function requireStudioAdmin(): Promise<
  { ok: true; ownerId: string; actorId: string } | { ok: false; response: NextResponse }
> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (session.user.role !== "admin") {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  await ensureCreativeStudioTables();
  return { ok: true, ownerId: session.user.id, actorId: session.user.memberId ?? session.user.id };
}

/** The project if it belongs to this workspace, else null. */
export async function loadProject(ownerId: string, projectId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(projectId)) return null;
  const [project] = await db
    .select()
    .from(creativeProjects)
    .where(and(eq(creativeProjects.id, projectId), eq(creativeProjects.ownerId, ownerId)))
    .limit(1);
  return project ?? null;
}

export const notFound = () => NextResponse.json({ error: "Project not found" }, { status: 404 });
