import type { Metadata } from "next";
import { AdCopyStudio } from "@/components/creative-studio/ad-copy-studio";

export const metadata: Metadata = { title: "Ad copy | Creative Studio | Nexli Portal" };

export default function CreativeStudioAdCopyPage() {
  return <AdCopyStudio />;
}
