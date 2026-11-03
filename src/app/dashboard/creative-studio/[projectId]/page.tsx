import type { Metadata } from "next";
import { StudioThread } from "@/components/creative-studio/thread";

export const metadata: Metadata = { title: "Creative Studio | Nexli Portal" };

export default async function CreativeStudioProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <StudioThread projectId={projectId} />;
}
