"use client";

import { useForceDark } from "@/components/launch-pad";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The Launch Pad is dark-first like the rest of the Nexli brand —
  // force dark regardless of the dashboard theme preference.
  useForceDark();

  return <>{children}</>;
}
