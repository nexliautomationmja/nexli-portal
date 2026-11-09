import type { Metadata } from "next";
import { PhotoAdsStudio } from "@/components/creative-studio/photo-ads-studio";
import { studioForPage, studioProps } from "../studio";

export const metadata: Metadata = { title: "Photo ads | Creative Studio | Nexli Portal" };

export default async function StudioPhotoAdsPage({ params }: { params: Promise<{ studio: string }> }) {
  const studio = await studioForPage(params);
  return <PhotoAdsStudio studio={studioProps(studio)} />;
}
