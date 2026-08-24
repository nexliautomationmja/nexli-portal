import type { Metadata } from "next";
import { ContractAnalyzerClient } from "./contract-analyzer-client";

export const metadata: Metadata = {
  title: "Contract Analyzer | Nexli Portal",
};

export default function ContractAnalyzerPage() {
  return <ContractAnalyzerClient />;
}
