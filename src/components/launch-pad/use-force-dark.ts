import { useEffect } from "react";

/**
 * Client-facing pages (Launch Pad, pulse check) are dark-first like the rest
 * of the Nexli brand — force `.dark` on <html> regardless of the dashboard
 * theme preference, and put it back the way it was on unmount.
 */
export function useForceDark() {
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
}
