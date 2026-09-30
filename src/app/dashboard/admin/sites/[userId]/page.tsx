import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { SiteEditorClient } from "./site-editor-client";

export const dynamic = "force-dynamic";

export default async function AdminSiteEditorPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    redirect("/dashboard");
  }
  const { userId } = await params;
  return <SiteEditorClient userId={userId} />;
}
