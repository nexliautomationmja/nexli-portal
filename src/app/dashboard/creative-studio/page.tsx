import type { Metadata } from "next";
import { StudioPicker } from "@/components/creative-studio/studio-picker";

export const metadata: Metadata = { title: "Creative Studio | Nexli Portal" };

/** Clicking Creative Studio asks which studio: Nexli's own, or a client firm's. */
export default async function CreativeStudioPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const { edit } = await searchParams;
  return <StudioPicker editKey={typeof edit === "string" ? edit : undefined} />;
}
