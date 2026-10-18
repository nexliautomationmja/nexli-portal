"use client";

import { useForceDark } from "@/components/launch-pad";

export default function SurveyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The pulse check shares the Launch Pad's dark-first brand shell.
  useForceDark();

  return <>{children}</>;
}
