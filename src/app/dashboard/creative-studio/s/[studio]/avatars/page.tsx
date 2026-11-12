import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AvatarLibrary } from "@/components/creative-studio/avatar-library";
import { studioForPage, studioProps } from "../studio";

export const metadata: Metadata = { title: "Avatars | Creative Studio | Nexli Portal" };

/** The AI avatar library — made in Nexli's studio, then each avatar is given to one firm. */
export default async function StudioAvatarsPage({ params }: { params: Promise<{ studio: string }> }) {
  const studio = await studioForPage(params);
  if (studio.kind !== "nexli") redirect("/dashboard/creative-studio/s/nexli/avatars");
  return <AvatarLibrary studio={studioProps(studio)} />;
}
