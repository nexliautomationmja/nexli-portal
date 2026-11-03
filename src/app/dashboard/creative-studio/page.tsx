import type { Metadata } from "next";
import { StudioHome } from "@/components/creative-studio/home";

export const metadata: Metadata = { title: "Creative Studio | Nexli Portal" };

export default function CreativeStudioPage() {
  return <StudioHome />;
}
