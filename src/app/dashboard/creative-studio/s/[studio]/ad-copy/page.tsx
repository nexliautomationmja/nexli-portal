import type { Metadata } from "next";
import { AdCopyStudio } from "@/components/creative-studio/ad-copy-studio";
import { studioForPage, studioProps } from "../studio";

export const metadata: Metadata = { title: "Ad copy | Creative Studio | Nexli Portal" };

export default async function StudioAdCopyPage({ params }: { params: Promise<{ studio: string }> }) {
  const studio = await studioForPage(params);
  return <AdCopyStudio studio={studioProps(studio)} />;
}
