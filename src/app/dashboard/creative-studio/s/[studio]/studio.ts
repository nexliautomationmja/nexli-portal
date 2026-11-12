import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ensureCreativeStudioTables } from "@/lib/creative-studio/tables";
import { resolveStudio, studioAvatar, type Studio } from "@/lib/creative-studio/studios";

/** The studio in the URL (this workspace's), or back to the picker. */
export async function studioForPage(params: Promise<{ studio: string }>): Promise<Studio & { avatar: { id: string; name: string } | null }> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") redirect("/dashboard");
  await ensureCreativeStudioTables();
  const studio = await resolveStudio(session.user.id, decodeURIComponent((await params).studio));
  if (!studio) redirect("/dashboard/creative-studio");
  return { ...studio, avatar: await studioAvatar(session.user.id, studio) };
}

/** What the browser components get: where you are, whether Manus can make frames here, and the firm's AI avatar. */
export function studioProps(studio: Studio & { avatar?: { id: string; name: string } | null }) {
  return {
    key: studio.key,
    kind: studio.kind,
    name: studio.name,
    hasAbout: Boolean(studio.about?.trim()),
    archived: studio.archived,
    ...(studio.avatar ? { avatar: studio.avatar } : {}),
  };
}
