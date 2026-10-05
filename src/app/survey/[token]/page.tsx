import type { Metadata } from "next";
import { SurveyClient } from "./survey-client";

export const metadata: Metadata = {
  title: "Weekly Pulse Check | Nexli",
  robots: { index: false, follow: false },
};

export default async function SurveyPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ s?: string }>;
}) {
  const { token } = await params;
  const { s } = await searchParams;
  const preset = Number(s);
  const initialScore = Number.isInteger(preset) && preset >= 1 && preset <= 5 ? preset : null;

  return <SurveyClient token={token} initialScore={initialScore} />;
}
