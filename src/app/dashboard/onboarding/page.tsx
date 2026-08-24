import type { Metadata } from "next";
import { OnboardingDashboardClient } from "./onboarding-client";

export const metadata: Metadata = {
  title: "Onboarding | Nexli Portal",
};

export default function OnboardingDashboardPage() {
  return <OnboardingDashboardClient />;
}
