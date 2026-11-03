import type { Metadata } from "next";
import { StudioProject } from "@/components/creative-studio/studio-project";

export const metadata: Metadata = { title: "Creative Studio | Nexli Portal" };

export default async function CreativeStudioProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <StudioProject projectId={projectId} />;
}
