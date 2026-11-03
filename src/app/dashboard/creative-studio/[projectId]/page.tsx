import type { Metadata } from "next";
import { StudioFlow } from "@/components/creative-studio/flow";

export const metadata: Metadata = { title: "Creative Studio | Nexli Portal" };

export default async function CreativeStudioProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <StudioFlow projectId={projectId} />;
}
