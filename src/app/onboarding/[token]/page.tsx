import type { Metadata } from "next";
import { OnboardingClient } from "./onboarding-client";

export const metadata: Metadata = {
  title: "Your Launch Pad | Nexli Portal",
};

export default async function OnboardingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <OnboardingClient token={token} />;
}
