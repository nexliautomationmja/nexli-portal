import type { Metadata } from "next";
import { HookTest } from "@/components/creative-studio/hook-test";
import { studioForPage, studioProps } from "../../studio";

export const metadata: Metadata = { title: "Hook test | Creative Studio | Nexli Portal" };

export default async function StudioHookTestPage({ params }: { params: Promise<{ studio: string; testId: string }> }) {
  const p = await params;
  const studio = await studioForPage(Promise.resolve({ studio: p.studio }));
  return <HookTest studio={studioProps(studio)} testId={p.testId} />;
}
