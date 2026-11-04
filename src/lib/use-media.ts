"use client";

import { useSyncExternalStore } from "react";

/** Subscribe to a CSS media query (false during server render). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false
  );
}

/** Touch-first device (no hover or a coarse pointer): phones and tablets. */
export function useIsTouch(): boolean {
  return useMediaQuery("(hover: none), (pointer: coarse)");
}
