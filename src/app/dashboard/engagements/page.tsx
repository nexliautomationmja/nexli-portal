import type { Metadata } from "next";
import { EngagementsClient } from "./engagements-client";

export const metadata: Metadata = {
  title: "Engagements | Nexli Portal",
};

export default function EngagementsPage() {
  return <EngagementsClient />;
}
