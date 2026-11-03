import type { Metadata } from "next";
import { BatchBoard } from "@/components/creative-studio/batch-board";

export const metadata: Metadata = { title: "Batch | Creative Studio | Nexli Portal" };

export default async function CreativeStudioBatchPage({ params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params;
  return <BatchBoard batchId={batchId} />;
}
