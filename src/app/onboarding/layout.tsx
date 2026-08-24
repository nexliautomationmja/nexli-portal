"use client";

import { useEffect } from "react";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The Launch Pad is dark-first like the rest of the Nexli brand —
  // force dark regardless of the dashboard theme preference.
  useEffect(() => {
    const hadDark = document.documentElement.classList.contains("dark");
    document.documentElement.classList.add("dark");
    return () => {
      const stored = localStorage.getItem("nexli-dashboard-theme");
      if (stored === "light" && !hadDark) {
        document.documentElement.classList.remove("dark");
      }
    };
  }, []);

  return <>{children}</>;
}
