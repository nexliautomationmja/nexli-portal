import type { Metadata } from "next";
import { StudioProjectList } from "@/components/creative-studio/project-list";

export const metadata: Metadata = { title: "Creative Studio | Nexli Portal" };

export default function CreativeStudioPage() {
  return <StudioProjectList />;
}
