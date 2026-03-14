"use client";

import { useEffect } from "react";

export default function EngageLayout({ children }: { children: React.ReactNode }) {
  // Force light mode on public engage pages regardless of dashboard theme
  useEffect(() => {
    document.documentElement.classList.remove("dark");
    return () => {
      // Restore dark if user navigates back to dashboard
      const stored = localStorage.getItem("nexli-dashboard-theme");
      if (!stored || stored === "dark") {
        document.documentElement.classList.add("dark");
      }
    };
  }, []);

  return <>{children}</>;
}
