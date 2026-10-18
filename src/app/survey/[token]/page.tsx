import type { Metadata } from "next";
import type { SurveyAnswers } from "@/lib/survey-questions";
import { SurveyClient } from "./survey-client";

export const metadata: Metadata = {
  title: "Pulse Check | Nexli",
  robots: { index: false, follow: false },
};

function parseScale(raw: string | undefined): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
}

export default async function SurveyPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ overall?: string; s?: string }>;
}) {
  const { token } = await params;
  const { overall, s } = await searchParams;

  // The Monday email's 1–5 buttons pre-fill Q1 (`?overall=`); `?s=` is the
  // legacy single-score link and maps to the same question.
  const preset = parseScale(overall) ?? parseScale(s);
  const initialAnswers: Partial<SurveyAnswers> = preset != null ? { overall: preset } : {};

  return <SurveyClient token={token} initialAnswers={initialAnswers} />;
}
