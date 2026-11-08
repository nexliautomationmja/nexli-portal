import type { Metadata } from "next";
import { StudioHome } from "@/components/creative-studio/home";
import { studioForPage, studioProps } from "./studio";

export const metadata: Metadata = { title: "Creative Studio | Nexli Portal" };

export default async function StudioHomePage({ params }: { params: Promise<{ studio: string }> }) {
  const studio = await studioForPage(params);
  return <StudioHome studio={studioProps(studio)} />;
}
