import type { Metadata } from "next";
import { HookTester } from "@/components/creative-studio/hook-tester";
import { studioForPage, studioProps } from "../studio";

export const metadata: Metadata = { title: "Hook Tester | Creative Studio | Nexli Portal" };

export default async function StudioHookTesterPage({ params }: { params: Promise<{ studio: string }> }) {
  const studio = await studioForPage(params);
  return <HookTester studio={studioProps(studio)} />;
}
