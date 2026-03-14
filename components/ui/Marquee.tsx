'use client';
"use client";

import React from "react";
import { motion } from "framer-motion";
import { cn } from "../../lib/utils";

interface MarqueeProps {
  className?: string;
  reverse?: boolean;
  pauseOnHover?: boolean;
  children?: React.ReactNode;
  vertical?: boolean;
  repeat?: number;
  duration?: number;
  gap?: number;
}

export function Marquee({
  className,
  reverse = false,
  pauseOnHover = false,
  children,
  vertical = false,
  repeat = 4,
  duration = 40,
  gap = 16,
}: MarqueeProps) {
  return (
    <div
      className={cn(
        "group flex overflow-hidden",
        vertical ? "flex-col" : "flex-row",
        className
      )}
      style={{ gap: `${gap}px` }}
    >
      {Array(repeat)
        .fill(0)
        .map((_, i) => (
          <motion.div
            key={i}
            className={cn(
              "flex shrink-0",
              vertical ? "flex-col" : "flex-row"
            )}
            style={{ gap: `${gap}px` }}
            initial={{ x: vertical ? 0 : "0%", y: vertical ? "0%" : 0 }}
            animate={{
              x: vertical ? 0 : (reverse ? "100%" : "-100%"),
              y: vertical ? (reverse ? "100%" : "-100%") : 0
            }}
            transition={{
              duration: duration,
              ease: "linear",
              repeat: Infinity,
            }}
            whileHover={pauseOnHover ? { animationPlayState: "paused" } : undefined}
          >
            {children}
          </motion.div>
        ))}
    </div>
  );
}

export default Marquee;
