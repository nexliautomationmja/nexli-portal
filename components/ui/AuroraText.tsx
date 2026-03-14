'use client';
"use client";

import { cn } from "../../lib/utils";

interface AuroraTextProps {
  children: React.ReactNode;
  className?: string;
}

export function AuroraText({ children, className }: AuroraTextProps) {
  return (
    <span className={cn("relative inline-block", className)}>
      <span
        className="animate-aurora bg-gradient-to-r from-[#2563EB] via-[#06B6D4] to-[#2563EB] bg-[length:200%_auto] bg-clip-text text-transparent"
      >
        {children}
      </span>
    </span>
  );
}

export default AuroraText;
