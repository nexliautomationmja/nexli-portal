import type { Metadata } from "next";
import { PipelineClient } from "./pipeline-client";

export const metadata: Metadata = {
  title: "Pipeline | Nexli Portal",
};

export default function PipelinePage() {
  return <PipelineClient />;
}
