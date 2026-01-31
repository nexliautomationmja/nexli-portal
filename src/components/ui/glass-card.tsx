"use client";

import { cn } from "@/lib/utils";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "compact";
}

export function GlassCard({
  className,
  variant = "default",
  children,
  ...props
}: GlassCardProps) {
  return (
    <div
      className={cn(
        "glass-card",
        variant === "default"
          ? "p-5 md:p-8 rounded-2xl md:rounded-[2rem]"
          : "p-4 md:p-5 rounded-xl md:rounded-2xl",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
