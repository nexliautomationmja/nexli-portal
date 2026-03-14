"use client";

import { cn } from "@/lib/utils";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "compact" | "elevated";
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
        variant === "default" && "p-5",
        variant === "compact" && "p-4",
        variant === "elevated" && "p-5",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
